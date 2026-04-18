//! End-to-end coverage for daemon identity persistence and pairing offers.

use acp_core as _;
use acp_discovery as _;
use agent_client_protocol_schema as _;
use axum as _;
use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use directories as _;
use futures_util as _;
use rand_core as _;
use remote_access as _;
use serde as _;
use serde_json::Value;
use service_runtime as _;
use session_store as _;
use std::error::Error;
use std::fs;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use thiserror as _;
use time as _;
use tokio as _;
use tokio_tungstenite as _;
use tower_http as _;
use tracing as _;
use tracing_subscriber as _;
use x25519_dalek as _;

type TestResult<T> = std::result::Result<T, Box<dyn Error>>;

const RELAY_ENDPOINT: &str = "relay.example.test:443";
const APP_BASE_URL: &str = "https://expo.test/app";

#[test]
fn cli_pairing_offer_is_stable_and_minimal() -> TestResult<()> {
    let home = test_home("cli-stable")?;
    let first = run_pair(&home)?;
    let second = run_pair(&home)?;
    cleanup(&home);

    let first_offer = offer(&first)?;
    let second_offer = offer(&second)?;
    if field(first_offer, "serverId") != field(second_offer, "serverId") {
        return Err("serverId changed across pair invocations".into());
    }
    if field(first_offer, "daemonPublicKeyB64") != field(second_offer, "daemonPublicKeyB64") {
        return Err("daemon public key changed across pair invocations".into());
    }
    if relay_field(first_offer, "serverId") != relay_field(second_offer, "serverId") {
        return Err("relay serverId changed across pair invocations".into());
    }
    assert_offer_minimal(&first)
}

#[test]
fn cli_pairing_offer_changes_for_new_home() -> TestResult<()> {
    let first_home = test_home("cli-first")?;
    let second_home = test_home("cli-second")?;
    let first = run_pair(&first_home)?;
    let second = run_pair(&second_home)?;
    cleanup(&first_home);
    cleanup(&second_home);

    let first_offer = offer(&first)?;
    let second_offer = offer(&second)?;
    if field(first_offer, "serverId") == field(second_offer, "serverId") {
        return Err("serverId was reused across fresh homes".into());
    }
    if field(first_offer, "daemonPublicKeyB64") == field(second_offer, "daemonPublicKeyB64") {
        return Err("daemon public key was reused across fresh homes".into());
    }
    Ok(())
}

#[test]
fn cli_pairing_offer_survives_concurrent_first_creation() -> TestResult<()> {
    let home = test_home("cli-concurrent")?;
    let mut children = Vec::new();
    for _index in 0..16 {
        children.push(
            Command::new(service_bin())
                .args(["pair", "--json", "--relay-endpoint", RELAY_ENDPOINT])
                .env("CONDUIT_HOME", &home)
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()?,
        );
    }

    let mut responses = Vec::new();
    for child in children {
        let output = child.wait_with_output()?;
        if !output.status.success() {
            cleanup(&home);
            return Err(format!(
                "concurrent pair failed: {}",
                String::from_utf8_lossy(&output.stderr)
            )
            .into());
        }
        responses.push(serde_json::from_slice::<Value>(&output.stdout)?);
    }
    cleanup(&home);

    let first_offer = offer(responses.first().ok_or("missing concurrent responses")?)?;
    for response in responses.iter().skip(1) {
        let current_offer = offer(response)?;
        if field(first_offer, "serverId") != field(current_offer, "serverId") {
            return Err("concurrent pair changed serverId".into());
        }
        if field(first_offer, "daemonPublicKeyB64") != field(current_offer, "daemonPublicKeyB64") {
            return Err("concurrent pair changed public key".into());
        }
    }
    Ok(())
}

#[test]
fn cli_pairing_requires_relay_endpoint() -> TestResult<()> {
    let home = test_home("cli-no-relay")?;
    let output = Command::new(service_bin())
        .args(["pair", "--json"])
        .env("CONDUIT_HOME", &home)
        .env_remove("CONDUIT_RELAY_ENDPOINT")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()?;
    cleanup(&home);

    if !output.status.success() {
        return Ok(());
    }
    Err("pair unexpectedly succeeded without relay endpoint".into())
}

