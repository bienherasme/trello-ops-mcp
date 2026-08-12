import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Reads the version from package.json at runtime rather than hardcoding it,
 * so it can't drift from the published package version. Works identically
 * from src/ (via tsx) and dist/ (after build) since both sit one directory
 * below the project root.
 */
function readPackageVersion(): string {
  const packageJsonPath = fileURLToPath(new URL("../../package.json", import.meta.url));
  const raw = readFileSync(packageJsonPath, "utf-8");
  const pkg = JSON.parse(raw) as { version?: string };
  return pkg.version ?? "0.0.0";
}

export const SERVER_NAME = "trello-ops-mcp";
export const SERVER_VERSION = readPackageVersion();
