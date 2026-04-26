import type { ProviderId } from "@conduit/session-client";
import type { SessionGroup, SessionRow } from "./session-list.types";

interface DraftSessionTarget {
  readonly cwd: string;
  readonly kind: "draft";
}

interface OpenSessionTarget {
  readonly cwd: string;
  readonly kind: "open";
  readonly provider: ProviderId;
  readonly sessionId: string;
  readonly title: string | null;
}

type SessionListTarget = DraftSessionTarget | OpenSessionTarget;
type SessionListTargetSelected = (target: SessionListTarget) => void;

function draftSessionTarget(cwd: string): DraftSessionTarget {
  return { cwd, kind: "draft" };
}

function openSessionTarget(
  group: SessionGroup,
  session: SessionRow,
): OpenSessionTarget {
  return {
    cwd: group.cwd,
    kind: "open",
    provider: session.provider,
    sessionId: session.sessionId,
    title: session.title,
  };
}

export { draftSessionTarget, openSessionTarget };
export type {
  DraftSessionTarget,
  OpenSessionTarget,
  SessionListTarget,
  SessionListTargetSelected,
};
