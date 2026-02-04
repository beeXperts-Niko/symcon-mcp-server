# Anleitung: MCP-Server-Modul auf der SymBox (SymOS) zum Laufen bringen

Diese Anleitung ist für **SymBox mit SymOS** geschrieben. Sie nutzen nur die Weboberfläche (z. B. `http://&lt;SymBox-IP&gt;:3777/console/`) und haben wenig Erfahrung mit Symcon-Modulentwicklung.

---

## Build ist fertig – was jetzt?

Wenn Sie den MCP-Server **lokal auf dem Mac gebaut** haben, sind das die nächsten Schritte:

| # | Was | Wo / Wie |
|---|-----|----------|
| 1 | **Modul auf die SymBox bringen** | **Git (empfohlen):** Repo auf GitHub pushen → in Symcon **Module Control** die Repo-URL eintragen. Symcon lädt dann **inkl. vorgebautem `dist/`** – kein eigener Build nötig. Oder: Ordner `symcon-mcp-server` (mit allem außer `node_modules`, **mit** `libs/mcp-server/dist/`) per SMB/SFTP nach `/var/lib/symcon/user/symcon-mcp-server/` kopieren. |
| 2 | **`dist/` auf die SymBox** | **Bei Git-Installation: entfällt** – `dist/` liegt im Repo und wird mitgeliefert. Nur bei manueller Installation ohne Git: `libs/mcp-server/dist/` auf die SymBox legen (SMB/SFTP oder **`./deploy-to-symbox.sh`**). |
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
3. **Laufbaren MCP-Server (Node)** – auf der SymBox. Das Repo enthält bereits den vorgebauten Ordner **`libs/mcp-server/dist/`**; bei **Git-Installation** kommt er automatisch mit. Nur bei manueller Installation ohne Git: Build auf dem PC und Kopieren von `dist/` (siehe Schritt 4).
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
   - Ordner `libs/` (inkl. **`libs/mcp-server/dist/`** – vorgebauter MCP-Server, damit Symcon per Git sofort lauffähigen Code bekommt)
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
   (z. B. `http://&lt;SymBox-IP&gt;:3777/console/`)

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

## Schritt 4: MCP-Server bauen / `dist/` – nur bei manueller Installation

**Wenn Sie das Modul per Git (Module Control) einbinden:** Dieser Schritt entfällt. Das Repo enthält bereits **`libs/mcp-server/dist/`**; Symcon lädt ihn mit.

**Wenn Sie das Modul manuell kopieren** und dabei kein fertiges `dist/` mitliefern, müssen Sie den MCP-Server auf dem PC bauen und `dist/` auf die SymBox bringen:

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
   - Kopieren per SMB-Freigabe, SFTP oder **`./deploy-to-symbox.sh`** (baut und kopiert per SCP; andere SymBox: `./deploy-to-symbox.sh root@IHRE-SYMBOX-IP`).

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
   - **API-Key (optional):** Wenn Sie den MCP-Server schützen wollen, tragen Sie einen geheimen Schlüssel ein (z. B. ein langes Zufallspasswort). Jeder Client (Claude, MCP Inspector, curl) muss dann denselben Key mitsenden (Header `Authorization: Bearer <Key>` oder `X-MCP-API-Key: <Key>`). Leer = keine Authentifizierung – dann kann jeder im Netzwerk den Port nutzen.
   - **Aktiv:** Haken setzen.

5. **„Änderungen übernehmen“** klicken.

Symcon startet dann den Node-Prozess (MCP-Server). **Wichtig:** Auf der SymBox muss dafür **Node.js** installiert und im Pfad erreichbar sein (`node`-Befehl). Wenn Ihre SymBox kein Node mitliefert und Sie keinen SSH-Zugang haben, kann das Modul den Prozess nicht starten – in dem Fall müssten Sie Node nach Symcon/SymBox-Dokumentation oder mit Support nachinstallieren.

---

## Schritt 6: Prüfen, ob der MCP-Server läuft

- **Status auf der Einstellungsseite:** Oben auf der Instanzkonfiguration „MCP Server“ steht entweder **„✓ MCP-Server läuft auf Port … (PID: …)“** oder **„○ MCP-Server gestoppt“**. Beim Öffnen der Seite wird der Status aus der PID-Datei ermittelt.

