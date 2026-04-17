//! Contract schemas emitted into `packages/app-protocol`.

mod roots;

use roots::{ROOT_DEFINITIONS, merge_backend_types};
use schemars::{
    JsonSchema,
    generate::SchemaSettings,
    transform::{RemoveRefSiblings, ReplaceBoolSchemas},
};
use serde_json::{Map, Value};
use std::collections::{BTreeMap, BTreeSet};
use std::error::Error;
use std::fmt::{self, Display};

const CONTRACT_VERSION: u8 = 1;

/// Generates TypeScript/Zod contracts from backend-owned serde types.
pub(crate) fn generate_typescript() -> Result<String, ContractError> {
    TypeScriptEmitter::new(ProtocolSchema::from_backend_types()?).emit()
}

#[derive(Debug)]
pub(crate) enum ContractError {
    Json(serde_json::Error),
    MissingDefinition(String),
    InvalidReference(String),
    UnsupportedSchema(String),
}

impl Display for ContractError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Json(source) => write!(formatter, "failed to encode ACP schema: {source}"),
            Self::MissingDefinition(name) => write!(formatter, "ACP schema is missing {name}"),
            Self::InvalidReference(reference) => {
                write!(formatter, "unsupported ACP schema reference {reference}")
            }
            Self::UnsupportedSchema(message) => {
                write!(formatter, "unsupported ACP schema: {message}")
            }
        }
    }
}

impl Error for ContractError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::Json(source) => Some(source),
            Self::MissingDefinition(_) | Self::InvalidReference(_) | Self::UnsupportedSchema(_) => {
                None
            }
        }
    }
}

impl From<serde_json::Error> for ContractError {
    fn from(source: serde_json::Error) -> Self {
        Self::Json(source)
    }
}

pub(crate) struct ProtocolSchema {
    definitions: BTreeMap<String, Value>,
}

impl ProtocolSchema {
    pub(crate) fn from_backend_types() -> Result<Self, ContractError> {
        let mut definitions = BTreeMap::new();
        merge_backend_types(&mut definitions)?;
        Ok(Self { definitions })
    }

    fn definition(&self, name: &str) -> Result<&Value, ContractError> {
        self.definitions
            .get(name)
            .ok_or_else(|| ContractError::MissingDefinition(name.to_owned()))
    }

    fn has_definition(&self, name: &str) -> bool {
        self.definitions.contains_key(name)
    }
}

pub(super) fn merge_schema<T: JsonSchema>(
    root_name: &str,
    definitions: &mut BTreeMap<String, Value>,
) -> Result<(), ContractError> {
    let schema = acp_schema_value::<T>()?;
    if let Some(defs) = schema.get("$defs").and_then(Value::as_object) {
        for (name, definition) in defs {
            if let Some(existing) = definitions.get(name) {
                if existing != definition {
                    return Err(ContractError::UnsupportedSchema(format!(
                        "conflicting ACP definition {name}"
                    )));
                }
            } else {
                definitions.insert(name.clone(), definition.clone());
            }
        }
    }

    if !definitions.contains_key(root_name) {
        definitions.insert(root_name.to_owned(), root_definition(&schema));
    }
    Ok(())
}

pub(crate) fn acp_schema_value<T: JsonSchema>() -> Result<Value, ContractError> {
    let mut settings = SchemaSettings::draft2020_12();
    settings.untagged_enum_variant_titles = true;
    let mut bool_schemas = ReplaceBoolSchemas::default();
    bool_schemas.skip_additional_properties = true;
    let generator = settings
        .with_transform(RemoveRefSiblings::default())
        .with_transform(bool_schemas)
        .into_generator();
    serde_json::to_value(generator.into_root_schema_for::<T>()).map_err(ContractError::from)
}

pub(crate) fn root_definition(schema: &Value) -> Value {
    let mut definition = schema.clone();
    if let Some(object) = definition.as_object_mut() {
        object.remove("$defs");
        object.remove("$schema");
        object.remove("title");
    }
    definition
}

