#!/usr/bin/env python3

from __future__ import annotations

import argparse
import collections
import dataclasses
import json
import os
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


RESTART_BUDGET_ATTEMPTS = 3
RESTART_BUDGET_WINDOW_SECONDS = 60
SLOW_RETRY_SECONDS = 30
FAST_RETRY_DELAYS = (1, 2, 4)
HEALTH_TIMEOUT_SECONDS = 2


@dataclasses.dataclass
class ServiceState:
    name: str
    pid_file: Path
    log_file: Path
    failure_times: collections.deque[float] = dataclasses.field(
        default_factory=collections.deque
    )
    consecutive_failures: int = 0
    next_retry_at: float = 0.0
    last_error: str | None = None
    status: str = "healthy"

    def pid(self) -> int | None:
        if not self.pid_file.exists():
            return None
        raw = self.pid_file.read_text(encoding="utf-8").strip()
        if raw == "":
            return None
        try:
            return int(raw)
        except ValueError:
            return None

    def write_pid(self, pid: int) -> None:
        self.pid_file.write_text(str(pid), encoding="utf-8")

    def clear_pid(self) -> None:
        try:
            self.pid_file.unlink()
        except FileNotFoundError:
            pass


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def is_running(pid: int | None) -> bool:
    if pid is None:
        return False
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True


def terminate_pid(pid: int | None) -> None:
    if pid is None:
        return
    try:
        os.kill(pid, signal.SIGTERM)
    except OSError:
        return


def check_backend_health(host: str, port: int) -> tuple[bool, str]:
    url = f"http://{host}:{port}/health"
    request = urllib.request.Request(url=url, method="GET")
    try:
        with urllib.request.urlopen(request, timeout=HEALTH_TIMEOUT_SECONDS) as response:
            if response.status != 200:
                return False, f"health returned HTTP {response.status}"
            payload = json.loads(response.read().decode("utf-8"))
    except TimeoutError:
        return False, "health timeout"
    except urllib.error.URLError as error:
        return False, f"health request failed: {error.reason}"
    except json.JSONDecodeError:
        return False, "health payload was not JSON"

    if payload.get("ok") is not True:
        return False, "health payload did not include ok=true"
    return True, "healthy"


def check_web_health(host: str, port: int) -> tuple[bool, str]:
    url = f"http://{host}:{port}/"
    request = urllib.request.Request(url=url, method="GET")
    try:
        with urllib.request.urlopen(request, timeout=HEALTH_TIMEOUT_SECONDS) as response:
            if response.status != 200:
                return False, f"web returned HTTP {response.status}"
    except TimeoutError:
        return False, "web timeout"
    except urllib.error.URLError as error:
        return False, f"web request failed: {error.reason}"
    return True, "healthy"


def current_release(current_link: Path) -> Path | None:
    if not current_link.exists():
        return None
    try:
        return current_link.resolve(strict=True)
    except FileNotFoundError:
        return None


def mark_failure(service: ServiceState, reason: str) -> None:
    now = time.time()
    service.last_error = reason
    service.consecutive_failures += 1
    service.failure_times.append(now)
    while service.failure_times and now - service.failure_times[0] > RESTART_BUDGET_WINDOW_SECONDS:
        service.failure_times.popleft()

    if len(service.failure_times) >= RESTART_BUDGET_ATTEMPTS:
        service.status = "degraded"
        service.next_retry_at = now + SLOW_RETRY_SECONDS
        return

    delay_index = min(service.consecutive_failures - 1, len(FAST_RETRY_DELAYS) - 1)
    service.status = "recovering"
    service.next_retry_at = now + FAST_RETRY_DELAYS[delay_index]


def mark_healthy(service: ServiceState) -> None:
    service.status = "healthy"
    service.consecutive_failures = 0
    service.next_retry_at = 0.0


def start_backend(
    service: ServiceState,
    release_path: Path,
    data_root: Path,
    host: str,
    port: int,
) -> tuple[bool, str]:
    binary = release_path / "bin" / "service-bin"
    if not binary.exists():
        return False, f"missing backend binary: {binary}"
    env = os.environ.copy()
    env["XDG_DATA_HOME"] = str(data_root)
    env["CONDUIT_LOG_PROFILE"] = "stage"
    env["CONDUIT_FRONTEND_LOG_PATH"] = str(service.log_file.with_name("frontend.log"))
    with service.log_file.open("a", encoding="utf-8") as log_stream:
        process = subprocess.Popen(
            [str(binary), "serve", "--host", host, "--port", str(port)],
            env=env,
            stdin=subprocess.DEVNULL,
            stdout=log_stream,
            stderr=log_stream,
            start_new_session=True,
        )
    service.write_pid(process.pid)
    return True, f"started backend pid={process.pid}"


def start_web(
    service: ServiceState,
    release_path: Path,
    static_server: Path,
    host: str,
    port: int,
) -> tuple[bool, str]:
    web_dir = release_path / "web"
    if not web_dir.exists():
        return False, f"missing web directory: {web_dir}"
    with service.log_file.open("a", encoding="utf-8") as log_stream:
        process = subprocess.Popen(
            [
                sys.executable,
                str(static_server),
                "--host",
                host,
                "--port",
                str(port),
                "--directory",
                str(web_dir),
            ],
            stdin=subprocess.DEVNULL,
            stdout=log_stream,
            stderr=log_stream,
            start_new_session=True,
        )
    service.write_pid(process.pid)
    return True, f"started web pid={process.pid}"


