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
      IPS_RunScriptText: ['ScriptText'],
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
   * Symcon prüft den Typ streng: Float-Variablen (z. B. Level ~Intensity.1) erwarten Float;
   * über JSON-RPC wird 0 als Integer geliefert → "Parameter type of Value does not match".
   * Wir senden Zahlen als Dezimal-String (z. B. "0.0", "100.0"), damit PHP (float)"0.0" nutzen kann.
   */
  private normalizeValue(value: unknown): unknown {
    if (typeof value === 'number' && Number.isFinite(value)) {
      const s = String(value);
      return s.includes('.') ? s : `${s}.0`;
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

  /** Führt PHP-Text direkt aus (asynchron). */
  async runScriptText(scriptText: string): Promise<unknown> {
    return this.call('IPS_RunScriptText', [scriptText]);
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
  static readonly MCP_TIMER_QUEUE_VAR_NAME = 'MCP Timer Queue';
  static readonly MCP_TIMER_DISPATCH_EVENT_NAME = 'MCP Timer Dispatcher';

  /**
   * Erstellt oder liefert die Script-ID des MCP Control-Skripts für verzögerte Aktionen.
   * Das Skript verwaltet eine Timer-Queue (Variable `MCP Timer Queue`) und wird zyklisch (alle 10s)
   * durch ein Event aufgerufen. Enqueue erfolgt per IPS_RunScriptEx(VariableID, Value, DelaySeconds).
   */
  async getOrCreateDelayedActionControlScript(): Promise<number> {
    const path = ['MCP Automations', 'Timer'];
    const categoryId = await this.getOrCreateCategoryPath(0, path);

    // Queue-Variable sicherstellen
    let queueVarId: number;
    try {
      queueVarId = await this.getObjectIdByName(SymconClient.MCP_TIMER_QUEUE_VAR_NAME, categoryId);
    } catch {
      queueVarId = await this.createVariable(3);
      await this.setName(queueVarId, SymconClient.MCP_TIMER_QUEUE_VAR_NAME);
      await this.setParent(queueVarId, categoryId);
      await this.setValue(queueVarId, '[]');
    }

    const content = `<?php
// ${SymconClient.MCP_DELAYED_ACTION_CONTROL_SCRIPT_NAME}
// Queue: Variable "${SymconClient.MCP_TIMER_QUEUE_VAR_NAME}" (JSON-Array von {runAt, variableId, value})
// Enqueue: IPS_RunScriptEx mit VariableID, Value, DelaySeconds
// Dispatch: zyklischer Aufruf per Event (alle 10s)

$catId = IPS_GetParent($_IPS['SELF']);
$queueVarId = @IPS_GetObjectIDByName("${SymconClient.MCP_TIMER_QUEUE_VAR_NAME}", $catId);
if (!$queueVarId) {
    $queueVarId = IPS_CreateVariable(3);
    IPS_SetName($queueVarId, "${SymconClient.MCP_TIMER_QUEUE_VAR_NAME}");
    IPS_SetParent($queueVarId, $catId);
    SetValue($queueVarId, "[]");
}

function mcp_timer_lock_enter() { return IPS_SemaphoreEnter("MCP_TIMER_QUEUE", 2000); }
function mcp_timer_lock_leave() { IPS_SemaphoreLeave("MCP_TIMER_QUEUE"); }

function mcp_timer_read_queue($queueVarId) {
    $raw = (string)GetValue($queueVarId);
    if ($raw === "") $raw = "[]";
    $q = json_decode($raw, true);
    return is_array($q) ? $q : [];
}

function mcp_timer_write_queue($queueVarId, $queue) {
    SetValue($queueVarId, json_encode(array_values($queue), JSON_UNESCAPED_UNICODE));
}

$now = time();

// ---- Enqueue (wenn Parameter per RunScriptEx übergeben wurden) ----
if (isset($_IPS["VariableID"]) && isset($_IPS["DelaySeconds"])) {
    $variableId = (int)$_IPS["VariableID"];
    $delaySeconds = (int)$_IPS["DelaySeconds"];
    $value = isset($_IPS["Value"]) ? $_IPS["Value"] : false;
    if ($variableId > 0 && $delaySeconds > 0) {
        $runAt = $now + $delaySeconds;
        if (mcp_timer_lock_enter()) {
            $q = mcp_timer_read_queue($queueVarId);
            $q[] = ["runAt" => $runAt, "variableId" => $variableId, "value" => $value];
            mcp_timer_write_queue($queueVarId, $q);
            mcp_timer_lock_leave();
        }
    }
}

// ---- Dispatch (fällige Einträge ausführen) ----
if (!mcp_timer_lock_enter()) { return; }
$q = mcp_timer_read_queue($queueVarId);
if (count($q) === 0) { mcp_timer_lock_leave(); return; }
$due = [];
$future = [];
foreach ($q as $item) {
    if (!is_array($item)) continue;
    $runAt = isset($item["runAt"]) ? (int)$item["runAt"] : 0;
    if ($runAt <= 0) continue;
    if ($runAt <= $now) $due[] = $item; else $future[] = $item;
}
mcp_timer_write_queue($queueVarId, $future);
mcp_timer_lock_leave();

foreach ($due as $item) {
    $vid = isset($item["variableId"]) ? (int)$item["variableId"] : 0;
    if ($vid <= 0) continue;
    $val = isset($item["value"]) ? $item["value"] : false;
    @RequestAction($vid, $val);
}
`;

    // Skript anlegen/aktualisieren
    let scriptId: number;
    try {
      scriptId = await this.getScriptIdByName(SymconClient.MCP_DELAYED_ACTION_CONTROL_SCRIPT_NAME, categoryId);
    } catch {
      scriptId = await this.createScript(0);
      await this.setName(scriptId, SymconClient.MCP_DELAYED_ACTION_CONTROL_SCRIPT_NAME);
      await this.setParent(scriptId, categoryId);
    }
    await this.setScriptContent(scriptId, content);

    // Dispatcher-Event sicherstellen (alle 10 Sekunden)
    let eventId: number;
    try {
      eventId = await this.getObjectIdByName(SymconClient.MCP_TIMER_DISPATCH_EVENT_NAME, categoryId);
    } catch {
      eventId = await this.createEvent(1);
      await this.setName(eventId, SymconClient.MCP_TIMER_DISPATCH_EVENT_NAME);
      await this.setParent(eventId, categoryId);
    }
    await this.setEventScript(eventId, `IPS_RunScript(${scriptId});`);
    // Jede Sekunde ausführen, damit kurze Timer (z. B. 10s) zuverlässig sind.
    await this.setEventCyclic(eventId, 0, 0, 0, 0, 1, 1);
    await this.setEventActive(eventId, true);

    // Queue initialisieren, falls leer
    try {
      const raw = await this.getValue(queueVarId);
      if (typeof raw !== 'string' || raw.trim() === '') {
        await this.setValue(queueVarId, '[]');
      }
    } catch {
      // ignore
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
