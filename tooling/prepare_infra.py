"""Create credentials for this checkout's real disposable Compose services once."""

import os
from pathlib import Path
import secrets


def main():
    target = Path(__file__).resolve().parent.parent / ".env.infra"
    admin, runtime = secrets.token_hex(24), secrets.token_hex(24)
    values = {
        "ZOEN_TEST_DB_ADMIN_PASSWORD": admin,
        "ZOEN_TEST_DB_RUNTIME_PASSWORD": runtime,
        "ZOEN_TEST_DATABASE_URL": f"postgresql://zoen_infra:{admin}@127.0.0.1:55434/zoen_test",
        "ZOEN_TEST_RUNTIME_DATABASE_URL": f"postgresql://zoen_runtime:{runtime}@127.0.0.1:55434/zoen_test",
        "ZOEN_TEST_S3_ENDPOINT": "http://127.0.0.1:59004",
        "ZOEN_TEST_S3_ACCESS_KEY": secrets.token_hex(12),
        "ZOEN_TEST_S3_SECRET_KEY": secrets.token_hex(32),
    }
    # Never replace credentials for existing database/storage volumes or follow an existing symlink.
    descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w") as stream:
        stream.write("".join(f"{key}={value}\n" for key, value in values.items()))
    print("Created .env.infra with owner-only permissions; existing volumes are unchanged.")


if __name__ == "__main__":
    main()
