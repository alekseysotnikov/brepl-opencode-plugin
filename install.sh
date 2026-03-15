#!/bin/bash
# Install brepl plugin for OpenCode (default: global)

SRC="$(dirname "$0")/brepl.ts"

if [ -n "$1" ]; then
  mkdir -p "$1/.opencode/plugins"
  cp "$SRC" "$1/.opencode/plugins/brepl.ts"
  echo "Installed to $1/.opencode/plugins/brepl.ts"
else
  mkdir -p ~/.config/opencode/plugins
  cp "$SRC" ~/.config/opencode/plugins/brepl.ts
  echo "Installed to ~/.config/opencode/plugins/brepl.ts"
fi