pub(crate) struct TypeScriptEmitter {
    schema: ProtocolSchema,
    emitted: BTreeSet<String>,
    visiting: BTreeSet<String>,
    order: Vec<String>,
    output: String,
}

impl TypeScriptEmitter {
    pub(crate) fn new(schema: ProtocolSchema) -> Self {
        Self {
            schema,
            emitted: BTreeSet::new(),
            visiting: BTreeSet::new(),
            order: Vec::new(),
            output: String::new(),
        }
    }

    pub(crate) fn emit(mut self) -> Result<String, ContractError> {
        self.push_header();
        for root in ROOT_DEFINITIONS {
            self.emit_definition(root)?;
        }
        self.push_export_blocks();
        if self.output.ends_with("\n\n") {
            self.output.truncate(self.output.len() - 1);
        }
        Ok(self.output)
    }

    fn emit_definition(&mut self, name: &str) -> Result<(), ContractError> {
        if self.emitted.contains(name) {
            return Ok(());
        }
        if self.visiting.contains(name) {
            return Err(ContractError::UnsupportedSchema(format!(
                "recursive definition {name}"
            )));
        }

        self.visiting.insert(name.to_owned());
        let definition = self.schema.definition(name)?.clone();
        for reference in references_in(&definition)? {
            if self.schema.has_definition(&reference) && reference != name {
                self.emit_definition(&reference)?;
            }
        }

        let expression = self.zod_for_schema(&definition)?;
        self.output.push_str("const ");
        self.output.push_str(&schema_identifier(name));
        self.output.push_str(" = ");
        self.output.push_str(&expression);
        self.output.push_str(";\ntype ");
        self.output.push_str(&type_identifier(name));
        self.output.push_str(" = z.infer<typeof ");
        self.output.push_str(&schema_identifier(name));
        self.output.push_str(">;\n\n");
        self.visiting.remove(name);
        self.emitted.insert(name.to_owned());
        self.order.push(name.to_owned());
        Ok(())
    }

    fn push_header(&mut self) {
        self.output.push_str(
            "// This file is generated by `pnpm run protocol:generate`.\n\
             // Do not edit manually.\n\
             /* eslint-disable max-lines, id-length */\n\
             import { z } from \"zod\";\n\n",
        );
        self.output.push_str("const PROTOCOL_CONTRACT_VERSION = ");
        self.output.push_str(&CONTRACT_VERSION.to_string());
        self.output.push_str(" as const;\n\n");
    }

    fn push_export_blocks(&mut self) {
        self.output
            .push_str("export {\n  PROTOCOL_CONTRACT_VERSION,\n");
        for name in &self.order {
            self.output.push_str("  ");
            self.output.push_str(&schema_identifier(name));
            self.output.push_str(",\n");
        }
        self.output.push_str("};\n\nexport type {\n");
        for name in &self.order {
            self.output.push_str("  ");
            self.output.push_str(&type_identifier(name));
            self.output.push_str(",\n");
        }
        self.output.push_str("};\n\n");
    }

    fn zod_for_schema(&self, schema: &Value) -> Result<String, ContractError> {
        if let Some(reference) = schema.get("$ref").and_then(Value::as_str) {
            return Ok(schema_identifier(reference_name(reference)?));
        }
        if let Some(value) = schema.get("const") {
            return literal_expr(value);
        }
        if let Some(values) = schema.get("enum").and_then(Value::as_array) {
            return union_expr(
                values
                    .iter()
                    .map(literal_expr)
                    .collect::<Result<Vec<_>, _>>()?,
            );
        }
        if self.has_discriminated_one_of(schema) {
            return self.discriminated_one_of(schema);
        }
        if let Some(values) = schema.get("oneOf").and_then(Value::as_array) {
            return self.union_for_schemas(values);
        }
        if let Some(values) = schema.get("anyOf").and_then(Value::as_array) {
            return self.union_for_schemas(values);
        }
        if let Some(values) = schema.get("allOf").and_then(Value::as_array) {
            return self.all_of(schema, values);
        }
        if let Some(types) = schema.get("type").and_then(Value::as_array) {
            return self.union_for_types(schema, types);
        }
        if let Some(schema_type) = schema.get("type").and_then(Value::as_str) {
            return self.zod_for_type(schema, schema_type);
        }
        if schema.as_object().is_some_and(Map::is_empty) || schema.get("description").is_some() {
            return Ok("z.unknown()".to_owned());
        }
        Err(ContractError::UnsupportedSchema(format!("{schema}")))
    }

