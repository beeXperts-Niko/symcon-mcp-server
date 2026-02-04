/**
 * MCP tool handlers for Symcon API.
 * Each tool maps to Symcon Befehlsreferenz methods.
 * Wissensbasis-Tools nutzen KnowledgeStore für gelernte Geräte-Zuordnungen.
 */
import type { SymconClient } from '../symcon/SymconClient.js';
import type { ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
export declare function createToolHandlers(client: SymconClient): Record<string, {
    description: string;
    inputSchema: z.ZodType;
    handler: ToolCallback;
}>;
