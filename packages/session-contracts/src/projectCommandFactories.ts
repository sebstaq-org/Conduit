import {
  isProjectAddRequest,
  isProjectRemoveRequest,
  isProjectSuggestionsQuery,
  isProjectUpdateRequest,
} from "./commandParams.js";
import type {
  ConsumerCommand,
  GlobalCommandTarget,
  ProjectAddCommandName,
  ProjectAddConsumerCommand,
  ProjectListCommandName,
  ProjectListConsumerCommand,
  ProjectRemoveCommandName,
  ProjectRemoveConsumerCommand,
  ProjectSuggestionsCommandName,
  ProjectSuggestionsConsumerCommand,
  ProjectUpdateCommandName,
  ProjectUpdateConsumerCommand,
} from "./wire.js";

type ProjectCommandName =
  | ProjectAddCommandName
  | ProjectListCommandName
  | ProjectRemoveCommandName
  | ProjectSuggestionsCommandName
  | ProjectUpdateCommandName;

type ProjectCommandFactory = (
  id: string,
  provider: GlobalCommandTarget,
  params: unknown,
) => ConsumerCommand;

function createProjectAddCommand(
  id: string,
  provider: GlobalCommandTarget,
  params: unknown,
): ProjectAddConsumerCommand {
  if (!isProjectAddRequest(params)) {
    throw new Error("projects/add params are invalid");
  }
  return {
    id,
    command: "projects/add",
    provider,
    params,
  };
}

function createProjectListCommand(
  id: string,
  provider: GlobalCommandTarget,
): ProjectListConsumerCommand {
  return {
    id,
    command: "projects/list",
    provider,
    params: {},
  };
}

function createProjectRemoveCommand(
  id: string,
  provider: GlobalCommandTarget,
  params: unknown,
): ProjectRemoveConsumerCommand {
  if (!isProjectRemoveRequest(params)) {
    throw new Error("projects/remove params are invalid");
  }
  return {
    id,
    command: "projects/remove",
    provider,
    params,
  };
}

function createProjectSuggestionsCommand(
  id: string,
  provider: GlobalCommandTarget,
  params: unknown,
): ProjectSuggestionsConsumerCommand {
  if (!isProjectSuggestionsQuery(params)) {
    throw new Error("projects/suggestions params are invalid");
  }
  return {
    id,
    command: "projects/suggestions",
    provider,
    params,
  };
}

function createProjectUpdateCommand(
  id: string,
  provider: GlobalCommandTarget,
  params: unknown,
): ProjectUpdateConsumerCommand {
  if (!isProjectUpdateRequest(params)) {
    throw new Error("projects/update params are invalid");
  }
  return {
    id,
    command: "projects/update",
    provider,
    params,
  };
}

const projectCommandFactories: Record<
  ProjectCommandName,
  ProjectCommandFactory
> = {
  "projects/add": createProjectAddCommand,
  "projects/list": createProjectListCommand,
  "projects/remove": createProjectRemoveCommand,
  "projects/suggestions": createProjectSuggestionsCommand,
  "projects/update": createProjectUpdateCommand,
};

function isProjectCommandName(command: string): command is ProjectCommandName {
  return command in projectCommandFactories;
}

export { isProjectCommandName, projectCommandFactories };
export type { ProjectCommandName };
