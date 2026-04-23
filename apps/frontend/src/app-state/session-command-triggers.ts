import type {
  SessionNewResult,
  SessionOpenResult,
  SessionSetConfigOptionResult,
} from "@conduit/session-client";
import type {
  NewSessionMutationArg,
  OpenSessionMutationArg,
  SetSessionConfigOptionMutationArg,
} from "./api";

interface MutationResult<ResultData> {
  unwrap: () => Promise<ResultData>;
}

type NewSessionTrigger = (
  request: NewSessionMutationArg,
) => MutationResult<SessionNewResult>;
type OpenSessionTrigger = (
  request: OpenSessionMutationArg,
) => MutationResult<SessionOpenResult>;
type SetSessionConfigOptionTrigger = (
  request: SetSessionConfigOptionMutationArg,
) => MutationResult<SessionSetConfigOptionResult>;

export type {
  MutationResult,
  NewSessionTrigger,
  OpenSessionTrigger,
  SetSessionConfigOptionTrigger,
};
