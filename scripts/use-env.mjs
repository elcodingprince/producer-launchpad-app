import fs from "node:fs";
import path from "node:path";

const sourceArg = process.argv[2];

if (!sourceArg) {
  console.error("Usage: node ./scripts/use-env.mjs <source-env-file>");
  process.exit(1);
}

const rootDir = process.cwd();
const sourcePath = path.resolve(rootDir, sourceArg);
const targetPath = path.resolve(rootDir, ".env");

if (!fs.existsSync(sourcePath)) {
  console.error(`Env file not found: ${sourceArg}`);
  console.error("Create it first, for example by copying .env.local.example to .env.local.");
  process.exit(1);
}

fs.copyFileSync(sourcePath, targetPath);

console.log(`Activated env from ${sourceArg}`);
console.log("Local commands like `npm run dev` will now use values from .env.");
