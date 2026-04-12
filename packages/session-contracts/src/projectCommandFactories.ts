import {
  isProjectAddRequest,
  isProjectRemoveRequest,
} from "./commandParams.js";
import type {
  ConsumerCommand,
  ConsumerCommandTarget,
  ProjectAddCommandName,
  ProjectAddConsumerCommand,
  ProjectListCommandName,
  ProjectListConsumerCommand,
  ProjectRemoveCommandName,
  ProjectRemoveConsumerCommand,
} from "./wire.js";

type ProjectCommandName =
  | ProjectAddCommandName
  | ProjectListCommandName
  | ProjectRemoveCommandName;

type ProjectCommandFactory = (
  id: string,
  provider: ConsumerCommandTarget,
  params: unknown,
) => ConsumerCommand;

function createProjectAddCommand(
  id: string,
  provider: ConsumerCommandTarget,
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
  provider: ConsumerCommandTarget,
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
  provider: ConsumerCommandTarget,
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

const projectCommandFactories: Record<
  ProjectCommandName,
  ProjectCommandFactory
> = {
  "projects/add": createProjectAddCommand,
  "projects/list": createProjectListCommand,
  "projects/remove": createProjectRemoveCommand,
};

function isProjectCommandName(command: string): command is ProjectCommandName {
  return command in projectCommandFactories;
}

export { isProjectCommandName, projectCommandFactories };
export type { ProjectCommandName };