#[test]
fn serve_pairing_and_status_are_stable_and_minimal() -> TestResult<()> {
    let home = test_home("serve-stable")?;
    let port = free_port()?;
    let mut first_child = spawn_serve(&home, port, true, APP_BASE_URL)?;
    wait_for_http(port)?;
    let first_pairing = get_json(port, "/api/pairing")?;
    let first_status = get_json(port, "/api/daemon/status")?;
    stop_child(&mut first_child)?;

    let mut second_child = spawn_serve(&home, port, true, APP_BASE_URL)?;
    wait_for_http(port)?;
    let second_pairing = get_json(port, "/api/pairing")?;
    let second_status = get_json(port, "/api/daemon/status")?;
    stop_child(&mut second_child)?;
    cleanup(&home);

    if field(offer(&first_pairing)?, "serverId") != field(offer(&second_pairing)?, "serverId") {
        return Err("HTTP pairing serverId changed after restart".into());
    }
    if field(offer(&first_pairing)?, "daemonPublicKeyB64")
        != field(offer(&second_pairing)?, "daemonPublicKeyB64")
    {
        return Err("HTTP pairing public key changed after restart".into());
    }
    if relay_field(offer(&first_pairing)?, "serverId")
        != relay_field(offer(&second_pairing)?, "serverId")
    {
        return Err("HTTP relay serverId changed after restart".into());
    }
    if field(&first_status, "serverId") != field(&second_status, "serverId") {
        return Err("daemon status serverId changed after restart".into());
    }
    if first_status.get("pairingConfigured") != Some(&Value::Bool(true)) {
        return Err("daemon status did not report configured pairing".into());
    }
    if !first_pairing
        .get("url")
        .and_then(Value::as_str)
        .is_some_and(|url| url.starts_with(APP_BASE_URL))
    {
        return Err("pairing URL did not use configured app base URL".into());
    }
    assert_offer_minimal(&first_pairing)
}

#[test]
fn serve_pairing_fails_without_relay_endpoint_but_status_remains_available() -> TestResult<()> {
    let home = test_home("serve-no-relay")?;
    let port = free_port()?;
    let mut child = spawn_serve(&home, port, false, APP_BASE_URL)?;
    wait_for_http(port)?;
    let status = get_json(port, "/api/daemon/status")?;
    let pairing_response = get_raw(port, "/api/pairing")?;
    stop_child(&mut child)?;
    cleanup(&home);

    if status.get("pairingConfigured") != Some(&Value::Bool(false)) {
        return Err("status should report pairingConfigured=false".into());
    }
    if pairing_response.starts_with("HTTP/1.1 409") {
        return Ok(());
    }
    Err(format!("unexpected pairing response: {pairing_response}").into())
}

#[test]
fn invalid_identity_files_fail_fast() -> TestResult<()> {
    let home = test_home("invalid-files")?;
    fs::create_dir_all(&home)?;
    fs::write(home.join("daemon-identity.json"), "{ not json")?;
    let output = Command::new(service_bin())
        .args(["pair", "--json", "--relay-endpoint", RELAY_ENDPOINT])
        .env("CONDUIT_HOME", &home)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()?;
    cleanup(&home);

    if !output.status.success() {
        return Ok(());
    }
    Err("invalid identity file was silently regenerated".into())
}

fn run_pair(home: &Path) -> TestResult<Value> {
    let output = Command::new(service_bin())
        .args(["pair", "--json", "--relay-endpoint", RELAY_ENDPOINT])
        .env("CONDUIT_HOME", home)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()?;
    if !output.status.success() {
        return Err(format!("pair failed: {}", String::from_utf8_lossy(&output.stderr)).into());
    }
    Ok(serde_json::from_slice(&output.stdout)?)
}

fn spawn_serve(home: &Path, port: u16, relay: bool, app_base_url: &str) -> TestResult<Child> {
    let mut command = Command::new(service_bin());
    let port_text = port.to_string();
    command
        .args([
            "serve",
            "--host",
            "127.0.0.1",
            "--port",
            &port_text,
            "--app-base-url",
            app_base_url,
        ])
        .env("CONDUIT_HOME", home)
        .stdout(Stdio::null())
        .stderr(Stdio::piped());
    if relay {
        command.env("CONDUIT_RELAY_ENDPOINT", RELAY_ENDPOINT);
    } else {
        command.env_remove("CONDUIT_RELAY_ENDPOINT");
    }
    Ok(command.spawn()?)
}

fn wait_for_http(port: u16) -> TestResult<()> {
    let deadline = std::time::Instant::now() + Duration::from_secs(10);
    while std::time::Instant::now() < deadline {
        if TcpStream::connect(("127.0.0.1", port)).is_ok() {
            return Ok(());
        }
        thread::sleep(Duration::from_millis(50));
    }
    Err("service did not start listening".into())
}

