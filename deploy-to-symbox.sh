#!/usr/bin/env bash
# Deploy dist/ der Symcon MCP Server auf die SymBox.
# Voraussetzung: SSH-Zugang (z. B. root@192.168.10.12), Passwort wird ggf. abgefragt.
#
# Nutzung:
#   ./deploy-to-symbox.sh
#   ./deploy-to-symbox.sh root@192.168.10.12

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MCP_DIR="$SCRIPT_DIR/libs/mcp-server"
REMOTE="${1:-root@192.168.10.12}"
REMOTE_PATH="/var/lib/symcon/user/symcon-mcp-server/libs/mcp-server"

echo "Build in $MCP_DIR ..."
(cd "$MCP_DIR" && npm run build)

echo "Kopiere dist/ nach $REMOTE:$REMOTE_PATH/"
scp -r "$MCP_DIR/dist" "$REMOTE:$REMOTE_PATH/"

echo "Fertig. In der Symcon-Weboberfläche: Instanz MCP Server → Änderungen übernehmen."
