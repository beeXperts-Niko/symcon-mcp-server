# Sprachassistent mit Symcon bauen

Du möchtest **sprechen**, der Assistent **antwortet mit Sprache** und **steuert dein Haus** (Symcon). So kannst du das umsetzen.

---

## Was du brauchst (Kernidee)

```
[Du sprichst] → Spracherkennung (STT) → Text
     → KI (z. B. ChatGPT) mit Symcon-Tools → Antwort-Text
     → Sprachausgabe (TTS) → [Assistent spricht]
```

Zusätzlich: **Trigger** – z. B. „Hey Assistent“, Push-to-Talk oder Dauer-Zuhören.

Die **Symcon-Steuerung** steckt in der KI: Sie bekommt deine Anfrage als Text und kann **Tools** aufrufen (Licht an/aus, Geräte auflösen, Wissensbasis nutzen). Dein Symcon MCP-Server liefert genau diese Tools – sie müssen nur in das Format der gewählten KI (z. B. OpenAI Function Calling) gebracht werden.

---

## Option 1: OpenAI Realtime API + Voice Agents (empfohlen für „alles aus einer Hand“)

Die **OpenAI Realtime API** macht Sprach-in/Sprach-out in einer Verbindung: niedrige Latenz, Unterbrechungen möglich, **Function Calling** wird unterstützt. Du baust einen **Voice Agent** mit Tools – die Tools können dein Symcon abbilden.

**Ablauf:**

