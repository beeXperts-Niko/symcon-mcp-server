# Anleitung: MCP-Server-Modul auf der SymBox (SymOS) zum Laufen bringen

Diese Anleitung ist für **SymBox mit SymOS** geschrieben. Sie nutzen nur die Weboberfläche (z. B. `http://192.168.10.12:3777/console/`) und haben wenig Erfahrung mit Symcon-Modulentwicklung.

---

## Build ist fertig – was jetzt?

Wenn Sie den MCP-Server **lokal auf dem Mac gebaut** haben, sind das die nächsten Schritte:

| # | Was | Wo / Wie |
|---|-----|----------|
| 1 | **Modul auf die SymBox bringen** | Entweder: Repo auf GitHub pushen → in Symcon **Module Control** die Repo-URL eintragen. Oder: Ordner `symcon-mcp-server` (mit allem außer `node_modules`) per SMB/SFTP nach `/var/lib/symcon/user/symcon-mcp-server/` auf die SymBox kopieren. |
| 2 | **`dist/` auf die SymBox kopieren** | Den bei Ihnen gebauten Ordner **`libs/mcp-server/dist/`** (vom Mac) in dasselbe Verzeichnis auf der SymBox legen: `/var/lib/symcon/user/symcon-mcp-server/libs/mcp-server/dist/` (z. B. per SMB/SFTP). Darin muss `index.js` liegen. |
| 3 | **Node.js auf der SymBox** | Das Modul startet `node dist/index.js`. Auf der SymBox muss **Node.js** (v20+) installiert und als `node` erreichbar sein. Ohne Node startet der MCP-Server nicht. Ob/wie Node auf SymBox installierbar ist, steht in der [SymBox-Anleitung](https://www.symcon.de/assets/files/product/symbox.pdf) bzw. beim Support. |
| 4 | **Modul in Symcon einbinden** | Konsole öffnen → **Kern Instanzen** → **Modules** → bei Git: **+** und Repo-URL eintragen. Bei manuell kopiert: Konsole neu laden oder Symcon-Dienst neustarten, damit die Bibliothek erscheint. |
| 5 | **Instanz anlegen** | **Instanz hinzufügen** → **MCP Server** wählen → Konfiguration: **Port** (z. B. 4096), **Symcon API URL** `http://127.0.0.1:3777/api/`, **Aktiv** anhaken → **Änderungen übernehmen**. |

Danach läuft der MCP-Server auf der SymBox (wenn Node vorhanden ist). Details zu jedem Schritt stehen in den folgenden Abschnitten.

---

## SymBox & SymOS – kurz

- **SymBox** = Komplettlösung für IP-Symcon (Hardware + SymOS).
- **SymOS** = von Symcon bereitgestelltes Betriebssystem (Linux-basiert), mit Weboberfläche für Einstellungen, Backup, Updates.
- Benutzer-Module liegen auf der SymBox unter: **`/var/lib/symcon/user/`**
- Sie steuern alles über die **IP-Symcon-Verwaltungskonsole** (Browser); für manche Schritte brauchen Sie ggf. **SSH** oder **Dateizugriff** (SMB/SFTP), falls auf Ihrer SymBox verfügbar.

Weitere Infos: [SymBox-Dokumentation](https://www.symcon.de/de/service/dokumentation/installation/symbox), [Installationsanleitung PDF](https://www.symcon.de/assets/files/product/symbox.pdf).

---

## Übersicht: Was Sie brauchen

1. **Symcon-Weboberfläche** – haben Sie (z. B. `http://<IP-der-SymBox>:3777/console/`).
2. **Modul-Code auf der SymBox** – per **Git-Repository** in der Module Control (empfohlen) oder per **manuelles Kopieren** in den user-Ordner.
3. **Laufbaren MCP-Server (Node)** – auf der SymBox. Da SymOS in der Regel **kein Node.js** mitbringt, bauen Sie `dist/` auf Ihrem **PC** und kopieren es in `libs/mcp-server/` auf die SymBox (siehe Schritt 4).
4. **Eine Instanz „MCP Server“** in Symcon – anlegen und konfigurieren.

---

## Schritt 1: Node.js – nur auf Ihrem PC nötig (für SymBox ohne Node)

Der MCP-Server ist ein Node.js-Programm. Auf der **SymBox** ist Node.js meist **nicht** vorinstalliert und wird von SymOS nicht mitgeliefert.

- **Empfohlener Weg für SymBox:**  
  Sie bauen den MCP-Server **auf Ihrem eigenen Rechner** (Windows/macOS/Linux) mit Node.js (v20+) und kopieren nur den fertigen Ordner **`dist/`** in `libs/mcp-server/` auf die SymBox. Dann muss auf der SymBox **kein** Node installiert werden – das Modul startet die **`node`-Binary**, die Sie ggf. separat bereitstellen müssten.  

  **Hinweis:** Das Modul startet aktuell `node dist/index.js`. Wenn auf der SymBox kein `node` existiert, müssen Sie entweder Node auf der SymBox installieren (nur mit SSH/Zugang zur Shell möglich) oder den Ansatz „vorkompiliertes dist/ kopieren“ nutzen und sicherstellen, dass auf der SymBox eine Node-Laufzeit vorhanden ist. Da SymBox/SymOS typischerweise **kein** Node mitliefert, gilt für die meisten Nutzer: **Zuerst Schritt 4 auf dem PC ausführen (Build), dann `dist/` auf die SymBox kopieren.** Ob auf Ihrer SymBox Node installiert werden kann, steht in der [SymBox-Installationsanleitung](https://www.symcon.de/assets/files/product/symbox.pdf) bzw. beim Support.

- **Wenn Sie SSH-Zugang zur SymBox haben** und Node dort installieren können:  
  Nach dem Einloggen `node --version` prüfen (v20 oder höher). Falls Node fehlt, nach Anleitung für Ihr SymOS/Linux Node.js LTS installieren (Paketmanager oder nvm). Dann können Sie Schritt 4 direkt auf der SymBox ausführen (`npm install` und `npm run build` in `libs/mcp-server/`).

---

## Schritt 2: Modul-Code auf die SymBox bringen

Symcon liest Benutzer-Module auf der **SymBox** aus dem Ordner **`/var/lib/symcon/user/`**.

### Option A: Installation über Git-Repository (empfohlen)

So lädt Symcon die Bibliothek selbst herunter und Sie können sie später aktualisieren.

1. **GitHub-Account** anlegen (falls noch keiner: [github.com](https://github.com) → Sign up).

2. **Neues Repository anlegen**
   - Auf GitHub: „New repository“.
   - Name z. B. `symcon-mcp-server`.
   - Öffentlich (Public), ohne README / .gitignore.

3. **Inhalt des Repositories = Inhalt von `symcon-mcp-server`**  
   Im Root des Repos müssen liegen:
   - `library.json`
   - Ordner `MCPServer/`
   - Ordner `libs/`
   - optional: `README.md`, `ANLEITUNG_INSTALLATION.md`

   Auf Ihrem Rechner:
   - In den Ordner wechseln: `symconMCP/symcon-mcp-server`
   - Git initialisieren (falls noch nicht):  
     `git init`  
     `git add library.json MCPServer libs README.md ANLEITUNG_INSTALLATION.md`  
     `git commit -m "Symcon MCP Server Modul"`
   - Remote setzen (Ihre GitHub-URL eintragen):  
     `git remote add origin https://github.com/IHR-BENUTZERNAME/symcon-mcp-server.git`  
     `git branch -M main`  
     `git push -u origin main`

4. **Repository-URL für Symcon kopieren**  
   z. B. `https://github.com/IHR-BENUTZERNAME/symcon-mcp-server`

---

### Option B: Manuelles Kopieren auf die SymBox

Wenn Sie Zugriff auf das Dateisystem der SymBox haben (z. B. SMB-Freigabe, SFTP, USB-Stick-Restore):

1. Den **kompletten** Ordner **symcon-mcp-server** (mit `library.json`, `MCPServer/`, `libs/`, …) auf die SymBox kopieren.
2. In den **user**-Ordner legen:
   - **SymBox (SymOS, Linux):**  
     **`/var/lib/symcon/user/symcon-mcp-server/`**

Zugriff auf `/var/lib/symcon/` ist je nach SymBox über SMB-Freigabe, SFTP oder andere in der [SymBox-Dokumentation](https://www.symcon.de/de/service/dokumentation/installation/symbox) beschriebene Wege möglich.

---

## Schritt 3: Modul in der Symcon-Weboberfläche einbinden

1. In der **Verwaltungskonsole** einloggen:  
   `http://<IP-der-SymBox>:3777/console/`  
   (z. B. `http://192.168.10.12:3777/console/`)

2. **Module Control** öffnen:
   - Links: **„Kern Instanzen“** aufklappen.
   - Instanz **„Modules“** (Module Control) auswählen.

3. **Repository hinzufügen** (nur bei Option A):
   - Auf **„+“** (Plus) klicken bzw. „Repository hinzufügen“ nutzen.
   - **Repository-URL** eintragen, z. B.:  
     `https://github.com/IHR-BENUTZERNAME/symcon-mcp-server`
   - Bestätigen. Symcon lädt die Bibliothek herunter; sie erscheint in der Liste. Auf der SymBox landet sie unter `/var/lib/symcon/user/<repo-name>/`.

4. **Bei Option B (manuell kopiert):**
   - Symcon erkennt neue Bibliotheken im `user`-Ordner oft erst nach einem **Neustart des Symcon-Dienstes** oder nach Reload der Konsole (Seite neu laden). Bei SymBox ggf. in den Einstellungen prüfen, ob ein Neustart nötig ist.

---

## Schritt 4: MCP-Server bauen – auf dem PC, dann `dist/` auf die SymBox kopieren

Da auf der SymBox in der Regel **kein Node.js** installiert ist, bauen Sie den MCP-Server auf Ihrem **eigenen Rechner** und kopieren nur das Ergebnis auf die SymBox.

1. **Auf Ihrem PC** (Windows/macOS/Linux, mit installiertem Node.js v20+):
   - In den Ordner wechseln:  
     `symconMCP/symcon-mcp-server/libs/mcp-server`
   - Ausführen:
     ```bash
     npm install
     npm run build
     ```
   - Es entsteht der Ordner **`dist/`** mit `index.js` darin.

2. **Ordner `dist/` auf die SymBox kopieren:**
   - Zielpfad auf der SymBox:  
     **`/var/lib/symcon/user/symcon-mcp-server/libs/mcp-server/dist/`**
   - Also: Inhalt von `dist/` (mindestens `index.js`) so auf die SymBox legen, dass z. B.  
     `/var/lib/symcon/user/symcon-mcp-server/libs/mcp-server/dist/index.js`  
     existiert.
   - Kopieren per SMB-Freigabe, SFTP oder anderem Zugriff, den Ihre SymBox anbietet.

**Falls Sie SSH und Node.js auf der SymBox haben:**  
Auf der SymBox in `/var/lib/symcon/user/symcon-mcp-server/libs/mcp-server/` die Befehle `npm install` und `npm run build` ausführen – dann entsteht `dist/` direkt auf der SymBox.

---

## Schritt 5: Instanz „MCP Server“ anlegen und konfigurieren

1. In der **Verwaltungskonsole**:
   - **„Instanz hinzufügen“** (oder „Gerät/Modul hinzufügen“) wählen.

2. In der Liste nach **„MCP Server“** suchen (Bibliothek „Symcon MCP Server“).
   - **MCP Server** auswählen und bestätigen.

3. Neue Instanz auswählen und **Konfiguration** öffnen.

4. **Einstellungen:**
   - **Port:** z. B. `4096` (freier Port auf der SymBox).
   - **Symcon API URL:**  
     `http://127.0.0.1:3777/api/`  
     (Symcon läuft auf derselben SymBox; 3777 = Standard-Webserver.)
   - **Aktiv:** Haken setzen.

5. **„Änderungen übernehmen“** klicken.

Symcon startet dann den Node-Prozess (MCP-Server). **Wichtig:** Auf der SymBox muss dafür **Node.js** installiert und im Pfad erreichbar sein (`node`-Befehl). Wenn Ihre SymBox kein Node mitliefert und Sie keinen SSH-Zugang haben, kann das Modul den Prozess nicht starten – in dem Fall müssten Sie Node nach Symcon/SymBox-Dokumentation oder mit Support nachinstallieren.

---

## Schritt 6: Prüfen, ob der MCP-Server läuft

- **MCP-Server bindet nur an 127.0.0.1 (localhost).**  
  Ein Aufruf von außen (z. B. `http://192.168.10.12:4096`) geht nur, wenn Sie den MCP-Server so anpassen, dass er auf alle Schnittstellen (0.0.0.0) hört, oder Sie einen Tunnel nutzen.

- **Prüfung von Ihrem PC aus (z. B. mit SSH-Tunnel):**
  ```bash
  ssh -L 4096:127.0.0.1:4096 BENUTZER@<IP-der-SymBox>
  ```
  Dann im Browser oder MCP-Client: `http://127.0.0.1:4096` (Verbindung läuft über den Tunnel zur SymBox).

- **Logs:** In Symcon unter **„Log“** / **„Nachrichten“** nach Einträgen zu „MCPServer“ oder „MCP“ schauen – Fehler beim Start des Node-Prozesses erscheinen dort, wenn Symcon sie schreibt.

---

## MCP-Server testen

Der MCP-Server hört nur auf **127.0.0.1** (localhost) auf der SymBox. Von Ihrem Mac aus testen Sie deshalb per **SSH-Tunnel** oder lokal (wenn Sie den MCP-Server zum Test auf dem Mac starten).

### 1. SSH-Tunnel zur SymBox (von Ihrem Mac)

Damit Ihr Mac den MCP-Server auf der SymBox erreicht:

```bash
ssh -L 4096:127.0.0.1:4096 BENUTZER@192.168.10.12
```

- `BENUTZER` durch Ihren SSH-Benutzernamen auf der SymBox ersetzen (falls SSH aktiv ist).
- Tunnel offen lassen. Dann gilt: Auf Ihrem Mac ist **http://127.0.0.1:4096** = MCP-Server auf der SymBox.

### 2. Schnelltest mit curl (nach Tunnel oder lokal)

Ob der MCP-Server antwortet (Initialize-Anfrage):

```bash
curl -X POST http://127.0.0.1:4096 \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
```

Erwartung: JSON-Antwort mit `result` (z. B. Server-Infos), kein „Connection refused“.

### 3. MCP Inspector (Tools im Browser testen)

[MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector) kann sich per **Streamable HTTP** mit einem MCP-Server verbinden:

1. **Tunnel starten** (siehe oben), damit `http://127.0.0.1:4096` auf Ihrem Mac den Symcon-MCP-Server erreicht.
2. Inspector starten:
   ```bash
   npx @modelcontextprotocol/inspector
   ```
3. Im Inspector **Streamable HTTP** wählen und als URL eintragen: **http://127.0.0.1:4096**
4. Verbinden – danach können Sie die **Tools** (z. B. `symcon_get_value`, `symcon_set_value`) aufrufen und mit echten Variablen-IDs testen.

### 4. In Cursor als MCP-Server nutzen

1. **Tunnel** zur SymBox laufen lassen (siehe oben).
2. In Cursor: **Einstellungen** → **MCP** (oder „Features“ → MCP) → **Server hinzufügen**.
3. Bei **Streamable HTTP** die URL eintragen: **http://127.0.0.1:4096**
4. Speichern – Cursor verbindet sich mit dem Symcon-MCP-Server; Sie können in Chats z. B. „Lies Variable 12345“ oder „Führe Skript 67890 aus“ nutzen (mit echten IDs aus Symcon).

### 5. MCP-Server lokal auf dem Mac testen (ohne SymBox)

Wenn Sie nur das Modul/den Code testen wollen, ohne Symcon:

```bash
cd symcon-mcp-server/libs/mcp-server
MCP_PORT=4096 SYMCON_API_URL=http://127.0.0.1:3777/api/ npm run start
```

- Dann läuft der MCP-Server auf dem Mac auf Port 4096. **Symcon** muss unter `http://127.0.0.1:3777/api/` erreichbar sein (z. B. Symcon lokal oder Tunnel zur SymBox auf 3777). Tools wie `symcon_get_value` rufen dann diese API auf.

---

## Kurz-Checkliste (SymBox/SymOS)

| Schritt | Erledigt? |
|--------|-----------|
| Modul-Code auf SymBox (Git in Module Control ODER kopiert nach `/var/lib/symcon/user/symcon-mcp-server/`) | ☐ |
| Auf dem PC: `npm install` und `npm run build` in `libs/mcp-server/` ausgeführt | ☐ |
| Ordner `dist/` nach `/var/lib/symcon/user/symcon-mcp-server/libs/mcp-server/` auf die SymBox kopiert | ☐ |
| Node.js auf der SymBox verfügbar (oder geklärt, dass Modul sonst nicht starten kann) | ☐ |
| In der Konsole: Instanz „MCP Server“ angelegt | ☐ |
| Port (z. B. 4096), Symcon API URL `http://127.0.0.1:3777/api/`, „Aktiv“ gesetzt | ☐ |
| „Änderungen übernehmen“ geklickt | ☐ |

---

## Typische Probleme (SymBox)

- **„Modul erscheint nicht unter Instanz hinzufügen“**  
  Repository-URL prüfen (Option A) oder prüfen, ob der Ordner wirklich unter `/var/lib/symcon/user/symcon-mcp-server/` liegt (Option B). Konsole neu laden oder Symcon-Dienst neustarten.

- **„MCP-Server startet nicht“**  
  Auf der SymBox muss `node` lauffähig sein. Wenn Node nicht installiert ist: entweder Node nach SymBox-Dokumentation installieren (SSH nötig) oder beim Symcon-Support nachfragen. Außerdem: `dist/index.js` muss unter `libs/mcp-server/dist/` auf der SymBox existieren (Schritt 4).

- **„Verbindung zu Port 4096 schlägt fehl“**  
  Der MCP-Server hört nur auf 127.0.0.1. Zugriff von außen nur per SSH-Tunnel (siehe Schritt 6) oder nach Anpassung des Moduls/Server auf 0.0.0.0.

Bei weiteren Fragen: [Symcon-Dokumentation](https://www.symcon.de/de/service/dokumentation/), [Symcon-Forum](https://www.symcon.de/forum/), [SymBox-Installation](https://www.symcon.de/de/service/dokumentation/installation/symbox).
