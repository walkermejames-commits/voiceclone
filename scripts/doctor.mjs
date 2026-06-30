import { access, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const requiredFiles = [
  "app/page.tsx",
  "app/projects/new/page.tsx",
  "app/projects/[id]/page.tsx",
  "app/health/page.tsx",
  "lib/server/projects.ts",
  "lib/server/narrator.ts",
  "lib/server/storage.ts",
  "package.json",
  "README.md",
];

const requiredScripts = ["dev", "build", "start", "lint", "typecheck", "doctor", "check"];

async function exists(relativePath) {
  await access(path.join(root, relativePath));
}

async function main() {
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const missingScripts = requiredScripts.filter((script) => !packageJson.scripts?.[script]);
  if (missingScripts.length > 0) {
    throw new Error(`Missing package scripts: ${missingScripts.join(", ")}`);
  }

  for (const file of requiredFiles) {
    await exists(file);
  }

  await mkdir(path.join(root, "data", "projects"), { recursive: true });

  console.log("ChipVoice doctor passed");
  console.log(`Platform: ${process.platform}`);
  console.log(`Node: ${process.version}`);
  console.log("Required app files: OK");
  console.log("Required package scripts: OK");
  console.log("Data directory: OK");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
