#!/usr/bin/env bash
set -euo pipefail

# Move to the directory of this script (the repo root)
cd "$(dirname "$0")"

# Detect or create venv: prefer .venv, then venv; create .venv if neither exists
VENV_DIR=""
if [[ -x ".venv/bin/python" ]]; then
  VENV_DIR=".venv"
elif [[ -x "venv/bin/python" ]]; then
  VENV_DIR="venv"
else
  echo "[setup] Creating virtual environment .venv ..."
  if command -v python3 >/dev/null 2>&1; then
    python3 -m venv .venv
  else
    python -m venv .venv
  fi
  VENV_DIR=".venv"
fi

PYEXE="./$VENV_DIR/bin/python"
if [[ ! -x "$PYEXE" ]]; then
  echo "[error] Python not found in $VENV_DIR" >&2
  exit 1
fi

echo "[setup] Upgrading pip and installing requirements ..."
"$PYEXE" -m pip install -U pip setuptools wheel
if [[ -f requirements.txt ]]; then
  "$PYEXE" -m pip install -r requirements.txt
fi

echo "[run] Launching crossPrint UI ..."
exec "$PYEXE" app.py
