#!/usr/bin/env bash
# Symcon-Log per SSH von der SymBox abrufen (z. B. zum Debuggen, wenn das Modul nicht läuft).
#
# Nutzung:
#   ./fetch-symcon-log.sh [USER@]HOST [ZEILEN]
#
# Beispiele:
#   ./fetch-symcon-log.sh root@<SymBox-IP>
#   ./fetch-symcon-log.sh root@symbox.fritz.box 200
#   ./fetch-symcon-log.sh root@<SymBox-IP> 500 | grep -i mcp

set -e
HOST="${1:?Usage: $0 root@<SymBox-IP> [lines]  – Ihre SymBox-IP z. B. in local-config.env, nicht im Repo.}"
LINES="${2:-100}"

# Symcon-Datenverzeichnis: SymBox/SymOS variiert (var/lib, mnt/data, opt, …)
# Suche: 1) logs/ mit log_*.txt oder log.txt, 2) find nach log-Dateien unter symcon
ssh "$HOST" "
  for base in /var/lib/symcon /mnt/data/symcon /opt/symcon /usr/share/symcon; do
    for logdir in \"\$base/logs\" \"\$base\"; do
      if [ -d \"\$logdir\" ]; then
        LOG=\$(ls -t \"\$logdir\"/log_*.txt \"\$logdir\"/log_* \"\$logdir\"/log.txt \"\$logdir\"/log 2>/dev/null | head -1)
        if [ -n \"\$LOG\" ] && [ -f \"\$LOG\" ]; then
          echo \"=== \$LOG (letzte $LINES Zeilen) ===\" >&2
          tail -n $LINES \"\$LOG\"
          exit 0
        fi
      fi
    done
  done
  # Fallback: find unter /mnt/data und /var/lib nach symcon/logs
  for base in /var/lib /mnt/data /opt; do
    [ ! -d \"\$base\" ] && continue
    LOG=\$(find \"\$base\" -path '*/symcon/logs/log_*' -type f 2>/dev/null | head -1)
    [ -z \"\$LOG\" ] && LOG=\$(find \"\$base\" -path '*/symcon/logs/*.txt' -type f 2>/dev/null | head -1)
    if [ -n \"\$LOG\" ] && [ -f \"\$LOG\" ]; then
      echo \"=== \$LOG (letzte $LINES Zeilen) ===\" >&2
      tail -n $LINES \"\$LOG\"
      exit 0
    fi
  done
  echo 'Kein Symcon-Log gefunden. Struktur prüfen:' >&2
  for d in /var/lib/symcon /mnt/data/symcon; do
    [ -d \"\$d\" ] && echo \"  \$d:\" >&2 && ls -la \"\$d\" 2>/dev/null | head -5 >&2
  done
  exit 1
"
