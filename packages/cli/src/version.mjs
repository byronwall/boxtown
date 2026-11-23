import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json");

export const packageName = typeof packageJson.name === "string"
  ? packageJson.name
  : "boxtown";

export const packageVersion = typeof packageJson.version === "string"
  ? packageJson.version
  : "0.0.0";

export const cliUserAgent = `${packageName}/${packageVersion}`;
