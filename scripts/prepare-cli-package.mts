import { spawn } from "node:child_process";
import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appDir = path.join(root, "app");
const cliDir = path.join(root, "packages", "cli");
const runtimeDir = path.join(cliDir, "runtime");
const buildDir = path.join(cliDir, "build");

await run("pnpm", ["--dir", appDir, "build"], {
  cwd: root,
  env: { ...process.env, BASE_PATH: "/" },
});
await rm(buildDir, { recursive: true, force: true });
await run("pnpm", [
  "--dir",
  appDir,
  "exec",
  "tsc",
  "../packages/cli/src/local-runtime.mts",
  "--target",
  "ES2022",
  "--module",
  "NodeNext",
  "--moduleResolution",
  "NodeNext",
  "--types",
  "node",
  "--typeRoots",
  "./node_modules/@types",
  "--skipLibCheck",
  "--outDir",
  "../packages/cli/build",
], { cwd: root, env: process.env });

await rm(runtimeDir, { recursive: true, force: true });
await mkdir(cliDir, { recursive: true });
await cp(path.join(appDir, ".output"), runtimeDir, { recursive: true, dereference: false });
console.log(`Prepared CLI runtime at ${runtimeDir}`);

function run(command: string, args: string[], options: Parameters<typeof spawn>[2]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: "inherit" });
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}.`)));
  });
}
