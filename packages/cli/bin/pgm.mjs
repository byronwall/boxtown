#!/usr/bin/env node
import { main } from "../src/main.mjs";

main(process.argv).catch((error) => {
  const code = Number.isInteger(error?.exitCode) ? error.exitCode : 1;
  const message = error instanceof Error ? error.message : "Unexpected CLI error.";
  process.stderr.write(`${message}\n`);
  process.exitCode = code;
});
