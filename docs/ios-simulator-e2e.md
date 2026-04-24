# iOS Simulator E2E Smoke

Run the simulator smoke test from the repo root:

```sh
rtk pnpm --filter @conduit/e2e run test:ios-sim
```

The test uses `base-cli` for the supported repo-to-macOS-VM flow. It ensures the workspace simulator exists, builds the `stage-simulator` Expo/EAS profile, then runs install, launch, and screenshot verification through `base-cli ssh exec` so the work stays inside the VM agent path.

The harness writes build output only to the existing local and VM artifact locations managed by `base-cli`, and it removes its temporary extracted app and screenshot before exiting.
