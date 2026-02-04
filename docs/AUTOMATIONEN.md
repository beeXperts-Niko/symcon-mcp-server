# MCP-Automationen (Skripte und zeitgesteuerte Events)

Der MCP-Server kann nicht nur Geräte steuern, sondern auch **Skripte** und **zeitgesteuerte Events** in Symcon anlegen und verwalten. So lassen sich z. B. umsetzen:

- **Einmalige Timer:** „Rolllade in 10 Minuten auf“ → Event „once“ + Skript (RequestAction).
- **Wiederkehrende Zeitpläne:** „Ambiente morgens und abends orange, tagsüber blau“ → Skript(e) + zyklische Events.

Damit die KI keine wilden Duplikate anlegt, gilt: **Vor dem Anlegen prüfen** (symcon_automation_list) und **vorhandene Automationen aktualisieren** statt neu anlegen. Die **Automation-Registry** (data/symcon-automations.json) speichert Zuordnungen (label, scriptId, eventIds, categoryPath).

## Ordnerstruktur (Konvention)

Alle von der KI angelegten Skripte und Events liegen unter einer festen Root-Kategorie im Symcon-Objektbaum:

- **Root:** „MCP Automations“
- **Ebene 1 – Thema:** Timer, Beleuchtung, Rollladen, Ambiente, Sonstige
- **Ebene 2 (optional) – Raum:** z. B. Büro, Wohnzimmer, wenn aus Kontext oder Wissensbasis ableitbar

Beispiele:

- `MCP Automations` → `Timer` (einmalige Aktionen wie „in 10 Min Rolllade auf“)
- `MCP Automations` → `Beleuchtung` → `Büro`
- `MCP Automations` → `Ambiente` (ohne Raum)

Die KI soll beim Anlegen immer **symcon_automation_get_or_create_folder** mit einem sinnvollen `categoryPath` aufrufen (z. B. aus Nutzeräußerung: „Rolllade in 10 Min“ → Timer; „Ambiente Büro“ → Ambiente, optional Büro).

## MCP-Tools für Automationen

| Tool | Zweck |
|------|--------|
| **symcon_automation_get_or_create_folder(categoryPath)** | Erstellt oder liefert die Kategorie-Pfadkette (rootCategoryId, categoryId, path). |
| **symcon_schedule_once(variableId, value, delayMinutes?, delaySeconds?, label?, categoryPath?)** | Einmalige zeitverzögerte Aktion (RequestAction). Nutzt Symcon-Timer-API (IPS_SetEventCyclicDateBounds). **Fallback**, wenn API nicht verfügbar: **MCP Delayed Action Control** – ein festes Control-Skript unter *MCP Automations/Timer*, dem VariableID, Value und DelaySeconds per IPS_RunScriptEx übergeben werden; es erzeugt ein einmaliges Skript (sleep → RequestAction → IPS_DeleteScript(self)) und startet es asynchron. Beliebige Werte (z. B. Rolllade 0/100) werden durchgereicht. |
| **symcon_script_create(name, content, categoryPath? \| parentCategoryId)** | PHP-Skript anlegen, Inhalt setzen, unter Kategorie einordnen. |
| **symcon_script_set_content(scriptId, content)** | Skript-Inhalt aktualisieren. |
| **symcon_script_delete(scriptId)** | Skript löschen (Events vorher löschen oder trennen). |
| **symcon_event_create_cyclic(scriptId, categoryPath?, … dateType, timeType, timeFrom, timeTo, …)** | Zyklisches Event anlegen, mit Skript verknüpfen (IPS_RunScript), unter categoryPath einordnen. |
| **symcon_event_delete(eventId)** / **symcon_event_get(eventId)** | Event löschen bzw. Infos abrufen. |
| **symcon_automation_list(theme?, room?, categoryPath?)** | Registry durchsuchen – vor dem Anlegen prüfen, ob bereits Eintrag existiert (z. B. „Ambiente-Licht Zeiten“). |
| **symcon_automation_register(label, categoryPath, scriptId, eventIds?, room?, theme?)** | Eintrag in Registry anlegen/aktualisieren. |
| **symcon_automation_unregister(automationId)** | Eintrag aus Registry entfernen (Skripte/Events werden nicht gelöscht). |

