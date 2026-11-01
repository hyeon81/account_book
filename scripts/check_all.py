"""Portable implementation of make all; never reads application secrets."""
from pathlib import Path
import shutil
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
npm = shutil.which("npm.cmd") or shutil.which("npm")
commands = [([sys.executable, "-m", "pytest"], root),
            ([sys.executable, "scripts/validate_docs.py"], root)]
commands += [([npm, "run", task], root / "ui") for task in ("test", "lint", "build")]
for command, cwd in commands:
    subprocess.run(command, cwd=cwd, check=True)
