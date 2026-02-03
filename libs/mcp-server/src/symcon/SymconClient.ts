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

export class SymconClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private requestId = 0;

  constructor(baseUrl: string, timeoutMs: number = DEFAULT_TIMEOUT_MS) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeoutMs = timeoutMs;
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
        headers: { 'Content-Type': 'application/json' },
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
}
