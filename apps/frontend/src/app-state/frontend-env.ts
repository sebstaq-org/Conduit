interface FrontendEnv {
  readonly EXPO_PUBLIC_CONDUIT_CLIENT_LOG_URL?: string;
  readonly EXPO_PUBLIC_CONDUIT_LOG_PROFILE?: string;
  readonly EXPO_PUBLIC_CONDUIT_SESSION_WS_URL?: string;
  readonly NODE_ENV?: string;
}

interface ConduitRuntimeConfig {
  readonly clientLogUrl?: string;
  readonly logProfile?: string;
  readonly sessionWsUrl?: string;
}

declare const process: {
  readonly env: FrontendEnv;
};

declare global {
  var CONDUIT_RUNTIME_CONFIG: ConduitRuntimeConfig | undefined;
}

function frontendEnvValue(name: keyof FrontendEnv): string | undefined {
  const runtimeConfig = globalThis.CONDUIT_RUNTIME_CONFIG;
  switch (name) {
    case "EXPO_PUBLIC_CONDUIT_CLIENT_LOG_URL": {
      return (
        runtimeConfig?.clientLogUrl ??
        process.env.EXPO_PUBLIC_CONDUIT_CLIENT_LOG_URL
      );
    }
    case "EXPO_PUBLIC_CONDUIT_LOG_PROFILE": {
      return (
        runtimeConfig?.logProfile ?? process.env.EXPO_PUBLIC_CONDUIT_LOG_PROFILE
      );
    }
    case "EXPO_PUBLIC_CONDUIT_SESSION_WS_URL": {
      return (
        runtimeConfig?.sessionWsUrl ??
        process.env.EXPO_PUBLIC_CONDUIT_SESSION_WS_URL
      );
    }
    case "NODE_ENV": {
      return process.env.NODE_ENV;
    }
    default: {
      return undefined;
    }
  }
}

export { frontendEnvValue };
