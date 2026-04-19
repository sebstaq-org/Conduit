import type { ActiveSession } from "@/app-state";

const draftSessionLabel = "Draft session";
const draftSessionNoProviderMeta = "No provider selected";

function draftSessionMatchesCwd(
  activeSession: ActiveSession | null,
  cwd: string,
): activeSession is Extract<ActiveSession, { kind: "draft" }> {
  return activeSession?.kind === "draft" && activeSession.cwd === cwd;
}

function draftSessionMeta(
  activeSession: Extract<ActiveSession, { kind: "draft" }>,
): string {
  return activeSession.provider ?? draftSessionNoProviderMeta;
}

export { draftSessionLabel, draftSessionMatchesCwd, draftSessionMeta };
