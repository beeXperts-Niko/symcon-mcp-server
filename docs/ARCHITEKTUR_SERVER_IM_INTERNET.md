# Architektur: Server im Internet + Smart Home im eigenen Netz

Du möchtest einen **Dienst auf deinem Server im Internet** betreiben. Von dort gibt es **keine Verbindung ins Heimnetz** (Symcon/Smart Home ist hinter dem Router). Die Lösung: **Das Smart Home baut die Verbindung zum Server auf** (Outbound). Deine Web-App (z. B. als native App auf iOS) nutzt Mikrofon, wertet optional lokal aus, ob es ein Haus-Befehl ist, und arbeitet dann mit Whisper + ChatGPT auf dem Server – der Server spricht mit dem Smart Home über die vom Heimnetz aus aufgebaute Verbindung.

**Tech-Stack Server/UI:** PHP, Composer, Laravel; für ein User-Interface: Flowbite und Tailwind nutzbar.

---

## Übersicht

```
[Web-App z. B. iOS]
  │  Mikrofon → optional lokal: "Befehl ans Haus?"
  │  Wenn ja: Audio (oder Text) → Server
  ▼
[Dein Server im Internet]
  │  Whisper (STT) → ChatGPT mit Symcon-Tools
  │  Bei Tool-Aufruf: Befehl an verbundenes Smart Home senden
  ▼
[Outbound-Verbindung: Smart Home → Server]
  │  WebSocket (oder ähnlich), vom HEIMNETZ aus aufgebaut
  ▼
[Brücke im Heimnetz (Symcon / SymBox / Pi)]
  │  Empfängt "führe Tool X mit Parametern Y aus"
  │  Ruft lokalen MCP-Server oder Symcon-API auf
  │  Sendet Ergebnis zurück an Server
  ▼
[Symcon / MCP-Server]
  │  Führt z. B. symcon_request_action aus
```

**Wichtig:** Der Server **initiiert keine** Verbindung ins Heimnetz. Nur die **Brücke im Heimnetz** verbindet sich **outbound** zum Server (z. B. `wss://dein-server.de/smart-home`). Dadurch funktioniert es auch ohne Port-Forwarding und ohne öffentliche IP für das Smart Home.

---

## 1. Brücke im Heimnetz („Modul“ / Connector)

**Rolle:** Läuft im gleichen Netz wie Symcon (z. B. auf der SymBox oder einem Raspberry Pi). Baut eine **persistente Outbound-Verbindung** zum Server im Internet auf und führt Befehle lokal aus.

**Ablauf:**

1. Beim Start verbindet sich die Brücke **outbound** mit deinem Server (z. B. WebSocket `wss://dein-server.de/smart-home`, optional mit Token/Home-ID).
2. Server merkt sich: „Home XYZ ist verbunden“ (über diese WebSocket-Instanz).
3. Wenn die Web-App einen Befehl schickt und ChatGPT einen **Tool-Aufruf** zurückgibt (z. B. `symcon_request_action`), sendet der Server eine Nachricht über die WebSocket an die Brücke: z. B. `{ "tool": "symcon_request_action", "args": { "variableId": 36800, "value": true } }`.
4. Die Brücke ruft **lokal** den MCP-Server (z. B. `http://127.0.0.1:4096`) oder direkt die Symcon JSON-RPC API auf, führt den Aufruf aus und sendet die **Antwort** zurück an den Server (über die gleiche WebSocket).
5. Der Server übergibt die Antwort an ChatGPT (als Tool-Result), ChatGPT antwortet dem User, und die Web-App kann die Antwort (evtl. als TTS) abspielen.

**Was die Brücke braucht:**

- Konfiguration: **Server-URL** (z. B. `wss://dein-server.de/smart-home`), optional **Home-ID**, **Token**.
- Lokale Adresse des **MCP-Servers** (z. B. `http://127.0.0.1:4096`) oder der **Symcon-API** (z. B. SymBox `http://192.168.1.10:3777/api/`).
- Implementierung: WebSocket-Client (Reconnect bei Abbruch), Empfang von JSON-Nachrichten, Aufruf des MCP-Servers (HTTP POST im MCP-Format) oder der Symcon-API, Rückgabe des Ergebnisses als JSON an den Server.