## Timer-Fallback: MCP Delayed Action Control (wenn Timer-API fehlt)

Wenn **IPS_SetEventCyclicDateBounds** oder **IPS_SetEventCyclicTimeBounds** nicht verfügbar sind, nutzt symcon_schedule_once ein **Control-Skript** in Symcon:

1. **MCP Delayed Action Control** – wird beim ersten Fallback-Aufruf unter *MCP Automations / Timer* angelegt (falls noch nicht vorhanden). Name: „MCP Delayed Action Control“.
2. Der MCP-Server ruft es per **IPS_RunScriptEx** mit den Parametern **VariableID**, **Value**, **DelaySeconds** auf (asynchron).
3. Das Control-Skript erzeugt ein **einmaliges** PHP-Skript mit: `sleep(DelaySeconds); RequestAction(VariableID, Value); IPS_DeleteScript($_IPS['SELF'], true);` und startet es mit **IPS_RunScript** (asynchron). Das einmalige Skript löscht sich nach der Aktion selbst (IPS_DeleteScript erfordert zwei Parameter: ScriptID, DeleteFile). Wenn **IPS_RunScriptEx** fehlschlägt, übergibt der MCP die Parameter per Variable „MCP Timer Params“ (JSON) und startet das Control-Skript mit **IPS_RunScript**.

Es gibt **nur dieses eine** Control-Skript; der MCP legt keine weiteren Runner- oder Einmalig-Skripte an. Temporäre Timer-Skripte werden von diesem Skript erzeugt und löschen sich nach der Aktion selbst. **Value** kann boolean (Licht ein/aus), Zahl (z. B. Rolllade 0/100) oder String sein – der MCP übergibt den Wert unverändert (bei String „zu“/„aus“/„off“ wird für den Fallback false, sonst true verwendet).

## Keine Duplikate – Registry nutzen

1. **Vor dem Anlegen:** symcon_automation_list mit theme oder label prüfen (z. B. theme „Ambiente“ oder label „Ambiente-Licht Zeiten“). Wenn Eintrag vorhanden: **Skript/Events aktualisieren** (symcon_script_set_content, symcon_event_delete + neu anlegen mit neuen Zeiten) oder User fragen, ob ersetzen.
2. **Beim Löschen/Ändern:** Registry-Eintrag nutzen → scriptId/eventIds → symcon_script_delete / symcon_event_delete aufrufen, danach symcon_automation_unregister(automationId).

## Ablaufbeispiele

**„Rolllade in 10 Minuten auf“**

1. symcon_resolve_device("Rolllade …") → variableId
2. symcon_automation_get_or_create_folder(["MCP Automations", "Timer"])
3. symcon_schedule_once(variableId, "auf", delayMinutes: 10, label: "Rolllade 10min", categoryPath: ["MCP Automations", "Timer"])
4. User bestätigen

**„Ambiente morgens und abends orange, tagsüber blau“**

1. symcon_automation_list(theme: "Ambiente") bzw. nach label „Ambiente-Licht“ suchen → falls Eintrag: Skript/Events aktualisieren statt neu anlegen
2. Sonst: symcon_automation_get_or_create_folder(["MCP Automations", "Ambiente"]) (ggf. + Raum)
3. Skript erstellen mit Logik (Uhrzeit → Farbe/Wert), zyklische Events für die Zeitpunkte (z. B. 06:00, 08:00, 18:00, 22:00) anlegen
4. symcon_automation_register(label: "Ambiente-Licht Zeiten", categoryPath, scriptId, eventIds, theme: "Ambiente")
5. Bei „stell das Ambiente anders ein“: Registry-Eintrag nutzen → Skript-Inhalt oder Event-Zeiten anpassen
