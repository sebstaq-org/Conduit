import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerZIP } from "@electron-forge/maker-zip";

const stageResourcesDirectoryName = "stage-resources";
const resourcesDir = process.env.CONDUIT_STAGE_RESOURCES_DIR;
const packageOutDir = process.env.CONDUIT_STAGE_PACKAGE_OUT_DIR ?? "out/forge";
const extraResource: string[] = [];
if (resourcesDir !== undefined && resourcesDir.trim().length > 0) {
  extraResource.push(resourcesDir);
}

const config: ForgeConfig = {
  outDir: packageOutDir,
  makers: [new MakerZIP({}, ["linux"])],
  packagerConfig: {
    asar: true,
    executableName: "conduit-stage",
    extraResource,
    ignore: [
      /^\/electron\.vite\.config\.ts$/,
      /^\/node_modules($|\/)/,
      /^\/src($|\/)/,
      /^\/test($|\/)/,
      /^\/tsconfig\..*\.json$/,
      /^\/tsconfig\.json$/,
      /^\/vitest\.config\.ts$/,
    ],
    name: "conduit-stage",
    overwrite: true,
    prune: false,
  },
};

if (
  resourcesDir !== undefined &&
  !resourcesDir.endsWith(stageResourcesDirectoryName)
) {
  throw new Error(
    `CONDUIT_STAGE_RESOURCES_DIR must end with ${stageResourcesDirectoryName}.`,
  );
}

export default config;