**Wo es leben kann:**

- Als **eigenes kleines Programm** (z. B. Node.js/TypeScript), das auf der SymBox oder einem Pi läuft (neben dem MCP-Server).
- Oder als **Erweiterung des Symcon-MCP-Servers**: Ein zusätzlicher „Outbound-Connector“, der beim Start des MCP-Servers eine WebSocket-Verbindung zum konfigurierten Server aufbaut und eingehende Tool-Aufrufe an die lokale Tool-Logik weiterreicht (gleicher Prozess wie der MCP-Server).

---

## 2. Server im Internet

**Rolle:** Zentrale Stelle für Whisper, ChatGPT und Routing der Tool-Aufrufe ans verbundene Smart Home.

**Komponenten:**

- **WebSocket-Endpunkt** (z. B. `/smart-home`): Akzeptiert **eingehende** Verbindungen von den Brücken (Heimnetz). Pro „Home“ eine Verbindung (oder pro Nutzer/Token). Speichert die Verbindung (z. B. in einer Map `homeId → WebSocket`).
- **REST/Web-API für die Web-App:**  
  - z. B. „Post Audio“: Nimmt Audio auf, optional Home-ID/Token.  
  - Führt Whisper (STT) aus → Text.  
  - Sendet Text an ChatGPT mit **Symcon-Tools** (Function Calling).  
  - Wenn ChatGPT einen Tool-Call zurückgibt: Sucht die zugehörige WebSocket-Verbindung (dieses Home) und sendet die Tool-Aufruf-Nachricht an die Brücke.  
  - Wartet auf Antwort von der Brücke (über WebSocket), liefert sie an ChatGPT als Tool-Result.  
  - Wiederholt das, bis ChatGPT eine finale Textantwort hat.  
  - Optional: TTS (z. B. OpenAI TTS) für die Antwort.  
  - Liefert Text (und optional Audio) an die Web-App zurück.
- **Tool-Definitionen für ChatGPT:** Die gleichen Tools wie der MCP-Server (z. B. `symcon_resolve_device`, `symcon_request_action`, …) als OpenAI-`tools` (Function Calling) definieren. Der **Server** führt sie nicht selbst aus, sondern leitet sie an die Brücke weiter und setzt die Antwort als `tool_call`-Result ein.

**Sicherheit:**

- Brücke und Web-App mit **Token/API-Key** oder **Home-ID** authentifizieren.
- Pro Token/Home nur eine aktive Brücken-Verbindung erlauben (oder klar definieren, welches Home zu welchem User gehört).

---

## 3. Web-App (z. B. iOS als „Add to Home Screen“)

**Rolle:** Sprach-Eingabe, optional lokale Vorprüfung, Anzeige/Ausgabe der Antwort (evtl. TTS).

**Ablauf:**

1. **Mikrofon:** User spricht (z. B. Push-to-Talk oder nach Wake Word).
2. **Optional – lokale Auswertung:** Bevor Audio oder Text zum Server geschickt wird, entscheiden: „Ist das ein Befehl ans Haus?“ Wenn nein, kein Upload (Datenschutz, Latenz, Traffic).
3. **Wenn ja:** Audio (oder bereits lokal transkribierter Text) an den Server senden (HTTPS).
4. **Antwort:** Server liefert Text (und optional TTS-Audio). App spielt Audio ab und/oder zeigt Text an.

**Technik:**

- Als **Progressive Web App (PWA)** installierbar („Zum Home-Bildschirm“ auf iOS). Nutzt normale Web-APIs (Mikrofon, Audio). Kein App-Store nötig.
- Alternative: Native App (z. B. Swift), die dasselbe Backend anspricht.

---

### Sprache erst lokal auf dem iPhone auswerten (bevor etwas ins Netz geht)

**Ja, das ist möglich** – je nach Art der App:

