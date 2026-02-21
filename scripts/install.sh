#!/usr/bin/env bash
set -euo pipefail

# ShipPulse installer
# Usage: curl -fsSL https://raw.githubusercontent.com/snarktank/shippulse/v0.5.1/scripts/install.sh | bash

REPO="https://github.com/snarktank/shippulse.git"
DEST="${HOME}/.openclaw/workspace/shippulse"

echo "Installing ShipPulse..."

# Clone or pull
if [ -d "$DEST/.git" ]; then
  echo "Updating existing install..."
  git -C "$DEST" pull --ff-only origin main
else
  echo "Cloning repository..."
  git clone "$REPO" "$DEST"
fi

cd "$DEST"

# Build
echo "Installing dependencies..."
npm install --no-fund --no-audit

echo "Building..."
npm run build

# Link CLI globally
echo "Linking CLI..."
npm link

# Install workflows — use linked CLI or fall back to direct node
SHIPPULSE="$(command -v shippulse 2>/dev/null || echo "")"
if [ -z "$SHIPPULSE" ]; then
  SHIPPULSE="node $DEST/dist/cli/cli.js"
fi

echo "Installing workflows..."
$SHIPPULSE install

echo ""
echo "ShipPulse installed! Run 'shippulse workflow list' to see available workflows."
