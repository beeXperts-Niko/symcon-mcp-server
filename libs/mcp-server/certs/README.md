# TLS-Zertifikate für HTTPS (optional)

Für **HTTPS** (z. B. Claude „Benutzerdefinierten Connector“ mit `https://127.0.0.1:4096`) ein self-signed Zertifikat erzeugen:

```bash
cd symcon-mcp-server/libs/mcp-server/certs
openssl req -x509 -newkey rsa:2048 -keyout server.key -out server.crt -days 365 -nodes -subj "/CN=localhost"
```

Danach startet `./start-mcp-local.sh` automatisch mit HTTPS, wenn `server.crt` und `server.key` hier liegen.

Siehe auch: [docs/CLAUDE_EINBINDEN.md](../../docs/CLAUDE_EINBINDEN.md) Abschnitt 6.
