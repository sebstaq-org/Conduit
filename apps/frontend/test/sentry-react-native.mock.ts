// oxlint-disable promise/prefer-await-to-callbacks -- This mock mirrors Sentry's callback API.
import { vi } from "vitest";

interface SentryScope {
  readonly setContext: (name: string, context: Record<string, unknown>) => void;
  readonly setLevel: (level: string) => void;
  readonly setTag: (name: string, value: string) => void;
}

type SentryScopeCallback = (scope: SentryScope) => void;

interface SentryMockModule {
  readonly addBreadcrumb: typeof addBreadcrumb;
  readonly captureException: typeof captureException;
  readonly captureMessage: typeof captureMessage;
  readonly flush: typeof flush;
  readonly init: typeof init;
  readonly logger: typeof logger;
  readonly resetSentryMock: typeof resetSentryMock;
  readonly scope: typeof scope;
  readonly setTag: typeof setTag;
  readonly withScope: typeof withScope;
  readonly wrap: typeof wrap;
}

const scope = {
  setContext: vi.fn<(name: string, context: Record<string, unknown>) => void>(),
  setLevel: vi.fn<(level: string) => void>(),
  setTag: vi.fn<(name: string, value: string) => void>(),
};

const addBreadcrumb = vi.fn<(breadcrumb: Record<string, unknown>) => void>();
const captureException = vi.fn<(error: unknown) => void>();
const captureMessage = vi.fn<(message: string, level?: string) => void>();
const flush = vi.fn<() => Promise<boolean>>();
flush.mockResolvedValue(true);
const init = vi.fn<(options: Record<string, unknown>) => void>();
const logger = {
  debug:
    vi.fn<(message: string, attributes?: Record<string, unknown>) => void>(),
  error:
    vi.fn<(message: string, attributes?: Record<string, unknown>) => void>(),
  info: vi.fn<
    (message: string, attributes?: Record<string, unknown>) => void
  >(),
  warn: vi.fn<
    (message: string, attributes?: Record<string, unknown>) => void
  >(),
};
const setTag = vi.fn<(name: string, value: string) => void>();
const withScope = vi.fn<(callback: SentryScopeCallback) => void>((callback) => {
  callback(scope);
});
const wrap = vi.fn<<Component>(component: Component) => Component>(
  (component) => component,
);

function resetSentryLoggerMock(): void {
  logger.debug.mockClear();
  logger.error.mockClear();
  logger.info.mockClear();
  logger.warn.mockClear();
}

function resetSentryScopeMock(): void {
  scope.setContext.mockClear();
  scope.setLevel.mockClear();
  scope.setTag.mockClear();
}

function resetSentryMock(): void {
  addBreadcrumb.mockClear();
  captureException.mockClear();
  captureMessage.mockClear();
  flush.mockClear();
  init.mockClear();
  resetSentryLoggerMock();
  resetSentryScopeMock();
  setTag.mockClear();
  withScope.mockClear();
  wrap.mockClear();
}

export type { SentryMockModule, SentryScope };
export {
  addBreadcrumb,
  captureException,
  captureMessage,
  flush,
  init,
  logger,
  resetSentryMock,
  scope,
  setTag,
  withScope,
  wrap,
};
