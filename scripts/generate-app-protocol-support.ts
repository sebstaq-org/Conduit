import type { JsonSchema } from "./generate-app-protocol-types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function readConstString(value: unknown): string | null {
  if (!isRecord(value) || !("const" in value)) {
    return null;
  }
  if (typeof value.const !== "string") {
    return null;
  }
  return value.const;
}

function readStringEnum(
  schema: JsonSchema | undefined,
  contractName: string,
): string[] {
  const enumValues = schema?.enum;
  if (
    Array.isArray(enumValues) &&
    enumValues.every((value) => typeof value === "string")
  ) {
    return enumValues;
  }

  const oneOfValues = schema?.oneOf;
  if (Array.isArray(oneOfValues)) {
    const providers = oneOfValues
      .map((value) => readConstString(value))
      .filter((value): value is string => value !== null);
    if (providers.length === oneOfValues.length && providers.length > 0) {
      return providers;
    }
  }

  throw new Error(
    `${contractName} enum is missing from generated contract bundle`,
  );
}

function readOptionalStringEnum(schema: JsonSchema | undefined): string[] {
  if (schema === undefined) {
    return [];
  }
  return readStringEnum(schema, "optional enum");
}

function indent(source: string): string {
  return source
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}

function hasNamedExport(compiled: string, candidate: string): boolean {
  return new RegExp(`export (?:interface|type) ${candidate}(?:\\s|=)`).test(
    compiled,
  );
}

function toIdentifier(value: string): string {
  const cleaned = value.replaceAll(/[^A-Za-z0-9]+/g, " ").trim();
  if (cleaned.length === 0) {
    return "Contract";
  }
  return cleaned
    .split(/\s+/)
    .map(
      (segment) => `${segment.at(0)?.toUpperCase() ?? ""}${segment.slice(1)}`,
    )
    .join("");
}

function typeCandidates(fallback: string, schema: JsonSchema): string[] {
  const candidates = [fallback];
  if (typeof schema.title === "string") {
    candidates.push(toIdentifier(schema.title));
  }
  return candidates;
}

function lastExportedTypeName(compiled: string): string | undefined {
  const exportedNames = Array.from(
    compiled.matchAll(/export (?:interface|type) ([A-Za-z0-9_]+)/g),
    (match) => match[1] ?? "",
  ).filter((name) => name.length > 0);
  return exportedNames.at(-1);
}

function findRootTypeName(
  compiled: string,
  fallback: string,
  schema: JsonSchema,
): string {
  for (const candidate of typeCandidates(fallback, schema)) {
    if (hasNamedExport(compiled, candidate)) {
      return candidate;
    }
  }

  const lastExportedName = lastExportedTypeName(compiled);
  if (lastExportedName !== undefined) {
    return lastExportedName;
  }

  throw new Error(`Could not determine generated type name for ${fallback}`);
}

function readDefs(schema: JsonSchema): Record<string, unknown> {
  if (isRecord(schema.$defs)) {
    return schema.$defs;
  }
  return {};
}

function copyEntries(
  first: Record<string, unknown>,
  second: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(first)) {
    result[key] = value;
  }
  for (const [key, value] of Object.entries(second)) {
    result[key] = value;
  }
  return result;
}

function mergeSchemaObjects(
  referenced: Record<string, unknown>,
  siblings: Record<string, unknown>,
): Record<string, unknown> {
  const merged = copyEntries(referenced, siblings);
  if (isRecord(referenced.properties) && isRecord(siblings.properties)) {
    merged.properties = copyEntries(referenced.properties, siblings.properties);
  }
  if (isStringArray(referenced.required) && isStringArray(siblings.required)) {
    merged.required = [
      ...new Set([...referenced.required, ...siblings.required]),
    ];
  }
  return merged;
}

function mergeReferenceSiblings(
  value: Record<string, unknown>,
  defs: Record<string, unknown>,
): Record<string, unknown> {
  const ref = value.$ref;
  if (
    typeof ref !== "string" ||
    !ref.startsWith("#/$defs/") ||
    Object.keys(value).every((key) => key === "$ref")
  ) {
    return value;
  }

  const referenced = defs[ref.slice("#/$defs/".length)];
  if (!isRecord(referenced)) {
    return value;
  }

  const siblings = Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== "$ref"),
  );
  return mergeSchemaObjects(referenced, siblings);
}

function normalizeValue(
  value: unknown,
  defs: Record<string, unknown>,
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item, defs));
  }
  if (isRecord(value)) {
    const merged = mergeReferenceSiblings(value, defs);
    return Object.fromEntries(
      Object.entries(merged).map(([key, entry]) => [
        key,
        normalizeValue(entry, defs),
      ]),
    );
  }
  return value;
}

function normalizeSchemaForTypescript(schema: JsonSchema): JsonSchema {
  const normalized = normalizeValue(schema, readDefs(schema));
  if (!isRecord(normalized)) {
    throw new Error("Expected normalized schema to remain an object");
  }
  return normalized;
}

export {
  findRootTypeName,
  indent,
  normalizeSchemaForTypescript,
  readOptionalStringEnum,
  readStringEnum,
};
