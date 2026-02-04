/**
 * MCP tool handlers for Symcon API.
 * Each tool maps to Symcon Befehlsreferenz methods.
 * Wissensbasis-Tools nutzen KnowledgeStore für gelernte Geräte-Zuordnungen.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getKnowledgeStore } from '../knowledge/KnowledgeStore.js';
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
            description: 'Setzt den Wert einer Symcon-Variable (SetValue). Für Licht ein/aus bei Hue und ähnlichen Aktoren stattdessen symcon_request_action nutzen – nur RequestAction löst die physische Schaltung aus.',
            inputSchema: setValueSchema,
            handler: async (args) => {
                const { variableId, value } = getArgs(args);
                await client.setValue(variableId, value);
                return { content: [{ type: 'text', text: 'OK' }] };
            },
        },
        symcon_request_action: {
            description: 'Führt die Aktion einer Symcon-Variable aus (RequestAction). Standard für Licht ein/aus bei Hue, Homematic und ähnlichen Aktoren – löst die physische Schaltung aus; SetValue allein reicht dort oft nicht.',
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
            description: 'Steuert ein Gerät per Ort und Name (Sprachsteuerung). Sucht unter Root nach dem Ort (z. B. "Büro"), dann nach dem Gerät (z. B. "Licht"), schaltet ein/aus per RequestAction (wichtig für Hue und ähnliche Aktoren – nur RequestAction löst die physische Schaltung aus). Aktion: "ein", "an", "on" = an; "aus", "off" = aus.',
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
                await client.requestAction(variableId, value);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                ok: true,
                                message: `${deviceName} in ${location} ${value ? 'ein' : 'aus'}geschaltet (VariableID ${variableId}, RequestAction).`,
                            }),
                        },
                    ],
                };
            },
        },
        symcon_knowledge_get: {
            description: 'Liefert alle gelernten Geräte-Zuordnungen (Wissensbasis). Die KI nutzt das, um „Büro Licht“ etc. auf VariableIDs aufzulösen, oder um dem User Vorschläge zu machen.',
            inputSchema: z.object({}),
            handler: async (_args) => {
                const store = getKnowledgeStore();
                const mappings = await store.getMappings();
                return { content: [{ type: 'text', text: JSON.stringify({ deviceMappings: mappings }, null, 2) }] };
            },
        },
        symcon_knowledge_set: {
            description: 'Speichert eine Geräte-Zuordnung in der Wissensbasis (Lernen). Nach User-Bestätigung aufrufen, z. B. „Ja, das ist mein Bürolicht.“ → userLabel „Büro Licht“, variableId, variableName „Zustand“, optional path.',
            inputSchema: z.object({
                userLabel: z.string().describe('Nutzer-Label, z. B. "Büro Licht", "Bürolicht"'),
                variableId: z.number().int().positive(),
                variableName: z.string().describe('Name der Variable in Symcon, z. B. "Zustand"'),
                path: z.string().optional().describe('Optional: Pfad im Objektbaum, z. B. Räume/Erdgeschoss/Büro/EG-BU-LI-1/Zustand'),
                objectId: z.number().int().positive().optional(),
            }),
            handler: async (args) => {
                const { userLabel, variableId, variableName, path, objectId } = getArgs(args);
                const store = getKnowledgeStore();
                const entry = await store.addOrUpdateMapping({ userLabel, variableId, variableName, path, objectId });
                return { content: [{ type: 'text', text: JSON.stringify({ ok: true, learned: entry }) }] };
            },
        },
        symcon_resolve_device: {
            description: 'Löst eine Nutzer-Phrase (z. B. "Büro Licht", "Licht im Büro") in der Wissensbasis auf. Wenn gefunden: variableId und variableName zurückgeben, dann kann die KI SetValue/RequestAction ausführen.',
            inputSchema: z.object({
                userPhrase: z.string().describe('Was der User gesagt hat, z. B. "Büro Licht", "Licht im Büro"'),
            }),
            handler: async (args) => {
                const { userPhrase } = getArgs(args);
                const store = getKnowledgeStore();
                const mapping = await store.resolve(userPhrase);
                if (!mapping) {
                    return { content: [{ type: 'text', text: JSON.stringify({ found: false, hint: 'Noch nicht gelernt. KI soll Objektbaum erkunden und User fragen, dann symcon_knowledge_set aufrufen.' }) }] };
                }
                return { content: [{ type: 'text', text: JSON.stringify({ found: true, variableId: mapping.variableId, variableName: mapping.variableName, userLabel: mapping.userLabel }) }] };
            },
        },
        symcon_get_variable_by_path: {
            description: 'Ermittelt die VariableID anhand eines Pfads im Objektbaum (z. B. Räume/Erdgeschoss/Büro/EG-BU-LI-1/Zustand). Nützlich zum Lernen: KI findet Pfad, holt variableId, fragt User, speichert mit symcon_knowledge_set.',
            inputSchema: z.object({
                path: z.string().describe('Pfad mit / getrennt, z. B. Räume/Erdgeschoss/Büro/EG-BU-LI-1/Zustand'),
            }),
            handler: async (args) => {
                const { path: pathStr } = getArgs(args);
                const segments = pathStr.split('/').map((s) => s.trim()).filter(Boolean);
                if (segments.length === 0) {
                    return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'Pfad leer' }) }] };
                }
                let parentId = 0;
                let objectId = 0;
                for (let i = 0; i < segments.length; i++) {
                    const name = segments[i];
                    const childIds = await client.getChildrenIds(parentId);
                    let found = false;
                    for (const id of childIds) {
                        const obj = (await client.getObject(id));
                        const objName = String(obj?.Name ?? '').trim();
                        if (objName === name || objName.toLowerCase() === name.toLowerCase()) {
                            parentId = id;
                            objectId = id;
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: `Segment "${name}" nicht gefunden unter Parent ${parentId}`, segmentIndex: i }) }] };
                    }
                }
                const obj = (await client.getObject(objectId));
                const type = Number(obj?.ObjectType ?? -1);
                if (type !== 2) {
                    return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: `Letztes Objekt (${objectId}) ist keine Variable (ObjectType ${type}, erwartet 2)` }) }] };
                }
                return { content: [{ type: 'text', text: JSON.stringify({ ok: true, variableId: objectId, variableName: segments[segments.length - 1], path: pathStr }) }] };
            },
        },
        symcon_snapshot_variables: {
            description: 'Liefert einen Snapshot aller Variablenwerte unter einer Wurzel (Vorher-Zustand). Nutzen: Wenn die KI nicht weiß, welches Gerät der User meint, zuerst diesen Snapshot aufrufen, dann den User bitten (z. B. „Schalte das Licht bitte kurz ein“), danach symcon_diff_variables mit diesem Snapshot aufrufen – die geänderten Variablen zeigen, welches Licht/Gerät gemeint ist. Optional rootId z. B. Räume/Erdgeschoss/Flur (Objekt-ID), um nur einen Bereich zu erfassen.',
            inputSchema: z.object({
                rootId: z.number().int().min(0).optional().describe('Wurzel (0 = gesamter Baum); z. B. Objekt-ID eines Raums wie Flur'),
                maxDepth: z.number().int().min(1).max(6).optional().describe('Maximale Tiefe (Standard 5)'),
            }),
            handler: async (args) => {
                const { rootId = 0, maxDepth = 5 } = getArgs(args);
                const collectVariables = async (id, depth) => {
                    const out = [];
                    if (depth > maxDepth)
                        return out;
                    let objectType = -1;
                    if (id > 0) {
                        try {
                            const obj = (await client.getObject(id));
                            objectType = Number(obj?.ObjectType ?? -1);
                        }
                        catch {
                            return out;
                        }
                    }
                    if (objectType === 2) {
                        try {
                            const value = await client.getValue(id);
                            out.push({ variableId: id, value });
                        }
                        catch {
                            // Variable lesen fehlgeschlagen, überspringen
                        }
                        return out;
                    }
                    const childIds = await client.getChildrenIds(id);
                    for (const cid of childIds) {
                        const sub = await collectVariables(cid, depth + 1);
                        out.push(...sub);
                    }
                    return out;
                };
                const snapshot = await collectVariables(rootId, 0);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(snapshot, null, 2) +
                                '\n\nHinweis: Diesen Snapshot (als JSON-Array) bei symcon_diff_variables als previousSnapshotJson übergeben, nachdem der User eine Aktion ausgeführt hat.',
                        },
                    ],
                };
            },
        },
        symcon_diff_variables: {
            description: 'Vergleicht den aktuellen Variablenzustand mit einem früheren Snapshot (symcon_snapshot_variables). Liefert alle Variablen, deren Wert sich geändert hat (variableId, oldValue, newValue). Nutzen: User bittet z. B. „Schalte das Licht ein“ → KI vergleicht Vorher-Snapshot mit Jetzt → geänderte Variable = das gemeinte Licht; danach lernen (symcon_knowledge_set) oder steuern.',
            inputSchema: z.object({
                previousSnapshotJson: z
                    .string()
                    .describe('JSON-Array aus symcon_snapshot_variables, z. B. [{"variableId":123,"value":false},...]'),
            }),
            handler: async (args) => {
                const { previousSnapshotJson } = getArgs(args);
                let previous;
                try {
                    previous = JSON.parse(previousSnapshotJson);
                    if (!Array.isArray(previous))
                        throw new Error('Kein Array');
                }
                catch {
                    return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'previousSnapshotJson muss ein gültiges JSON-Array von { variableId, value } sein.' }) }] };
                }
                const changes = [];
                for (const { variableId, value: oldValue } of previous) {
                    try {
                        const newValue = await client.getValue(variableId);
                        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
                            changes.push({ variableId, oldValue, newValue });
                        }
                    }
                    catch {
                        // Variable nicht mehr lesbar oder fehlgeschlagen, überspringen
                    }
                }
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(changes, null, 2) +
                                (changes.length > 0
                                    ? '\n\nGeänderte Variablen: variableId für symcon_set_value/symcon_get_object/symcon_knowledge_set nutzen.'
                                    : '\n\nKeine Änderungen. User evtl. bitten, die Aktion auszuführen, oder anderen Bereich (rootId) snappen.'),
                        },
                    ],
                };
            },
        },
        symcon_get_module_reference: {
            description: 'Liefert die Symcon-Modulreferenz (Geräte): Kategorien und Funktionen/Module aus der offiziellen Dokumentation (symcon.de). Nutzen: KI kann nachschlagen, wie ein Modul (z. B. HomeMatic, Hue, Z-Wave, EnOcean) bedient wird – welche Befehle/Funktionen es gibt. Optional: category (z. B. "homematic", "z-wave") oder search (Suchbegriff in Namen) zum Filtern.',
            inputSchema: z.object({
                category: z.string().optional().describe('Nur diese Kategorie (id), z. B. homematic, z-wave, enocean'),
                search: z.string().optional().describe('Suchbegriff in Funktions-/Modulnamen'),
            }),
            handler: async (args) => {
                const { category, search } = getArgs(args);
                const candidates = [
                    join(process.cwd(), 'data', 'modulreferenz-geraete.json'),
                    join(process.cwd(), 'libs', 'mcp-server', 'data', 'modulreferenz-geraete.json'),
                ];
                let path = null;
                for (const p of candidates) {
                    if (existsSync(p)) {
                        path = p;
                        break;
                    }
                }
                if (!path) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify({
                                    ok: false,
                                    error: 'Modulreferenz-Datei nicht gefunden. Bitte scripts/fetch-modulreferenz.mjs ausführen.',
                                    expectedPaths: candidates,
                                }),
                            },
                        ],
                    };
                }
                const raw = readFileSync(path, 'utf8');
                let data;
                try {
                    data = JSON.parse(raw);
                }
                catch {
                    return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'Modulreferenz-Datei ist kein gültiges JSON.' }) }] };
                }
                let categories = data.categories;
                if (category) {
                    const catNorm = category.trim().toLowerCase();
                    categories = categories.filter((c) => c.id.toLowerCase().includes(catNorm) || c.name.toLowerCase().includes(catNorm));
                }
                if (search) {
                    const searchNorm = search.trim().toLowerCase();
                    categories = categories
                        .map((c) => ({
                        ...c,
                        functions: c.functions.filter((f) => f.name.toLowerCase().includes(searchNorm) || (f.description && f.description.toLowerCase().includes(searchNorm))),
                    }))
                        .filter((c) => c.functions.length > 0);
                }
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({ sourceUrl: data.sourceUrl, updated: data.updated, categories }, null, 2) + '\n\nQuelle: ' + data.sourceUrl + ' – KI kann hier nach Modul/Befehl (z. B. HomeMatic, HM_WriteValueBoolean, Z-Wave SwitchMode) suchen.',
                        },
                    ],
                };
            },
        },
    };
}