fn get_json(port: u16, path: &str) -> TestResult<Value> {
    let response = get_raw(port, path)?;
    let body = response
        .split("\r\n\r\n")
        .nth(1)
        .ok_or("HTTP response body missing")?;
    Ok(serde_json::from_str(body)?)
}

fn get_raw(port: u16, path: &str) -> TestResult<String> {
    let mut stream = TcpStream::connect(("127.0.0.1", port))?;
    let request = format!("GET {path} HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n");
    stream.write_all(request.as_bytes())?;
    let mut response = String::new();
    stream.read_to_string(&mut response)?;
    Ok(response)
}

fn stop_child(child: &mut Child) -> TestResult<()> {
    child.kill()?;
    let _status = child.wait()?;
    Ok(())
}

fn offer(value: &Value) -> TestResult<&Value> {
    value.get("offer").ok_or_else(|| "missing offer".into())
}

fn field<'a>(value: &'a Value, name: &str) -> Option<&'a str> {
    value.get(name).and_then(Value::as_str)
}

fn relay_field<'a>(value: &'a Value, name: &str) -> Option<&'a str> {
    value
        .get("relay")
        .and_then(|relay| relay.get(name))
        .and_then(Value::as_str)
}

#[expect(
    clippy::too_many_lines,
    reason = "Pairing E2E assertion intentionally checks the full public offer and leak denylist in one place."
)]
fn assert_offer_minimal(value: &Value) -> TestResult<()> {
    let offer_value = offer(value)?;
    if offer_value.get("v") != Some(&Value::from(1)) {
        return Err("unexpected offer version".into());
    }
    if field(offer_value, "serverId").is_none() {
        return Err("missing serverId".into());
    }
    if field(offer_value, "daemonPublicKeyB64").is_none() {
        return Err("missing daemonPublicKeyB64".into());
    }
    if field(offer_value, "nonce").is_none() {
        return Err("missing nonce".into());
    }
    if field(offer_value, "expiresAt").is_none() {
        return Err("missing expiresAt".into());
    }
    if offer_value
        .get("authorization")
        .and_then(|authorization| authorization.get("required"))
        != Some(&Value::Bool(true))
    {
        return Err("missing required authorization boundary".into());
    }
    if offer_value
        .get("authorization")
        .and_then(|authorization| authorization.get("boundary"))
        .and_then(Value::as_str)
        != Some("relay-handshake")
    {
        return Err("unexpected authorization boundary".into());
    }
    let public_key = field(offer_value, "daemonPublicKeyB64").ok_or("missing public key")?;
    let public_key_bytes = STANDARD.decode(public_key)?;
    if public_key_bytes.len() != 32 {
        return Err("daemonPublicKeyB64 did not decode to 32 bytes".into());
    }
    if offer_value
        .get("relay")
        .and_then(|relay| relay.get("endpoint"))
        .and_then(Value::as_str)
        != Some(RELAY_ENDPOINT)
    {
        return Err("unexpected relay endpoint".into());
    }
    if !relay_field(offer_value, "serverId").is_some_and(|server_id| server_id.starts_with("srv_"))
    {
        return Err("missing relay serverId".into());
    }
    if relay_field(offer_value, "clientCapability").is_none_or(|capability| capability.len() != 43)
    {
        return Err("missing relay clientCapability".into());
    }
    let text = serde_json::to_string(value)?;
    for forbidden in [
        "secretKeyB64",
        "daemonCapability",
        "CONDUIT_HOME",
        "daemon-keypair",
        "local-store",
        "/tmp/",
        "USER=",
        "HOME=",
    ] {
        if text.contains(forbidden) {
            return Err(format!("pairing payload leaked {forbidden}").into());
        }
    }
    Ok(())
}

fn free_port() -> TestResult<u16> {
    let listener = TcpListener::bind(("127.0.0.1", 0))?;
    let port = listener.local_addr()?.port();
    drop(listener);
    Ok(port)
}

fn test_home(label: &str) -> TestResult<PathBuf> {
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH)?.as_nanos();
    Ok(std::env::temp_dir().join(format!("conduit-service-bin-pairing-{label}-{nanos}")))
}

fn cleanup(path: &Path) {
    let _ignored = fs::remove_dir_all(path);
}

fn service_bin() -> PathBuf {
    PathBuf::from(env!("CARGO_BIN_EXE_service-bin"))
}
