# Daemon Identity Security

Conduit v1 stores the daemon identity under the product home resolved by `CONDUIT_HOME` or the OS app-data directory. The persisted keypair is an x25519 daemon keypair used to advertise the daemon public key in pairing offers; the secret key never appears in pairing URLs, HTTP responses, logs, or curated test fixtures.

The keypair file is a local JSON file with owner-only `0600` permissions on Unix. This PR treats compromise of the local user account, the product home directory, or another same-user process as out of scope; a local attacker with that access can read or replace the daemon secret key. Invalid or tampered identity files fail fast rather than being silently regenerated.

Pairing offers are not authorization. Each offer carries a short-lived nonce, an expiry timestamp, and an explicit `relay-handshake` authorization boundary; relay/E2EE work must enforce that boundary before any mobile client can drive the daemon.

Desktop/native hardening should move daemon secret storage to the platform credential store or an equivalent OS-backed secret mechanism when the desktop-managed daemon flow is implemented.
