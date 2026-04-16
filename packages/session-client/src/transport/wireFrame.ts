import { ServerFrameSchema } from "@conduit/app-protocol";
import type { ServerFrame } from "@conduit/app-protocol";

function parseServerFrame(text: string): ServerFrame | null {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return null;
  }
  const result = ServerFrameSchema.safeParse(parsed);
  if (!result.success) {
    return null;
  }
  return result.data;
}

export { parseServerFrame };
