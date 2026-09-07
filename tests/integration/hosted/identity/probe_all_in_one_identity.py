"""ZA-05 exact all-in-one identity seam against a disposable local volume.

Proves:
  ZA-05-01 readiness under restricted runtime identities (app UID zoen)
  ZA-05-02 denied infra auth / bootstrap file reads / SET ROLE from app identity
  ZA-05-03 missing bootstrap password / entrypoint failure status fail closed

Does not deploy Fly or touch live resources. Requires Docker.
"""

from __future__ import annotations

import json
import os
import secrets
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen
from uuid import uuid4


ROOT = Path(__file__).resolve().parents[4]


def run(args: list[str], **options):
    options.setdefault("check", True)
    return subprocess.run(args, cwd=ROOT, **options)


def wait_ready(origin: str, timeout: float = 180.0) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with urlopen(f"{origin}/ready", timeout=2) as response:
                if response.status == 200 and json.load(response) == {
                    "status": "ready"
                }:
                    return
        except (URLError, TimeoutError, ConnectionError, json.JSONDecodeError):
            pass
        time.sleep(1)
    raise RuntimeError(f"all-in-one did not become ready at {origin}")


def docker_exec(container: str, command: list[str], user: str | None = None) -> subprocess.CompletedProcess:
    args = ["docker", "exec"]
    if user:
        args.extend(["-u", user])
    args.append(container)
    args.extend(command)
    return subprocess.run(args, cwd=ROOT, capture_output=True, text=True, check=False)


