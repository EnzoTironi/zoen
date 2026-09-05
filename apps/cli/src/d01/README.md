# D01 CLI candidate — EX11

`command.ts` exports `d01Command`. Root composes `Command.run({ version })`, `NodeServices.layer`, `FetchHttpClient.layer`, and `NodeRuntime.runMain` in the reserved entrypoint. Every command needs `--base-url <origin>`; the default session directory is `~/.config/zoen` (0700).

Commands: `sign-up`, `sign-in`, `sign-out`, `create-world`, `import`, `inspect`, `open`. Command help describes flags. Passwords use stdin or an owned 0600 `--password-file`. Sessions store the real authentication cookie in an owned 0600 file bound to the exact origin. An existing session file is never overwritten. Sign out revokes the server session before removing that file.

Import reads unchanged UTF-8 document text through `--file` or stdin, including BOM, whitespace, and duplicate keys. The server owns document interpretation. Mutation commands require explicit operation UUIDs, which callers reuse for retries. Results preserve the public response and are JSON on stdout. Failures are sanitized JSON on stderr and set a nonzero exit status. Fetch redirects are disabled so credentials cannot follow a different destination.

The HTTP transport uses `HttpApiClient.make(ApplicationApi)` and the real EX09 identity endpoints. There are no authority, SQL, or storage imports. Four local tests exercise result/error formatting, URL validation, raw input boundaries, and session permissions/origin binding. They do not prove server behavior.

Acceptance remains pending real process integration against EX10 and independent review by worker-2/root. The installed Effect CLI declaration references a stripped internal type; the separately reviewed root dependency patch is also required for strict compilation.