| Variante | Lokale Auswertung vor Versand ins Netz |
|----------|----------------------------------------|
| **Native iOS-App (Swift)** | **Ja, vollständig.** Apple **Speech Framework** (ab iOS 13, on-device ab iOS 19 mit `requiresOnDeviceRecognition`) macht Spracherkennung **lokal auf dem Gerät**. Du transkribierst on-device → prüfst den Text lokal (Keywords wie „Licht“, „Schalte“, „Haus“ oder kleines Intent-Modell) → nur wenn es wie ein Haus-Befehl aussieht, sendest du **nur den Text** (kein Audio) an deinen Server. Kein Sprach-Audio verlässt das iPhone. |
| **PWA / reine Web-App auf iOS** | **Eingeschränkt.** iOS Safari unterstützt die **Web Speech API** (SpeechRecognition) **nicht**. Lokale STT im Browser auf dem iPhone ist damit nicht verfügbar. Optionen: (1) **Keyword-Check auf dem Server:** Audio an Server senden (Whisper), Server prüft Transkript auf Haus-Befehle und ruft nur bei Treffer ChatGPT/Symcon auf. (2) **Hybrid:** Web-App in **Capacitor** (oder ähnlich) einbetten → nutzt nativ das Speech Framework für on-device STT, dann lokale Auswertung im JS, nur bei Bedarf Text an Server. |
| **Android / Chrome (PWA)** | Web Speech API verfügbar; Transkript oft über Google-Server. Für echte lokale Auswertung ohne Audio-Versand: native App oder Keyword-Check erst **nach** Transkript (dann nur Text senden, wenn Keyword trifft). |

**Praktische Empfehlung:**

- **Maximaler Datenschutz / „nichts verlässt das Gerät“:** Native iOS-App mit Speech Framework, **on-device**-Erkennung (iOS 19+), lokale Keyword- oder Intent-Prüfung, nur bei Haus-Befehl den **Text** an deinen Laravel-Server senden.
- **Schnellste Umsetzung mit Web-Stack:** PWA mit Mikrofon; Audio an Laravel senden; **Server** transkribiert (Whisper), prüft auf Keywords/Intent und ruft nur bei Haus-Befehl ChatGPT + Brücke auf. So bleibt die Logik „erst auswerten, dann Haus ansteuern“ erhalten, nur die Auswertung passiert auf dem Server statt auf dem iPhone.

---

### Avatar: Roboterkopf mit Mimik

Die App kann um einen **Avatar** ergänzt werden – z. B. ein **Roboterkopf mit Mimik**, der den Assistenten sichtbar macht und auf den Dialogzustand reagiert.

**Mögliche Zustände (Mimik / Animation):**

- **Idle** – wartet, freundlicher neutraler Blick
- **Zuhören** – Augen/Ohren „aktiv“, evtl. leichte Bewegung
- **Denken** – konzentrierte Mimik, evtl. „Laden“-Animation
- **Sprechen** – Lippenbewegung oder Mundlicht, passend zu TTS
- **Erfolg** – kurzes Lächeln / Bestätigung
- **Fehler / Unklar** – fragender oder entschuldigender Ausdruck

**Technische Optionen (mit Laravel + Flowbite/Tailwind):**

| Variante | Beschreibung |
|----------|--------------|
| **SVG/Canvas + Zustände** | Roboterkopf als SVG (oder Canvas). Pro Zustand eine Variante (z. B. andere Augen, Mund) oder CSS-Animation/Transition. Frontend (Blade + Alpine.js oder Vue) setzt die Klasse/State je nach Status („listening“, „speaking“, …). Einfach, leichtgewichtig, gut mit Tailwind kombinierbar. |
| **Lottie** | Vorgefertigte oder eigene Animationen (After Effects → Lottie JSON). Mehrere Clips für Idle, Listening, Speaking etc.; Wechsel per JavaScript. Wirkt sehr flüssig, etwas mehr Aufwand beim Erstellen der Animationen. |
| **3D (Three.js / Babylon)** | 3D-Roboterkopf mit Skelett/Rigging; Mimik über Blend Shapes oder Bones. Maximale Freiheit, höherer Aufwand und Performance-Bedarf – eher für Desktop oder leistungsstarke Geräte. |
| **Lip-Sync zu TTS** | Wenn der Avatar beim Sprechen den Mund bewegen soll: Audio (TTS) an Frontend senden, mit Library (z. B. Rhubarb Lip Sync, oder viseme-basiert) Mundbewegung berechnen und auf Avatar anwenden. Alternativ: fertige Dienste (z. B. D-ID), die aus Text + Avatar ein Video erzeugen – dann weniger Kontrolle, dafür schnell. |