def main() -> int:
    profile = f"za05-{uuid4().hex[:12]}"
    image = f"zoen-all-in-one:{profile}"
    volume = f"{profile}-data"
    container = profile
    origin = "http://127.0.0.1:4310"
    auth_secret = secrets.token_hex(32)
    artifacts = ROOT / ".local" / f"{profile}-identity"
    artifacts.mkdir(mode=0o700, parents=True)

    preexisting = os.environ.get("ZOEN_IDENTITY_IMAGE")
    if preexisting:
        image = preexisting
        print(f"Reusing image {image}", flush=True)
    else:
        print(f"Building {image}", flush=True)
        with (artifacts / "build.log").open("x") as log:
            run(
                [
                    "docker",
                    "build",
                    "-f",
                    "ops/containers/all-in-one.Dockerfile",
                    "-t",
                    image,
                    ".",
                ],
                stdout=log,
                stderr=subprocess.STDOUT,
            )

    run(["docker", "volume", "create", volume], stdout=subprocess.DEVNULL)

    def start(extra_env: list[str] | None = None) -> None:
        env_args: list[str] = [
            "-e",
            f"ZOEN_AUTH_SECRET={auth_secret}",
            "-e",
            "ZOEN_PUBLIC_URL=http://127.0.0.1:4310",
        ]
        if extra_env:
            for item in extra_env:
                env_args.extend(["-e", item])
        run(
            [
                "docker",
                "run",
                "-d",
                "--name",
                container,
                "--publish",
                "127.0.0.1:4310:4310",
                "--mount",
                f"type=volume,src={volume},dst=/data",
                *env_args,
                image,
            ],
            stdout=subprocess.DEVNULL,
        )

    try:
        start()
        wait_ready(origin)
        print("ZA-05-01: ready under restricted identities", flush=True)

        # App process user (gosu zoen → node main.js)
        who = docker_exec(
            container,
            ["bash", "-lc", "ps -eo user=,args= | grep '[n]ode /app/apps/server/dist/main.js' | awk '{print $1}'"],
        )
        users = {line.strip() for line in who.stdout.splitlines() if line.strip()}
        if "zoen" not in users:
            raise RuntimeError(f"expected app UID zoen, observed {users!r} stdout={who.stdout!r}")

        # Bootstrap files unreadable to zoen
        denied = docker_exec(
            container,
            ["bash", "-lc", "cat /data/bootstrap/pg-infra.password"],
            user="zoen",
        )
        if denied.returncode == 0:
            raise RuntimeError("zoen could read /data/bootstrap/pg-infra.password")

        # zoen must not be able to rename/replace the root-only bootstrap directory
        rename = docker_exec(
            container,
            ["bash", "-lc", "mv /data/bootstrap /data/bootstrap.stolen"],
            user="zoen",
        )
        if rename.returncode == 0:
            raise RuntimeError("zoen could rename /data/bootstrap")

        # Trust auth must be gone
        hba = docker_exec(container, ["bash", "-lc", "grep -E 'trust|scram' /data/postgres/pg_hba.conf"])
        if "trust" in hba.stdout and "scram-sha-256" not in hba.stdout:
            raise RuntimeError("pg_hba still trusts without SCRAM")
        if "scram-sha-256" not in hba.stdout:
            raise RuntimeError("pg_hba missing scram-sha-256")

        # App runtime.env must not contain infra role or bootstrap URL
        runtime = docker_exec(container, ["bash", "-lc", "cat /data/zoen/runtime.env"], user="zoen")
        if runtime.returncode != 0:
            raise RuntimeError("zoen cannot read runtime.env")
        if "zoen_infra" in runtime.stdout or "ZOEN_BOOTSTRAP_ADMIN_URL" in runtime.stdout:
            raise RuntimeError("runtime.env leaks bootstrap admin identity")
        if "ZOEN_S3_ADMIN_" in runtime.stdout:
            raise RuntimeError("runtime.env leaks object-store admin keys")

        # Passwordless / wrong infra auth denied from loopback
        infra_denied = docker_exec(
            container,
            [
                "bash",
                "-lc",
                "psql 'postgresql://zoen_infra@127.0.0.1:5432/postgres' -c 'SELECT 1'",
            ],
            user="zoen",
        )
        if infra_denied.returncode == 0:
            raise RuntimeError("passwordless zoen_infra auth unexpectedly succeeded")

        # SET ROLE to infra from authority role should fail
        # Extract authority URL without printing secrets to stdout artifacts
        set_role = docker_exec(
            container,
            [
                "bash",
                "-lc",
                "set -a; source /data/zoen/runtime.env; set +a; "
                "psql \"$ZOEN_AUTHORITY_DATABASE_URL\" -v ON_ERROR_STOP=1 "
                "-c \"SET ROLE zoen_infra\"",
            ],
            user="zoen",
        )
        if set_role.returncode == 0:
            raise RuntimeError("SET ROLE zoen_infra unexpectedly succeeded")

        # App S3 credentials must not create foreign buckets (scoped IAM)
        scoped = docker_exec(
            container,
            [
                "bash",
                "-lc",
                "set -a; source /data/zoen/runtime.env; set +a; "
                "node --input-type=module <<'NODE'\n"
                "import { createRequire } from 'node:module';\n"
                "const require = createRequire('/app/apps/server/package.json');\n"
                "const { S3Client, CreateBucketCommand } = require('@aws-sdk/client-s3');\n"
                "const client = new S3Client({\n"
                "  credentials: {\n"
                "    accessKeyId: process.env.ZOEN_S3_ACCESS_KEY,\n"
                "    secretAccessKey: process.env.ZOEN_S3_SECRET_KEY,\n"
                "  },\n"
                "  endpoint: process.env.ZOEN_S3_ENDPOINT,\n"
                "  forcePathStyle: true,\n"
                "  region: process.env.ZOEN_S3_REGION || 'us-east-1',\n"
                "});\n"
                "try {\n"
                "  await client.send(new CreateBucketCommand({ Bucket: 'za05-should-deny' }));\n"
                "  console.log('CREATED');\n"
                "  process.exit(0);\n"
                "} catch (error) {\n"
                "  console.log('DENIED');\n"
                "  process.exit(2);\n"
                "}\n"
                "NODE",
            ],
            user="zoen",
        )
        if "DENIED" not in scoped.stdout and scoped.returncode != 2:
            raise RuntimeError(f"scoped S3 create-bucket probe failed: {scoped.stdout} {scoped.stderr}")

        print("ZA-05-02: admin auth / bootstrap reads / SET ROLE / scoped S3 denied", flush=True)

        # ZA-05-03a: passwordless admin URL fail-closed at bootstrap module
        run(["docker", "rm", "--force", container], stdout=subprocess.DEVNULL)
        fail_volume = f"{profile}-fail"
        run(["docker", "volume", "create", fail_volume], stdout=subprocess.DEVNULL)
        probe = subprocess.run(
            [
                "docker",
                "run",
                "--rm",
                "--entrypoint",
                "bash",
                image,
                "-lc",
                "export ZOEN_BOOTSTRAP_ADMIN_URL='postgresql://zoen_infra@127.0.0.1:5432/postgres'; "
                "export ZOEN_S3_ADMIN_ACCESS_KEY=x; export ZOEN_S3_ADMIN_SECRET_KEY=y; "
                "export ZOEN_S3_ENDPOINT=http://127.0.0.1:9000; "
                "export ZOEN_INSTALLATION_FILE=/tmp/i.json; "
                "export ZOEN_RUNTIME_ENV_FILE=/tmp/r.env; "
                "export ZOEN_AUTH_SECRET=fixture; "
                "export ZOEN_RELEASE_FILE=/app/apps/server/dist/release.json; "
                "export NODE_PATH=/app/apps/server/node_modules; "
                "node /app/apps/server/scripts/all-in-one-bootstrap.ts; echo EXIT:$?",
            ],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        combined = (probe.stdout or "") + (probe.stderr or "")
        if "EXIT:0" in combined:
            raise RuntimeError("passwordless bootstrap unexpectedly succeeded")
        (artifacts / "fail-closed.log").write_text(combined)
        print("ZA-05-03a: passwordless bootstrap module fail-closed", flush=True)

        # ZA-05-03b: entrypoint must surface bootstrap failure as nonzero container exit
        # (regression guard for `if ! node ...; status=$?` discarding the real status).
        fail_name = f"{profile}-failclosed-entrypoint"
        run(
            [
                "docker",
                "run",
                "-d",
                "--name",
                fail_name,
                "--mount",
                f"type=volume,src={fail_volume},dst=/data",
                # Omit ZOEN_AUTH_SECRET so bootstrap fails after Postgres/RustFS start.
                "-e",
                "ZOEN_PUBLIC_URL=http://127.0.0.1:4310",
                image,
            ],
            stdout=subprocess.DEVNULL,
        )
        wait_proc = subprocess.run(
            ["docker", "wait", fail_name],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        entrypoint_status = int((wait_proc.stdout or "0").strip() or "0")
        fail_logs = subprocess.run(
            ["docker", "logs", fail_name],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        (artifacts / "entrypoint-fail-closed.log").write_text(
            (fail_logs.stdout or "") + (fail_logs.stderr or "")
        )
        subprocess.run(
            ["docker", "rm", "--force", fail_name],
            cwd=ROOT,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
        if entrypoint_status == 0:
            raise RuntimeError(
                "entrypoint masked bootstrap failure with exit 0 "
                f"(logs in {artifacts / 'entrypoint-fail-closed.log'})"
            )
        print(
            f"ZA-05-03b: entrypoint bootstrap failure exit={entrypoint_status}",
            flush=True,
        )
        run(["docker", "volume", "rm", fail_volume], stdout=subprocess.DEVNULL, check=False)

        digest = run(
            ["docker", "image", "inspect", "--format", "{{.Id}}", image],
            capture_output=True,
            text=True,
        ).stdout.strip()
        (artifacts / "result.json").write_text(
            json.dumps(
                {
                    "checks": ["ZA-05-01", "ZA-05-02", "ZA-05-03a", "ZA-05-03b"],
                    "image": image,
                    "imageId": digest,
                    "profile": profile,
                    "status": "passed",
                },
                indent=2,
            )
            + "\n"
        )
        print(f"Identity seam passed for {image} ({digest})", flush=True)
        return 0
    finally:
        try:
            with (artifacts / "container.log").open("w") as log:
                subprocess.run(["docker", "logs", container], cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, check=False)
        except Exception:
            pass
        subprocess.run(
            ["docker", "rm", "--force", container],
            cwd=ROOT,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
        subprocess.run(
            ["docker", "volume", "rm", volume],
            cwd=ROOT,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except subprocess.CalledProcessError as error:
        print(error, file=sys.stderr)
        raise SystemExit(error.returncode)
