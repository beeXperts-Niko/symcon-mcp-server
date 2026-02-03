# Anleitung: MCP-Server-Modul zum Laufen bringen

Diese Anleitung richtet sich an Nutzer mit **nur Web-Oberfläche** (z. B. `http://192.168.10.12:3777/console/`) und wenig Erfahrung mit Symcon-Modulentwicklung.

---

## Übersicht: Was Sie brauchen

1. **Symcon-Weboberfläche** – haben Sie bereits (z. B. `http://192.168.10.12:3777/console/`).
2. **Den Modul-Code auf dem Symcon-Server** – entweder per **Git-Repository** (empfohlen) oder per **manuelles Kopieren**.
3. **Node.js auf dem Symcon-Server** – damit der MCP-Server (Node) starten kann.
4. **Eine Instanz „MCP Server“** in Symcon – anlegen und konfigurieren.

---

## Schritt 1: Node.js auf dem Symcon-Server

Der MCP-Server ist ein kleines Node.js-Programm. Es muss auf **demselben Rechner** laufen wie Symcon (bei Ihnen vermutlich der Rechner mit der IP 192.168.10.12).

- **Wenn Sie per SSH auf den Server können:**  
  Einloggen, dann prüfen: `node --version` (sollte v20 oder höher sein).  
  Falls nicht installiert: Node.js LTS von [nodejs.org](https://nodejs.org/) installieren (unter Linux z. B. per Paketmanager oder nvm).

- **Wenn Sie keinen SSH-Zugang haben:**  
  Prüfen Sie in der Symcon-Dokumentation oder beim Hersteller Ihres Geräts (NAS, SymBox, Raspberry, PC), ob Node.js vorinstalliert ist oder wie es installiert wird. Ohne Node.js auf dem Server kann das Modul den MCP-Server-Prozess nicht starten.

---

## Schritt 2: Modul-Code auf den Symcon-Server bringen

Symcon liest Module aus einem festen Ordner („user“). Sie haben zwei Wege:

### Option A: Installation über ein Git-Repository (empfohlen)

So kann Symcon das Modul selbst herunterladen und später aktualisieren.

1. **GitHub-Account** (falls noch keiner: [github.com](https://github.com) → Sign up).

2. **Neues Repository anlegen**  
   - Auf GitHub: „New repository“.  
   - Name z. B. `symcon-mcp-server`.  
   - Öffentlich (Public), ohne README/ .gitignore (Projekt ist schon da).

3. **Nur den Inhalt von `symcon-mcp-server` als Repo-Inhalt verwenden**  
   Der **Root** des Repositories muss genau so aussehen:
   - `library.json`
   - Ordner `MCPServer/`
   - Ordner `libs/`
   - optional: `README.md`, `ANLEITUNG_INSTALLATION.md`

   Auf Ihrem Rechner (im Projektordner):
   - In den Ordner wechseln: `symconMCP/symcon-mcp-server`
   - Git initialisieren (falls noch nicht):  
     `git init`  
     `git add library.json MCPServer libs README.md ANLEITUNG_INSTALLATION.md`  
     `git commit -m "Symcon MCP Server Modul"`
   - Remote hinzufügen (Ihre GitHub-URL eintragen):  
     `git remote add origin https://github.com/IHR-BENUTZERNAME/symcon-mcp-server.git`  
     `git branch -M main`  
     `git push -u origin main`

4. **Repository-URL für Symcon kopieren**  
   - HTTPS-URL der Repo-Startseite, z. B.:  
     `https://github.com/IHR-BENUTZERNAME/symcon-mcp-server`

---

### Option B: Manuelles Kopieren (wenn Sie Zugriff auf die Festplatte des Servers haben)

Symcon speichert Benutzer-Module typischerweise hier:

- **Windows:** `C:\ProgramData\Symcon\user\`
- **Linux / Raspberry / SymBox:** `/var/lib/symcon/user/`

1. Den kompletten Ordner **symcon-mcp-server** (mit allem darin: `library.json`, `MCPServer/`, `libs/`, …) auf den Server kopieren.
2. In den **user**-Ordner legen, z. B. als:
   - `C:\ProgramData\Symcon\user\symcon-mcp-server\` (Windows) oder
   - `/var/lib/symcon/user/symcon-mcp-server/` (Linux).

Kopieren per SMB/Freigabe, SFTP, USB-Stick o. Ä. – je nachdem, wie Sie auf den Server zugreifen.

---

## Schritt 3: Modul in der Symcon-Weboberfläche einbinden

1. In der **Verwaltungskonsole** einloggen:  
   `http://192.168.10.12:3777/console/`

2. **Module Control** öffnen:
   - Links in der Baumansicht: **„Kern Instanzen“** (oder „Kern-Instanzen“) aufklappen.
   - Instanz **„Modules“** (Module Control) auswählen.

3. **Repository hinzufügen** (nur bei Option A):
   - Auf das **„+“** (Plus) klicken oder den Bereich „Repository hinzufügen“ nutzen.
   - Die **Repository-URL** eintragen, z. B.:  
     `https://github.com/IHR-BENUTZERNAME/symcon-mcp-server`
   - Bestätigen. Symcon lädt die Bibliothek herunter und zeigt sie in der Liste an.

4. **Bei Option B (manuell kopiert):**
   - Symcon erkennt neue Bibliotheken im `user`-Ordner oft nach einem **Neustart des Symcon-Dienstes** oder einem Reload der Konsole.
   - Falls die Bibliothek nicht erscheint: Symcon-Dokumentation zu „lokale Module / user-Ordner“ für Ihre Version prüfen.

---

## Schritt 4: Node-Abhängigkeiten bauen (einmalig)

Der MCP-Server ist in TypeScript geschrieben und muss einmal gebaut werden.

**Dafür brauchen Sie Zugriff auf eine Kommandozeile auf dem Symcon-Server** (SSH, direkte Konsole, oder z. B. „Task“/„Skript“ auf dem Gerät).

1. Auf dem Server in den MCP-Server-Ordner wechseln. Typische Pfade:
   - **Option A (Git):**  
     z. B. `/var/lib/symcon/user/symcon-mcp-server/libs/mcp-server` (Linux)  
     oder `C:\ProgramData\Symcon\user\symcon-mcp-server\libs\mcp-server` (Windows).
   - **Option B (manuell):**  
     Derselbe Pfad, je nachdem wo Sie `symcon-mcp-server` abgelegt haben.

2. Dort ausführen:
   ```bash
   npm install
   npm run build
   ```
   Danach sollte der Ordner `dist/` mit `index.js` existieren.

Wenn Sie **keinen** Shell-Zugriff haben: Manche Symcon-Umgebungen (z. B. NAS) erlauben, dass Sie den **bereits gebauten** Ordner `dist/` von Ihrem Entwicklungsrechner mit in den Ordner `libs/mcp-server/` kopieren (also `npm run build` lokal ausführen und dann `dist/` auf den Server kopieren). Dann entfällt `npm run build` auf dem Server.

---

## Schritt 5: Instanz „MCP Server“ anlegen und konfigurieren

1. In der **Verwaltungskonsole**:
   - Oben oder im Kontextmenü: **„Instanz hinzufügen“** (oder „Gerät/Modul hinzufügen“).

2. In der Liste nach **„MCP Server“** suchen (unter der Bibliothek „Symcon MCP Server“).
   - **MCP Server** auswählen und bestätigen (z. B. „Hinzufügen“ / „OK“).

3. Die neue Instanz auswählen und die **Konfiguration** öffnen.

4. **Einstellungen setzen:**
   - **Port:** z. B. `4096` (freier TCP-Port auf dem Server).
   - **Symcon API URL:**  
     `http://127.0.0.1:3777/api/`  
     (läuft auf demselben Rechner wie Symcon; Port 3777 ist der Standard-Webserver.)
   - **Aktiv:** Haken setzen.

5. **„Änderungen übernehmen“** (oder „Apply“ / „Speichern“) klicken.

Symcon startet dann im Hintergrund den Node-Prozess (MCP-Server). Wenn Node.js nicht installiert ist oder `dist/index.js` fehlt, passiert nichts oder es erscheint ggf. eine Meldung im Log.

---

## Schritt 6: Prüfen, ob der MCP-Server läuft

- **Von einem Rechner im gleichen Netzwerk** (z. B. Ihr PC):
  - Im Browser oder mit einem Tool:  
    `http://192.168.10.12:4096`  
    (4096 durch Ihren konfigurierten Port ersetzen.)
  - Es kann eine leere Seite oder eine technische Antwort kommen – wichtig ist, dass nicht „Verbindung abgelehnt“ kommt. Dann lauscht der MCP-Server.

- **Hinweis:** Der MCP-Server bindet sich nur an **127.0.0.1** (localhost). Wenn Sie von außen (z. B. 192.168.10.12:4096) zugreifen wollen, müsste die Bindung in der Modul-/Server-Konfiguration angepasst werden (Thema „Listen on all interfaces“). Standard ist nur localhost.

- **Logs:** In Symcon unter **„Log“** oder **„Nachrichten“** nach Einträgen zu „MCPServer“ oder „MCP“ schauen (Fehler beim Start des Node-Prozesses erscheinen dort, wenn Symcon das schreibt).

---

## Kurz-Checkliste

| Schritt | Erledigt? |
|--------|-----------|
| Node.js (v20+) auf dem Symcon-Server (192.168.10.12) | ☐ |
| Modul-Code auf Server (Git-Repo in Module Control ODER manuell in `user/`) | ☐ |
| `npm install` und `npm run build` in `libs/mcp-server/` auf dem Server (oder `dist/` kopiert) | ☐ |
| In der Konsole: Instanz „MCP Server“ angelegt | ☐ |
| Port (z. B. 4096), Symcon API URL `http://127.0.0.1:3777/api/`, „Aktiv“ gesetzt | ☐ |
| „Änderungen übernehmen“ geklickt | ☐ |

---

## Typische Probleme

- **„Modul erscheint nicht unter Instanz hinzufügen“**  
  Repository-URL prüfen (Option A) oder Pfad im `user`-Ordner und ggf. Symcon-Neustart (Option B).

- **„MCP-Server startet nicht“**  
  Node.js auf dem Server installiert? In `libs/mcp-server` `npm run build` ausgeführt (oder `dist/` von Ihrem Rechner kopiert)?

- **„Verbindung zu Port 4096 schlägt fehl“**  
  MCP-Server hört standardmäßig nur auf 127.0.0.1. Für Zugriff von Cursor/PC aus dem Netzwerk wäre eine Anpassung (Binding auf 0.0.0.0 oder Reverse-Proxy) nötig.

Bei weiteren Fragen hilft die [Symcon-Dokumentation](https://www.symcon.de/de/service/dokumentation/) und das [Symcon-Forum](https://www.symcon.de/forum/).
