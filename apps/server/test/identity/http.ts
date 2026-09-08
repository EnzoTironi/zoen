import { randomBytes, randomUUID } from "node:crypto";

import { Effect, Redacted, Schema } from "effect";

import { IdentityAuth } from "../../src/identity/identity.ts";

export const UserResponse = Schema.Struct({
  user: Schema.Struct({
    emailVerified: Schema.Boolean,
    id: Schema.String.check(Schema.isUUID()),
  }),
});

export const cookieCredential = (response: Response) =>
  Redacted.make(
    response.headers
      .getSetCookie()
      .map((cookie) => cookie.split(";")[0])
      .join("; ")
  );

export const postAuth = Effect.fn("test.postAuth")(function* post(
  baseUrl: string,
  path: string,
  body: unknown,
  credential?: Redacted.Redacted
) {
  const auth = yield* IdentityAuth;
  const headers = new Headers({
    "Content-Type": "application/json",
    origin: baseUrl,
  });
  if (credential !== undefined) {
    headers.set("cookie", Redacted.value(credential));
  }
  return yield* auth.handle(
    new Request(`${baseUrl}/api/auth/${path}`, {
      body: yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))(
        body
      ),
      headers,
      method: "POST",
    })
  );
});

export const createAccount = Effect.fn("test.createRealAccount")(
  function* createAccount(
    baseUrl: string,
    additional: Readonly<Record<string, unknown>> = {}
  ) {
    const email = `${randomUUID()}@example.test`;
    const password = Redacted.make(randomBytes(24).toString("base64url"));
    const response = yield* postAuth(baseUrl, "sign-up/email", {
      ...additional,
      email,
      name: "Real local account",
      password: Redacted.value(password),
    });
    if (response.status !== 200) {
      throw new Error(`Real signup failed with status ${response.status}`);
    }
    const body = yield* Effect.tryPromise(() => response.json()).pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(UserResponse))
    );
    return {
      credential: cookieCredential(response),
      email,
      password,
      response,
      user: body.user,
    };
  }
);
