# Mobile Desktop Connection Torture Plan

## Environment Policy

Primary torture runs target dev only: desktop dev, iOS dev simulator, the dev bundle id `com.sebstaq.conduit.dev`, the dev scheme `conduit-dev://pair`, isolated dev home/store/logs, and the live relay endpoint. Stage is a later release smoke after the dev flow is robust and merged.

The first gate is pairing. A run cannot enter torture until a desktop-generated `conduit-dev://pair?offer=...` link opens the dev iOS app, the app accepts the offer, `/api/daemon/status` reports `mobilePeerConnected: true`, and both desktop and mobile render connected.

Use these commands as the dev baseline, with paths/ports isolated per run:

```bash
rtk pnpm run desktop:dev
rtk pnpm run frontend:start:dev
rtk pnpm run frontend:ios:dev-simulator-build
```

For simulator driving on the macOS VM, use `base-cli workspace info` to identify the workspace simulator, `xcrun simctl openurl <device> 'conduit-dev://pair?offer=...'` to open pairing, and AXe or screenshots only as proof of rendered state. Backend truth comes from `/api/daemon/status`; screenshots alone are not sufficient.

This plan tests one invariant: a paired mobile client is green only after a fresh verified roundtrip to the desktop-managed backend, and it is red or connecting when that truth is unknown or false. The target failure is a false stale state, especially green after the desktop is unreachable or red while a healthy desktop should be reachable.

## Instrumentation Gate

Before expanding the matrix, every run needs a shared run id in mobile logs, desktop logs, service logs, and E2E output. Log these state transitions with timestamps: pairing accepted, persisted host hydrated, relay socket open, relay socket close code/reason, command roundtrip success, command roundtrip failure, heartbeat or presence update accepted, app foreground/background, and rendered connection indicator.

The minimum debug payload for a failed run is: run id, app build, desktop commit, platform/device, active host id, relay server id, connection id, last successful command timestamp, last failed command timestamp, current rendered indicator, and backend presence snapshot.

## Automated E2E Scope

Automated E2E owns deterministic behavior in simulator or browser-backed mobile viewport. It should avoid OS claims that only a physical phone can prove.

| Case                                        | Driver                                                          | Expected result                                                                     |
| ------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Pair from mobile pair route                 | Playwright mobile viewport                                      | Desktop indicator turns green after real command roundtrip.                         |
| App restart with persisted host             | Playwright closes page and opens a new page in the same context | Mobile rehydrates host and returns green without new pairing.                       |
| Relay data socket dropped after restart     | Playwright test relay admin endpoint                            | Mobile command traffic forces relay reconnection and session load still works.      |
| Browser reload after pairing                | Playwright reload                                               | Mobile remains green only after refetch succeeds.                                   |
| Stale RTK success beyond grace              | Vitest status contract                                          | UI does not show green for old cached success.                                      |
| Transient polling failure inside grace      | Vitest status contract                                          | UI does not flicker red while a fresh success is still valid.                       |
| Persistent polling failure after grace      | Vitest status contract                                          | UI turns red after the configured grace window.                                     |
| Tampered relay endpoint                     | Playwright pairing UI                                           | Mobile shows disconnected and surfaces relay error.                                 |
| Forget desktop                              | Playwright pairing UI                                           | Mobile returns idle, clears session affordances, and does not use stale host data.  |
| Desktop daemon restart                      | Electron Playwright                                             | Desktop exposes a fresh pairing offer and accepts a new mobile relay client.        |
| Desktop daemon startup failure              | Electron Playwright                                             | Desktop recovery UI is shown and mobile pairing is not reported connected.          |
| Direct relay socket close                   | Relay/package E2E                                               | Relay closes paired data/client sockets and cleans idle state.                      |
| Duplicate reconnect after app restart       | Future Playwright loop                                          | Multiple app restarts must not create permanent stale relay sessions.               |
| Long idle with shortened timeout            | Future Playwright with test timeout env                         | Old green state must expire and recover on next successful command.                 |
| Unauthorized reconnect                      | Future service fault hook                                       | Mobile turns red and does not retry as green.                                       |
| Service restart behind same pairing         | Future harness service restart                                  | Mobile leaves green during outage and returns green after service accepts commands. |
| Service accepts TCP but no command response | Future harness blackhole mode                                   | Mobile reaches timeout and turns red or connecting, never stale green.              |

## Manual Physical Phone Scope