1. **OpenAI Voice Agents SDK** nutzen (TypeScript/JavaScript):
   - [Voice Agents Quickstart](https://platform.openai.com/docs/guides/voice-agents)
   - [openai-agents-js – Voice Agents](https://openai.github.io/openai-agents-js/guides/voice-agents/quickstart/)
2. **Symcon als Tools** anbinden:
   - Entweder: Dein Backend stellt die gleichen Aktionen wie der MCP-Server bereit (z. B. HTTP-API, die `symcon_resolve_device`, `symcon_request_action` etc. aufruft) und du definierst sie als **OpenAI Functions**.
   - Oder: Ein kleines **Adapter-Service** übersetzt MCP-Tool-Aufrufe in Aufrufe gegen deinen Symcon MCP-Server (Streamable HTTP auf Port 4096) und liefert die Antwort im OpenAI-Function-Format zurück.
3. **Frontend**: Web (WebRTC) oder App, die mit dem Realtime-Endpunkt verbunden ist; Mikrofon + Lautsprecher.

**Vorteile:** Eine Verbindung, wenig Verzögerung, Unterbrechung möglich, offiziell mit Tools/Functions.

**Was du mitbringen musst:** OpenAI API-Key, laufenden Symcon MCP-Server (oder eigene kleine API, die Symcon anspricht).

---

## Option 2: Eigenes kleines Projekt (Whisper → ChatGPT → TTS)

Klassische Kette: **Sprache → Text → KI → Text → Sprache**.

1. **Spracherkennung (STT):**  
   - [OpenAI Whisper API](https://platform.openai.com/docs/guides/speech-to-text) (Audio-Datei hochladen)  
   - oder lokales Whisper, oder Web Speech API im Browser
2. **KI mit Haus-Steuerung:**  
   - [Chat Completions API](https://platform.openai.com/docs/api-reference/chat) mit **tools** (Function Calling).  
   - Die „Functions“ sind deine Symcon-Aktionen: z. B. `resolve_device`, `request_action`, `knowledge_set`, `get_object_tree` usw.  
   - Dein Backend ruft bei jedem Tool-Aufruf entweder den **Symcon MCP-Server** (HTTP) auf oder spricht direkt die **Symcon JSON-RPC API** (z. B. SymBox) an – je nachdem, ob du den MCP-Server wiederverwenden willst oder eine schlanke eigene Schicht bauen willst.
3. **Sprachausgabe (TTS):**  
   - [OpenAI Text-to-Speech API](https://platform.openai.com/docs/guides/text-to-speech)  
   - oder z. B. ElevenLabs, oder Browser TTS
4. **Trigger:**  
   - Push-to-Talk (Button), oder Wake Word (z. B. „Hey Assistent“), oder Dauer-Zuhören

**Beispiel-Architektur:**

- **Frontend (Web/App):** Mikrofon aufnehmen → Audio an Backend senden → Antwort-Audio abspielen.
- **Backend (z. B. Node/ Python):**
  - Endpoint 1: Audio empfangen → Whisper → Text.
  - Endpoint 2 (oder gleicher Flow): Text an ChatGPT mit `tools` (Symcon-Funktionen) → bei `tool_calls` Backend führt Aufruf gegen MCP-Server oder Symcon-API aus → Ergebnis zurück an ChatGPT → Antwort-Text.
  - Antwort-Text → TTS → Audio zurück an Frontend.

**Symcon anbinden:**  
Entweder dein Backend spricht den **Symcon MCP-Server** (Streamable HTTP, z. B. `http://127.0.0.1:4096`) und übersetzt MCP-Tool-Aufrufe in HTTP-Requests, oder du implementierst die gleiche Logik (resolve_device, request_action, …) direkt gegen die Symcon JSON-RPC API und definierst diese als OpenAI-`tools`.

---

## Option 3: Externe Voice-Plattform (Vapi, Bland AI, Retell …)

Dienste wie **Vapi**, **Bland AI**, **Retell** bieten fertige Sprach-Pipelines (STT, LLM, TTS) und **Webhooks / Function Calling** für eigene Logik.

**Ablauf:**

1. Bei der Plattform einen **Voice Agent** anlegen (Sprache, Modell, Verhalten).
2. **Tools/Functions** definieren, z. B. „Licht an/aus“, „Gerät auflösen“ – der Webhook deines Backends wird aufgerufen.
3. **Dein Backend** empfängt den Aufruf (z. B. „Licht Büro an“) und spricht den **Symcon MCP-Server** (HTTP) oder die **Symcon-API** an und antwortet mit dem Ergebnis.
4. Die Plattform spricht die Antwort per TTS.

**Vorteil:** Wenig eigene Infrastruktur für STT/TTS/Sprachsteuerung; du konzentrierst dich auf die Symcon-Anbindung im Backend.

---

## Symcon-Anbindung im Detail

Dein **Symcon MCP-Server** (z. B. `start-mcp-local.sh`, Port 4096) stellt bereits alle nötigen Tools bereit:

- `symcon_resolve_device` – „Büro Licht“ → variableId  
- `symcon_request_action` – Licht an/aus, Helligkeit  
- `symcon_knowledge_set` / `symcon_knowledge_get` – Geräte lernen  
- `symcon_get_object_tree`, `symcon_snapshot_variables`, `symcon_diff_variables` – für Discovery/Vorher-Nachher  
- usw.

**Für ChatGPT/OpenAI:**

- Die MCP-Tools haben Namen und Parameter (JSON-Schema). Du musst sie als **OpenAI `tools`** (Function Calling) abbilden: gleiche Namen, gleiche Parameter, `description` aus der MCP-Beschreibung.
- Bei jedem Aufruf von der KI: Request an deinen MCP-Server (Streamable HTTP) senden, Antwort parsen und als `tool`-Ergebnis an die Chat-API zurückgeben.

**Für Claude:**

- Claude kann den Symcon MCP-Server direkt nutzen (z. B. über .mcpb oder Config – siehe [CLAUDE_EINBINDEN.md](CLAUDE_EINBINDEN.md)). Für **Sprache** bräuchtest du zusätzlich ein Frontend mit STT/TTS, das mit Claude (z. B. API) spricht und die Antworten vorliest.

---

## Kurz: Welchen Weg wählen?

| Ziel | Empfehlung |
|------|------------|
| Schnell, wenig Eigenbau, moderne Voice-API | **Option 1:** OpenAI Realtime API + Voice Agents, Symcon als Functions anbinden |
| Volle Kontrolle, bewährte Kette STT → LLM → TTS | **Option 2:** Whisper + ChatGPT (mit tools) + TTS, Backend ruft MCP oder Symcon-API |
| Keine eigene STT/TTS-Infrastruktur | **Option 3:** Vapi/Bland/Retell + Webhook-Backend zu Symcon |

In allen Fällen bleibt die **Logik** gleich: Die KI bekommt deine Absicht als Text und ruft Symcon-Funktionen auf – so wie es in Cursor/Claude mit dem MCP-Server schon funktioniert, nur mit Sprache vorne und hinten dran.

**Server im Internet, Smart Home im eigenen Netz:** Wenn dein Sprachassistent auf einem **Server im Internet** laufen soll und das Smart Home **nicht von außen erreichbar** ist (Heimnetz), muss das **Smart Home die Verbindung zum Server aufbauen** (Outbound). Dafür brauchst du eine **Brücke im Heimnetz**, die sich mit dem Server verbindet und Befehle lokal (MCP/Symcon) ausführt. Detaillierte Architektur und Ablauf: [ARCHITEKTUR_SERVER_IM_INTERNET.md](ARCHITEKTUR_SERVER_IM_INTERNET.md).

---

Wenn du magst, können wir als Nächstes **ein konkretes Minimal-Beispiel** (z. B. Option 2 mit Node + Whisper + ChatGPT + TTS und einem einzigen Symcon-Tool) Schritt für Schritt durchgehen oder die Tool-Definitionen für OpenAI Function Calling aus dem MCP-Server ableiten.
