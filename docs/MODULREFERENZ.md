# Symcon-Modulreferenz (Geräte) im MCP

Der MCP-Server kann die **offizielle Modulreferenz** von Symcon (Geräte/Module) einbinden, damit die KI weiß, wie z. B. HomeMatic, Z-Wave, EnOcean oder Philips Hue bedient werden.

## Quelle

- **URL:** [https://www.symcon.de/de/service/dokumentation/modulreferenz/geraete/](https://www.symcon.de/de/service/dokumentation/modulreferenz/geraete/)
- Die Referenz wird **rekursiv** aus der Hauptseite und allen Kategorieseiten gelesen (Geräte + Funktionen/Links).

## Referenz aktualisieren

```bash
# Im Repo-Root (symcon-mcp-server)
node scripts/fetch-modulreferenz.mjs
```

Das Skript:

1. Lädt die Geräte-Übersichtsseite von symcon.de.
2. Lädt jede Kategorieseite (z. B. 1-wire, homematic, z-wave) und sammelt alle Geräte- und Funktions-Links.
3. Schreibt `libs/mcp-server/data/modulreferenz-geraete.json`.

Nach dem Abruf enthält die Datei u. a.:

- **Kategorien:** 1-Wire, HomeMatic, Z-Wave, KNX, EnOcean, digitalSTROM, DMX, etc.
- **Funktionen/Links:** z. B. HM_WriteValueBoolean, ZW_SwitchMode, ENO_SwitchMode, DS_SwitchMode mit URL zur Doku.

## MCP-Tool

- **`symcon_get_module_reference`**  
  Liefert die eingebundene Referenz (JSON). Optional:
  - `category`: nur eine Kategorie (z. B. `homematic`, `z-wave`)
  - `search`: Suchbegriff in Namen (z. B. `SwitchMode`, `WriteValue`)

Die KI kann damit nachschlagen, welche Befehle/Module es für ein Gerät gibt und wie sie heißen (z. B. für Licht ein/aus: RequestAction auf die Zustand-Variable; bei HomeMatic zusätzlich HM_WriteValueBoolean in der Doku).

## Hinweis

Die Referenz enthält **Links und Namen** der Module/Funktionen, nicht die vollständige Parameter-Dokumentation. Detaillierte Parameter stehen auf den verlinkten Einzelseiten auf symcon.de.
