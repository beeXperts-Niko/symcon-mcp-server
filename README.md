# Symcon MCP Server – Bibliothek

Symcon-Bibliothek mit dem Modul **MCP Server**: Ein PHP-Wrapper startet einen Node.js MCP-Server, der die IP-Symcon JSON-RPC API als MCP-Tools (GetValue, SetValue, RequestAction, Objekte, Skripte) bereitstellt. So können KI-Clients (z. B. ein KI-fähiger Editor oder ein späterer „smarte Helfer“) per Streamable HTTP auf Ihr Symcon-Smart-Home zugreifen.

## Voraussetzungen

- **IP-Symcon** ab Version 5.0 (empfohlen 8.1+ für IPSModuleStrict).
- **Node.js** 20+ (LTS) auf demselben Rechner wie Symcon.
- Symcon WebServer mit JSON-RPC API (Standard: Port 3777, Pfad `/api/`).

## Installation

1. Bibliothek über **Module Control** hinzufügen (Repository-URL oder lokalen Pfad zu `symcon-mcp-server` angeben). Das Repo enthält den vorgebauten MCP-Server (`libs/mcp-server/dist/`) – bei Git-Installation ist kein eigener Build nötig.
2. Unter „Instanz hinzufügen“ das Modul **MCP Server** auswählen.
3. **Port** (z. B. 4096) und **Symcon API URL** (z. B. `http://127.0.0.1:3777/api/`) konfigurieren, **Aktiv** setzen, Änderungen übernehmen.

Ausführlich: [ANLEITUNG_INSTALLATION.md](ANLEITUNG_INSTALLATION.md).

**Sprachassistent bauen:** Wenn du sprechen willst und der Assistent mit Sprache antwortet und dein Haus steuert: [docs/SPRACHASSISTENT_BAUEN.md](docs/SPRACHASSISTENT_BAUEN.md) – Optionen mit ChatGPT/OpenAI Realtime API, Whisper+TTS oder externen Voice-Plattformen.

**Server im Internet + Smart Home im eigenen Netz:** Wenn dein Dienst auf einem Server im Internet läuft und das Smart Home im Heimnetz nicht von außen erreichbar ist: [docs/ARCHITEKTUR_SERVER_IM_INTERNET.md](docs/ARCHITEKTUR_SERVER_IM_INTERNET.md) – Outbound-Verbindung vom Smart Home zum Server, Brücke im Heimnetz, Web-App mit Mikrofon und optional lokaler Auswertung, dann Whisper + ChatGPT auf dem Server.

## Ausführung: Symcon vs. lokal

**Auf der SymBox / in Symcon selbst:** Der MCP-Server läuft **aktuell noch nicht** auf der SymBox (IP-Symcon als Instanz). Die Ausführung direkt in IP-Symcon hat noch Probleme (z. B. Umgebung, Node-Ausführung). Wir arbeiten daran.

**Lokal (empfohlen):** Der Server läuft zuverlässig, wenn Sie ihn auf Ihrem Rechner starten und dabei die Symcon-API (lokal oder im Netz) ansprechen. Dafür **muss** die **`local-config.env`** angepasst werden:

1. Im Projektordner `symcon-mcp-server`: **`local-config.env`** anlegen – z. B. `cp local-config.env.example local-config.env` – und anpassen:
   - **`SYMCON_API_URL`**: Adresse der Symcon-API (z. B. `http://127.0.0.1:3777/api/` oder `http://<SymBox-IP>:3777/api/`).
   - **`SYMCON_API_USER`** (optional): Lizenz-E-Mail für Symcon Remote Access; Passwort wird beim Start abgefragt.
   - **`MCP_AUTH_TOKEN`** (optional): MCP-API-Key.
2. Server starten (Node.js 20+ vorausgesetzt):
   - **Ohne HTTPS (z. B. für Cursor):** `MCP_HTTP=1 ./start-mcp-local.sh` – der Server läuft dann auf **http://127.0.0.1:4096**; Cursor akzeptiert in der Regel keine self-signed Zertifikate, daher HTTP nutzen.
   - Mit HTTPS (falls Zertifikate in `certs/` liegen): `./start-mcp-local.sh`.
   Optional: URL und API-Key als Argumente übergeben.
3. In Cursor (oder anderem MCP-Client) die MCP-URL auf **http://127.0.0.1:4096** stellen (bei `MCP_HTTP=1`) und den Client ggf. neu starten.

