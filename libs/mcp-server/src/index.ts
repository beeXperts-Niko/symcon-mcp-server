/**
 * Symcon MCP Server – Streamable HTTP entry point.
 * Reads MCP_PORT and SYMCON_API_URL from environment (set by Symcon module).
 */

import { createServer } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SymconClient } from './symcon/SymconClient.js';
import { createToolHandlers } from './tools/index.js';

const PORT = parseInt(process.env.MCP_PORT ?? '4096', 10);
const SYMCON_API_URL = process.env.SYMCON_API_URL ?? 'http://127.0.0.1:3777/api/';
/** Bind on all interfaces (0.0.0.0) so the server is reachable at http://<SymBox-IP>:PORT from your Mac/PC. */
const HOST = process.env.MCP_BIND ?? '0.0.0.0';

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

  const server = createServer(async (req, res) => {
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
  });
}

main().catch((err) => {
  process.stderr.write(String(err) + '\n');
  process.exit(1);
});