- **MCP-Server hört auf allen Schnittstellen (0.0.0.0).**  
  Von Ihrem Mac/PC aus direkt erreichbar unter **http://&lt;IP-der-SymBox&gt;:4096** (z. B. `http://&lt;SymBox-IP&gt;:4096`). Kein SSH-Tunnel nötig.

- **Debug-Protokoll:** Bei der Instanz **„MCP Server“** den Tab **„Debug Protokoll“** öffnen und oben **„START“** klicken (damit Meldungen aufgezeichnet werden). Dann **„Änderungen übernehmen“** klicken – es erscheinen Meldungen wie „MCP-Server gestartet …“ oder „MCP-Server gestoppt“. Ohne START bleiben die Einträge leer. Zusätzlich: **„Meldungen“** / **„Nachrichten“** – dort erscheinen alle Log-Einträge mit Absender „MCPServer“.

---

## MCP-Server testen

Der MCP-Server hört auf der SymBox auf **allen Schnittstellen** (0.0.0.0). Sie können ihn von Ihrem Mac aus direkt unter **http://&lt;SymBox-IP&gt;:4096** erreichen (IP der SymBox und konfigurierter Port). Ein SSH-Tunnel ist nicht nötig.

### 1. Schnelltest mit curl

Ob der MCP-Server antwortet (Initialize-Anfrage):

```bash
curl -X POST http://&lt;SymBox-IP&gt;:4096 \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
```

**Falls Sie einen API-Key konfiguriert haben**, zusätzlich z. B.:  
`-H "Authorization: Bearer IHR_API_KEY"` oder `-H "X-MCP-API-Key: IHR_API_KEY"`.

Erwartung: JSON-Antwort mit `result` (z. B. Server-Infos), kein „Connection refused“. Ohne gültigen Key: HTTP 401 Unauthorized. Port und IP ggf. anpassen (z. B. 4096 → Ihr Port, &lt;SymBox-IP&gt; → Ihre SymBox-IP).

### 2. MCP Inspector (Tools im Browser testen)

[MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector) kann sich per **Streamable HTTP** mit dem MCP-Server verbinden:

1. Inspector starten: `npx @modelcontextprotocol/inspector`
2. **Streamable HTTP** wählen, URL eintragen: **http://&lt;SymBox-IP&gt;:4096**
3. Verbinden – danach die **Tools** (z. B. `symcon_get_value`, `symcon_set_value`) mit echten Symcon-Variablen-IDs testen.

### 3. In Claude oder anderem MCP-Client nutzen

1. In Ihrem KI-Agenten (z. B. Claude): **Einstellungen** → **MCP** → **Server hinzufügen**.
2. **Streamable HTTP**, URL: **http://&lt;SymBox-IP&gt;:4096** (SymBox-IP und Port anpassen).
3. **Falls Sie einen API-Key in Symcon gesetzt haben:** Unter „Headers“ eintragen:  
   - Name: `Authorization`, Wert: `Bearer IHR_API_KEY` (IHR_API_KEY durch den in Symcon konfigurierten Key ersetzen),  
   - oder Name: `X-MCP-API-Key`, Wert: `IHR_API_KEY`.  
   Ohne API-Key: Headers leer lassen.
4. Speichern – der MCP-Client verbindet sich mit dem Symcon-MCP-Server; in Chats z. B. „Lies Variable 12345“ (mit echten IDs aus Symcon).

**Claude: Erster Überblick + interaktiv reden** – Damit Claude beim ersten Mal „Gib mir ein paar Sekunden, ich schaue mir dein Smart Home an“ sagt und dann einen Überblick holt, siehe **docs/CLAUDE_EINBINDEN.md** (Custom Instructions / Anweisungen zum Kopieren).

### 4. Optional: Nur localhost (SSH-Tunnel)

