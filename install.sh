#!/bin/bash
# Install brepl plugin for OpenCode (default: global)

SRC="$(dirname "$0")/brepl.js"

if [ -n "$1" ]; then
  mkdir -p "$1/.opencode/plugins"
  cp "$SRC" "$1/.opencode/plugins/brepl.js"
  echo "Installed to $1/.opencode/plugins/brepl.js"
else
  mkdir -p ~/.config/opencode/plugins
  cp "$SRC" ~/.config/opencode/plugins/brepl.js
  echo "Installed to ~/.config/opencode/plugins/brepl.js"
fi
