/**
 * Symcon JSON-RPC API client.
 * Calls IP-Symcon API (Befehlsreferenz) via HTTP JSON-RPC.
 */
const DEFAULT_TIMEOUT_MS = 10000;
export class SymconClient {
    baseUrl;
    timeoutMs;
    requestId = 0;
    constructor(baseUrl, timeoutMs = DEFAULT_TIMEOUT_MS) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.timeoutMs = timeoutMs;
    }
    /**
     * Call a Symcon RPC method (Befehlsreferenz method names).
     */
    async call(method, params = []) {
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
            const data = (await res.json());
            if (data.error) {
                throw new Error(`Symcon RPC error: ${data.error.message} (code ${data.error.code})`);
            }
            return data.result;
        }
        catch (err) {
            clearTimeout(timeout);
            if (err instanceof Error)
                throw err;
            throw new Error(String(err));
        }
    }
    paramsToArray(method, params) {
        const order = {
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
    async getValue(variableId) {
        return this.call('GetValue', [variableId]);
    }
    async setValue(variableId, value) {
        return this.call('SetValue', [variableId, value]);
    }
    async requestAction(variableId, value = true) {
        return this.call('RequestAction', [variableId, value]);
    }
    async getObject(objectId) {
        return this.call('IPS_GetObject', [objectId]);
    }
    async getChildrenIds(parentId) {
        return this.call('IPS_GetChildrenIDs', [parentId]);
    }
    async runScript(scriptId) {
        return this.call('IPS_RunScript', [scriptId]);
    }
    async getObjectIdByName(name, parentId = 0) {
        return this.call('IPS_GetObjectIDByName', [name, parentId]);
    }
    async getVariable(variableId) {
        return this.call('IPS_GetVariable', [variableId]);
    }
}
