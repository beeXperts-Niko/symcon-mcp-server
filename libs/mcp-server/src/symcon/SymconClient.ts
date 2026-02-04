/**
 * Symcon JSON-RPC API client.
 * Calls IP-Symcon API (Befehlsreferenz) via HTTP JSON-RPC.
 */

const DEFAULT_TIMEOUT_MS = 10000;

export interface SymconRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  result?: T;
  error?: { code: number; message: string; data?: unknown };
  id: number | string | null;
}

export type SymconAuth =
  | { type: 'basic'; username: string; password: string }
  | { type: 'header'; name: string; value: string };

export class SymconClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private requestId = 0;
  private readonly authHeader?: { name: string; value: string };

  constructor(baseUrl: string, timeoutMs: number = DEFAULT_TIMEOUT_MS, auth?: SymconAuth) {
    const trimmed = baseUrl.trim();
    // IP-Symcon JSON-RPC Endpoint ist /api/ (mit Slash). /api (ohne Slash) liefert i. d. R. HTTP 404.
    this.baseUrl = trimmed.endsWith('/api') ? `${trimmed}/` : trimmed;
    this.timeoutMs = timeoutMs;
    if (auth?.type === 'basic') {
      const token = Buffer.from(`${auth.username}:${auth.password}`, 'utf8').toString('base64');
      this.authHeader = { name: 'Authorization', value: `Basic ${token}` };
    } else if (auth?.type === 'header') {
      this.authHeader = { name: auth.name, value: auth.value };
    }
  }

  /**
   * Call a Symcon RPC method (Befehlsreferenz method names).
   */
  async call<T = unknown>(method: string, params: unknown[] | Record<string, unknown> = []): Promise<T> {
    const id = ++this.requestId;
    const body = {
      jsonrpc: '2.0',
      method,
      params: Array.isArray(params) ? params : this.paramsToArray(method, params),
      id,
    };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.authHeader ? { [this.authHeader.name]: this.authHeader.value } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        throw new Error(`Symcon API HTTP ${res.status}: ${res.statusText}`);
      }
      const data = (await res.json()) as SymconRpcResponse<T>;
      if (data.error) {
        throw new Error(`Symcon RPC error: ${data.error.message} (code ${data.error.code})`);
      }
      return data.result as T;
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof Error) throw err;
      throw new Error(String(err));
    }
  }

  private paramsToArray(method: string, params: Record<string, unknown>): unknown[] {
    const order: Record<string, string[]> = {
      GetValue: ['VariableID'],
      SetValue: ['VariableID', 'Value'],
      RequestAction: ['VariableID', 'Value'],
      IPS_GetObject: ['ObjectID'],
      IPS_GetChildrenIDs: ['ParentID'],
      IPS_RunScript: ['ScriptID'],
      IPS_RunScriptEx: ['ScriptID', 'Parameters'],
      IPS_GetVariable: ['VariableID'],
      IPS_GetObjectIDByName: ['Name', 'ParentID'],
      IPS_CreateCategory: [],
      IPS_SetName: ['ObjectID', 'Name'],
      IPS_SetParent: ['ObjectID', 'ParentID'],
      IPS_CreateScript: ['ScriptType'],
      IPS_SetScriptContent: ['ScriptID', 'Content'],
      IPS_GetScriptContent: ['ScriptID'],
      IPS_DeleteScript: ['ScriptID', 'DeleteFile'],
      IPS_CreateVariable: ['VariableType'],
      IPS_GetScriptIDByName: ['ScriptName', 'ParentID'],
      IPS_CreateEvent: ['EventType'],
      IPS_SetEventCyclic: ['EventID', 'DateType', 'DateInterval', 'DateDay', 'DateDayInterval', 'TimeType', 'TimeInterval'],
      IPS_SetEventCyclicDateBounds: ['EventID', 'FromDate', 'ToDate'],
      IPS_SetEventCyclicTimeBounds: ['EventID', 'FromTime', 'ToTime'],
      IPS_SetEventScript: ['EventID', 'EventScript'],
      IPS_SetEventActive: ['EventID', 'Active'],
      IPS_DeleteEvent: ['EventID'],
      IPS_GetEvent: ['EventID'],
    };
    const keys = order[method] ?? Object.keys(params);
    return keys.map((k) => params[k]);
  }

  async getValue(variableId: number): Promise<unknown> {
    return this.call('GetValue', [variableId]);
  }

  /**
   * Normalisiert den Wert für SetValue/RequestAction.
   * Symcon erwartet bei Float-Variablen (z. B. Level ~Intensity.1) einen passenden Typ;
   * über JSON-RPC werden ganze Zahlen als Integer übergeben, was zu "Parameter type of Value does not match" führt.
   * Zahlen werden daher als String gesendet, damit Symcon sie in den Variablentyp konvertieren kann.
   */
  private normalizeValue(value: unknown): unknown {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
    return value;
  }

  async setValue(variableId: number, value: unknown): Promise<void> {
    return this.call('SetValue', [variableId, this.normalizeValue(value)]);
  }

  async requestAction(variableId: number, value: unknown = true): Promise<void> {
    return this.call('RequestAction', [variableId, this.normalizeValue(value)]);
  }

  async getObject(objectId: number): Promise<unknown> {
    return this.call('IPS_GetObject', [objectId]);
  }

  async getChildrenIds(parentId: number): Promise<number[]> {
    return this.call('IPS_GetChildrenIDs', [parentId]) as Promise<number[]>;
  }

  async runScript(scriptId: number): Promise<unknown> {
    return this.call('IPS_RunScript', [scriptId]);
  }

  /**
   * Startet ein Skript mit Parametern (asynchron). Das aufgerufene Skript erhält die Keys
   * von params in $_IPS (z. B. params.VariableID → $_IPS['VariableID']).
   */
  async runScriptEx(scriptId: number, params: Record<string, unknown>): Promise<unknown> {
    return this.call('IPS_RunScriptEx', [scriptId, params]);
  }

  async getObjectIdByName(name: string, parentId: number = 0): Promise<number> {
    return this.call('IPS_GetObjectIDByName', [name, parentId]) as Promise<number>;
  }

  async getVariable(variableId: number): Promise<unknown> {
    return this.call('IPS_GetVariable', [variableId]);
  }

  // --- Objektverwaltung (Kategorien, Namen, Parent) ---
  async createCategory(): Promise<number> {
    return this.call<number>('IPS_CreateCategory', []);
  }

  async setName(objectId: number, name: string): Promise<boolean> {
    return this.call<boolean>('IPS_SetName', [objectId, name]);
  }

  async setParent(objectId: number, parentId: number): Promise<boolean> {
    return this.call<boolean>('IPS_SetParent', [objectId, parentId]);
  }

  // --- Skripte ---
  async createScript(scriptType: number): Promise<number> {
    return this.call<number>('IPS_CreateScript', [scriptType]);
  }

  async setScriptContent(scriptId: number, content: string): Promise<boolean> {
    return this.call<boolean>('IPS_SetScriptContent', [scriptId, content]);
  }

  async getScriptContent(scriptId: number): Promise<string> {
    return this.call<string>('IPS_GetScriptContent', [scriptId]);
  }

  async deleteScript(scriptId: number, deleteFile: boolean = true): Promise<boolean> {
    return this.call<boolean>('IPS_DeleteScript', [scriptId, deleteFile]);
  }

  async getScriptIdByName(scriptName: string, parentId: number): Promise<number> {
    return this.call<number>('IPS_GetScriptIDByName', [scriptName, parentId]);
  }

  /** Erstellt eine Benutzer-Variable (Typ 0=Boolean, 1=Integer, 2=Float, 3=String). */
  async createVariable(variableType: number): Promise<number> {
    return this.call<number>('IPS_CreateVariable', [variableType]);
  }

  // --- Events (zyklisch / einmalig) ---
  async createEvent(eventType: number): Promise<number> {
    return this.call<number>('IPS_CreateEvent', [eventType]);
  }

  async setEventCyclic(
    eventId: number,
    dateType: number,
    dateInterval: number,
    dateDay: number,
    dateDayInterval: number,
    timeType: number,
    timeInterval: number
  ): Promise<boolean> {
    return this.call<boolean>('IPS_SetEventCyclic', [
      eventId,
      dateType,
      dateInterval,
      dateDay,
      dateDayInterval,
      timeType,
      timeInterval,
    ]);
  }

  async setEventCyclicDateBounds(eventId: number, fromDate: number, toDate: number): Promise<boolean> {
    return this.call<boolean>('IPS_SetEventCyclicDateBounds', [eventId, fromDate, toDate]);
  }

  async setEventCyclicTimeBounds(eventId: number, fromTime: number, toTime: number): Promise<boolean> {
    return this.call<boolean>('IPS_SetEventCyclicTimeBounds', [eventId, fromTime, toTime]);
  }

  async setEventScript(eventId: number, eventScript: string): Promise<boolean> {
    return this.call<boolean>('IPS_SetEventScript', [eventId, eventScript]);
  }

  async setEventActive(eventId: number, active: boolean): Promise<boolean> {
    return this.call<boolean>('IPS_SetEventActive', [eventId, active]);
  }

  async deleteEvent(eventId: number): Promise<boolean> {
    return this.call<boolean>('IPS_DeleteEvent', [eventId]);
  }

  async getEvent(eventId: number): Promise<unknown> {
    return this.call('IPS_GetEvent', [eventId]);
  }

  /** Name des MCP-Control-Skripts für verzögerte Aktionen (Timer). Wird unter MCP Automations/Timer angelegt. */
  static readonly MCP_DELAYED_ACTION_CONTROL_SCRIPT_NAME = 'MCP Delayed Action Control';

  /**
   * Erstellt oder liefert die Script-ID des MCP Control-Skripts für verzögerte Aktionen.
   * Das Skript erwartet per IPS_RunScriptEx: VariableID, Value, DelaySeconds.
   * Es erzeugt ein einmaliges Skript (sleep → RequestAction → IPS_DeleteScript(self, true)) und startet es asynchron.
   */
  async getOrCreateDelayedActionControlScript(): Promise<number> {
    const path = ['MCP Automations', 'Timer'];
    const categoryId = await this.getOrCreateCategoryPath(0, path);
    const content = `<?php
// Einziges Control-Skript für verzögerte Aktionen. Aufruf per IPS_RunScriptEx (VariableID, Value, DelaySeconds) ODER per Variable "MCP Timer Params" (JSON).
\$variableId = isset(\$_IPS['VariableID']) ? (int)\$_IPS['VariableID'] : 0;
\$value = isset(\$_IPS['Value']) ? \$_IPS['Value'] : false;
\$delaySeconds = isset(\$_IPS['DelaySeconds']) ? (int)\$_IPS['DelaySeconds'] : 0;
if (\$variableId <= 0 || \$delaySeconds <= 0) {
    \$catId = IPS_GetParent(\$_IPS['SELF']);
    \$varId = @IPS_GetObjectIDByName("MCP Timer Params", \$catId);
    if (!\$varId) { \$varId = IPS_CreateVariable(3); IPS_SetName(\$varId, "MCP Timer Params"); IPS_SetParent(\$varId, \$catId); }
    \$json = (string)GetValue(\$varId);
    if (\$json !== '') { SetValue(\$varId, ''); \$p = json_decode(\$json, true); if (isset(\$p['VariableID'], \$p['DelaySeconds'])) { \$variableId = (int)\$p['VariableID']; \$value = isset(\$p['Value']) ? \$p['Value'] : false; \$delaySeconds = (int)\$p['DelaySeconds']; } }
}
if (\$variableId <= 0 || \$delaySeconds <= 0) { return; }
\$valuePhp = is_bool(\$value) ? (\$value ? 'true' : 'false') : (is_numeric(\$value) ? (string)\$value : json_encode(\$value));
\$sid = IPS_CreateScript(0);
\$inner = '<?php' . "\\n" . 'sleep(' . \$delaySeconds . ');' . "\\n" . 'RequestAction(' . \$variableId . ', ' . \$valuePhp . ');' . "\\n" . 'IPS_DeleteScript(\$_IPS[\\'SELF\\'], true);' . "\\n";
IPS_SetScriptContent(\$sid, \$inner);
IPS_SetName(\$sid, 'MCP Delayed Action (einmalig)');
IPS_SetParent(\$sid, IPS_GetParent(\$_IPS['SELF']));
IPS_RunScript(\$sid);
`;
    try {
      const existingId = await this.getScriptIdByName(SymconClient.MCP_DELAYED_ACTION_CONTROL_SCRIPT_NAME, categoryId);
      await this.setScriptContent(existingId, content);
      try {
        await this.getObjectIdByName('MCP Timer Params', categoryId);
      } catch {
        const varId = await this.createVariable(3);
        await this.setName(varId, 'MCP Timer Params');
        await this.setParent(varId, categoryId);
      }
      return existingId;
    } catch {
      // Skript existiert nicht → anlegen
    }
    const scriptId = await this.createScript(0);
    await this.setScriptContent(scriptId, content);
    await this.setName(scriptId, SymconClient.MCP_DELAYED_ACTION_CONTROL_SCRIPT_NAME);
    await this.setParent(scriptId, categoryId);
    try {
      await this.getObjectIdByName('MCP Timer Params', categoryId);
    } catch {
      const varId = await this.createVariable(3);
      await this.setName(varId, 'MCP Timer Params');
      await this.setParent(varId, categoryId);
    }
    return scriptId;
  }

  /**
   * Erstellt die Kategorie-Pfadkette unter parentId. Für jedes Segment: existiert bereits eine
   * Kategorie mit diesem Namen unter dem aktuellen Parent, wird deren ID genutzt; sonst wird
   * eine neue Kategorie erstellt, benannt und als Kind zugeordnet.
   * @returns ObjectID der letzten Kategorie im Pfad (dort können Skripte/Events abgelegt werden).
   */
  async getOrCreateCategoryPath(parentId: number, pathSegments: string[]): Promise<number> {
    let currentParentId = parentId;
    for (const segment of pathSegments) {
      if (!segment.trim()) continue;
      try {
        const existingId = await this.getObjectIdByName(segment.trim(), currentParentId);
        if (existingId && existingId > 0) {
          currentParentId = existingId;
          continue;
        }
      } catch {
        // Objekt mit diesem Namen existiert nicht → Kategorie anlegen
      }
      const catId = await this.createCategory();
      await this.setName(catId, segment.trim());
      await this.setParent(catId, currentParentId);
      currentParentId = catId;
    }
    return currentParentId;
  }
}
