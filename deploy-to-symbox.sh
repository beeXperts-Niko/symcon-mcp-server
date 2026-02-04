#!/usr/bin/env bash
# Deploy dist/ der Symcon MCP Server auf die SymBox.
# Voraussetzung: SSH-Zugang (z. B. root@<SymBox-IP>), Passwort wird ggf. abgefragt.
#
# Nutzung:
#   ./deploy-to-symbox.sh
#   ./deploy-to-symbox.sh root@<SymBox-IP>

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MCP_DIR="$SCRIPT_DIR/libs/mcp-server"
REMOTE="${1:?Usage: $0 root@<SymBox-IP>  – Ihre SymBox-IP z. B. in local-config.env, nicht im Repo.}"
REMOTE_PATH="/var/lib/symcon/user/symcon-mcp-server/libs/mcp-server"

echo "Build in $MCP_DIR ..."
(cd "$MCP_DIR" && npm run build)

echo "Kopiere dist/ nach $REMOTE:$REMOTE_PATH/"
scp -r "$MCP_DIR/dist" "$REMOTE:$REMOTE_PATH/"

echo "Fertig. In der Symcon-Weboberfläche: Instanz MCP Server → Änderungen übernehmen."
