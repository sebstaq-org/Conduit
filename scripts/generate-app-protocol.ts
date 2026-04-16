import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { format } from "prettier";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  findRootTypeName,
  indent,
  normalizeSchemaForTypescript,
  readOptionalStringEnum,
  readStringEnum,
} from "./generate-app-protocol-support.js";
import type {
  CompileSchema,
  ConsumerContractBundle,
  JsonSchema,
} from "./generate-app-protocol-types.js";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const CONTRACT_BUNDLE_PATH = resolve(
  REPO_ROOT,
  "packages/app-protocol/generated/consumer-contracts.schema.json",
);
const OUTPUT_PATH = resolve(
  REPO_ROOT,
  "packages/app-protocol/src/generated.ts",
);
const require = createRequire(import.meta.url);

const bundle = readContractBundle();
const contractNames = Object.keys(bundle.roots).sort();
const providerEnum = readStringEnum(bundle.roots.ProviderId, "ProviderId");
const consumerCommandEnum = readOptionalStringEnum(
  bundle.roots.ConsumerCommandName,
);
const compile = await loadCompiler();
const generatedSource = await renderGeneratedProtocol(
  bundle,
  contractNames,
  consumerCommandEnum,
  providerEnum,
  compile,
);

mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(
  OUTPUT_PATH,
  await format(generatedSource, { parser: "typescript" }),
);
writeFileSync(
  CONTRACT_BUNDLE_PATH,
  await format(readFileSync(CONTRACT_BUNDLE_PATH, "utf8"), { parser: "json" }),
);

function readContractBundle(): ConsumerContractBundle {
  return JSON.parse(
    readFileSync(CONTRACT_BUNDLE_PATH, "utf8"),
  ) as ConsumerContractBundle;
}

async function loadCompiler(): Promise<CompileSchema> {
  const loaded = require("json-schema-to-typescript") as {
    compile: CompileSchema;
  };
  return loaded.compile;
}

async function renderGeneratedProtocol(
  bundle: ConsumerContractBundle,
  contractNames: string[],
  consumerCommandEnum: string[],
  providerEnum: string[],
  compileSchema: CompileSchema,
): Promise<string> {
  const typeBlocks = await Promise.all(
    contractNames.map(async (name) =>
      renderTypeBlock(name, bundle.roots[name] ?? {}, compileSchema),
    ),
  );

  const schemaLiteral = JSON.stringify(bundle.roots, null, 2);
  const consumerCommandLiteral =
    consumerCommandEnum.length > 0
      ? `\nexport const CONSUMER_COMMANDS = ${JSON.stringify(
          consumerCommandEnum,
          null,
          2,
        )} as const;\n`
      : "\n";
  const providerLiteral = JSON.stringify(providerEnum, null, 2);
  const contractNameLiteral = contractNames
    .map((name) => `"${name}"`)
    .join(" | ");
  const validatorRegistrations = contractNames
    .map(
      (name) =>
        `validators.${name} = ajv.compile(contractSchemas.${name}) as ValidateFunction;`,
    )
    .join("\n");
  const schemaExports = contractNames
    .map((name) => renderSchemaExports(name))
    .join("\n\n");

  return `/* eslint-disable max-lines -- generated backend-owned contract surface. */
// GENERATED FILE. DO NOT EDIT.
// Source: scripts/generate-app-protocol.ts

import Ajv2020 from "ajv/dist/2020.js";
import type { Options, ValidateFunction } from "ajv";

${typeBlocks.join("\n\n")}

export const CONTRACT_BUNDLE_VERSION = ${String(bundle.version)} as const;
export const PROVIDERS = ${providerLiteral} as const satisfies readonly ProviderId[];
${consumerCommandLiteral}
const contractSchemas = ${schemaLiteral} as const;

type ContractName = ${contractNameLiteral};

interface SafeParseSuccess<T> {
  success: true;
  data: T;
}

interface SafeParseFailure {
  success: false;
  error: Error;
}

type SafeParseResult<T> = SafeParseSuccess<T> | SafeParseFailure;

interface GeneratedSchema<T> {
  parse(value: unknown): T;
  safeParse(value: unknown): SafeParseResult<T>;
}

type Ajv2020Constructor = new (options?: Options) => {
  compile(schema: object): ValidateFunction;
};
const ajv = new (Ajv2020 as unknown as Ajv2020Constructor)({
  allErrors: true,
  allowUnionTypes: true,
  discriminator: true,
  strict: true,
  strictTypes: false,
  strictTuples: false,
  validateFormats: false,
}) as {
  addKeyword(keyword: string): unknown;
  compile(schema: object): ValidateFunction;
};
ajv.addKeyword("x-method");
ajv.addKeyword("x-side");
const validators = {} as Record<ContractName, ValidateFunction>;
${validatorRegistrations}

function validationError(contract: ContractName, value: unknown): Error {
  const validator = validators[contract];
  const message =
    validator.errors
      ?.map((error) => {
        const path =
          error.instancePath.length === 0
            ? "$"
            : "$" + error.instancePath;
        return path + ": " + (error.message ?? "invalid value");
      })
      .join("; ") ?? contract + " is invalid";
  return new Error(message);
}

function parseContract<T>(contract: ContractName, value: unknown): T {
  const validator = validators[contract];
  if (validator(value)) {
    return value as T;
  }
  throw validationError(contract, value);
}

function safeParseContract<T>(
  contract: ContractName,
  value: unknown,
): SafeParseResult<T> {
  try {
    return {
      success: true,
      data: parseContract<T>(contract, value),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

function isContract<T>(contract: ContractName, value: unknown): value is T {
  return validators[contract](value) === true;
}

${schemaExports}
`;
}

async function renderTypeBlock(
  name: string,
  schema: JsonSchema,
  compileSchema: CompileSchema,
): Promise<string> {
  const namespace = `${name}Types`;
  const compiled = (
    await compileSchema(normalizeSchemaForTypescript(schema), name, {
      bannerComment: "",
      unreachableDefinitions: true,
      style: {
        singleQuote: false,
      },
    })
  ).trim();
  const rootTypeName = findRootTypeName(compiled, name, schema);
  return `export namespace ${namespace} {\n${indent(compiled)}\n}\n\nexport type ${name} = ${namespace}.${rootTypeName};`;
}

function renderSchemaExports(name: string): string {
  return `export function parse${name}(value: unknown): ${name} {
  return parseContract<${name}>("${name}", value);
}

export function is${name}(value: unknown): value is ${name} {
  return isContract<${name}>("${name}", value);
}

export const ${name}Schema: GeneratedSchema<${name}> = {
  parse(value: unknown): ${name} {
    return parse${name}(value);
  },
  safeParse(value: unknown): SafeParseResult<${name}> {
    return safeParseContract<${name}>("${name}", value);
  },
};`;
}
