#!/usr/bin/env node
/**
 * Symcon MCPB Launcher: startet den stdio→streamable-http Adapter per npx.
 * Erwartet Umgebungsvariablen: URI (Pflicht), MCP_NAME, BEARER_TOKEN (optional).
 * Der Adapter verbindet sich mit dem Symcon MCP-Server unter URI.
 * Wichtig: Der Symcon MCP-Server muss unter dieser URL bereits laufen (z. B. ./start-mcp-local.sh).
 */

const { spawn } = require('child_process');

const adapter = '@pyroprompts/mcp-stdio-to-streamable-http-adapter';
const uri = (process.env.URI || 'http://127.0.0.1:4096').trim();
const mcpName = process.env.MCP_NAME || 'symcon';
const bearerToken = (process.env.BEARER_TOKEN || '').trim();

const env = { ...process.env, URI: uri, MCP_NAME: mcpName };
if (bearerToken) {
  env.BEARER_TOKEN = bearerToken;
} else {
  delete env.BEARER_TOKEN;
}

// Hinweis für Log: Welche URL genutzt wird (hilft bei "Server disconnected")
console.error('[Symcon MCPB] Connecting to Symcon MCP server at ' + uri + ' …');

const child = spawn('npx', ['-y', adapter], { stdio: 'inherit', env, shell: true });
child.on('close', (code, signal) => {
  if (code !== 0 && code != null) {
    console.error(
      '[Symcon MCPB] Adapter exited with code ' + code + '. ' +
      'Ensure the Symcon MCP server is running at ' + uri + ' (e.g. ./start-mcp-local.sh).'
    );
  }
  process.exit(code == null ? (signal ? 1 : 0) : code);
});
child.on('error', (err) => {
  console.error('[Symcon MCPB] Launcher error:', err.message);
  process.exit(1);
});