Wenn Sie den MCP-Server nur auf localhost der SymBox binden möchten, setzen Sie die Umgebungsvariable **MCP_BIND=127.0.0.1** (z. B. im Symcon-Modul beim Start des Node-Prozesses). Dann ist Zugriff von außen nur per SSH-Tunnel möglich: `ssh -L 4096:127.0.0.1:4096 BENUTZER@&lt;SymBox-IP&gt;`, danach **http://127.0.0.1:4096** nutzen.

### 5. MCP-Server lokal auf dem Mac starten (ohne SymBox)

Wenn Sie nur das Modul/den Code testen wollen, ohne Symcon:

```bash
cd symcon-mcp-server/libs/mcp-server
MCP_PORT=4096 SYMCON_API_URL=http://127.0.0.1:3777/api/ npm run start
```

- Dann läuft der MCP-Server auf dem Mac auf Port 4096. **Symcon** muss unter `http://127.0.0.1:3777/api/` erreichbar sein (z. B. Symcon lokal oder Tunnel zur SymBox auf 3777). Tools wie `symcon_get_value` rufen dann diese API auf.

### 6. MCP-Server lokal starten (wenn „Loading Tools“ hängt)

Wenn Cursor sich nicht zur SymBox (z. B. &lt;SymBox-IP&gt;:4096) verbinden kann (Firewall, anderes Netz), starten Sie den MCP-Server **auf Ihrem Mac** und verbinden Cursor mit **localhost**:

1. **Im Projektordner** (vom Mac aus):
   ```bash
   cd symcon-mcp-server
   ./start-mcp-local.sh http://&lt;SymBox-IP&gt;:3777/api/ IHR_API_KEY
   ```
   (Ohne API-Key: `./start-mcp-local.sh http://&lt;SymBox-IP&gt;:3777/api/`.) Lassen Sie das Fenster offen – der Server läuft im Vordergrund.

2. **In Cursor** (mcp.json oder MCP-Einstellungen): Symcon-URL von `http://&lt;SymBox-IP&gt;:4096` auf **`http://127.0.0.1:4096`** ändern. API-Key-Header unverändert lassen.

3. **Cursor neu starten** – die Tools sollten geladen werden. Der MCP-Server auf dem Mac spricht dann mit der Symcon-API auf der SymBox (Port 3777); Port 4096 muss nur lokal erreichbar sein.

---

## Kurz-Checkliste (SymBox/SymOS)

| Schritt | Erledigt? |
|--------|-----------|
| Modul-Code auf SymBox (Git in Module Control ODER kopiert nach `/var/lib/symcon/user/symcon-mcp-server/`) | ☐ |
| Bei Git-Installation: Repo enthält `dist/` – nichts zu tun. Bei manuell: Build + Kopieren von `dist/` | ☐ |
| Node.js auf der SymBox verfügbar (oder geklärt, dass Modul sonst nicht starten kann) | ☐ |
| In der Konsole: Instanz „MCP Server“ angelegt | ☐ |
| Port (z. B. 4096), Symcon API URL `http://127.0.0.1:3777/api/`, optional API-Key, „Aktiv“ gesetzt | ☐ |
| „Änderungen übernehmen“ geklickt | ☐ |
| Bei API-Key: Claude/MCP-Client mit Header `Authorization: Bearer <Key>` oder `X-MCP-API-Key: <Key>` konfiguriert | ☐ |

---

## Typische Probleme (SymBox)

- **„Modul erscheint nicht unter Instanz hinzufügen“**  
  Repository-URL prüfen (Option A) oder prüfen, ob der Ordner wirklich unter `/var/lib/symcon/user/symcon-mcp-server/` liegt (Option B). Konsole neu laden oder Symcon-Dienst neustarten.

- **„MCP-Server startet nicht“**  
  Auf der SymBox muss `node` lauffähig sein. Wenn Node nicht installiert ist: entweder Node nach SymBox-Dokumentation installieren (SSH nötig) oder beim Symcon-Support nachfragen. Außerdem: `dist/index.js` muss unter `libs/mcp-server/dist/` auf der SymBox existieren (Schritt 4).

- **„Verbindung zu Port 4096 schlägt fehl“**  
  SymBox-IP und Port prüfen (z. B. `http://&lt;SymBox-IP&gt;:4096`). MCP-Server hört standardmäßig auf allen Schnittstellen (0.0.0.0). Firewall auf der SymBox prüfen, ob Port 4096 erlaubt ist.

