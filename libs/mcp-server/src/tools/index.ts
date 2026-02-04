/**
 * MCP tool handlers for Symcon API.
 * Each tool maps to Symcon Befehlsreferenz methods.
 * Wissensbasis-Tools nutzen KnowledgeStore für gelernte Geräte-Zuordnungen.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { SymconClient } from '../symcon/SymconClient.js';
import { getKnowledgeStore } from '../knowledge/KnowledgeStore.js';
import { getAutomationStore } from '../knowledge/AutomationStore.js';
import type { ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
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

/** Root-Name für MCP-Automationen im Objektbaum (Ordnerkonvention: Thema, optional Raum). */
const MCP_AUTOMATIONS_ROOT = 'MCP Automations';

function getArgs<T>(args: unknown): T {
  return args as T;
}

type HandlerArgs = unknown;

export function createToolHandlers(client: SymconClient): Record<string, { description: string; inputSchema: z.ZodType; handler: ToolCallback }> {
  return {
    symcon_ping: {
      description:
        'Verbindungs-/Auth-Test zur Symcon-API. Ruft IPS_GetKernelVersion auf und liefert die Kernel-Version zurück. Wenn hier 401 kommt, fehlt Remote-Access Basic-Auth (oder SYMCON_API_URL ist falsch).',
      inputSchema: z.object({}),
      handler: async (_args: HandlerArgs) => {
        const kernelVersion = await client.call<string>('IPS_GetKernelVersion', []);
        return { content: [{ type: 'text', text: JSON.stringify({ ok: true, kernelVersion }) }] };
      },
    },
    symcon_get_value: {
      description: 'Liest den Wert einer Symcon-Variable (GetValue).',
      inputSchema: variableIdSchema,
      handler: async (args: HandlerArgs) => {
        const { variableId } = getArgs<z.infer<typeof variableIdSchema>>(args);
        const value = await client.getValue(variableId);
        return { content: [{ type: 'text', text: JSON.stringify(value) }] };
      },
    },
    symcon_set_value: {
      description:
        'Setzt den Wert einer Symcon-Variable (SetValue). Für Licht ein/aus und für Helligkeit/Dimmer bei Hue und ähnlichen Aktoren stattdessen symcon_request_action nutzen – nur RequestAction löst die physische Schaltung aus. Hue-Helligkeit (VariableProfile Intensity.Hue): Skala 0–254, Steuerung nur per RequestAction.',
      inputSchema: setValueSchema,
      handler: async (args: HandlerArgs) => {
        const { variableId, value } = getArgs<z.infer<typeof setValueSchema>>(args);
        await client.setValue(variableId, value);
        return { content: [{ type: 'text', text: 'OK' }] };
      },
    },
    symcon_request_action: {
      description:
        'Führt die Aktion einer Symcon-Variable aus (RequestAction). Standard für Licht ein/aus und für Helligkeit/Dimmer bei Hue, Homematic und ähnlichen Aktoren – löst die physische Schaltung aus; SetValue allein reicht dort oft nicht. Hue-Helligkeit (Variable „Helligkeit“, Profil Intensity.Hue): Wert 0–254 (z. B. 5 % ≈ 13), immer RequestAction verwenden.',
      inputSchema: z.object({ variableId: z.number().int().positive(), value: z.union([z.string(), z.number(), z.boolean()]).optional() }),
      handler: async (args: HandlerArgs) => {
        const { variableId, value } = getArgs<{ variableId: number; value?: unknown }>(args);
        await client.requestAction(variableId, value ?? true);
        return { content: [{ type: 'text', text: 'OK' }] };
      },
    },
    symcon_get_object: {
      description: 'Liefert Objekt-Infos zu einer Symcon-Objekt-ID (IPS_GetObject).',
      inputSchema: objectIdSchema,
      handler: async (args: HandlerArgs) => {
        const { objectId } = getArgs<z.infer<typeof objectIdSchema>>(args);
        const obj = await client.getObject(objectId);
        return { content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] };
      },
    },
    symcon_get_children: {
      description: 'Liefert die Kinder-IDs eines Objekts (IPS_GetChildrenIDs). objectId 0 = Root, damit man den Baum für Sprachsteuerung durchlaufen kann.',
      inputSchema: parentIdSchema,
      handler: async (args: HandlerArgs) => {
        const { objectId } = getArgs<z.infer<typeof parentIdSchema>>(args);
        const ids = await client.getChildrenIds(objectId);
        return { content: [{ type: 'text', text: JSON.stringify(ids) }] };
      },
    },
    symcon_run_script: {
      description: 'Führt ein Symcon-Skript aus (IPS_RunScript).',
      inputSchema: scriptIdSchema,
      handler: async (args: HandlerArgs) => {
        const { scriptId } = getArgs<z.infer<typeof scriptIdSchema>>(args);
        const result = await client.runScript(scriptId);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      },
    },
    symcon_get_object_id_by_name: {
      description: 'Ermittelt die Objekt-ID anhand des Namens (IPS_GetObjectIDByName).',
      inputSchema: z.object({ name: z.string(), parentId: z.number().int().min(0).optional() }),
      handler: async (args: HandlerArgs) => {
        const { name, parentId = 0 } = getArgs<{ name: string; parentId?: number }>(args);
        const id = await client.getObjectIdByName(name, parentId);
        return { content: [{ type: 'text', text: String(id) }] };
      },
    },
    symcon_get_variable: {
      description:
        'Liefert Variablen-Infos (IPS_GetVariable). Enthält Variablentyp (Boolean, Integer, …) und VariableProfile (z. B. Intensity.Hue). Bei Intensity.Hue: Helligkeit 0–254, Steuerung per RequestAction (nicht SetValue). Wichtig, um „Licht aus“ oder „5 % Helligkeit“ korrekt umzusetzen.',
      inputSchema: variableIdSchema,
      handler: async (args: HandlerArgs) => {
        const { variableId } = getArgs<z.infer<typeof variableIdSchema>>(args);
        const v = await client.getVariable(variableId);
        return { content: [{ type: 'text', text: JSON.stringify(v, null, 2) }] };
      },
    },
    symcon_get_object_tree: {
      description:
        'Liefert den Objektbaum ab einer Wurzel (Discovery). Jeder Knoten: ObjectID, Name, ObjectType (0=Kategorie, 1=Instanz, 2=Variable), children. Bei mehreren Kandidaten: Gefundene Objekte in normaler Sprache vorlesen und User fragen (Verhalten siehe symcon_resolve_device bei found: false: instructions, askUserExamples).',
      inputSchema: z.object({
        rootId: z.number().int().min(0).optional().describe('Wurzel (0 = Root); Standard 0'),
        maxDepth: z.number().int().min(1).max(6).optional().describe('Maximale Tiefe (Standard 4)'),
      }),
      handler: async (args: HandlerArgs) => {
        const { rootId = 0, maxDepth = 4 } = getArgs<{ rootId?: number; maxDepth?: number }>(args);
        type TreeNode = { ObjectID: number; Name: string; ObjectType: number; children: TreeNode[] };
        const buildTree = async (id: number, depth: number): Promise<TreeNode> => {
          let name = 'Root';
          let objectType = 0;
          if (id > 0) {
            try {
              const obj = (await client.getObject(id)) as { Name?: string; ObjectName?: string; ObjectType?: number };
              name = String(obj?.ObjectName ?? obj?.Name ?? '').trim() || `Objekt ${id}`;
              objectType = Number(obj?.ObjectType ?? 0);
            } catch {
              return { ObjectID: id, Name: `(Fehler beim Laden)`, ObjectType: -1, children: [] };
            }
          }
          const childIds = await client.getChildrenIds(id);
          const children: TreeNode[] =
            depth < maxDepth
              ? await Promise.all(childIds.map((cid) => buildTree(cid, depth + 1)))
              : [];
          return { ObjectID: id, Name: name, ObjectType: objectType, children };
        };
        const tree = await buildTree(rootId, 0);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                tree,
                null,
                2
              ) + '\n\nObjectType: 0=Kategorie, 1=Instanz, 2=Variable. Bei Variable: ObjectID = VariableID für SetValue/RequestAction.',
            },
          ],
        };
      },
    },
    symcon_control_device: {
      description:
        'Steuert ein Gerät per Ort und Name (Sprachsteuerung). Sucht unter Root nach dem Ort (z. B. "Büro"), dann nach dem Gerät (z. B. "Licht"), schaltet ein/aus per RequestAction (wichtig für Hue und ähnliche Aktoren – nur RequestAction löst die physische Schaltung aus). Aktion: "ein", "an", "on" = an; "aus", "off" = aus.',
      inputSchema: z.object({
        location: z.string().describe('Ort/Raum, z. B. "Büro", "Wohnzimmer"'),
        deviceName: z.string().describe('Gerät, z. B. "Licht", "Deckenlicht"'),
        action: z.enum(['ein', 'an', 'on', 'aus', 'off']).describe('Aktion: ein/an/on = an, aus/off = aus'),
      }),
      handler: async (args: HandlerArgs) => {
        const { location, deviceName, action } = getArgs<{
          location: string;
          deviceName: string;
          action: 'ein' | 'an' | 'on' | 'aus' | 'off';
        }>(args);
        const value = action === 'aus' || action === 'off' ? false : true;
        const locNorm = location.trim().toLowerCase();
        const devNorm = deviceName.trim().toLowerCase();

        let locationId: number;
        try {
          locationId = await client.getObjectIdByName(location.trim(), 0);
        } catch {
          const rootIds = await client.getChildrenIds(0);
          let found = false;
          locationId = 0;
          for (const id of rootIds) {
            const obj = (await client.getObject(id)) as { Name?: string; ObjectName?: string };
            const name = String(obj?.ObjectName ?? obj?.Name ?? '').trim().toLowerCase();
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
        let variableId: number | null = null;
        for (const id of childIds) {
          const obj = (await client.getObject(id)) as { Name?: string; ObjectName?: string; ObjectType?: number };
          const name = String(obj?.ObjectName ?? obj?.Name ?? '').trim().toLowerCase();
          const type = Number(obj?.ObjectType ?? -1);
          const nameMatch = name === devNorm || name.includes(devNorm) || devNorm.includes(name);
          if (nameMatch && type === 2) {
            variableId = id;
            break;
          }
          if (nameMatch && type === 0) {
            const subIds = await client.getChildrenIds(id);
            for (const subId of subIds) {
              const sub = (await client.getObject(subId)) as { ObjectType?: number };
              if (Number(sub?.ObjectType ?? -1) === 2) {
                variableId = subId;
                break;
              }
            }
            if (variableId !== null) break;
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
      description:
        'Liefert deviceMappings, conventions, controlRules (Steuerungsregeln pro Akteur, z. B. Rolllade auf/zu) und usageHint. KI nutzt controlRules für „auf“/„zu“ etc.; bei User-Korrektur „andersrum“ symcon_knowledge_correct_direction aufrufen.',
      inputSchema: z.object({}),
      handler: async (_args: HandlerArgs) => {
        const store = getKnowledgeStore();
        const [mappings, conventions, controlRules] = await Promise.all([
          store.getMappings(),
          store.getConventions(),
          store.getControlRules(),
        ]);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  deviceMappings: mappings,
                  conventions,
                  controlRules,
                  usageHint:
                    'Bei nicht gefunden oder mehreren Kandidaten: Nur relevanten Bereich erkunden, Gefundenes vorlesen und User fragen. Für Akteure (z. B. Rolllade): symcon_get_module_reference nachschlagen, Steuerung mit symcon_knowledge_set_control_rule speichern. Bei User „das war falsch rum“: symcon_knowledge_correct_direction(variableId) aufrufen.',
                },
                null,
                2,
              ),
            },
          ],
        };
      },
    },
    symcon_knowledge_set: {
      description:
        'Speichert eine Geräte-Zuordnung in der Wissensbasis (Lernen). Nach User-Bestätigung aufrufen, z. B. „Ja, das ist mein Bürolicht.“ → userLabel „Büro Licht“, variableId, variableName „Zustand“, optional path.',
      inputSchema: z.object({
        userLabel: z.string().describe('Nutzer-Label, z. B. "Büro Licht", "Bürolicht"'),
        variableId: z.number().int().positive(),
        variableName: z.string().describe('Name der Variable in Symcon, z. B. "Zustand"'),
        path: z.string().optional().describe('Optional: Pfad im Objektbaum, z. B. Räume/Erdgeschoss/Büro/EG-BU-LI-1/Zustand'),
        objectId: z.number().int().positive().optional(),
      }),
      handler: async (args: HandlerArgs) => {
        const { userLabel, variableId, variableName, path, objectId } = getArgs<{
          userLabel: string;
          variableId: number;
          variableName: string;
          path?: string;
          objectId?: number;
        }>(args);
        const store = getKnowledgeStore();
        const entry = await store.addOrUpdateMapping({ userLabel, variableId, variableName, path, objectId });
        return { content: [{ type: 'text', text: JSON.stringify({ ok: true, learned: entry }) }] };
      },
    },
    symcon_knowledge_set_convention: {
      description:
        'Speichert eine Konvention/Hinweis in der Wissensbasis (z. B. key "LI" = "Licht", key "SD" = "Steckdose"). Die KI nutzt das bei der Suche im Objektbaum (z. B. bei „Licht“ nur Objekte mit LI, SD ausschließen) und kann Rückfragen stellen. Generell nutzbar für beliebige Abkürzungen/Bezeichnungen.',
      inputSchema: z.object({
        key: z.string().describe('Kurzform/Code in Objektnamen, z. B. "LI", "SD"'),
        meaning: z.string().describe('Bedeutung, z. B. "Licht", "Steckdose"'),
        description: z
          .string()
          .optional()
          .describe('Optional: Hinweis für die KI, z. B. "Bei Licht-Steuerung nur Objekte mit LI; SD ausschließen."'),
      }),
      handler: async (args: HandlerArgs) => {
        const { key, meaning, description } = getArgs<{ key: string; meaning: string; description?: string }>(args);
        const store = getKnowledgeStore();
        const entry = await store.addOrUpdateConvention({ key, meaning, description });
        return { content: [{ type: 'text', text: JSON.stringify({ ok: true, convention: entry }) }] };
      },
    },
    symcon_knowledge_set_control_rule: {
      description:
        'Speichert eine Steuerungsregel für einen Akteur (z. B. Rolllade: „auf“ = 0, „zu“ = 100). Nach Modulreferenz (symcon_get_module_reference) oder nach dem Lernen aufrufen. actions: Objekt mit Aktion → Wert, z. B. { "auf": 0, "zu": 100, "aufmachen": 0, "zumachen": 100 } oder { "ein": true, "aus": false }. Optional source (module_reference, learned), note.',
      inputSchema: z.object({
        variableId: z.number().int().positive(),
        variableName: z.string().optional(),
        deviceType: z.string().optional().describe('z. B. "Rolllade", "Licht"'),
        actions: z.record(z.union([z.number(), z.boolean()])).describe('Aktion → Wert, z. B. { "auf": 0, "zu": 100 }'),
        source: z.string().optional().describe('z. B. module_reference, learned'),
        note: z.string().optional(),
      }),
      handler: async (args: HandlerArgs) => {
        const { variableId, variableName, deviceType, actions, source, note } = getArgs<{
          variableId: number;
          variableName?: string;
          deviceType?: string;
          actions: Record<string, number | boolean>;
          source?: string;
          note?: string;
        }>(args);
        const store = getKnowledgeStore();
        const entry = await store.addOrUpdateControlRule({
          variableId,
          variableName,
          deviceType,
          actions: { ...actions },
          source,
          note,
        });
        return { content: [{ type: 'text', text: JSON.stringify({ ok: true, controlRule: entry }) }] };
      },
    },
    symcon_knowledge_get_control_rule: {
      description:
        'Liefert die Steuerungsregel für eine Variable (variableId). Falls vorhanden: actions (z. B. auf/zu) für RequestAction/SetValue nutzen. Sonst Modulreferenz nachschlagen und symcon_knowledge_set_control_rule aufrufen.',
      inputSchema: z.object({
        variableId: z.number().int().positive(),
      }),
      handler: async (args: HandlerArgs) => {
        const { variableId } = getArgs<{ variableId: number }>(args);
        const store = getKnowledgeStore();
        const rule = await store.getControlRuleByVariableId(variableId);
        return {
          content: [{ type: 'text', text: JSON.stringify(rule ? { found: true, controlRule: rule } : { found: false }) }],
        };
      },
    },
    symcon_knowledge_correct_direction: {
      description:
        'Tauscht die Werte für „auf“/„zu“ (bzw. aufmachen/zumachen, open/close) bei der Steuerungsregel für variableId. Aufrufen, wenn der User korrigiert: „das war falsch rum“, „das geht andersrum“ – dann beim nächsten Mal die richtige Richtung nutzen.',
      inputSchema: z.object({
        variableId: z.number().int().positive(),
        note: z.string().optional().describe('Optional: z. B. "User sagte: andersrum"'),
      }),
      handler: async (args: HandlerArgs) => {
        const { variableId, note } = getArgs<{ variableId: number; note?: string }>(args);
        const store = getKnowledgeStore();
        const rule = await store.correctDirection(variableId, note);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                rule
                  ? { ok: true, controlRule: rule, hint: 'Auf/Zu-Werte getauscht. Beim nächsten Mal wird die richtige Richtung genutzt.' }
                  : { ok: false, error: 'Keine Steuerungsregel für diese variableId gefunden. Zuerst symcon_knowledge_set_control_rule aufrufen.' },
              ),
            },
          ],
        };
      },
    },
    symcon_resolve_device: {
      description:
        'Löst eine Nutzer-Phrase (z. B. "Büro Licht", "Licht im Büro") in der Wissensbasis auf. Wenn gefunden: variableId und variableName. Wenn found: false: conventions, instructions (explore, tellUser, ask, then) und askUserExamples mitliefern – KI soll sich an instructions halten (zügig erkunden, vorlesen, fragen, dann symcon_knowledge_set).',
      inputSchema: z.object({
        userPhrase: z.string().describe('Was der User gesagt hat, z. B. "Büro Licht", "Licht im Büro"'),
      }),
      handler: async (args: HandlerArgs) => {
        const { userPhrase } = getArgs<{ userPhrase: string }>(args);
        const store = getKnowledgeStore();
        const [mapping, conventions] = await Promise.all([store.resolve(userPhrase), store.getConventions()]);
        if (!mapping) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    found: false,
                    hint: 'Noch nicht gelernt. Verhalten siehe instructions.',
                    conventions,
                    instructions: {
                      explore: 'Nur den relevanten Bereich erkunden (z. B. einen Raum mit symcon_get_object_tree(rootId: raumObjectId, maxDepth: 4)), nicht den ganzen Baum.',
                      tellUser: 'Gefundene Geräte/Knoten in normaler Sprache vorlesen (z. B. „Im Wohnzimmer sehe ich: Stehlampe, Deckenlicht Mitte, TV-Licht“).',
                      ask: 'User konkret fragen, z. B. „Welches meinst du?“ oder „Soll die Stehlampe dein Couch-Licht sein?“',
                      then: 'Bei Bestätigung symcon_knowledge_set aufrufen, danach gewünschte Aktion ausführen.',
                    },
                    askUserExamples: [
                      'Im Wohnzimmer habe ich gefunden: Stehlampe, Deckenlicht Mitte, TV-Licht. Welches meinst du?',
                      'Soll die Stehlampe dein Couch-Licht sein?',
                    ],
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                found: true,
                variableId: mapping.variableId,
                variableName: mapping.variableName,
                userLabel: mapping.userLabel,
              }),
            },
          ],
        };
      },
    },
    symcon_get_variable_by_path: {
      description:
        'Ermittelt die VariableID anhand eines Pfads im Objektbaum (z. B. Räume/Erdgeschoss/Büro/eg-bu-li-1/Zustand). Bei ok: true sofort variableId nutzen (symcon_knowledge_set, symcon_request_action, symcon_schedule_once) – keine weitere Suche. Nützlich zum Lernen: KI findet Pfad, holt variableId, fragt User, speichert mit symcon_knowledge_set.',
      inputSchema: z.object({
        path: z.string().describe('Pfad mit / getrennt, z. B. Räume/Erdgeschoss/Büro/EG-BU-LI-1/Zustand'),
      }),
      handler: async (args: HandlerArgs) => {
        const { path: pathStr } = getArgs<{ path: string }>(args);
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
            const obj = (await client.getObject(id)) as { Name?: string; ObjectName?: string; ObjectType?: number };
            const objName = String(obj?.ObjectName ?? obj?.Name ?? '').trim();
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
        const obj = (await client.getObject(objectId)) as { ObjectType?: number };
        const type = Number(obj?.ObjectType ?? -1);
        if (type !== 2) {
          return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: `Letztes Objekt (${objectId}) ist keine Variable (ObjectType ${type}, erwartet 2)` }) }] };
        }
        return { content: [{ type: 'text', text: JSON.stringify({ ok: true, variableId: objectId, variableName: segments[segments.length - 1], path: pathStr }) }] };
      },
    },
    symcon_snapshot_variables: {
      description:
        'Liefert einen Snapshot aller Variablenwerte unter einer Wurzel (Vorher-Zustand). Wichtig: Immer rootId der relevanten Raums/ Bereichs verwenden (Objekt-ID des Raums, z. B. Büro), nie rootId 0 – sonst sind tausende Variablen (Sensoren, sich ändernde Werte) drin und verfälschen den Diff. User-Anweisung: „Schalte das Gerät jetzt ein oder aus – egal welche Richtung –, sag Bescheid wenn fertig.“ Danach symcon_diff_variables mit diesem Snapshot aufrufen.',
      inputSchema: z.object({
        rootId: z.number().int().min(0).optional().describe('Objekt-ID des Raums/Bereichs (z. B. Büro); 0 = gesamter Baum – nur nutzen wenn kein Raum bekannt, sonst Ergebnis verfälscht'),
        maxDepth: z.number().int().min(1).max(6).optional().describe('Maximale Tiefe (Standard 5)'),
      }),
      handler: async (args: HandlerArgs) => {
        const { rootId = 0, maxDepth = 5 } = getArgs<{ rootId?: number; maxDepth?: number }>(args);
        type Obj = { ObjectType?: number };
        const collectVariables = async (id: number, depth: number): Promise<{ variableId: number; value: unknown }[]> => {
          const out: { variableId: number; value: unknown }[] = [];
          if (depth > maxDepth) return out;
          let objectType = -1;
          if (id > 0) {
            try {
              const obj = (await client.getObject(id)) as Obj;
              objectType = Number(obj?.ObjectType ?? -1);
            } catch {
              return out;
            }
          }
          if (objectType === 2) {
            try {
              const value = await client.getValue(id);
              out.push({ variableId: id, value });
            } catch {
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
              text:
                JSON.stringify(snapshot, null, 2) +
                '\n\nHinweis: Sage dem User: „Schalte das Gerät jetzt ein oder aus – egal welche Richtung –, und sag Bescheid, wenn du fertig bist.“ Danach symcon_diff_variables(previousSnapshotJson) mit diesem Snapshot aufrufen.',
            },
          ],
        };
      },
    },
    symcon_diff_variables: {
      description:
        'Vergleicht den aktuellen Variablenzustand mit einem früheren Snapshot (symcon_snapshot_variables). Liefert alle Variablen, deren Wert sich geändert hat (variableId, oldValue, newValue). Nutzen: User bittet z. B. „Schalte das Licht ein“ → KI vergleicht Vorher-Snapshot mit Jetzt → geänderte Variable = das gemeinte Licht; danach lernen (symcon_knowledge_set) oder steuern.',
      inputSchema: z.object({
        previousSnapshotJson: z
          .string()
          .describe('JSON-Array aus symcon_snapshot_variables, z. B. [{"variableId":123,"value":false},...]'),
      }),
      handler: async (args: HandlerArgs) => {
        const { previousSnapshotJson } = getArgs<{ previousSnapshotJson: string }>(args);
        let previous: { variableId: number; value: unknown }[];
        try {
          previous = JSON.parse(previousSnapshotJson) as { variableId: number; value: unknown }[];
          if (!Array.isArray(previous)) throw new Error('Kein Array');
        } catch {
          return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'previousSnapshotJson muss ein gültiges JSON-Array von { variableId, value } sein.' }) }] };
        }
        const changes: { variableId: number; oldValue: unknown; newValue: unknown }[] = [];
        for (const { variableId, value: oldValue } of previous) {
          try {
            const newValue = await client.getValue(variableId);
            if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
              changes.push({ variableId, oldValue, newValue });
            }
          } catch {
            // Variable nicht mehr lesbar oder fehlgeschlagen, überspringen
          }
        }
        return {
          content: [
            {
              type: 'text',
              text:
                JSON.stringify(changes, null, 2) +
                (changes.length > 0
                  ? '\n\nGeänderte Variablen: variableId für symcon_set_value/symcon_get_object/symcon_knowledge_set nutzen.'
                  : '\n\nKeine Änderungen. User evtl. bitten, die Aktion auszuführen, oder anderen Bereich (rootId) snappen.'),
            },
          ],
        };
      },
    },
    symcon_get_module_reference: {
      description:
        'Liefert die Symcon-Modulreferenz (Geräte): Kategorien und Funktionen/Module aus der offiziellen Dokumentation (symcon.de). Nutzen: KI kann nachschlagen, wie ein Modul (z. B. HomeMatic, Hue, Z-Wave, EnOcean) bedient wird – welche Befehle/Funktionen es gibt. Optional: category (z. B. "homematic", "z-wave") oder search (Suchbegriff in Namen) zum Filtern.',
      inputSchema: z.object({
        category: z.string().optional().describe('Nur diese Kategorie (id), z. B. homematic, z-wave, enocean'),
        search: z.string().optional().describe('Suchbegriff in Funktions-/Modulnamen'),
      }),
      handler: async (args: HandlerArgs) => {
        const { category, search } = getArgs<{ category?: string; search?: string }>(args);
        const candidates = [
          join(process.cwd(), 'data', 'modulreferenz-geraete.json'),
          join(process.cwd(), 'libs', 'mcp-server', 'data', 'modulreferenz-geraete.json'),
        ];
        let path: string | null = null;
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
        let data: { sourceUrl: string; updated: string; categories: { id: string; name: string; description: string; functions: { name: string; description: string; url: string }[] }[] };
        try {
          data = JSON.parse(raw) as typeof data;
        } catch {
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
              text:
                JSON.stringify(
                  { sourceUrl: data.sourceUrl, updated: data.updated, categories },
                  null,
                  2
                ) + '\n\nQuelle: ' + data.sourceUrl + ' – KI kann hier nach Modul/Befehl (z. B. HomeMatic, HM_WriteValueBoolean, Z-Wave SwitchMode) suchen.',
            },
          ],
        };
      },
    },
    // --- Automationen: Ordner, Timer, Skripte, Events, Registry ---
    symcon_automation_get_or_create_folder: {
      description:
        'Erstellt oder liefert die Kategorie-Pfadkette für MCP-Automationen. Ordnerkonvention: Root „MCP Automations“, darunter Themen (Timer, Beleuchtung, Rollladen, Ambiente, Sonstige), optional zweite Ebene Raum (z. B. Büro). Gibt rootCategoryId, categoryId und path zurück.',
      inputSchema: z.object({
        categoryPath: z
          .array(z.string())
          .describe('z. B. ["MCP Automations", "Timer"] oder ["MCP Automations", "Beleuchtung", "Büro"]'),
      }),
      handler: async (args: HandlerArgs) => {
        const { categoryPath } = getArgs<{ categoryPath: string[] }>(args);
        const path = categoryPath.map((s) => s.trim()).filter(Boolean);
        if (path.length === 0) {
          return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'categoryPath darf nicht leer sein.' }) }] };
        }
        const fullPath = path[0] === MCP_AUTOMATIONS_ROOT ? path : [MCP_AUTOMATIONS_ROOT, ...path];
        const categoryId = await client.getOrCreateCategoryPath(0, fullPath);
        const rootId = fullPath.length > 1 ? await client.getOrCreateCategoryPath(0, [fullPath[0]]) : categoryId;
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ ok: true, rootCategoryId: rootId, categoryId, path: fullPath }),
            },
          ],
        };
      },
    },
    symcon_schedule_once: {
      description:
        'Legt eine einmalige zeitverzögerte Aktion an (z. B. „Licht in 1 Minute an“). Nutzt wenn möglich die Symcon-Timer-API (IPS_SetEventCyclicDateBounds). Fallback: ein Skript pro Timer mit Sleep bis Zielzeit, dann RequestAction, dann Event und Skript selbst löschen (IPS_DeleteEvent, sleep, RequestAction, IPS_DeleteScript).',
      inputSchema: z.object({
        variableId: z.number().int().positive(),
        value: z.union([z.string(), z.number(), z.boolean()]).describe('true/auf/ein = an, false/zu/aus = aus'),
        delayMinutes: z.number().int().min(0).optional().describe('Verzögerung in Minuten (Standard 0)'),
        delaySeconds: z.number().int().min(0).optional().describe('Verzögerung in Sekunden (wenn delayMinutes 0)'),
        label: z.string().optional().describe('Lesbares Label für Registry, z. B. „Rolllade 10min“'),
        categoryPath: z.array(z.string()).optional().describe('Default: [\"MCP Automations\", \"Timer\"]'),
      }),
      handler: async (args: HandlerArgs) => {
        const {
          variableId,
          value,
          delayMinutes = 0,
          delaySeconds = 0,
          label: labelArg,
          categoryPath: categoryPathArg,
        } = getArgs<{
          variableId: number;
          value: unknown;
          delayMinutes?: number;
          delaySeconds?: number;
          label?: string;
          categoryPath?: string[];
        }>(args);
        const delayTotalSeconds = delayMinutes * 60 + delaySeconds;
        if (delayTotalSeconds <= 0) {
          return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'delayMinutes oder delaySeconds > 0 angeben.' }) }] };
        }
        const path = (categoryPathArg && categoryPathArg.length > 0 ? categoryPathArg : [MCP_AUTOMATIONS_ROOT, 'Timer']).map((s) => s.trim()).filter(Boolean);
        const fullPath = path[0] === MCP_AUTOMATIONS_ROOT ? path : [MCP_AUTOMATIONS_ROOT, ...path];
        const categoryId = await client.getOrCreateCategoryPath(0, fullPath);

        const actionValue = typeof value === 'string' ? (value.toLowerCase() === 'aus' || value.toLowerCase() === 'zu' || value.toLowerCase() === 'off' ? false : true) : Boolean(value);
        const scriptName = labelArg?.trim() || `Timer ${variableId} in ${delayTotalSeconds}s`;
        const now = Math.floor(Date.now() / 1000);
        const targetTs = now + delayTotalSeconds;
        /** Wert für RequestAction: bei String zu/aus/off → false, sonst true; bei Zahl/boolean unverändert (z. B. Rolllade 0/100). */
        const valueForAction = typeof value === 'string' ? (value.toLowerCase() === 'aus' || value.toLowerCase() === 'zu' || value.toLowerCase() === 'off' ? false : true) : value;

        const runPrimary = async (): Promise<{ ok: true; scriptId: number; eventId: number; categoryId: number; categoryPath: string[]; runsAtUnix: number; automationId: string; fallback?: false }> => {
          const scriptId = await client.createScript(0);
          const scriptContent = `<?php\nRequestAction(${variableId}, ${actionValue ? 'true' : 'false'});\n`;
          await client.setScriptContent(scriptId, scriptContent);
          await client.setName(scriptId, scriptName);
          await client.setParent(scriptId, categoryId);

          const eventId = await client.createEvent(1);
          await client.setEventScript(eventId, `IPS_RunScript(${scriptId});`);
          try {
            await client.setEventCyclic(eventId, 1, 0, 0, 0, 0, 0);
            await client.setEventCyclicDateBounds(eventId, targetTs, targetTs);
            await client.setEventCyclicTimeBounds(eventId, targetTs, 0);
          } catch (e) {
            await client.deleteEvent(eventId);
            await client.deleteScript(scriptId);
            throw e;
          }
          await client.setEventActive(eventId, true);
          await client.setName(eventId, scriptName + ' (Event)');
          await client.setParent(eventId, categoryId);

          const store = getAutomationStore();
          const entry = await store.addOrUpdate({
            label: labelArg?.trim() || `Timer ${variableId} ${delayTotalSeconds}s`,
            categoryPath: fullPath,
            scriptId,
            eventIds: [eventId],
            theme: 'Timer',
          });
          return { ok: true, scriptId, eventId, categoryId, categoryPath: fullPath, runsAtUnix: targetTs, automationId: entry.automationId };
        };

        const runControlScriptFallback = async (): Promise<{ ok: true; controlScript: true; runsAtUnix: number; hint: string }> => {
          const controlScriptId = await client.getOrCreateDelayedActionControlScript();
          const payload = { VariableID: variableId, Value: valueForAction, DelaySeconds: delayTotalSeconds };
          try {
            await client.runScriptEx(controlScriptId, payload);
          } catch {
            // RunScriptEx nicht verfügbar (z. B. Parameter count mismatch) → Parameter per Variable übergeben
            const paramsVarId = await client.getObjectIdByName('MCP Timer Params', categoryId);
            await client.setValue(paramsVarId, JSON.stringify(payload));
            await client.runScript(controlScriptId);
          }
          return {
            ok: true,
            controlScript: true,
            runsAtUnix: targetTs,
            hint: 'Nur ein Control-Skript (MCP Delayed Action Control): erzeugt einmaliges Skript (sleep → RequestAction → IPS_DeleteScript(self, true)) und startet es asynchron. Keine weiteren Skripte anlegen.',
          };
        };

        try {
          const result = await runPrimary();
          return { content: [{ type: 'text', text: JSON.stringify(result) }] };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          const useFallback = msg.includes('SetEventCyclicDateBounds') || msg.includes('SetEventCyclicTimeBounds') || msg.includes('-44001') || msg.includes('not found');
          if (!useFallback) throw err;
          const result = await runControlScriptFallback();
          return {
            content: [{ type: 'text', text: JSON.stringify(result) }],
          };
        }
      },
    },
    symcon_script_create: {
      description:
        'Erstellt ein PHP-Skript in Symcon, setzt Inhalt und Namen, ordnet es unter der angegebenen Kategorie ein. categoryPath: z. B. ["MCP Automations", "Ambiente"]; parentCategoryId kann stattdessen verwendet werden.',
      inputSchema: z.object({
        name: z.string(),
        content: z.string().describe('PHP-Code inkl. <?php ... ?>'),
        categoryPath: z.array(z.string()).optional(),
        parentCategoryId: z.number().int().min(0).optional().describe('Objekt-ID der übergeordneten Kategorie (Alternative zu categoryPath)'),
      }),
      handler: async (args: HandlerArgs) => {
        const { name, content, categoryPath: categoryPathArg, parentCategoryId } = getArgs<{
          name: string;
          content: string;
          categoryPath?: string[];
          parentCategoryId?: number;
        }>(args);
        let categoryId: number;
        if (parentCategoryId !== undefined && parentCategoryId > 0) {
          categoryId = parentCategoryId;
        } else {
          const path = (categoryPathArg && categoryPathArg.length > 0 ? categoryPathArg : [MCP_AUTOMATIONS_ROOT, 'Sonstige']).map((s) => s.trim()).filter(Boolean);
          const fullPath = path[0] === MCP_AUTOMATIONS_ROOT ? path : [MCP_AUTOMATIONS_ROOT, ...path];
          categoryId = await client.getOrCreateCategoryPath(0, fullPath);
        }
        const scriptId = await client.createScript(0);
        await client.setScriptContent(scriptId, content);
        await client.setName(scriptId, name.trim());
        await client.setParent(scriptId, categoryId);
        return { content: [{ type: 'text', text: JSON.stringify({ ok: true, scriptId, categoryId }) }] };
      },
    },
    symcon_script_set_content: {
      description: 'Aktualisiert den Inhalt eines Symcon-Skripts (IPS_SetScriptContent).',
      inputSchema: z.object({ scriptId: z.number().int().positive(), content: z.string() }),
      handler: async (args: HandlerArgs) => {
        const { scriptId, content } = getArgs<{ scriptId: number; content: string }>(args);
        await client.setScriptContent(scriptId, content);
        return { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] };
      },
    },
    symcon_script_delete: {
      description: 'Löscht ein Symcon-Skript (IPS_DeleteScript). Vorher zugehörige Events löschen oder trennen.',
      inputSchema: scriptIdSchema,
      handler: async (args: HandlerArgs) => {
        const { scriptId } = getArgs<z.infer<typeof scriptIdSchema>>(args);
        await client.deleteScript(scriptId);
        return { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] };
      },
    },
    symcon_event_create_cyclic: {
      description:
        'Erstellt ein zyklisches Event in Symcon, verknüpft es mit einem Skript (IPS_RunScript) und ordnet es unter categoryPath ein. dateType: 0=kein Datum, 1=einmalig (DateBounds), 2=täglich, 3=wöchentlich, 4=monatlich, 5=jährlich. timeType: 0=einmalig (TimeBounds), 1=jede Sekunde, 2=jede Minute, 3=stündlich. timeFrom/timeTo: Unix-Zeit (Sekunden) für Zeitgrenzen, z. B. mktime(7,0,0) für 07:00.',
      inputSchema: z.object({
        scriptId: z.number().int().positive(),
        categoryPath: z.array(z.string()).optional(),
        parentCategoryId: z.number().int().min(0).optional(),
        dateType: z.number().int().min(0).max(5).optional().describe('0–5, 1=once'),
        dateInterval: z.number().int().min(0).optional(),
        dateDay: z.number().int().min(0).optional(),
        dateDayInterval: z.number().int().min(0).optional(),
        timeType: z.number().int().min(0).max(3).optional().describe('0=once, 1=sec, 2=min, 3=hour'),
        timeInterval: z.number().int().min(0).optional(),
        timeFrom: z.number().int().min(0).optional().describe('Unix-Zeit Start'),
        timeTo: z.number().int().min(0).optional().describe('Unix-Zeit Ende'),
        dateFrom: z.number().int().min(0).optional(),
        dateTo: z.number().int().min(0).optional(),
        name: z.string().optional(),
      }),
      handler: async (args: HandlerArgs) => {
        const params = getArgs<{
          scriptId: number;
          categoryPath?: string[];
          parentCategoryId?: number;
          dateType?: number;
          dateInterval?: number;
          dateDay?: number;
          dateDayInterval?: number;
          timeType?: number;
          timeInterval?: number;
          timeFrom?: number;
          timeTo?: number;
          dateFrom?: number;
          dateTo?: number;
          name?: string;
        }>(args);
        let categoryId: number;
        if (params.parentCategoryId !== undefined && params.parentCategoryId > 0) {
          categoryId = params.parentCategoryId;
        } else {
          const path = (params.categoryPath && params.categoryPath.length > 0 ? params.categoryPath : [MCP_AUTOMATIONS_ROOT, 'Sonstige']).map((s) => s.trim()).filter(Boolean);
          const fullPath = path[0] === MCP_AUTOMATIONS_ROOT ? path : [MCP_AUTOMATIONS_ROOT, ...path];
          categoryId = await client.getOrCreateCategoryPath(0, fullPath);
        }
        const eventId = await client.createEvent(1);
        const runScriptCode = `IPS_RunScript(${params.scriptId});`;
        await client.setEventScript(eventId, runScriptCode);
        const dateType = params.dateType ?? 0;
        const dateInterval = params.dateInterval ?? 0;
        const dateDay = params.dateDay ?? 0;
        const dateDayInterval = params.dateDayInterval ?? 0;
        const timeType = params.timeType ?? 0;
        const timeInterval = params.timeInterval ?? 0;
        await client.setEventCyclic(eventId, dateType, dateInterval, dateDay, dateDayInterval, timeType, timeInterval);
        if (params.timeFrom !== undefined || params.timeTo !== undefined) {
          await client.setEventCyclicTimeBounds(eventId, params.timeFrom ?? 0, params.timeTo ?? 0);
        }
        if (params.dateFrom !== undefined || params.dateTo !== undefined) {
          await client.setEventCyclicDateBounds(eventId, params.dateFrom ?? 0, params.dateTo ?? 0);
        }
        await client.setEventActive(eventId, true);
        if (params.name) await client.setName(eventId, params.name);
        await client.setParent(eventId, categoryId);
        return {
          content: [{ type: 'text', text: JSON.stringify({ ok: true, eventId, categoryId }) }],
        };
      },
    },
    symcon_event_delete: {
      description: 'Löscht ein Symcon-Event (IPS_DeleteEvent).',
      inputSchema: z.object({ eventId: z.number().int().positive() }),
      handler: async (args: HandlerArgs) => {
        const { eventId } = getArgs<{ eventId: number }>(args);
        await client.deleteEvent(eventId);
        return { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] };
      },
    },
    symcon_event_get: {
      description: 'Liefert Infos zu einem Symcon-Event (IPS_GetEvent).',
      inputSchema: z.object({ eventId: z.number().int().positive() }),
      handler: async (args: HandlerArgs) => {
        const { eventId } = getArgs<{ eventId: number }>(args);
        const ev = await client.getEvent(eventId);
        return { content: [{ type: 'text', text: JSON.stringify(ev, null, 2) }] };
      },
    },
    symcon_automation_list: {
      description:
        'Listet MCP-Automationen aus der Registry. Optional Filter: theme (z. B. Timer, Ambiente), room, categoryPath. Ohne Filter: alle Einträge. Die KI soll vor dem Anlegen neuer Automationen prüfen, ob bereits ein Eintrag existiert (z. B. „Ambiente-Licht Zeiten“), und dann aktualisieren statt Duplikate anlegen.',
      inputSchema: z.object({
        theme: z.string().optional(),
        room: z.string().optional(),
        categoryPath: z.array(z.string()).optional(),
      }),
      handler: async (args: HandlerArgs) => {
        const { theme, room, categoryPath } = getArgs<{ theme?: string; room?: string; categoryPath?: string[] }>(args);
        const store = getAutomationStore();
        let list = await store.getAll();
        if (theme) list = list.filter((a) => a.theme && a.theme.toLowerCase() === theme.trim().toLowerCase());
        if (room) list = list.filter((a) => a.room && a.room.toLowerCase() === room.trim().toLowerCase());
        if (categoryPath && categoryPath.length > 0) {
          const norm = categoryPath.map((s) => s.trim().toLowerCase()).filter(Boolean);
          list = list.filter((a) => a.categoryPath.length >= norm.length && a.categoryPath.slice(0, norm.length).every((p, i) => p.toLowerCase() === norm[i]));
        }
        return { content: [{ type: 'text', text: JSON.stringify({ automations: list }, null, 2) }] };
      },
    },
    symcon_automation_register: {
      description:
        'Speichert oder aktualisiert einen Eintrag in der Automation-Registry (label, categoryPath, scriptId, eventIds, optional room, theme). Wird intern von schedule_once etc. genutzt; KI kann es explizit aufrufen, um eine Automation zu registrieren.',
      inputSchema: z.object({
        label: z.string(),
        categoryPath: z.array(z.string()),
        scriptId: z.number().int().positive(),
        eventIds: z.array(z.number().int().positive()).optional(),
        room: z.string().optional(),
        theme: z.string().optional(),
      }),
      handler: async (args: HandlerArgs) => {
        const { label, categoryPath, scriptId, eventIds, room, theme } = getArgs<{
          label: string;
          categoryPath: string[];
          scriptId: number;
          eventIds?: number[];
          room?: string;
          theme?: string;
        }>(args);
        const store = getAutomationStore();
        const entry = await store.addOrUpdate({ label, categoryPath, scriptId, eventIds: eventIds ?? [], room, theme });
        return { content: [{ type: 'text', text: JSON.stringify({ ok: true, automationId: entry.automationId, entry }) }] };
      },
    },
    symcon_automation_unregister: {
      description: 'Entfernt einen Eintrag aus der Automation-Registry (anhand automationId). Skript/Events werden nicht gelöscht – dazu symcon_script_delete / symcon_event_delete nutzen.',
      inputSchema: z.object({ automationId: z.string() }),
      handler: async (args: HandlerArgs) => {
        const { automationId } = getArgs<{ automationId: string }>(args);
        const store = getAutomationStore();
        const removed = await store.remove(automationId);
        return { content: [{ type: 'text', text: JSON.stringify({ ok: removed, automationId }) }] };
      },
    },
  };
}
