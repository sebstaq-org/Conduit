import type {
  ActiveSession,
  OpenSessionFailure,
  PromptFailure,
} from "@/app-state";
import { showErrorToast } from "@/ui";

function titleCase(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

function providerLabel(provider: string | null): string {
  if (provider === null || provider.length === 0) {
    return "Session";
  }
  return titleCase(provider);
}

function sessionTitle(title: string | null): string {
  return title ?? "Untitled session";
}

function objectStringField(value: unknown, field: string): string | null {
  if (typeof value !== "object" || value === null || !(field in value)) {
    return null;
  }
  const fieldValue: unknown = Reflect.get(value, field);
  if (typeof fieldValue !== "string" || fieldValue.length === 0) {
    return null;
  }
  return fieldValue;
}

function requestErrorMessage(error: unknown): string | null {
  if (typeof error === "string" && error.length > 0) {
    return error;
  }
  return (
    objectStringField(error, "message") ?? objectStringField(error, "data")
  );
}

function promptProvider(activeSession: ActiveSession): string | null {
  return activeSession.provider;
}

function promptFailureTitle(activeSession: ActiveSession): string {
  const provider = promptProvider(activeSession);
  if (provider === null) {
    return "Request failed. Draft kept.";
  }
  return `${providerLabel(provider)} request failed. Draft kept.`;
}

function failureMessage(prefix: string, error: unknown): string {
  const message = requestErrorMessage(error);
  if (message === null) {
    return prefix;
  }
  return `${prefix} ${message}`;
}

function showOpenSessionFailureToast({
  error,
  request,
}: OpenSessionFailure): void {
  showErrorToast({
    message: failureMessage(
      `${sessionTitle(request.title)} did not open.`,
      error,
    ),
    title: `Couldn't open ${providerLabel(request.provider)} session`,
  });
}

function showPromptFailureToast({ activeSession, error }: PromptFailure): void {
  showErrorToast({
    message: failureMessage(
      "Your draft was kept. Edit it and try again.",
      error,
    ),
    title: promptFailureTitle(activeSession),
  });
}

export { showOpenSessionFailureToast, showPromptFailureToast };