**Integration in deine App:**

- Avatar als **eigenes UI-Element** (z. B. oben oder zentral), daneben oder darunter: Mikrofon-Button, Textantwort, evtl. TTS-Wiedergabe.
- **Status** kommt vom gleichen Flow wie die Sprachauswertung: „listening“ beim Aufnehmen, „thinking“ während Server antwortet, „speaking“ während TTS läuft, „success“/„error“ nach Ergebnis. Diese States kannst du per WebSocket oder nach jedem API-Call an das Frontend liefern; der Avatar wechselt dann die Mimik bzw. Animation.
- Mit **Flowbite/Tailwind** lässt sich der Container (Karten, Abstände, Dark Mode) sauber bauen; der Avatar selbst ist ein eingebettetes SVG, Canvas oder eine Lottie/WebGL-Komponente.

Ein **Roboterkopf mit klarer, freundlicher Mimik** passt gut zum Smart-Home-Assistenten und macht die Interaktion greifbarer – technisch ist das mit deinem Stack (Laravel, Frontend mit Tailwind/Flowbite) gut umsetzbar.

---

## 4. Gesamtfluss (Beispiel)

1. User öffnet die Web-App auf dem Handy, tippt auf Mikrofon (oder sagt „Hey Haus“).
2. App nimmt auf, prüft optional lokal „Befehl?“ → ja, sendet Audio an `https://dein-server.de/api/voice` (mit Token/Home-ID).
3. **Server:** Whisper transkribiert → „Schalte das Licht im Büro an.“  
   Server ruft ChatGPT auf mit System-Prompt „Du steuerst das Smart Home …“ und `tools` = Symcon-Funktionen.  
   ChatGPT antwortet mit `tool_calls`: z. B. `symcon_resolve_device("Büro Licht")`, dann `symcon_request_action(36800, true)`.
4. **Server** hat die WebSocket-Verbindung der Brücke für dieses Home. Sendet an Brücke: `{ "id": "1", "tool": "symcon_resolve_device", "args": { "userPhrase": "Büro Licht" } }`.
5. **Brücke** (im Heimnetz) ruft lokal `http://127.0.0.1:4096` (MCP) auf, bekommt `{ "found": true, "variableId": 36800, … }`, sendet das an den Server zurück.
6. **Server** setzt das als Tool-Result in ChatGPT ein. ChatGPT ruft als Nächstes `symcon_request_action(36800, true)` auf. Server sendet wieder an Brücke, Brücke führt aus, antwortet „OK“. Server liefert das an ChatGPT.
7. ChatGPT antwortet: „Bürolicht ist an.“ Server optional TTS → Audio. Antwort (Text + optional Audio) geht an die Web-App.
8. App spielt „Bürolicht ist an.“ ab und/oder zeigt den Text.

---

## 5. Was du konkret umsetzen musst

| Baustein | Wo | Aufgabe |
|----------|----|--------|
| **Outbound-Brücke** | Heimnetz (SymBox/Pi, evtl. Teil des MCP-Moduls) | WebSocket-Client zu deinem Server; empfängt Tool-Aufrufe, führt sie lokal (MCP oder Symcon-API) aus, sendet Ergebnis zurück. |
| **Server** | Dein Server im Internet | WebSocket-Server für Brücken; REST/API für Web-App; Whisper + ChatGPT mit Symcon-Tools; Tool-Calls an Brücke weiterleiten, Result an ChatGPT zurück. |
| **Web-App** | Handy/Browser | Mikrofon, optional lokale „Befehl?“-Prüfung, Upload an Server, Wiedergabe Antwort (Text/TTS). |

