# Symcon MCP Server – Bibliothek

Symcon-Bibliothek mit dem Modul **MCP Server**: Ein PHP-Wrapper startet einen Node.js MCP-Server, der die IP-Symcon JSON-RPC API als MCP-Tools (GetValue, SetValue, RequestAction, Objekte, Skripte) bereitstellt. So können KI-Clients (z. B. Cursor oder ein späterer „smarte Helfer“) per Streamable HTTP auf Ihr Symcon-Smart-Home zugreifen.

## Voraussetzungen

- **IP-Symcon** ab Version 5.0 (empfohlen 8.1+ für IPSModuleStrict).
- **Node.js** 20+ (LTS) auf demselben Rechner wie Symcon.
- Symcon WebServer mit JSON-RPC API (Standard: Port 3777, Pfad `/api/`).

## Installation

1. Bibliothek über **Module Control** hinzufügen (Repository-URL oder lokalen Pfad zu `symcon-mcp-server` angeben).
2. Unter „Instanz hinzufügen“ das Modul **MCP Server** auswählen.
3. **Port** (z. B. 4096) und **Symcon API URL** (z. B. `http://127.0.0.1:3777/api/`) konfigurieren, **Aktiv** setzen, Änderungen übernehmen.
4. Auf dem Symcon-Server im Ordner `libs/mcp-server/` einmalig ausführen: `npm install` und `npm run build`.

## Konfiguration

- **Port:** TCP-Port für den MCP-Server (Streamable HTTP). Nur localhost (127.0.0.1).
- **Symcon API URL:** Basis-URL der Symcon JSON-RPC API (z. B. `http://127.0.0.1:3777/api/`).
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

Ein MCP-Client (z. B. Cursor oder ein eigener KI-Assistent) verbindet sich per Streamable HTTP mit `http://127.0.0.1:<Port>` (POST/GET am gleichen Endpunkt). Der spätere „smarte Helfer“ wird in einem separaten Schritt entwickelt und nutzt diesen MCP-Server.
