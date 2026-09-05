#!/usr/bin/env python3
"""Compatibility entry point for current workspace validation."""
from pathlib import Path
import subprocess, sys
root=Path(__file__).resolve().parents[1]
raise SystemExit(subprocess.call([sys.executable,str(root/'tooling/workspace.py'),'validate'],cwd=root))