Die Symcon-API bleibt auf dem Gerät, auf dem Symcon läuft (SymBox/PC); der MCP-Server verbindet sich von Ihrem Rechner aus dorthin.

## Konfiguration

- **Port:** TCP-Port für den MCP-Server (Streamable HTTP).
- **Symcon API URL:** Basis-URL der Symcon JSON-RPC API (z. B. `http://127.0.0.1:3777/api/`).
- **API-Key (optional):** Wenn gesetzt, müssen Clients den Key mitsenden (Header `Authorization: Bearer <Key>` oder `X-MCP-API-Key: <Key>`). Ohne Key ist der MCP-Server für jeden im Netzwerk erreichbar – für Produktion empfohlen.
- **Aktiv:** MCP-Server starten/beenden mit den Instanz-Änderungen.

## MCP-Tools

- `symcon_get_value` – Variable lesen (variableId)
- `symcon_set_value` – Variable schreiben (variableId, value)
- `symcon_request_action` – Aktion auslösen (variableId, optional value)
- `symcon_get_object` – Objekt-Infos (objectId)
- `symcon_get_children` – Kinder-IDs (objectId)
- `symcon_run_script` – Skript ausführen (scriptId)
- `symcon_get_object_id_by_name` – Objekt-ID anhand des Namens (name, optional parentId)
- `symcon_get_variable` – Variablen-Infos (variableId)
- `symcon_get_variable_by_path` – Variable anhand Pfad (z. B. Räume/Erdgeschoss/Büro/EG-BU-LI-1/Zustand)
- `symcon_resolve_device` – Nutzer-Phrase in Wissensbasis auflösen (z. B. „Büro Licht“ → variableId)
- `symcon_knowledge_set` / `symcon_knowledge_get` – Geräte-Zuordnungen speichern/lesen (Sprachsteuerung)
- `symcon_snapshot_variables` – Snapshot aller Variablenwerte unter einer Wurzel (rootId, maxDepth)
- `symcon_diff_variables` – Aktuellen Zustand mit Snapshot vergleichen (variableId, oldValue, newValue)

### Fall: Gerät per Vorher/Nachher zuordnen (Snapshot/Diff)

Wenn die KI nicht weiß, welches Gerät gemeint ist (z. B. „Ambiente-Licht im Büro“), kann sie es per Vorher/Nachher-Vergleich ermitteln:

1. **Anweisung an den User (immer klar):** „Schalte das Gerät jetzt **ein oder aus** – egal welche Richtung –, damit ich es zuordnen kann. Sag Bescheid, wenn du fertig bist.“
2. **Snapshot nur ab relevantem Knoten:** `symcon_snapshot_variables(rootId: raumObjectId)` mit der **Objekt-ID des Raums** (z. B. Büro), **nicht** rootId 0. Sonst sind tausende Variablen (Sensoren, sich ändernde Werte) im Snapshot und verfälschen den Diff. Raums-Objekt-ID z. B. aus bekannter Variable: `symcon_get_object(variableId)` → ParentID hochgehen bis zum Raums-Knoten.
3. User führt die Aktion aus (ein oder aus).
4. `symcon_diff_variables(previousSnapshotJson)` mit dem gespeicherten Snapshot aufrufen → geänderte variableId = das gemeinte Gerät; danach `symcon_knowledge_set` zum Lernen nutzen.

Ein MCP-Client (z. B. ein KI-fähiger Editor oder ein eigener KI-Assistent) verbindet sich per Streamable HTTP mit `http://127.0.0.1:<Port>` (POST/GET am gleichen Endpunkt). Der spätere „smarte Helfer“ wird in einem separaten Schritt entwickelt und nutzt diesen MCP-Server.

**Entwicklung:** Wenn Sie den TypeScript-Code in `libs/mcp-server/src/` ändern: `npm run build` in `libs/mcp-server/` ausführen und die aktualisierten Dateien in `libs/mcp-server/dist/` mit ins Repo committen, damit Git-Installationen die neueste Version bekommen.

## Dokumentation

- [docs/STEUERUNG_HINWEISE.md](docs/STEUERUNG_HINWEISE.md) – Steuerungshinweise für KI und MCP-Clients (z. B. Hue: RequestAction für Ein/Aus und Helligkeit, Skala 0–254).
- [docs/CLAUDE_EINBINDEN.md](docs/CLAUDE_EINBINDEN.md) – Claude/.mcpb-Einbindung.
- [docs/MODULREFERENZ.md](docs/MODULREFERENZ.md) – Modulreferenz (Geräte) von Symcon.
