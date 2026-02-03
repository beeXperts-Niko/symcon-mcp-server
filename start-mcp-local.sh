#!/usr/bin/env bash
# MCP-Server lokal auf dem Mac starten (Workaround wenn SymBox:4096 nicht erreichbar).
# Symcon-API bleibt auf der SymBox (z. B. http://192.168.10.12:3777/api/).
#
# Config: Lizenz-E-Mail und URL in local-config.env (siehe local-config.env.example).
# Passwort wird beim Start abgefragt, wenn SYMCON_API_USER gesetzt ist.
# Vor dem Start: In Cursor MCP-URL auf http://127.0.0.1:4096 stellen, dann Cursor neu starten.
#
# Nutzung:
#   ./start-mcp-local.sh
#   ./start-mcp-local.sh [SYMCON_API_URL] [MCP_API_KEY]   # optional: URL/Key überschreiben

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MCP_DIR="$SCRIPT_DIR/libs/mcp-server"

# Config laden (E-Mail/URL); Passwort nie in der Datei speichern
if [ -f "$SCRIPT_DIR/local-config.env" ]; then
  set -a
  # shellcheck source=local-config.env
  source "$SCRIPT_DIR/local-config.env"
  set +a
fi

SYMCON_URL="${1:-${SYMCON_API_URL:-http://192.168.10.12:3777/api/}}"
MCP_API_KEY="${2:-${MCP_AUTH_TOKEN:-}}"
SYMCON_USER="${SYMCON_API_USER:-}"
SYMCON_PASS="${SYMCON_API_PASSWORD:-}"

if [ -n "$SYMCON_USER" ] && [ -z "$SYMCON_PASS" ]; then
  echo "Symcon Remote Access: Passwort für $SYMCON_USER"
  read -r -s -p "Passwort: " SYMCON_PASS
  echo ""
  export SYMCON_API_PASSWORD="$SYMCON_PASS"
fi

echo "Starte MCP-Server lokal (Port 4096), Symcon-API: $SYMCON_URL"
echo "In Cursor MCP-URL auf http://127.0.0.1:4096 stellen, dann Cursor neu starten."
if [ -n "$SYMCON_USER" ]; then
  echo "Symcon-Auth: Basic-Auth aktiv (Remote Access)."
fi
echo "Beenden mit Ctrl+C."
echo ""

export MCP_PORT=4096
export SYMCON_API_URL="$SYMCON_URL"
[ -n "$MCP_API_KEY" ] && export MCP_AUTH_TOKEN="$MCP_API_KEY"
[ -n "$SYMCON_USER" ] && export SYMCON_API_USER="$SYMCON_USER"
[ -n "$SYMCON_PASS" ] && export SYMCON_API_PASSWORD="$SYMCON_PASS"

cd "$MCP_DIR"
exec npm run start
