# Symcon-Modulreferenz (Geräte) im MCP

Der MCP-Server kann die **offizielle Modulreferenz** von Symcon (Geräte/Module) einbinden, damit die KI weiß, wie z. B. HomeMatic, Z-Wave, EnOcean oder Philips Hue bedient werden.

## Quelle

- **URL:** [https://www.symcon.de/de/service/dokumentation/modulreferenz/geraete/](https://www.symcon.de/de/service/dokumentation/modulreferenz/geraete/)
- Die Referenz wird **rekursiv** aus der Hauptseite und allen Kategorieseiten gelesen (Geräte + Funktionen/Links).

## Referenz aktualisieren

```bash
# Im Repo-Root (symcon-mcp-server)
node scripts/fetch-modulreferenz.mjs              # nur Namen + URL
node scripts/fetch-modulreferenz.mjs --deep       # Kategorieseiten für volle Link-Liste
node scripts/fetch-modulreferenz.mjs --with-details   # pro Modul-URL Detailseite laden, Summary extrahieren
node scripts/fetch-modulreferenz.mjs --with-details --max-details=50   # max. 50 Detail-Abrufe (z. B. zum Testen)
```

Das Skript:

1. Lädt die Geräte-Übersichtsseite von symcon.de.
2. Mit **`--deep`**: Lädt jede Kategorieseite (z. B. 1-wire, homematic, z-wave) und sammelt alle Geräte- und Funktions-Links.
3. Mit **`--with-details`**: Lädt zusätzlich jede Modul-Detailseite (mit Verzögerung zwischen Abrufen), extrahiert **Titel** und **Kurztext (Summary)** aus dem Seiteninhalt und speichert sie pro Eintrag. So enthält die Referenz nicht nur Name + URL, sondern auch Inhalt für die KI. Optional **`--max-details=N`** begrenzt die Anzahl der Detail-Abrufe.
4. Schreibt `libs/mcp-server/data/modulreferenz-geraete.json`.

Nach dem Abruf enthält die Datei u. a.:

- **Kategorien:** 1-Wire, HomeMatic, Z-Wave, KNX, EnOcean, digitalSTROM, DMX, etc.
- **Funktionen/Module pro Kategorie:** `name`, `description` (falls auf der Übersichtsseite), `url`. Mit **`--with-details`** zusätzlich: **`pageTitle`** (Seitentitel), **`summary`** (Kurztext aus der Modul-Dokumentation, z. B. Installation, Steuerung, Tipps).

## MCP-Tool

- **`symcon_get_module_reference`**  
  Liefert die eingebundene Referenz (JSON). Optional:
  - `category`: nur eine Kategorie (z. B. `homematic`, `z-wave`)
  - `search`: Suchbegriff in Namen (z. B. `SwitchMode`, `WriteValue`)

Die KI kann damit nachschlagen, welche Befehle/Module es für ein Gerät gibt und wie sie heißen (z. B. für Licht ein/aus: RequestAction auf die Zustand-Variable; bei HomeMatic zusätzlich HM_WriteValueBoolean in der Doku).

## Hinweis

Ohne `--with-details` enthält die Referenz nur **Links und Namen** der Module/Funktionen. Mit **`--with-details`** wird pro Modul ein **Summary** (Kurztext aus der Doku-Seite) mitgeliefert – die KI hat damit mehr Kontext, ohne jede Einzelseite aufrufen zu müssen. Vollständige Parameter-Dokumentation steht weiterhin auf den verlinkten Einzelseiten auf symcon.de.
