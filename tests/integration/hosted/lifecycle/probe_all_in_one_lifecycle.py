"""ZA-06 exact all-in-one install/restart/reset lifecycle seam.

Proves:
  ZA-06-01 empty volume → same-image restart preserves installation identity
  ZA-06-02 incompatible release digest → RESET_REQUIRED before serving
  ZA-06-03 interrupted first install resumes; credentials match roles
  ZA-06-04 dependency exit after readiness withdraws /ready

Does not deploy Fly or wipe hosted volumes. Requires Docker.
"""

from __future__ import annotations

import json
import os
import secrets
import socket
import subprocess
import sys
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


def wait_not_ready(origin: str, timeout: float = 30.0) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with urlopen(f"{origin}/ready", timeout=2) as response:
                if response.status == 200:
                    time.sleep(0.5)
                    continue
        except (URLError, TimeoutError, ConnectionError, json.JSONDecodeError):
            return
        time.sleep(0.5)
    raise RuntimeError(f"all-in-one unexpectedly stayed ready at {origin}")



def docker_wait(container: str, timeout: float, artifacts: Path, label: str) -> int:
    """Bounded wait for an expected-failure container; dump logs on timeout."""
    try:
        wait_proc = subprocess.run(
            ["docker", "wait", container],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        logs = subprocess.run(
            ["docker", "logs", container],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        combined = (logs.stdout or "") + (logs.stderr or "")
        (artifacts / f"{label}-timeout.log").write_text(combined)
        subprocess.run(
            ["docker", "rm", "--force", container],
            cwd=ROOT,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
        raise RuntimeError(
            f"{label}: docker wait timed out after {timeout}s; logs={combined[-2000:]}"
        )
    return int((wait_proc.stdout or "1").strip() or "1")


def docker_exec(container: str, command: list[str], user: str | None = None) -> subprocess.CompletedProcess:
    args = ["docker", "exec"]
    if user:
        args.extend(["-u", user])
    args.append(container)
    args.extend(command)
    return subprocess.run(args, cwd=ROOT, capture_output=True, text=True, check=False)


def read_installation(container: str) -> dict:
    result = docker_exec(container, ["bash", "-lc", "cat /data/zoen/installation.json"])
    if result.returncode != 0:
        raise RuntimeError(f"missing installation.json: {result.stderr}")
    return json.loads(result.stdout)


def main() -> int:
    profile = f"za06-{uuid4().hex[:12]}"
    image = f"zoen-all-in-one:{profile}"
    volume = f"{profile}-data"
    container = profile
    # Bind an ephemeral loopback port so identity/other local stacks can coexist.
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        host_port = sock.getsockname()[1]
    origin = f"http://127.0.0.1:{host_port}"
    auth_secret = secrets.token_hex(32)
    artifacts = ROOT / ".local" / f"{profile}-lifecycle"
    artifacts.mkdir(mode=0o700, parents=True)

    preexisting = os.environ.get("ZOEN_LIFECYCLE_IMAGE")
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

    def start(name: str, extra_env: list[str] | None = None, publish: bool = True) -> None:
        env_args: list[str] = [
            "-e",
            f"ZOEN_AUTH_SECRET={auth_secret}",
            "-e",
            f"ZOEN_PUBLIC_URL={origin}",
        ]
        if extra_env:
            for item in extra_env:
                env_args.extend(["-e", item])
        args = [
            "docker",
            "run",
            "-d",
            "--name",
            name,
            "--mount",
            f"type=volume,src={volume},dst=/data",
            *env_args,
        ]
        if publish:
            host_port = int(origin.rsplit(":", 1)[-1])
            args.extend(["--publish", f"127.0.0.1:{host_port}:4310"])
        args.append(image)
        run(args, stdout=subprocess.DEVNULL)

    def stop_rm(name: str) -> None:
        subprocess.run(
            ["docker", "rm", "--force", name],
            cwd=ROOT,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )

    try:
        # --- ZA-06-01 first boot + same-image restart ---
        start(container)
        wait_ready(origin)
        first = read_installation(container)
        cell_id = first["installation"]["cellId"]
        generation_id = first["installation"]["generationId"]
        release_digest = first["installation"]["releaseDigest"]
        print("ZA-06-01a: first install ready", flush=True)

        stop_rm(container)
        start(container)
        wait_ready(origin)
        second = read_installation(container)
        if second["installation"]["cellId"] != cell_id:
            raise RuntimeError("same-image restart changed cellId")
        if second["installation"]["generationId"] != generation_id:
            raise RuntimeError("same-image restart changed generationId")
        if second["installation"]["releaseDigest"] != release_digest:
            raise RuntimeError("same-image restart changed releaseDigest")
        print("ZA-06-01: same-image restart preserved installation identity", flush=True)

        # --- ZA-06-02 incompatible release digest ---
        stop_rm(container)
        other_release = artifacts / "other-release.json"
        other_release.write_text(
            json.dumps({"format": "zoen-release", "za06": profile, "nonce": secrets.token_hex(8)})
            + "\n",
            encoding="utf-8",
        )
        # Mount foreign release over the image path used by bootstrap/server.
        run(
            [
                "docker",
                "run",
                "-d",
                "--name",
                container,
                "--publish",
                f"127.0.0.1:{int(origin.rsplit(':', 1)[-1])}:4310",
                "--mount",
                f"type=volume,src={volume},dst=/data",
                "--mount",
                f"type=bind,src={other_release},dst=/app/apps/server/dist/release.json,readonly",
                "-e",
                f"ZOEN_AUTH_SECRET={auth_secret}",
                "-e",
                f"ZOEN_PUBLIC_URL={origin}",
                image,
            ],
            stdout=subprocess.DEVNULL,
        )
        mismatch_status = docker_wait(container, 120.0, artifacts, "reset-required")
        logs = subprocess.run(
            ["docker", "logs", container],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        combined = (logs.stdout or "") + (logs.stderr or "")
        (artifacts / "reset-required.log").write_text(combined)
        if mismatch_status == 0:
            raise RuntimeError("incompatible release unexpectedly exited 0")
        if "RESET_REQUIRED" not in combined and "reset" not in combined.lower():
            # bootstrap-error.txt is the durable signal
            err = subprocess.run(
                [
                    "docker",
                    "run",
                    "--rm",
                    "--entrypoint",
                    "bash",
                    "--mount",
                    f"type=volume,src={volume},dst=/data",
                    image,
                    "-lc",
                    "cat /data/zoen/bootstrap-error.txt 2>/dev/null || true",
                ],
                cwd=ROOT,
                capture_output=True,
                text=True,
                check=False,
            )
            err_text = (err.stdout or "") + (err.stderr or "")
            (artifacts / "bootstrap-error.txt").write_text(err_text)
            if "RESET_REQUIRED" not in err_text:
                raise RuntimeError(
                    f"expected RESET_REQUIRED, status={mismatch_status} logs={combined[-2000:]}"
                )
        # Volume installation must be unchanged (no silent rewrite).
        preserved = subprocess.run(
            [
                "docker",
                "run",
                "--rm",
                "--entrypoint",
                "bash",
                "--mount",
                f"type=volume,src={volume},dst=/data",
                image,
                "-lc",
                "cat /data/zoen/installation.json",
            ],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        preserved_json = json.loads(preserved.stdout)
        if preserved_json["installation"]["releaseDigest"] != release_digest:
            raise RuntimeError("incompatible boot rewrote installation releaseDigest")
        if preserved_json["installation"]["cellId"] != cell_id:
            raise RuntimeError("incompatible boot rewrote cellId")
        print("ZA-06-02: incompatible digest refused without wipe/rebind", flush=True)
        stop_rm(container)

        # --- ZA-06-03 interrupted first install resumes ---
        crash_volume = f"{profile}-crash"
        crash_name = f"{profile}-crash"
        run(["docker", "volume", "create", crash_volume], stdout=subprocess.DEVNULL)
        run(
            [
                "docker",
                "run",
                "-d",
                "--name",
                crash_name,
                "--mount",
                f"type=volume,src={crash_volume},dst=/data",
                "-e",
                f"ZOEN_AUTH_SECRET={auth_secret}",
                "-e",
                f"ZOEN_PUBLIC_URL={origin}",
                "-e",
                "ZOEN_BOOTSTRAP_CRASH_AFTER=installation",
                image,
            ],
            stdout=subprocess.DEVNULL,
        )
        crash_status = docker_wait(crash_name, 120.0, artifacts, "crash-after-installation")
        crash_logs = subprocess.run(
            ["docker", "logs", crash_name],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        (artifacts / "crash-after-installation.log").write_text(
            (crash_logs.stdout or "") + (crash_logs.stderr or "")
        )
        if crash_status == 0:
            raise RuntimeError("crash-after-installation unexpectedly succeeded")
        # installation present, marker absent
        probe_state = subprocess.run(
            [
                "docker",
                "run",
                "--rm",
                "--entrypoint",
                "bash",
                "--mount",
                f"type=volume,src={crash_volume},dst=/data",
                image,
                "-lc",
                "test -f /data/zoen/installation.json && test ! -f /data/zoen/.bootstrap-complete && echo PARTIAL",
            ],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        if "PARTIAL" not in (probe_state.stdout or ""):
            raise RuntimeError(
                f"expected partial install state after crash: {probe_state.stdout} {probe_state.stderr}"
            )
        stop_rm(crash_name)
        # Resume without crash barrier on a published port alternate to avoid clash
        resume_name = f"{profile}-resume"
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.bind(("127.0.0.1", 0))
            resume_port = sock.getsockname()[1]
        resume_origin = f"http://127.0.0.1:{resume_port}"
        run(
            [
                "docker",
                "run",
                "-d",
                "--name",
                resume_name,
                "--publish",
                f"127.0.0.1:{resume_port}:4310",
                "--mount",
                f"type=volume,src={crash_volume},dst=/data",
                "-e",
                f"ZOEN_AUTH_SECRET={auth_secret}",
                "-e",
                f"ZOEN_PUBLIC_URL={resume_origin}",
                image,
            ],
            stdout=subprocess.DEVNULL,
        )
        wait_ready(resume_origin, timeout=180.0)
        resumed = subprocess.run(
            [
                "docker",
                "exec",
                resume_name,
                "bash",
                "-lc",
                "cat /data/zoen/installation.json && test -f /data/zoen/.bootstrap-complete && echo COMPLETE",
            ],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        if "COMPLETE" not in (resumed.stdout or ""):
            raise RuntimeError(f"resume did not complete: {resumed.stdout} {resumed.stderr}")
        # Credentials in runtime.env must authenticate as the declared roles.
        role_check = docker_exec(
            resume_name,
            [
                "bash",
                "-lc",
                (
                    "set -a; source /data/zoen/runtime.env; set +a; "
                    'psql "$ZOEN_AUTHORITY_DATABASE_URL" -v ON_ERROR_STOP=1 '
                    "-c 'SELECT current_user' | grep -q zoen_authority && "
                    'psql "$ZOEN_IDENTITY_DATABASE_URL" -v ON_ERROR_STOP=1 '
                    "-c 'SELECT current_user' | grep -q zoen_identity && echo ROLES_OK"
                ),
            ],
        )
        if "ROLES_OK" not in role_check.stdout:
            raise RuntimeError(
                f"resumed credentials do not match roles: {role_check.stdout} {role_check.stderr}"
            )
        print("ZA-06-03: interrupted install resumed with matching credentials", flush=True)
        stop_rm(resume_name)
        run(["docker", "volume", "rm", crash_volume], stdout=subprocess.DEVNULL, check=False)

        # --- ZA-06-04 dependency exit withdraws readiness ---
        start(container)
        wait_ready(origin)
        kill_rustfs = docker_exec(
            container,
            ["bash", "-lc", "kill -TERM $(pgrep -f '/usr/local/bin/rustfs') || kill -9 $(pgrep -f rustfs)"],
        )
        wait_not_ready(origin, timeout=60.0)
        # Container should exit or at least stop serving; wait briefly for supervisor.
        deadline = time.monotonic() + 60.0
        exited = False
        while time.monotonic() < deadline:
            state = subprocess.run(
                [
                    "docker",
                    "inspect",
                    "--format",
                    "{{.State.Running}} {{.State.ExitCode}}",
                    container,
                ],
                cwd=ROOT,
                capture_output=True,
                text=True,
                check=False,
            )
            running = (state.stdout or "").strip()
            if running.startswith("false"):
                exited = True
                break
            # Still running but not ready is also acceptance if supervisor-failure exists
            failure = docker_exec(
                container,
                ["bash", "-lc", "test -f /data/zoen/supervisor-failure.txt && cat /data/zoen/supervisor-failure.txt"],
            )
            if failure.returncode == 0 and "RUSTFS" in (failure.stdout or ""):
                exited = True
                break
            time.sleep(1)
        if not exited:
            raise RuntimeError(
                f"supervisor did not withdraw after RustFS kill; inspect={state.stdout!r} kill={kill_rustfs.stderr!r}"
            )
        print("ZA-06-04: dependency exit withdrew readiness", flush=True)

        digest = run(
            ["docker", "image", "inspect", "--format", "{{.Id}}", image],
            capture_output=True,
            text=True,
        ).stdout.strip()
        (artifacts / "result.json").write_text(
            json.dumps(
                {
                    "checks": ["ZA-06-01", "ZA-06-02", "ZA-06-03", "ZA-06-04"],
                    "image": image,
                    "imageId": digest,
                    "profile": profile,
                    "status": "passed",
                },
                indent=2,
            )
            + "\n"
        )
        print(f"Lifecycle seam passed for {image} ({digest})", flush=True)
        return 0
    finally:
        try:
            with (artifacts / "container.log").open("w") as log:
                subprocess.run(
                    ["docker", "logs", container],
                    cwd=ROOT,
                    stdout=log,
                    stderr=subprocess.STDOUT,
                    check=False,
                )
        except Exception:
            pass
        for name in (container, f"{profile}-crash", f"{profile}-resume"):
            subprocess.run(
                ["docker", "rm", "--force", name],
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
        if not preexisting:
            subprocess.run(
                ["docker", "image", "rm", "--force", image],
                cwd=ROOT,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False,
            )


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:  # noqa: BLE001 — surface seam failure clearly
        print(f"Lifecycle seam failed: {error}", file=sys.stderr)
        raise SystemExit(1)