def write_status(
    status_file: Path,
    backend: ServiceState,
    web: ServiceState,
    backend_health: tuple[bool, str],
    web_health: tuple[bool, str],
) -> None:
    states = [backend.status, web.status]
    if "degraded" in states:
        state = "degraded"
    elif "recovering" in states:
        state = "recovering"
    else:
        state = "healthy"

    def serialize_service(
        service: ServiceState,
        health: tuple[bool, str],
    ) -> dict[str, object]:
        next_retry_seconds: int | None = None
        if service.next_retry_at > time.time():
            next_retry_seconds = max(0, int(service.next_retry_at - time.time()))
        return {
            "status": service.status,
            "pid": service.pid(),
            "healthy": health[0],
            "healthMessage": health[1],
            "lastError": service.last_error,
            "nextRetrySeconds": next_retry_seconds,
            "restartsLast60s": len(service.failure_times),
        }

    payload = {
        "updatedAt": utc_now(),
        "state": state,
        "services": {
            "backend": serialize_service(backend, backend_health),
            "web": serialize_service(web, web_health),
        },
    }
    status_file.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Conduit stage watchdog")
    parser.add_argument("--backend-host", required=True)
    parser.add_argument("--backend-port", type=int, required=True)
    parser.add_argument("--current-link", required=True)
    parser.add_argument("--data-root", required=True)
    parser.add_argument("--log-dir", required=True)
    parser.add_argument("--pid-dir", required=True)
    parser.add_argument("--poll-interval", type=int, default=5)
    parser.add_argument("--status-file", required=True)
    parser.add_argument("--web-host", required=True)
    parser.add_argument("--web-port", type=int, required=True)
    parser.add_argument("--static-server", required=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    current_link = Path(args.current_link)
    data_root = Path(args.data_root)
    log_dir = Path(args.log_dir)
    pid_dir = Path(args.pid_dir)
    status_file = Path(args.status_file)
    static_server = Path(args.static_server)

    pid_dir.mkdir(parents=True, exist_ok=True)
    log_dir.mkdir(parents=True, exist_ok=True)
    status_file.parent.mkdir(parents=True, exist_ok=True)

    backend = ServiceState(
        name="backend",
        pid_file=pid_dir / "backend.pid",
        log_file=log_dir / "backend.log",
    )
    web = ServiceState(
        name="web",
        pid_file=pid_dir / "web.pid",
        log_file=log_dir / "web.log",
    )

    running = True

    def stop_handler(_signum: int, _frame: object) -> None:
        nonlocal running
        running = False

    signal.signal(signal.SIGTERM, stop_handler)
    signal.signal(signal.SIGINT, stop_handler)

    while running:
        release_path = current_release(current_link)
        backend_health = (False, "backend unavailable")
        web_health = (False, "web unavailable")

        if release_path is None:
            mark_failure(backend, "current release link is missing")
            mark_failure(web, "current release link is missing")
            write_status(status_file, backend, web, backend_health, web_health)
            time.sleep(args.poll_interval)
            continue

        for service in (backend, web):
            pid = service.pid()
            if pid is not None and not is_running(pid):
                service.clear_pid()
                mark_failure(service, f"{service.name} process exited")

        backend_pid = backend.pid()
        web_pid = web.pid()

        if backend_pid is not None and is_running(backend_pid):
            backend_health = check_backend_health(args.backend_host, args.backend_port)
            if backend_health[0]:
                mark_healthy(backend)
            else:
                terminate_pid(backend_pid)
                backend.clear_pid()
                mark_failure(backend, backend_health[1])

        if web_pid is not None and is_running(web_pid):
            web_health = check_web_health(args.web_host, args.web_port)
            if web_health[0]:
                mark_healthy(web)
            else:
                terminate_pid(web_pid)
                web.clear_pid()
                mark_failure(web, web_health[1])

        now = time.time()
        if backend.pid() is None and now >= backend.next_retry_at:
            started, message = start_backend(
                backend,
                release_path,
                data_root,
                args.backend_host,
                args.backend_port,
            )
            if not started:
                mark_failure(backend, message)
            else:
                backend.last_error = None

        if web.pid() is None and now >= web.next_retry_at:
            started, message = start_web(
                web,
                release_path,
                static_server,
                args.web_host,
                args.web_port,
            )
            if not started:
                mark_failure(web, message)
            else:
                web.last_error = None

        backend_health = (
            check_backend_health(args.backend_host, args.backend_port)
            if backend.pid() is not None and is_running(backend.pid())
            else (False, "backend unavailable")
        )
        web_health = (
            check_web_health(args.web_host, args.web_port)
            if web.pid() is not None and is_running(web.pid())
            else (False, "web unavailable")
        )
        if backend_health[0]:
            mark_healthy(backend)
        if web_health[0]:
            mark_healthy(web)

        write_status(status_file, backend, web, backend_health, web_health)
        time.sleep(args.poll_interval)

    terminate_pid(backend.pid())
    terminate_pid(web.pid())
    backend.clear_pid()
    web.clear_pid()


if __name__ == "__main__":
    main()
