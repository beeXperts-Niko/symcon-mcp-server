/**
 * MCP tool handlers for Symcon API.
 * Each tool maps to Symcon Befehlsreferenz methods.
 */
import { z } from 'zod';
const variableIdSchema = z.object({ variableId: z.number().int().positive() });
const objectIdSchema = z.object({ objectId: z.number().int().positive() });
const scriptIdSchema = z.object({ scriptId: z.number().int().positive() });
const setValueSchema = z.object({
    variableId: z.number().int().positive(),
    value: z.union([z.string(), z.number(), z.boolean()]),
});
function getArgs(args) {
    return args;
}
export function createToolHandlers(client) {
    return {
        symcon_get_value: {
            description: 'Liest den Wert einer Symcon-Variable (GetValue).',
            inputSchema: variableIdSchema,
            handler: async (args) => {
                const { variableId } = getArgs(args);
                const value = await client.getValue(variableId);
                return { content: [{ type: 'text', text: JSON.stringify(value) }] };
            },
        },
        symcon_set_value: {
            description: 'Setzt den Wert einer Symcon-Variable (SetValue).',
            inputSchema: setValueSchema,
            handler: async (args) => {
                const { variableId, value } = getArgs(args);
                await client.setValue(variableId, value);
                return { content: [{ type: 'text', text: 'OK' }] };
            },
        },
        symcon_request_action: {
            description: 'Führt die Aktion einer Symcon-Variable aus (RequestAction).',
            inputSchema: z.object({ variableId: z.number().int().positive(), value: z.union([z.string(), z.number(), z.boolean()]).optional() }),
            handler: async (args) => {
                const { variableId, value } = getArgs(args);
                await client.requestAction(variableId, value ?? true);
                return { content: [{ type: 'text', text: 'OK' }] };
            },
        },
        symcon_get_object: {
            description: 'Liefert Objekt-Infos zu einer Symcon-Objekt-ID (IPS_GetObject).',
            inputSchema: objectIdSchema,
            handler: async (args) => {
                const { objectId } = getArgs(args);
                const obj = await client.getObject(objectId);
                return { content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] };
            },
        },
        symcon_get_children: {
            description: 'Liefert die Kinder-IDs eines Objekts (IPS_GetChildrenIDs).',
            inputSchema: objectIdSchema,
            handler: async (args) => {
                const { objectId } = getArgs(args);
                const ids = await client.getChildrenIds(objectId);
                return { content: [{ type: 'text', text: JSON.stringify(ids) }] };
            },
        },
        symcon_run_script: {
            description: 'Führt ein Symcon-Skript aus (IPS_RunScript).',
            inputSchema: scriptIdSchema,
            handler: async (args) => {
                const { scriptId } = getArgs(args);
                const result = await client.runScript(scriptId);
                return { content: [{ type: 'text', text: JSON.stringify(result) }] };
            },
        },
        symcon_get_object_id_by_name: {
            description: 'Ermittelt die Objekt-ID anhand des Namens (IPS_GetObjectIDByName).',
            inputSchema: z.object({ name: z.string(), parentId: z.number().int().min(0).optional() }),
            handler: async (args) => {
                const { name, parentId = 0 } = getArgs(args);
                const id = await client.getObjectIdByName(name, parentId);
                return { content: [{ type: 'text', text: String(id) }] };
            },
        },
        symcon_get_variable: {
            description: 'Liefert Variablen-Infos (IPS_GetVariable).',
            inputSchema: variableIdSchema,
            handler: async (args) => {
                const { variableId } = getArgs(args);
                const v = await client.getVariable(variableId);
                return { content: [{ type: 'text', text: JSON.stringify(v, null, 2) }] };
            },
        },
    };
}
