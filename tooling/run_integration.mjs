import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vitest = path.join(root, "node_modules/vitest/vitest.mjs");
const raw = process.argv.slice(2);
const filters = raw[0] === "--" ? raw.slice(1) : raw;
// Path filters are project-scoped: a legacy-only path matches nothing in
// `integration`, and vice versa. Allow empty selection only when filtering.
const allowEmpty = filters.length > 0 ? ["--passWithNoTests"] : [];

for (const project of ["integration-legacy", "integration"]) {
  const result = spawnSync(
    process.execPath,
    [
      "--env-file=.env.infra",
      vitest,
      "run",
      "--project",
      project,
      ...allowEmpty,
      ...filters,
    ],
    { cwd: root, stdio: "inherit" }
  );
  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
