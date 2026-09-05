# EX22: loss after emitter return, before the Node writer

Baseline: `815684b`, Node 24.18.1, Effect 4.0.0-rc.112, native pg 8.23.0, local real PostgreSQL. Reproduced twice on 2026-09-05 at 16:46:52 and 16:47:58 America/Sao_Paulo. The final reproduction uses the real Effect HTTP client against a real ephemeral Node HTTP server.

Run:

```sh
node --env-file=.env.infra node_modules/vitest/vitest.mjs run --project integration apps/server/test/adapters/postgres/disclosure/writer-loss.integration.test.ts
```

The handler acquires real shared session/membership locks and returns a bounded buffer containing a synthetic unique marker. `appendPreResponseHandler` pauses after that return and before the actual writer. A separate SQL connection first confirms that the session exclusive cannot be acquired, terminates the coordinator backend, then acquires and commits the session exclusive. After resuming the writer, the native `ServerResponse.end` wrapper forwards every original call and records its entry/return. It does not substitute a response or provider.

Observed trace from the second run:

```text
emitter.return
preResponse.pause
coordinator.terminated
exclusive.acquired.and.committed
preResponse.resume
node.end.enter
node.end.return
scope.close
fiber.exit.interrupted=true
```

The real client received HTTP 200 with body `private-probe-6cfad658-8272-4412-88f7-1a6ce4feb747`. The assertion that the private marker must not be delivered failed. The initial run using native fetch produced the same order and failure with a different unique marker.

This is a causal failure reproduction for the real coordinator and HTTP lifecycle, not an accepted application journey or a successful disclosure test. The caller fiber was eventually interrupted, but the uninterruptible HTTP response region deferred that interruption until after private bytes reached `end`. Physical lock release following coordinator connection loss therefore permits an exclusive writer to commit before the old private response is emitted. Ordinary scoped cleanup and interruption alone do not establish the promised ordering. The non-disclosure assertion remains in the test; no alternative coordination contract has been implemented in this commit.
