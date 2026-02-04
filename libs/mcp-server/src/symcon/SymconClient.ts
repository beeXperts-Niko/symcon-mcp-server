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
      IPS_GetVariable: ['VariableID'],
      IPS_GetObjectIDByName: ['Name', 'ParentID'],
      IPS_CreateCategory: [],
      IPS_SetName: ['ObjectID', 'Name'],
      IPS_SetParent: ['ObjectID', 'ParentID'],
      IPS_CreateScript: ['ScriptType'],
      IPS_SetScriptContent: ['ScriptID', 'Content'],
      IPS_GetScriptContent: ['ScriptID'],
      IPS_DeleteScript: ['ScriptID'],
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

  async setValue(variableId: number, value: unknown): Promise<void> {
    return this.call('SetValue', [variableId, value]);
  }

  async requestAction(variableId: number, value: unknown = true): Promise<void> {
    return this.call('RequestAction', [variableId, value]);
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

  async deleteScript(scriptId: number): Promise<boolean> {
    return this.call<boolean>('IPS_DeleteScript', [scriptId]);
  }

  async getScriptIdByName(scriptName: string, parentId: number): Promise<number> {
    return this.call<number>('IPS_GetScriptIDByName', [scriptName, parentId]);
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
