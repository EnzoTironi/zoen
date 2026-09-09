import { homedir } from "node:os";

import { Effect, Path } from "effect";

import { McpFailure } from "./output.js";

export const validateBaseUrl = (value: string): string => {
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      ))
  ) {
    throw new McpFailure("MCP_CONFIG");
  }
  return url.origin;
};

export interface McpConfig {
  readonly baseUrl: string;
  readonly sessionDir: string;
}

/** Stdio hosts inject ZOEN_* via process env (Cursor/Claude mcp.json). */
export const loadConfig = Effect.fn(function* loadConfig() {
  const rawBase = process.env.ZOEN_BASE_URL;
  if (rawBase === undefined || rawBase === "") {
    return yield* new McpFailure("MCP_CONFIG");
  }
  const baseUrl = yield* Effect.try({
    catch: () => new McpFailure("MCP_CONFIG"),
    try: () => validateBaseUrl(rawBase),
  });
  const path = yield* Path.Path;
  const configuredSession = process.env.ZOEN_SESSION_DIR;
  const sessionDir =
    configuredSession === undefined || configuredSession === ""
      ? path.join(homedir(), ".config", "zoen")
      : configuredSession;
  return { baseUrl, sessionDir } satisfies McpConfig;
});