**Symcon/MCP:** Der bestehende **MCP-Server** (und die Wissensbasis) bleiben unverändert. Die Brücke **nutzt** den MCP-Server lokal (HTTP) oder spricht die Symcon-API direkt an – je nachdem, wie du es implementierst.

---

## 6. Nächster Schritt: Brücke im Projekt

Damit das Modul (Symcon-MCP-Server-Projekt) die Verbindung zum Server aufbaut, brauchst du einen **Outbound-Connector**:

- **Option A:** Eigenes kleines Skript/Service (z. B. Node.js), das neben dem MCP-Server läuft: Konfiguration (Server-URL, Token), WebSocket-Client, bei Nachricht vom Server → HTTP-POST an `http://127.0.0.1:4096` (MCP) mit dem entsprechenden Tool-Aufruf → Antwort parsen und an Server zurücksenden.
- **Option B:** Den MCP-Server erweitern: Beim Start zusätzlich eine WebSocket-Verbindung zum konfigurierten Server aufbauen; eingehende Nachrichten als MCP-Tool-Aufrufe interpretieren, lokal ausführen, Ergebnis zurückschicken.

In beiden Fällen bleibt die **Schnittstelle zum Server** gleich: Nachricht enthält Tool-Name + Parameter; Antwort enthält das gleiche Format wie der MCP-Server (JSON). So kann dein Server im Internet „blind“ Tool-Aufrufe an die Brücke schicken und die Antwort an ChatGPT weiterreichen, ohne selbst Symcon zu kennen.

---

## 7. Nachrichtenformat Brücke ↔ Server (Vorschlag)

Damit Server und Brücke sich verstehen, reicht ein einfaches JSON-Protokoll über die WebSocket-Verbindung.

**Server → Brücke (Tool ausführen):**

```json
{
  "id": "req-123",
  "tool": "symcon_request_action",
  "args": { "variableId": 36800, "value": true }
}
```

- `id`: Eindeutige Anfrage-ID (Server erwartet die Antwort mit derselben ID).
- `tool`: Name des MCP-Tools (z. B. `symcon_resolve_device`, `symcon_request_action`, `symcon_knowledge_get`, …).
- `args`: Objekt mit den Parametern wie im MCP-Tool (z. B. `userPhrase`, `variableId`, `value`).

**Brücke → Server (Antwort):**

```json
{
  "id": "req-123",
  "ok": true,
  "result": { "content": [ { "type": "text", "text": "OK" } ] }
}
```

bzw. bei Fehler:

```json
{
  "id": "req-123",
  "ok": false,
  "error": "Symcon RPC error: …"
}
```

- `id`: Gleiche ID wie in der Anfrage.
- `ok`: `true` wenn der MCP-Aufruf erfolgreich war.
- `result`: Die rohe MCP-Antwort (z. B. `content` mit `type` und `text`), damit der Server sie 1:1 an ChatGPT als Tool-Result übergeben kann.
- `error`: Fehlermeldung, wenn `ok === false`.

**Brücke-Implementierung (lokal):** Bei Empfang einer Nachricht: HTTP POST an den lokalen MCP-Server (z. B. `http://127.0.0.1:4096`) im MCP-Streamable-HTTP-Format (Tool `tool` mit `args` aufrufen), Antwort parsen und als `result` (oder `error`) mit gleicher `id` an den Server zurücksenden.

**Server-Implementierung:** Bei jedem ChatGPT-Tool-Call: Nachricht mit `id`, `tool` (= Name des Tools), `args` (= Parameter aus dem Tool-Call) an die WebSocket-Verbindung der Brücke senden; auf Antwort mit gleicher `id` warten; `result` oder `error` an ChatGPT als Tool-Result zurückgeben.

---

Wenn du möchtest, können wir als Nächstes einen **Minimal-Prototyp** der Brücke (z. B. Node.js, WebSocket-Client + HTTP-POST an MCP) konkret ausarbeiten.
