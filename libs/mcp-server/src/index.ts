/**
 * Symcon MCP Server – Streamable HTTP entry point.
 * Reads MCP_PORT, SYMCON_API_URL, MCP_AUTH_TOKEN from environment (set by Symcon module).
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SymconClient } from './symcon/SymconClient.js';
import { createToolHandlers } from './tools/index.js';

const PORT = parseInt(process.env.MCP_PORT ?? '4096', 10);
const SYMCON_API_URL = process.env.SYMCON_API_URL ?? 'http://127.0.0.1:3777/api/';
/** Optional: if set, requests must send Authorization: Bearer <token> or X-MCP-API-Key: <token> */
const MCP_AUTH_TOKEN = process.env.MCP_AUTH_TOKEN ?? '';
/** Bind on all interfaces (0.0.0.0) so the server is reachable at http://<SymBox-IP>:PORT from your Mac/PC. */
const HOST = process.env.MCP_BIND ?? '0.0.0.0';

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  if (bufA.length === 0) return true;
  return timingSafeEqual(bufA, bufB);
}

function isAuthorized(req: IncomingMessage): boolean {
  if (!MCP_AUTH_TOKEN) return true;
  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers['x-mcp-api-key'];
  const bearer = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : '';
  const key = typeof apiKeyHeader === 'string' ? apiKeyHeader.trim() : '';
  return constantTimeEqual(bearer, MCP_AUTH_TOKEN) || constantTimeEqual(key, MCP_AUTH_TOKEN);
}

function readBody(req: import('node:http').IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw.trim()) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve(undefined);
      }
    });
    req.on('error', reject);
  });
}

async function main(): Promise<void> {
  const client = new SymconClient(SYMCON_API_URL);
  const mcp = new McpServer(
    {
      name: 'symcon-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {},
    }
  );

  const handlers = createToolHandlers(client);
  for (const [name, { description, inputSchema, handler }] of Object.entries(handlers)) {
    mcp.registerTool(
      name,
      {
        description,
        inputSchema,
      },
      handler as (args: unknown) => Promise<{ content: Array<{ type: 'text'; text: string }> }>
    );
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await mcp.connect(transport);

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // Auth nur für POST (JSON-RPC). GET (SSE-Stream) oft ohne Header – sonst hängen manche MCP-Clients bei "Loading Tools".
    if (req.method === 'POST' && !isAuthorized(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized', message: 'Missing or invalid API key' }));
      return;
    }
    const origin = req.headers.origin;
    const allowedOrigins = [`http://127.0.0.1:${PORT}`, `http://localhost:${PORT}`];
    if (origin && !allowedOrigins.includes(origin) && HOST === '127.0.0.1') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Origin not allowed' }));
      return;
    }
    const body = req.method === 'POST' ? await readBody(req) : undefined;
    await transport.handleRequest(req, res, body);
  });

  server.listen(PORT, HOST, () => {
    process.stderr.write(`Symcon MCP Server listening on port ${PORT} (${HOST === '0.0.0.0' ? 'all interfaces, use http://<SymBox-IP>:' + PORT : HOST + ':' + PORT})\n`);
    process.stderr.write(`Symcon API: ${SYMCON_API_URL}\n`);
    if (MCP_AUTH_TOKEN) process.stderr.write('Auth: API key required (Authorization: Bearer or X-MCP-API-Key)\n');
  });
}

main().catch((err) => {
  process.stderr.write(String(err) + '\n');
  process.exit(1);
});
