# Steuerungshinweise für KI und MCP-Clients

Diese Hinweise fließen in die Tool-Beschreibungen des MCP-Servers und in die Cursor-Regeln ein, damit die KI Geräte (Hue, Homematic, etc.) korrekt steuert.

## Philips Hue und ähnliche Aktoren

### Licht ein/aus

- **Immer `symcon_request_action(variableId, true/false)`** verwenden, nicht `symcon_set_value`.
- Nur RequestAction löst die physische Schaltung aus; SetValue aktualisiert in Symcon oft nur den Variablenwert, ohne den Befehl an die Hue-Bridge zu senden.

### Helligkeit / Dimmer

- Die Helligkeits-Variable heißt in Symcon oft **„Helligkeit“**, VariableProfile typisch **`Intensity.Hue`**.
- **Skala 0–254** (nicht 0–100). Umrechnung: z. B. 5 % Helligkeit = 254 × 0,05 ≈ **13**.
- **Immer `symcon_request_action(helligkeitVariableId, wert)`** verwenden – SetValue schickt den Befehl bei Hue oft nicht an die Hardware.
- Vor der Steuerung kann **`symcon_get_variable(variableId)`** aufgerufen werden: Bei `VariableProfile: "Intensity.Hue"` RequestAction mit Wert 0–254 nutzen.

### Kurzreferenz Hue

| Aktion           | Tool / Wert                                      |
|------------------|--------------------------------------------------|
| Licht an/aus     | `symcon_request_action(zustandVariableId, true/false)` |
| Helligkeit setzen| `symcon_request_action(helligkeitVariableId, 0–254)` (5 % ≈ 13) |

## Allgemein

- **RequestAction** für alle Aktionen, die die Hardware wirklich ansprechen sollen (Hue, Homematic, etc.).
- **SetValue** nur, wenn explizit nur der Variablenwert in Symcon gesetzt werden soll (ohne Hardware-Befehl).
- Bei unbekannten Variablen: **`symcon_get_variable(variableId)`** liefert Typ und Profil und hilft bei der Wahl von Tool und Wert.
