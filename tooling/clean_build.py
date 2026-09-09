"""Remove only declared generated outputs before building a local release."""

from pathlib import Path
import shutil


def main():
    root = Path(__file__).resolve().parent.parent
    targets = []
    for package in ["packages/contracts", "packages/application-client", "packages/ontology", "packages/oms", "apps/server", "apps/cli", "apps/mcp", "apps/web"]:
        for artifact in ["dist", "tsconfig.build.tsbuildinfo"]:
            relative = Path(package) / artifact
            target = root
            for part in relative.parts:
                target = target / part
                if target.is_symlink():
                    raise RuntimeError(f"Refusing a symlink build path: {target}")
            if not target.resolve().is_relative_to(root):
                raise RuntimeError(f"Build path leaves the workspace: {target}")
            targets.append(target)
    # Validate every destination first; a later invalid package must not cause a partial cleanup.
    for target in targets:
        if target.is_dir():
            shutil.rmtree(target)
        elif target.exists():
            target.unlink()


if __name__ == "__main__":
    main()
