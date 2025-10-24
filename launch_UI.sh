#!/usr/bin/env bash
set -euo pipefail

# Move to the repo root
cd "$(dirname "$0")"

# --- Choose bootstrap Python ---
# On Linux, prefer system Python so python3-gi works (GTK backend).
OS="$(uname -s || echo Unknown)"
if [[ "${CROSSPRINT_PY:-}" != "" ]]; then
  BOOTSTRAP_PY="$CROSSPRINT_PY"
elif [[ "$OS" == "Linux" && -x "/usr/bin/python3" ]]; then
  BOOTSTRAP_PY="/usr/bin/python3"
else
  BOOTSTRAP_PY="$(command -v python3 || command -v python)"
fi

if [[ -z "${BOOTSTRAP_PY:-}" ]]; then
  echo "[error] No python interpreter found." >&2
  exit 1
fi

echo "[setup] Using bootstrap Python: $BOOTSTRAP_PY ($("$BOOTSTRAP_PY" -V 2>&1))"

# --- Detect/create venv (.venv preferred) ---
VENV_DIR=""
if [[ -x ".venv/bin/python" ]]; then
  VENV_DIR=".venv"
elif [[ -x "venv/bin/python" ]]; then
  VENV_DIR="venv"
else
  echo "[setup] Creating virtual environment in .venv ..."
  "$BOOTSTRAP_PY" -m venv .venv
  VENV_DIR=".venv"
fi

PYEXE="./$VENV_DIR/bin/python"
if [[ ! -x "$PYEXE" ]]; then
  echo "[error] Python not found in $VENV_DIR" >&2
  exit 1
fi

# --- Install deps ---
echo "[setup] Upgrading pip and installing requirements ..."
"$PYEXE" -m pip install -U pip setuptools wheel
if [[ -f requirements.txt ]]; then
  "$PYEXE" -m pip install -r requirements.txt
fi

# --- Backend auto-detect / fallback ---
# If on Linux and GTK (gi) is NOT present in this venv, install Qt backend.
if [[ "$OS" == "Linux" ]]; then
  if ! "$PYEXE" -c "import gi" >/dev/null 2>&1; then
    echo "[setup] GTK bindings (gi) not available; installing Qt backend (pyside6 + qtpy) ..."
    "$PYEXE" -m pip install -q pyside6 qtpy || {
      echo "[warn] Qt backend install failed; GTK may still work if system packages are present." >&2
    }
  fi
fi

# --- Run ---
echo "[run] Launching CrossPrint UI ..."
exec "$PYEXE" app.py
