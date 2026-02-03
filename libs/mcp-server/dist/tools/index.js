/**
 * MCP tool handlers for Symcon API.
 * Each tool maps to Symcon Befehlsreferenz methods.
 */
import { z } from 'zod';
const variableIdSchema = z.object({ variableId: z.number().int().positive() });
const objectIdSchema = z.object({ objectId: z.number().int().positive() });
/** Erlaubt 0 für Root, damit man den Objektbaum ab Root durchlaufen kann (z. B. für Sprachsteuerung). */
const parentIdSchema = z.object({ objectId: z.number().int().min(0) });
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
        symcon_ping: {
            description: 'Verbindungs-/Auth-Test zur Symcon-API. Ruft IPS_GetKernelVersion auf und liefert die Kernel-Version zurück. Wenn hier 401 kommt, fehlt Remote-Access Basic-Auth (oder SYMCON_API_URL ist falsch).',
            inputSchema: z.object({}),
            handler: async (_args) => {
                const kernelVersion = await client.call('IPS_GetKernelVersion', []);
                return { content: [{ type: 'text', text: JSON.stringify({ ok: true, kernelVersion }) }] };
            },
        },
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
            description: 'Liefert die Kinder-IDs eines Objekts (IPS_GetChildrenIDs). objectId 0 = Root, damit man den Baum für Sprachsteuerung durchlaufen kann.',
            inputSchema: parentIdSchema,
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
            description: 'Liefert Variablen-Infos (IPS_GetVariable). Enthält u. a. Variablentyp (Boolean, Integer, …) – wichtig, um zu wissen, wie man „Licht aus“ umsetzt (z. B. Boolean false, Dimmer 0).',
            inputSchema: variableIdSchema,
            handler: async (args) => {
                const { variableId } = getArgs(args);
                const v = await client.getVariable(variableId);
                return { content: [{ type: 'text', text: JSON.stringify(v, null, 2) }] };
            },
        },
        symcon_get_object_tree: {
            description: 'Liefert den Objektbaum ab einer Wurzel (Discovery). Jeder Knoten: ObjectID, Name, ObjectType (0=Kategorie, 1=Instanz, 2=Variable), children. Die KI soll zuerst diesen Baum aufrufen, die Struktur sinnhaft verstehen (welcher Ort, welches Gerät), dann passend steuern.',
            inputSchema: z.object({
                rootId: z.number().int().min(0).optional().describe('Wurzel (0 = Root); Standard 0'),
                maxDepth: z.number().int().min(1).max(6).optional().describe('Maximale Tiefe (Standard 4)'),
            }),
            handler: async (args) => {
                const { rootId = 0, maxDepth = 4 } = getArgs(args);
                const buildTree = async (id, depth) => {
                    let name = 'Root';
                    let objectType = 0;
                    if (id > 0) {
                        try {
                            const obj = (await client.getObject(id));
                            name = String(obj?.Name ?? '').trim() || `Objekt ${id}`;
                            objectType = Number(obj?.ObjectType ?? 0);
                        }
                        catch {
                            return { ObjectID: id, Name: `(Fehler beim Laden)`, ObjectType: -1, children: [] };
                        }
                    }
                    const childIds = await client.getChildrenIds(id);
                    const children = depth < maxDepth
                        ? await Promise.all(childIds.map((cid) => buildTree(cid, depth + 1)))
                        : [];
                    return { ObjectID: id, Name: name, ObjectType: objectType, children };
                };
                const tree = await buildTree(rootId, 0);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(tree, null, 2) + '\n\nObjectType: 0=Kategorie, 1=Instanz, 2=Variable. Bei Variable: ObjectID = VariableID für SetValue/RequestAction.',
                        },
                    ],
                };
            },
        },
        symcon_control_device: {
            description: 'Steuert ein Gerät per Ort und Name (Sprachsteuerung). Sucht unter Root nach dem Ort (z. B. "Büro"), dann nach dem Gerät (z. B. "Licht"), setzt die Variable auf ein/aus. Aktion: "ein", "an", "on" = an; "aus", "off" = aus.',
            inputSchema: z.object({
                location: z.string().describe('Ort/Raum, z. B. "Büro", "Wohnzimmer"'),
                deviceName: z.string().describe('Gerät, z. B. "Licht", "Deckenlicht"'),
                action: z.enum(['ein', 'an', 'on', 'aus', 'off']).describe('Aktion: ein/an/on = an, aus/off = aus'),
            }),
            handler: async (args) => {
                const { location, deviceName, action } = getArgs(args);
                const value = action === 'aus' || action === 'off' ? false : true;
                const locNorm = location.trim().toLowerCase();
                const devNorm = deviceName.trim().toLowerCase();
                let locationId;
                try {
                    locationId = await client.getObjectIdByName(location.trim(), 0);
                }
                catch {
                    const rootIds = await client.getChildrenIds(0);
                    let found = false;
                    locationId = 0;
                    for (const id of rootIds) {
                        const obj = (await client.getObject(id));
                        const name = String(obj?.Name ?? '').trim().toLowerCase();
                        if (name === locNorm || name.includes(locNorm) || locNorm.includes(name)) {
                            locationId = id;
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify({
                                        ok: false,
                                        error: `Ort "${location}" nicht gefunden. Root-Kinder: ${rootIds.join(', ')}`,
                                    }),
                                },
                            ],
                        };
                    }
                }
                const childIds = await client.getChildrenIds(locationId);
                let variableId = null;
                for (const id of childIds) {
                    const obj = (await client.getObject(id));
                    const name = String(obj?.Name ?? '').trim().toLowerCase();
                    const type = Number(obj?.ObjectType ?? -1);
                    const nameMatch = name === devNorm || name.includes(devNorm) || devNorm.includes(name);
                    if (nameMatch && type === 2) {
                        variableId = id;
                        break;
                    }
                    if (nameMatch && type === 0) {
                        const subIds = await client.getChildrenIds(id);
                        for (const subId of subIds) {
                            const sub = (await client.getObject(subId));
                            if (Number(sub?.ObjectType ?? -1) === 2) {
                                variableId = subId;
                                break;
                            }
                        }
                        if (variableId !== null)
                            break;
                    }
                }
                if (variableId === null) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify({
                                    ok: false,
                                    error: `Gerät "${deviceName}" in "${location}" nicht gefunden. Kinder: ${childIds.join(', ')}`,
                                }),
                            },
                        ],
                    };
                }
                await client.setValue(variableId, value);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                ok: true,
                                message: `${deviceName} in ${location} ${value ? 'ein' : 'aus'}geschaltet (VariableID ${variableId}).`,
                            }),
                        },
                    ],
                };
            },
        },
    };
}