Manual runs own OS lifecycle, network, and hardware behavior. Each manual run should capture the phone screen plus desktop/backend logs with the same run id.

| Case                                | Steps                                                                 | Expected result                                                           |
| ----------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Force-kill mobile app               | Pair, swipe app away, wait 30s, reopen                                | Green returns without new pairing when desktop is healthy.                |
| Force-kill past timeout             | Pair, kill app, wait beyond timeout budget, reopen                    | Mobile revalidates before green and never shows stale green indefinitely. |
| Phone restart while desktop is up   | Pair, reboot phone, open app                                          | Green returns without new pairing.                                        |
| Phone restart while desktop is down | Pair, stop desktop, reboot phone, open app, start desktop             | Red while desktop is down, then green after desktop is reachable.         |
| Lock screen short wait              | Pair, lock phone for 1-2 min, unlock                                  | Green remains or quickly revalidates.                                     |
| Lock screen long wait               | Pair, lock phone for 30-60 min, unlock                                | No stale green; state revalidates and recovers.                           |
| Overnight idle                      | Pair, lock phone overnight, keep desktop controlled                   | Morning state matches actual desktop reachability.                        |
| Airplane mode                       | Pair, enable airplane mode, wait timeout, disable                     | Red during outage, green after network returns.                           |
| Wi-Fi off/on                        | Pair, disable Wi-Fi, wait timeout, enable                             | Red during outage, green after LAN returns.                               |
| Switch Wi-Fi networks               | Pair, move phone to a network without desktop, then back              | Red off-LAN, green back on-LAN.                                           |
| Walk out of LAN range               | Pair, leave range until timeout, return                               | Red out of range, green after return.                                     |
| Captive or half-open Wi-Fi          | Pair on a network that blocks relay/backend                           | No green without a successful command roundtrip.                          |
| Desktop sleep/wake                  | Pair, sleep desktop, wait timeout, wake                               | Red while asleep, green after wake.                                       |
| Desktop VPN toggle                  | Pair, toggle VPN that changes reachability                            | Mobile state matches actual reachability.                                 |
| Desktop firewall block              | Pair, block backend/relay port, unblock                               | Red while blocked, green after unblock.                                   |
| Desktop IP change                   | Pair, move desktop between networks or renew IP                       | Mobile rediscovers or fails explicitly according to contract.             |
| Desktop app restart loop            | Pair, restart desktop app 20 times                                    | Mobile never sticks stale and recovers each cycle.                        |
| Backend crash loop                  | Pair, kill backend repeatedly if exposed                              | Mobile alternates red/green with actual service state.                    |
| Low-memory reclaim                  | Pair, pressure phone memory until app is reclaimed, reopen            | Pairing persists and state revalidates.                                   |
| App upgrade preserving storage      | Pair, install next build over app, open                               | Pairing survives or fails explicitly if contract changed.                 |
| App reinstall clearing storage      | Pair, uninstall/reinstall, open                                       | No stale paired desktop is shown.                                         |
| Two phones paired                   | Pair two phones, kill/restart one                                     | The other phone remains connected; killed phone recovers cleanly.         |
| QR flow while already paired        | Open pairing flow again on mobile                                     | Existing connection is not broken unless a new host is accepted.          |
| Clock change on phone               | Pair, change phone clock forward/back, reopen                         | Stale logic is not fooled into false green.                               |
| Clock change on desktop             | Pair, change desktop clock forward/back                               | Presence and timeout state remain deterministic.                          |
| 30-minute chaos pass                | Randomize app kill/open, network off/on, desktop restart, lock/unlock | No false green, no permanent stale red, all failures have logs.           |

## Execution Order

Start with the instrumentation gate, then keep automated tests narrow and repeatable. The first automated target is mobile app restart with persisted pairing plus relay data socket drop, because it directly models a phone app restart without needing physical-device automation.

After that, add harness fault controls in this order: service stop/start, relay blackhole, unauthorized reconnect, shortened heartbeat timeout, and repeated restart loops. Each new fault mode should land with one E2E test and one manual checklist entry.

Physical-phone runs should happen after the logs are in place. Run short lifecycle cases first, then network transitions, then desktop sleep/firewall/VPN, and leave overnight/chaos for the end because those are expensive without good diagnostics.

## Pass Criteria

A run passes only when the rendered mobile indicator, command roundtrip result, and backend presence snapshot agree within the timeout budget. A failure is actionable only if the run id ties the UI state to relay/backend logs; otherwise rerun with logging fixed before changing connection logic.
