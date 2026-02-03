#!/usr/bin/env bash
# Symcon-Log per SSH von der SymBox abrufen (z. B. zum Debuggen, wenn das Modul nicht läuft).
#
# Nutzung:
#   ./fetch-symcon-log.sh [USER@]HOST [ZEILEN]
#
# Beispiele:
#   ./fetch-symcon-log.sh root@192.168.10.12
#   ./fetch-symcon-log.sh root@symbox.fritz.box 200
#   ./fetch-symcon-log.sh root@192.168.10.12 500 | grep -i mcp

set -e
HOST="${1:-root@192.168.10.12}"
LINES="${2:-100}"

# Symcon-Datenverzeichnis: SymBox oft /var/lib/symcon oder /mnt/data/symcon
# $dir und $LOG auf der Remote-Shell auswerten, $LINES lokal einsetzen
ssh "$HOST" "for dir in /var/lib/symcon /mnt/data/symcon; do
  if [ -d \"\$dir/logs\" ]; then
    LOG=\$(ls -t \"\$dir/logs\"/log_*.txt \"\$dir/logs\"/log.txt 2>/dev/null | head -1)
    if [ -n \"\$LOG\" ]; then
      echo \"=== \$LOG (letzte $LINES Zeilen) ===\" >&2
      tail -n $LINES \"\$LOG\"
      exit 0
    fi
  fi
done
echo 'Kein Symcon-Log unter /var/lib/symcon/logs oder /mnt/data/symcon/logs gefunden.' >&2
exit 1"
