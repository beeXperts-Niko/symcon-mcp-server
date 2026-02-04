# Symcon-Smart-Home in Claude einbinden

So nutzt du dein Symcon-Smart-Home **mit Claude** (Anthropic): MCP-Server verbinden + Anweisungen für „erster Überblick“ und interaktives Reden.

**Hinweis:** Claude setzt bei Konnektoren-URLs **HTTPS** voraus. Der Symcon MCP-Server läuft unter HTTP – nutze daher die **.mcpb-Erweiterung** oder die **Config-Datei** (siehe unten).

---

## „Ziehe .MCPB- oder .DXT-Dateien hier her“ – was bedeutet das?

In Claude Desktop siehst du unter **Einstellungen → Erweiterungen** oft: **„Ziehe .MCPB- oder .DXT-Dateien hier her, um sie zu installieren.“**

- **.mcpb / .dxt** = vorgepackte Erweiterungen (ein Klick, alles drin). Unser Symcon-Server ist ein **Streamable-HTTP-Server unter einer URL** – dafür gibt es jetzt **eine .mcpb-Datei zum Reinziehen**.

**Zwei nutzbare Wege:** .mcpb-Datei reinziehen (empfohlen) oder Config-Datei. Der Dialog **„Benutzerdefinierten Connector hinzufügen“** (URL) **funktioniert nicht**, weil Claude dort nur **HTTPS** akzeptiert – der Symcon-Server läuft unter HTTP.

---

## 1. MCP-Server in Claude verbinden

### Variante 0: .mcpb-Datei reinziehen (empfohlen)

Es gibt eine **Symcon-Smart-Home-.mcpb**-Datei, die du in Claude Desktop **reinziehen** kannst (Einstellungen → Erweiterungen → „.mcpb hierher ziehen“ oder Doppelklick auf die Datei).

1. **.mcpb-Datei erstellen** (einmalig, z. B. als Entwickler):
   ```bash
   cd symcon-mcp-server/mcpb
   npm install -g @anthropic-ai/mcpb   # falls noch nicht installiert
   mcpb pack
   ```
   Es entsteht `mcpb.mcpb` im Ordner `mcpb/` (optional umbenennen z. B. zu `symcon-smart-home-1.0.0.mcpb`).

2. **Symcon MCP-Server starten** (muss laufen, bevor Claude sich verbindet):
   ```bash
   cd symcon-mcp-server
   ./start-mcp-local.sh
   ```
   Server läuft z. B. auf **http://127.0.0.1:4096**.

3. **.mcpb in Claude installieren**: Datei in Claude Desktop reinziehen. Beim Installieren wirst du nach der **Symcon MCP-Server URL** gefragt (Standard: `http://127.0.0.1:4096`). Optional: Bearer Token, falls dein MCP-Server einen API-Key verlangt.

4. **Claude Desktop neu starten**. Danach ist die Symcon-Erweiterung aktiv – vorausgesetzt, der Symcon MCP-Server läuft unter der eingetragenen URL.

Die .mcpb-Datei enthält nur einen **Launcher** (stdio→streamable-http Adapter); der eigentliche Symcon-Server muss weiterhin separat laufen (z. B. per `start-mcp-local.sh` oder auf der SymBox).

---

### Variante A: Config-Datei (wenn du keine .mcpb nutzen willst)

Claude Desktop kann MCP-Server auch über eine **Konfigurationsdatei** laden. Dafür brauchst du einen kleinen **Adapter**, der zwischen Claude (stdio) und unserem Server (Streamable HTTP per URL) vermittelt.

1. **Symcon MCP-Server starten** (lokal auf dem Mac):
   ```bash
   cd symcon-mcp-server
   ./start-mcp-local.sh
   ```
   Passwort eingeben. Server läuft auf **http://127.0.0.1:4096**.

2. **Config-Datei bearbeiten:**
   - **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

   Falls die Datei noch nicht existiert: anlegen. Inhalt (oder als `mcpServers`-Block zu bestehendem Config hinzufügen):

   ```json
   {
     "mcpServers": {
       "symcon": {
         "command": "npx",
         "args": ["-y", "@pyroprompts/mcp-stdio-to-streamable-http-adapter"],
         "env": {
           "URI": "http://127.0.0.1:4096",
           "MCP_NAME": "symcon"
         }
       }
     }
   }
   ```

   Bei MCP-API-Key (falls du einen gesetzt hast):
   ```json
   "env": {
     "URI": "http://127.0.0.1:4096",
     "MCP_NAME": "symcon",
     "BEARER_TOKEN": "DEIN_API_KEY"
   }
   ```

3. **Claude Desktop vollständig neu starten** (nicht nur Fenster schließen). Danach sollte der Symcon-Server als MCP verfügbar sein.

Der Adapter (`@pyroprompts/mcp-stdio-to-streamable-http-adapter`) läuft lokal und leitet alle Aufrufe an deinen Symcon-Server (die URL) weiter. **npx** lädt ihn bei Bedarf automatisch herunter.

---

