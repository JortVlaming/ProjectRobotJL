#!/bin/bash

set -e

# --- Detect OS ---------------------------------------------------------------
OS="$(uname)"
echo "Detected OS: $OS"

# --- Determine Python 2.7 binary -------------------------------------------
if command -v python2.7 >/dev/null 2>&1; then
    PYTHON="python2.7"
elif command -v python2 >/dev/null 2>&1; then
    PYTHON="python2"
else
    echo "❌ Python 2.7 not found. Install Python 2.7 first."
    exit 1
fi

echo "Using Python: $PYTHON"

# --- Ensure pip exists -------------------------------------------------------
if ! $PYTHON -m pip --version >/dev/null 2>&1; then
    echo "pip for Python2 not found. Attempting to bootstrap..."
    curl https://bootstrap.pypa.io/pip/2.7/get-pip.py -o get-pip.py
    $PYTHON get-pip.py
fi

# --- Ensure virtualenv exists ------------------------------------------------
if ! $PYTHON -m virtualenv --version >/dev/null 2>&1; then
    echo "Installing virtualenv for Python2..."
    $PYTHON -m pip install --upgrade virtualenv
fi

# --- Create virtualenv -------------------------------------------------------
VENV_DIR="py27env"

echo "Creating Python 2.7 virtualenv in: $VENV_DIR"
$PYTHON -m virtualenv "$VENV_DIR"

echo "Virtualenv created"

# Detect extracted directories
PYNAOQI_DIR=$(find sdks -maxdepth 1 -type d -name "pynaoqi*" | head -n 1)
NAOQI_DIR=$(find sdks -maxdepth 1 -type d -name "naoqi*" | head -n 1)

echo "Detected pynaoqi folder: $PYNAOQI_DIR"
echo "Detected naoqi-sdk folder: $NAOQI_DIR"

if [ -z "$PYNAOQI_DIR" ] || [ -z "$NAOQI_DIR" ]; then
    echo "❌ Could not detect sdk directories."
    exit 1
fi

# ---------------------------------------------------------------------------
# --- Inject environment variables into venv activate script -----------------
# ---------------------------------------------------------------------------

ACTIVATE_FILE="$VENV_DIR/bin/activate"

echo
echo "Updating virtualenv activate script..."

# Prevent duplicate injection
if ! grep -q "PYTHONPATH=.*pynaoqi" "$ACTIVATE_FILE"; then
    cat <<EOF >> "$ACTIVATE_FILE"

# --- Added automatically by setup script ---
export PYTHONPATH="\$PYTHONPATH:$(pwd)/$PYNAOQI_DIR/lib/python2.7/site-packages"
export AL_DIR="$(pwd)/$NAOQI_DIR"
export AL_DIR_SIM="$(pwd)/$NAOQI_DIR"
# --- End automatic block ---

EOF
    echo "Environment variables added to activate script."
else
    echo "Activate script already contains environment settings. Skipping."
fi

echo
echo "✅ All done!"
echo "Activate your environment with:"
echo "source $VENV_DIR/bin/activate"
