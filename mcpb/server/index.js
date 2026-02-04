#!/usr/bin/env node
/**
 * Symcon MCPB Launcher: startet den stdio→streamable-http Adapter per npx.
 * Erwartet Umgebungsvariablen: URI (Pflicht), MCP_NAME, BEARER_TOKEN (optional).
 * Der Adapter verbindet sich mit dem Symcon MCP-Server unter URI.
 * Wichtig: Der Symcon MCP-Server muss unter dieser URL bereits laufen (z. B. ./start-mcp-local.sh).
 */

const { spawn } = require('child_process');
const http = require('http');
const https = require('https');

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

/** Prüft, ob unter URI ein Server antwortet (z. B. Symcon MCP). Bei ECONNREFUSED → false. HTTPS: self-signed erlaubt (rejectUnauthorized: false). */
function checkReachable(url, timeoutMs) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const port = u.port || (u.protocol === 'https:' ? 443 : 80);
      const opts = {
        hostname: u.hostname,
        port,
        path: u.pathname || '/',
        method: 'GET',
      };
      if (u.protocol === 'https:') {
        opts.rejectUnauthorized = false;
      }
      const lib = u.protocol === 'https:' ? https : http;
      const req = lib.request(opts, (res) => {
        res.on('data', () => {});
        res.on('end', () => resolve(true));
      });
      req.setTimeout(timeoutMs, () => {
        req.destroy();
        resolve(false);
      });
      req.on('error', () => resolve(false));
      req.end();
    } catch {
      resolve(false);
    }
  });
}

async function main() {
  console.error('[Symcon MCPB] Connecting to Symcon MCP server at ' + uri + ' …');

  const reachable = await checkReachable(uri, 3000);
  if (!reachable) {
    console.error(
      '[Symcon MCPB] Symcon MCP server is not reachable at ' + uri + '. ' +
      'Start it first (e.g. ./start-mcp-local.sh in symcon-mcp-server).'
    );
    process.exit(1);
  }

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
}

main();
