import { rm, writeFile } from "node:fs/promises";
import type { ChildProcess } from "node:child_process";

async function removePidFile(path: string | null): Promise<void> {
  if (path !== null) {
    await rm(path, { force: true });
  }
}

async function writePidFile(
  path: string | null,
  child: ChildProcess,
): Promise<void> {
  if (child.pid !== undefined && path !== null) {
    await writeFile(path, String(child.pid), "utf8");
  }
}

export { removePidFile, writePidFile };