    fn zod_for_type(&self, schema: &Value, schema_type: &str) -> Result<String, ContractError> {
        match schema_type {
            "array" => self.array_schema(schema),
            "boolean" => Ok("z.boolean()".to_owned()),
            "integer" => Ok(numeric_schema(schema, "z.number().int()")),
            "null" => Ok("z.null()".to_owned()),
            "number" => Ok(numeric_schema(schema, "z.number()")),
            "object" => self.object_schema(schema),
            "string" => Ok("z.string()".to_owned()),
            other => Err(ContractError::UnsupportedSchema(format!(
                "schema type {other}"
            ))),
        }
    }

    fn array_schema(&self, schema: &Value) -> Result<String, ContractError> {
        let item_schema = schema.get("items").map_or_else(
            || Ok("z.unknown()".to_owned()),
            |items| self.zod_for_schema(items),
        )?;
        Ok(format!("z.array({item_schema})"))
    }

    fn object_schema(&self, schema: &Value) -> Result<String, ContractError> {
        let properties = schema.get("properties").and_then(Value::as_object);
        let additional = schema.get("additionalProperties");
        if properties.is_none() {
            return self.additional_properties(additional);
        }

        let properties = properties.ok_or_else(|| {
            ContractError::UnsupportedSchema("object properties were not an object".to_owned())
        })?;
        let mut object = format!(
            "z.object({{\n{}\n}})",
            self.object_fields(schema, properties)?
        );
        if let Some(catchall) = self.catchall_schema(additional)? {
            object.push_str(".catchall(");
            object.push_str(&catchall);
            object.push(')');
        } else {
            object.push_str(".strict()");
        }
        Ok(object)
    }

    fn object_fields(
        &self,
        schema: &Value,
        properties: &Map<String, Value>,
    ) -> Result<String, ContractError> {
        let required = required_fields(schema);
        let mut fields = Vec::new();
        for (name, property_schema) in properties {
            let mut expression = self.zod_for_schema(property_schema)?;
            if !required.contains(name) {
                expression.push_str(".optional()");
            }
            fields.push(format!("  {name}: {expression}"));
        }
        Ok(fields.join(",\n"))
    }

    fn additional_properties(&self, additional: Option<&Value>) -> Result<String, ContractError> {
        match additional {
            Some(Value::Bool(true)) => Ok("z.record(z.string(), z.unknown())".to_owned()),
            Some(Value::Object(object)) if object.is_empty() => Ok("z.unknown()".to_owned()),
            Some(value) if value.is_object() => {
                let value_schema = self.zod_for_schema(value)?;
                Ok(format!("z.record(z.string(), {value_schema})"))
            }
            _ => Ok("z.object({})".to_owned()),
        }
    }

    fn catchall_schema(&self, additional: Option<&Value>) -> Result<Option<String>, ContractError> {
        match additional {
            Some(Value::Bool(true)) => Ok(Some("z.unknown()".to_owned())),
            Some(Value::Object(object)) if object.is_empty() => Ok(Some("z.unknown()".to_owned())),
            Some(value) if value.is_object() => self.zod_for_schema(value).map(Some),
            _ => Ok(None),
        }
    }

    fn has_discriminated_one_of(&self, schema: &Value) -> bool {
        schema.get("discriminator").is_some()
            && schema.get("oneOf").and_then(Value::as_array).is_some()
    }