### Variante B: „Benutzerdefinierten Connector hinzufügen“ (URL) – **funktioniert nicht mit Symcon**

Unter **Einstellungen → Konnektoren** gibt es oft **„Benutzerdefinierten Connector hinzufügen“**, wo man eine **Server-URL** eintragen kann. **Claude verlangt dort zwingend HTTPS** (Fehlermeldung: „URL muss mit 'https' beginnen“). Der Symcon MCP-Server läuft aber unter **HTTP** (z. B. `http://127.0.0.1:4096`). Daher ist dieser Weg **für Symcon nicht nutzbar**.

**Empfehlung:** Symcon ausschließlich über **Variante 0 (.mcpb)** oder **Variante A (Config-Datei)** einbinden – dort wird die HTTP-URL nur intern vom Adapter genutzt, Claude prüft sie nicht auf HTTPS.

---

## 2. Claude-Anweisungen für „Überblick“ und interaktives Reden

Damit Claude sich beim **ersten Mal** einen Überblick verschafft und **mit dir redet**, kannst du folgende Anweisungen in Claude einfügen (z. B. unter **Custom Instructions**, **Projekt-Anweisungen** oder in der ersten Nachricht):

---

**Kopierblock für Claude (Custom Instructions / Projekt-Anweisungen):**

```
Du steuerst mein Smart Home über Symcon (MCP-Server "user-symcon" / symcon).

Erster Kontakt:
- Wenn ich das erste Mal in diesem Chat mit dem Smart Home spreche (z. B. "Hey, ich will mit meinem Haus reden" oder eine erste Steuerungsanfrage), sag zuerst: "Gib mir ein paar Sekunden, ich schaue mir dein Smart Home an." Rufe dann symcon_get_object_tree(rootId: 0, maxDepth: 4) und symcon_knowledge_get() auf. Fasse danach in 1–2 Sätzen zusammen, was du siehst (z. B. Räume, gelernte Geräte), und frage: "Was soll ich für dich schalten oder einstellen?"

Immer interaktiv:
- Rede mit mir: bestätige Aktionen ("Bürolicht ist an."), frage nach, wenn etwas unklar ist, und lerne neue Geräte, indem du mich frage ("Ist das dein Flurlicht?" → bei Ja: symcon_knowledge_set aufrufen).
- Für Lichter/Schalter: symcon_resolve_device("…") nutzen; wenn gefunden, symcon_request_action(variableId, true/false) oder symcon_set_value. Wenn nicht gelernt: Struktur erkunden, mich fragen, dann symcon_knowledge_set und Aktion ausführen.
```

---

## 3. Kurzablauf in Claude

| Du sagst | Claude soll |
|----------|-------------|
| Erstes Mal im Chat etwas zum Smart Home | "Gib mir ein paar Sekunden, ich schaue mir dein Smart Home an." → get_object_tree + knowledge_get → kurze Zusammenfassung → "Was soll ich schalten?" |
| "Schalte das Licht im Büro an" | resolve_device("Büro Licht") → wenn gefunden: request_action(36800, true) → "Bürolicht ist an." |
| Neues Gerät | Struktur erkunden, dich fragen ("Ist EG-FL-LI-1 dein Flurlicht?"), bei Ja: knowledge_set + Aktion |

---

## 4. Hinweise

- **MCP-Server muss laufen**, bevor Claude sich verbindet (localhost:4096 oder SymBox:4096).
- Bei **lokalem Server** (start-mcp-local.sh): Symcon-API (z. B. SymBox) muss vom Mac aus erreichbar sein; Passwort wird beim Start abgefragt.
- Die **Wissensbasis** (gelernte Geräte) liegt im MCP-Server (z. B. `data/symcon-knowledge.json`) und bleibt erhalten – auch in neuen Claude-Chats, solange derselbe MCP-Server läuft.

---

## 5. Fehlerbehebung: „Server disconnected“

Wenn Claude die Meldung **„Server disconnected“** oder **„Server transport closed unexpectedly“** anzeigt:

1. **Symcon MCP-Server zuerst starten**  
   In einem Terminal:
   ```bash
   cd symcon-mcp-server
   ./start-mcp-local.sh
   ```
   Warte, bis der Server läuft (z. B. „Listening on http://0.0.0.0:4096“). **Erst danach** Claude Desktop starten bzw. die Erweiterung nutzen.

2. **URL in der Erweiterung prüfen**  
   Unter Erweiterungen → Symcon Smart Home → **Konfigurieren**: Die **Symcon MCP-Server URL** muss exakt der Adresse entsprechen, unter der der Server läuft (z. B. `http://127.0.0.1:4096`). Kein Slash am Ende.

3. **Im Claude-Log nachsehen**  
   In den Entwickler-Logs von Claude solltest du u. a. sehen:  
   `[Symcon MCPB] Connecting to Symcon MCP server at http://127.0.0.1:4096 …`  
   Erscheint danach `Adapter exited with code …`, ist der Symcon MCP-Server unter dieser URL nicht erreichbar (nicht gestartet oder falsche URL).
