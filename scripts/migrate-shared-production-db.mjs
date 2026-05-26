#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required to migrate the shared production database.");
  process.exit(1);
}

let parsedUrl;

try {
  parsedUrl = new URL(databaseUrl);
} catch {
  console.error("DATABASE_URL must be a valid PostgreSQL connection string.");
  process.exit(1);
}

const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
const isLocalDatabase = localHosts.has(parsedUrl.hostname);

if (isLocalDatabase && process.env.ALLOW_LOCAL_SHARED_DB_MIGRATION !== "1") {
  console.error(
    "Refusing to run the shared production migration script against a local database.",
  );
  console.error("Set ALLOW_LOCAL_SHARED_DB_MIGRATION=1 only for local smoke tests.");
  process.exit(1);
}

if (!parsedUrl.protocol.startsWith("postgres")) {
  console.error("Shared production migrations must target PostgreSQL.");
  process.exit(1);
}

const databaseName = parsedUrl.pathname.replace(/^\//, "") || "(default)";

console.log("Running Prisma migrations once for the shared database.");
console.log(`Target: ${parsedUrl.hostname}/${databaseName}`);

const result = spawnSync("npm", ["run", "db:migrate:deploy"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
