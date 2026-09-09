import { describe, expect, it } from "@effect/vitest";

import { validateBaseUrl } from "../src/config.ts";
import { McpFailure } from "../src/output.ts";

describe("MCP config", () => {
  it("accepts HTTPS and loopback HTTP origins only", () => {
    expect(validateBaseUrl("http://127.0.0.1:4310/")).toBe(
      "http://127.0.0.1:4310"
    );
    expect(validateBaseUrl("https://zoen.example")).toBe(
      "https://zoen.example"
    );
    for (const value of [
      "http://zoen.example",
      "https://person:secret@zoen.example",
      "https://zoen.example/path",
      "file:///tmp/x",
    ]) {
      expect(() => validateBaseUrl(value)).toThrow(McpFailure);
    }
  });
});
