import type { DesktopDaemonConfig } from "./types.js";

function backendEnvironment(config: DesktopDaemonConfig): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      env[key] = value;
    }
  }
  env.CONDUIT_HOME = config.home;
  env.CONDUIT_LOG_PROFILE = config.logProfile;
  env.XDG_DATA_HOME = config.home;
  return env;
}

export { backendEnvironment };
