interface FrontendEnv {
  readonly EXPO_PUBLIC_CONDUIT_CLIENT_LOG_URL?: string;
  readonly EXPO_PUBLIC_CONDUIT_LOG_PROFILE?: string;
  readonly EXPO_PUBLIC_CONDUIT_SESSION_WS_URL?: string;
  readonly NODE_ENV?: string;
}

declare const process: {
  readonly env: FrontendEnv;
};

function frontendEnvValue(name: keyof FrontendEnv): string | undefined {
  return process.env[name];
}

export { frontendEnvValue };