    fn discriminated_one_of(&self, schema: &Value) -> Result<String, ContractError> {
        let discriminator = schema
            .get("discriminator")
            .and_then(|value| value.get("propertyName"))
            .and_then(Value::as_str)
            .ok_or_else(|| ContractError::UnsupportedSchema("missing discriminator".to_owned()))?;
        let variants = schema
            .get("oneOf")
            .and_then(Value::as_array)
            .ok_or_else(|| ContractError::UnsupportedSchema("missing oneOf".to_owned()))?;
        let expressions = variants
            .iter()
            .map(|variant| self.discriminated_variant(schema, variant))
            .collect::<Result<Vec<_>, _>>()?;
        if expressions.len() == 1 {
            return expressions
                .into_iter()
                .next()
                .ok_or_else(|| ContractError::UnsupportedSchema("empty oneOf".to_owned()));
        }
        Ok(format!(
            "z.discriminatedUnion({}, [\n  {}\n])",
            quoted(discriminator)?,
            expressions.join(",\n  ")
        ))
    }

    fn discriminated_variant(
        &self,
        parent_schema: &Value,
        variant_schema: &Value,
    ) -> Result<String, ContractError> {
        let merged_schema = merged_variant_schema(parent_schema, variant_schema);
        if let Some(reference) = single_all_of_ref(&merged_schema)? {
            let base = schema_identifier(reference_name(reference)?);
            let properties = merged_schema.get("properties").and_then(Value::as_object);
            let Some(properties) = properties else {
                return Ok(base);
            };
            return Ok(format!(
                "{base}.extend({{\n{}\n}})",
                self.object_fields(&merged_schema, properties)?
            ));
        }
        self.zod_for_schema(&merged_schema)
    }

    fn union_for_schemas(&self, schemas: &[Value]) -> Result<String, ContractError> {
        union_expr(
            schemas
                .iter()
                .map(|schema| self.zod_for_schema(schema))
                .collect::<Result<Vec<_>, _>>()?,
        )
    }

    fn union_for_types(&self, schema: &Value, types: &[Value]) -> Result<String, ContractError> {
        let expressions = types
            .iter()
            .map(|schema_type| {
                let Some(schema_type) = schema_type.as_str() else {
                    return Err(ContractError::UnsupportedSchema(
                        "type array contains non-string".to_owned(),
                    ));
                };
                let mut typed_schema = schema.clone();
                typed_schema["type"] = Value::String(schema_type.to_owned());
                self.zod_for_type(&typed_schema, schema_type)
            })
            .collect::<Result<Vec<_>, _>>()?;
        union_expr(expressions)
    }

    fn all_of(&self, schema: &Value, schemas: &[Value]) -> Result<String, ContractError> {
        if let Some(reference) = single_all_of_ref(schema)? {
            return Ok(schema_identifier(reference_name(reference)?));
        }
        if schemas.len() == 1 {
            return self.zod_for_schema(&schemas[0]);
        }

        let mut expressions = schemas
            .iter()
            .map(|schema| self.zod_for_schema(schema))
            .collect::<Result<Vec<_>, _>>()?
            .into_iter();
        let Some(first) = expressions.next() else {
            return Err(ContractError::UnsupportedSchema("empty allOf".to_owned()));
        };
        Ok(expressions.fold(first, |left, right| {
            format!("z.intersection({left}, {right})")
        }))
    }
}

fn required_fields(schema: &Value) -> BTreeSet<String> {
    schema
        .get("required")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(Value::as_str)
        .map(ToOwned::to_owned)
        .collect()
}

fn single_all_of_ref(schema: &Value) -> Result<Option<&str>, ContractError> {
    let Some(values) = schema.get("allOf").and_then(Value::as_array) else {
        return Ok(None);
    };
    if values.len() != 1 {
        return Ok(None);
    }
    Ok(values[0].get("$ref").and_then(Value::as_str))
}

