import { describe, expect, it } from "@effect/vitest";
import { SqlError } from "effect/unstable/sql";

import { isTransactionConflict } from "../../src/commit/transaction.js";

describe("EX05 SQL retry classification", () => {
  it("allows only serialization and deadlock reasons", () => {
    const causes = [
      new SqlError.SerializationError({ cause: undefined }),
      new SqlError.DeadlockError({ cause: undefined }),
    ];
    for (const reason of causes) {
      expect(
        isTransactionConflict(new SqlError.SqlError({ reason }))
      ).toBeTruthy();
    }
    const excluded = [
      new SqlError.ConnectionError({ cause: undefined }),
      new SqlError.LockTimeoutError({ cause: undefined }),
      new SqlError.StatementTimeoutError({ cause: undefined }),
      new SqlError.ConstraintError({ cause: undefined }),
    ];
    for (const reason of excluded) {
      expect(
        isTransactionConflict(new SqlError.SqlError({ reason }))
      ).toBeFalsy();
    }
    expect(
      isTransactionConflict({ _tag: "SqlError", code: "40001" })
    ).toBeFalsy();
  });
});
