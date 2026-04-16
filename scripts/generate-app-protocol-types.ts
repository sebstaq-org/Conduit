interface ConsumerContractBundle {
  version: number;
  roots: Record<string, JsonSchema>;
}

type JsonSchema = Record<string, unknown>;

type CompileSchema = (
  schema: JsonSchema,
  name: string,
  options: {
    bannerComment: string;
    unreachableDefinitions: boolean;
    style: {
      singleQuote: boolean;
    };
  },
) => Promise<string>;

export type { CompileSchema, ConsumerContractBundle, JsonSchema };
