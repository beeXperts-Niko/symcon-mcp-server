#!/usr/bin/env bash
# MCP-Server lokal auf dem Mac starten (Workaround wenn SymBox:4096 nicht erreichbar).
# Symcon-API bleibt auf der SymBox (URL in local-config.env, z. B. http://<SymBox-IP>:3777/api/).
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

SYMCON_URL="${1:-${SYMCON_API_URL:-}}"
MCP_API_KEY="${2:-${MCP_AUTH_TOKEN:-}}"
SYMCON_USER="${SYMCON_API_USER:-}"
SYMCON_PASS="${SYMCON_API_PASSWORD:-}"

if [ -n "$SYMCON_USER" ] && [ -z "$SYMCON_PASS" ]; then
  echo "Symcon Remote Access: Passwort für $SYMCON_USER"
  read -r -s -p "Passwort: " SYMCON_PASS
  echo ""
  export SYMCON_API_PASSWORD="$SYMCON_PASS"
fi

# Passwort prüfen: Symcon-API mit Basic-Auth testen
if [ -n "$SYMCON_USER" ] && [ -n "$SYMCON_PASS" ]; then
  echo "Prüfe Symcon-Anmeldung..."
  RESP=$(curl -s -w "\n%{http_code}" -X POST -H "Content-Type: application/json" \
    -u "$SYMCON_USER:$SYMCON_PASS" \
    -d '{"jsonrpc":"2.0","method":"IPS_GetKernelVersion","params":[],"id":1}' \
    "$SYMCON_URL")
  HTTP_CODE=$(echo "$RESP" | tail -n1)
  BODY=$(echo "$RESP" | sed '$d')
  if [ "$HTTP_CODE" = "401" ]; then
    echo "Fehler: Anmeldung fehlgeschlagen (401). Passwort oder Benutzer falsch."
    exit 1
  fi
  if [ "$HTTP_CODE" != "200" ]; then
    echo "Fehler: Symcon-API antwortete mit HTTP $HTTP_CODE"
    exit 1
  fi
  if echo "$BODY" | grep -q '"error"'; then
    echo "Fehler: Symcon-API meldet Fehler. Prüfe Passwort und URL."
    echo "$BODY" | head -c 200
    echo ""
    exit 1
  fi
  echo "Symcon-Anmeldung OK."
fi

# Optional HTTPS: wenn certs vorhanden, MCP_HTTPS=1 setzen (für Claude „Benutzerdefinierten Connector“ mit https://).
# Für Cursor („self signed certificate“): HTTP erzwingen mit MCP_HTTP=1 ./start-mcp-local.sh
if [ "${MCP_HTTP:-0}" = "1" ] || [ "${MCP_HTTPS:-}" = "0" ]; then
  export MCP_HTTPS=0
  echo "HTTP erzwungen (MCP_HTTP=1 oder MCP_HTTPS=0) – für Cursor mit http://127.0.0.1:4096"
elif [ -f "$MCP_DIR/certs/server.crt" ] && [ -f "$MCP_DIR/certs/server.key" ]; then
  export MCP_HTTPS=1
  export MCP_TLS_CERT="$MCP_DIR/certs/server.crt"
  export MCP_TLS_KEY="$MCP_DIR/certs/server.key"
  echo "HTTPS: Zertifikate gefunden, Server startet mit https://"
fi

echo "Starte MCP-Server lokal (Port 4096), Symcon-API: $SYMCON_URL"
echo "In Cursor MCP-URL auf http(s)://127.0.0.1:4096 stellen, dann Cursor neu starten."
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