- **„401 Unauthorized“ / „Missing or invalid API key“**  
  Sie haben in Symcon einen API-Key gesetzt. In Claude oder anderem MCP-Client (MCP-Einstellungen) unter Headers eintragen: `Authorization: Bearer IHR_KEY` oder `X-MCP-API-Key: IHR_KEY`. Key muss exakt dem in Symcon entsprechen.

- **„Loading Tools“ bleibt hängen**  
  (1) Symcon: Instanz „MCP Server“ → **Aktiv** gesetzt, **Änderungen übernehmen** – oben sollte dann **[OK] MCP-Server läuft** stehen (oder „Port in Benutzung“). (2) Erreichbarkeit vom Rechner des MCP-Clients: `curl -s -o /dev/null -w "%{http_code}" http://&lt;SymBox-IP&gt;:4096` – sollte 200 oder 405 liefern, nicht 000 (Firewall/Netzwerk prüfen). (3) API-Key im MCP-Client (Header `Authorization: Bearer <Key>`) muss exakt dem in Symcon entsprechen. (4) MCP-Client neu starten.  
  **Workaround:** Wenn die SymBox von Ihrem Mac aus nicht erreichbar ist, können Sie den MCP-Server **lokal auf dem Mac** starten und Cursor mit **http://127.0.0.1:4096** verbinden – siehe Abschnitt „MCP-Server lokal starten (Loading Tools)“ unten.

- **„fetch failed: self signed certificate“ (Cursor)**  
  Cursor vertraut **self-signed Zertifikaten** standardmäßig nicht. Wenn der Symcon MCP-Server mit HTTPS läuft und Sie in Cursor **https://127.0.0.1:4096** eintragen, schlägt die Verbindung mit diesem Fehler fehl.  
  **Lösung:** Server mit **HTTP** starten: `MCP_HTTP=1 ./start-mcp-local.sh` (erzwingt HTTP trotz vorhandener Zertifikate). In Cursor **http://127.0.0.1:4096** eintragen. Für Claude „Benutzerdefinierten Connector“ können Sie den Server ohne `MCP_HTTP=1` starten und HTTPS nutzen.

---

## Symcon-Log per SSH abrufen (Debugging)

Wenn das Modul nicht läuft und Sie SSH-Zugang zur SymBox haben, können Sie das Symcon-Log direkt abrufen:

**Skript im Projektordner** (z. B. vom Mac aus):

```bash
cd symcon-mcp-server
./fetch-symcon-log.sh root@&lt;SymBox-IP&gt;
```

- Erster Parameter: SSH-Ziel (Standard: `root@&lt;SymBox-IP&gt;`).
- Zweiter Parameter (optional): Anzahl Zeilen (Standard: 100), z. B. `./fetch-symcon-log.sh root@&lt;SymBox-IP&gt; 500`.
- Nur MCP-Einträge anzeigen: `./fetch-symcon-log.sh root@&lt;SymBox-IP&gt; 200 | grep -i mcp`

Das Skript sucht das Symcon-Log unter `/var/lib/symcon/logs/` und `/mnt/data/symcon/logs/` und gibt die letzten Zeilen aus (u. a. PHPLibrary, MCPServer, Fehler beim Modulstart).

**Ohne Skript (manuell per SSH):**

```bash
# Log-Pfad kann je nach SymBox/SymOS variieren:
ssh root@&lt;SymBox-IP&gt; "tail -100 /var/lib/symcon/logs/log_*.txt 2>/dev/null || tail -100 /mnt/data/symcon/logs/log_*.txt"
# Struktur anzeigen, wenn kein Log gefunden wird:
ssh root@&lt;SymBox-IP&gt; "ls -la /var/lib/symcon/ /mnt/data/symcon/ 2>/dev/null"
```

Bei weiteren Fragen: [Symcon-Dokumentation](https://www.symcon.de/de/service/dokumentation/), [Symcon-Forum](https://www.symcon.de/forum/), [SymBox-Installation](https://www.symcon.de/de/service/dokumentation/installation/symbox).
