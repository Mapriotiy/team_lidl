/**
 * Zod -> JSON Schema, in the dialect OpenAI-compatible strict mode wants.
 *
 * Strict `json_schema` response formats require every object to set
 * `additionalProperties: false` and to list *every* property in `required`.
 * zod-to-json-schema emits idiomatic JSON Schema instead, so the output is
 * walked once and tightened. The same schema is also printed into the prompt,
 * where the explicit `required` list doubles as documentation.
 */
import { zodToJsonSchema as convert } from "zod-to-json-schema";
import type { ZodType } from "zod";

type JsonObject = Record<string, unknown>;

function tighten(node: unknown): void {
  if (Array.isArray(node)) {
    node.forEach(tighten);
    return;
  }
  if (!node || typeof node !== "object") return;

  const schema = node as JsonObject;

  if (schema.type === "object" && schema.properties && typeof schema.properties === "object") {
    const props = schema.properties as JsonObject;
    schema.additionalProperties = false;
    schema.required = Object.keys(props);
    Object.values(props).forEach(tighten);
  }

  for (const key of ["items", "anyOf", "allOf", "oneOf", "definitions", "$defs"] as const) {
    if (schema[key]) tighten(schema[key]);
  }
}

export function zodToJsonSchema(schema: ZodType<unknown>): JsonObject {
  const out = convert(schema, { $refStrategy: "none", target: "jsonSchema7" }) as JsonObject;
  // $schema is noise in a prompt and some gateways reject it inside json_schema.
  delete out.$schema;
  tighten(out);
  return out;
}