fn merged_variant_schema(parent_schema: &Value, variant_schema: &Value) -> Value {
    let mut merged = variant_schema.clone();
    merge_object_property(parent_schema, &mut merged, "properties");
    merge_string_array_property(parent_schema, &mut merged, "required");
    merged
}

fn merge_object_property(source: &Value, target: &mut Value, property: &str) {
    let Some(source_object) = source.get(property).and_then(Value::as_object) else {
        return;
    };
    let Some(target_object) = target.as_object_mut() else {
        return;
    };
    let entry = target_object
        .entry(property.to_owned())
        .or_insert_with(|| Value::Object(Map::new()));
    let Some(entry_object) = entry.as_object_mut() else {
        return;
    };
    for (name, value) in source_object {
        entry_object
            .entry(name.clone())
            .or_insert_with(|| value.clone());
    }
}

fn merge_string_array_property(source: &Value, target: &mut Value, property: &str) {
    let Some(source_values) = source.get(property).and_then(Value::as_array) else {
        return;
    };
    let Some(target_object) = target.as_object_mut() else {
        return;
    };
    let entry = target_object
        .entry(property.to_owned())
        .or_insert_with(|| Value::Array(Vec::new()));
    let Some(entry_values) = entry.as_array_mut() else {
        return;
    };
    for value in source_values {
        if !entry_values.contains(value) {
            entry_values.push(value.clone());
        }
    }
}

fn numeric_schema(schema: &Value, base: &str) -> String {
    if schema
        .get("minimum")
        .and_then(Value::as_i64)
        .is_some_and(|minimum| minimum == 0)
    {
        format!("{base}.nonnegative()")
    } else {
        base.to_owned()
    }
}

fn union_expr(expressions: Vec<String>) -> Result<String, ContractError> {
    let mut unique = Vec::new();
    for expression in expressions {
        if expression == "z.unknown()" {
            return Ok(expression);
        }
        if !unique.contains(&expression) {
            unique.push(expression);
        }
    }
    match unique.len() {
        0 => Err(ContractError::UnsupportedSchema("empty union".to_owned())),
        1 => unique
            .into_iter()
            .next()
            .ok_or_else(|| ContractError::UnsupportedSchema("empty union".to_owned())),
        _ => Ok(format!("z.union([{}])", unique.join(", "))),
    }
}

fn literal_expr(value: &Value) -> Result<String, ContractError> {
    if value.is_null() {
        return Ok("z.null()".to_owned());
    }
    Ok(format!("z.literal({})", serde_json::to_string(value)?))
}

fn quoted(value: &str) -> Result<String, ContractError> {
    serde_json::to_string(value).map_err(ContractError::from)
}

fn reference_name(reference: &str) -> Result<&str, ContractError> {
    reference
        .strip_prefix("#/$defs/")
        .ok_or_else(|| ContractError::InvalidReference(reference.to_owned()))
}

fn references_in(value: &Value) -> Result<BTreeSet<String>, ContractError> {
    let mut references = BTreeSet::new();
    collect_references(value, &mut references)?;
    Ok(references)
}

fn collect_references(
    value: &Value,
    references: &mut BTreeSet<String>,
) -> Result<(), ContractError> {
    match value {
        Value::Array(values) => {
            for item in values {
                collect_references(item, references)?;
            }
        }
        Value::Object(object) => {
            if let Some(reference) = object.get("$ref").and_then(Value::as_str) {
                references.insert(reference_name(reference)?.to_owned());
            }
            for item in object.values() {
                collect_references(item, references)?;
            }
        }
        Value::Bool(_) | Value::Null | Value::Number(_) | Value::String(_) => {}
    }
    Ok(())
}

fn schema_identifier(name: &str) -> String {
    format!("{}Schema", type_identifier(name))
}

fn type_identifier(name: &str) -> String {
    let mut identifier = if name.starts_with("Conduit") {
        String::new()
    } else {
        String::from("Acp")
    };
    for character in name.chars() {
        if character.is_ascii_alphanumeric() {
            identifier.push(character);
        }
    }
    identifier
}
