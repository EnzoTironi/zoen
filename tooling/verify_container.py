"""Build and exercise the real application image against the local Compose services."""

import json
import os
from pathlib import Path
import subprocess
import time
from urllib.error import URLError
from urllib.parse import urlsplit, urlunsplit
from urllib.request import urlopen
from uuid import uuid4


ROOT = Path(__file__).resolve().parent.parent


def run(arguments, **options):
    return subprocess.run(arguments, cwd=ROOT, check=True, **options)


def database_in_compose(value):
    url = urlsplit(value)
    credentials, separator, _ = url.netloc.rpartition("@")
    if not separator:
        raise ValueError("The provisioned database URL has no role credentials")
    return urlunsplit((url.scheme, f"{credentials}@postgres:5432", url.path, url.query, url.fragment))


def wait_ready(origin):
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        try:
            with urlopen(f"{origin}/ready", timeout=2) as response:
                if response.status == 200 and json.load(response) == {"status": "ready"}:
                    return
        except (URLError, TimeoutError, ConnectionError):
            pass
        time.sleep(0.5)
    raise RuntimeError("The application container did not become ready within 60 seconds")


def main():
    profile = f"container-{uuid4().hex[:16]}"
    image = f"zoen-local:{profile}"
    origin = "http://127.0.0.1:4313"
    artifacts = ROOT / ".local" / f"{profile}-proof"
    artifacts.mkdir(mode=0o700, parents=True)
    print(f"Building {image}; evidence directory: {artifacts.relative_to(ROOT)}", flush=True)
    with (artifacts / "build.log").open("x") as log:
        run(["docker", "build", "-f", "ops/containers/application.Dockerfile", "-t", image, "."], stdout=log, stderr=subprocess.STDOUT)

    # The installation digest comes from the executable image, never a host build or a guessed tag.
    staged = run(["docker", "create", image], capture_output=True, text=True).stdout.strip()
    release = artifacts / "release.json"
    try:
        run(["docker", "cp", f"{staged}:/app/apps/server/dist/release.json", str(release)])
    finally:
        run(["docker", "rm", staged], stdout=subprocess.DEVNULL)

    environment = {key: value for key, value in os.environ.items() if not key.startswith("ZOEN_")} | {
        "ZOEN_LOCAL_PROFILE": profile,
        "ZOEN_LOCAL_PUBLIC_URL": origin,
        "ZOEN_LOCAL_RELEASE_FILE": str(release),
        "ZOEN_TEST_WEB_URL": origin,
        "ZOEN_TEST_CSV_WEB_URL": origin,
    }
    run(["pnpm", "provision:local"], env=environment)
    # Provision writes JSON-compatible quoted values and refuses embedded control/escape bytes.
    values = {
        key: json.loads(value)
        for key, value in (
            line.split("=", 1)
            for line in (ROOT / f".env.{profile}").read_text().splitlines()
        )
    }
    installation = Path(values["ZOEN_INSTALLATION_FILE"])
    for key in ["ZOEN_AUTHORITY_DATABASE_URL", "ZOEN_IDENTITY_DATABASE_URL"]:
        values[key] = database_in_compose(values[key])
    values |= {
        "ZOEN_INSTALLATION_FILE": "/run/zoen/installation.json",
        "ZOEN_LISTEN_HOST": "0.0.0.0",
        "ZOEN_S3_ENDPOINT": "http://object-storage:9000",
    }
    container_env = artifacts / "runtime.env"
    descriptor = os.open(container_env, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w") as stream:
        for key, value in values.items():
            if "\n" in value or "\r" in value:
                raise ValueError("Invalid container environment encoding")
            stream.write(f"{key}={value}\n")

    postgres = run(["docker", "compose", "--env-file", ".env.infra", "-f", "ops/compose.yaml", "ps", "-q", "postgres"], capture_output=True, text=True).stdout.strip()
    inspection = json.loads(run(["docker", "inspect", postgres], capture_output=True, text=True).stdout)
    networks = inspection[0]["NetworkSettings"]["Networks"]
    if len(networks) != 1:
        raise RuntimeError("Expected one Compose network for the disposable database")
    container = run([
        "docker", "create", "--name", profile, "--network", next(iter(networks)),
        "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
        "--user", f"{os.getuid()}:{os.getgid()}", "--tmpfs", "/tmp:rw,noexec,nosuid,size=32m",
        "--env-file", str(container_env), "--publish", "127.0.0.1:4313:4313",
        "--mount", f"type=bind,src={installation},dst=/run/zoen/installation.json,readonly",
        image,
    ], capture_output=True, text=True).stdout.strip()
    try:
        run(["docker", "start", container], stdout=subprocess.DEVNULL)
        wait_ready(origin)
        print("Container ready; executing the same browser and CLI acceptance witnesses", flush=True)
        run(["pnpm", "test:acceptance"], env=environment)
    finally:
        with (artifacts / "container.log").open("x") as log:
            subprocess.run(["docker", "logs", container], cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, check=False)
        run(["docker", "rm", "--force", container], stdout=subprocess.DEVNULL)
    # Retain this run's database, bucket, configuration and logs locally. CI owns its disposable volumes.
    print(f"Container acceptance passed for {image}", flush=True)


if __name__ == "__main__":
    main()
