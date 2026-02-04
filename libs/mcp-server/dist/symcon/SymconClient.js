/**
 * Symcon JSON-RPC API client.
 * Calls IP-Symcon API (Befehlsreferenz) via HTTP JSON-RPC.
 */
const DEFAULT_TIMEOUT_MS = 10000;
export class SymconClient {
    baseUrl;
    timeoutMs;
    requestId = 0;
    authHeader;
    constructor(baseUrl, timeoutMs = DEFAULT_TIMEOUT_MS, auth) {
        const trimmed = baseUrl.trim();
        // IP-Symcon JSON-RPC Endpoint ist /api/ (mit Slash). /api (ohne Slash) liefert i. d. R. HTTP 404.
        this.baseUrl = trimmed.endsWith('/api') ? `${trimmed}/` : trimmed;
        this.timeoutMs = timeoutMs;
        if (auth?.type === 'basic') {
            const token = Buffer.from(`${auth.username}:${auth.password}`, 'utf8').toString('base64');
            this.authHeader = { name: 'Authorization', value: `Basic ${token}` };
        }
        else if (auth?.type === 'header') {
            this.authHeader = { name: auth.name, value: auth.value };
        }
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
    // --- Objektverwaltung (Kategorien, Namen, Parent) ---
    async createCategory() {
        return this.call('IPS_CreateCategory', []);
    }
    async setName(objectId, name) {
        return this.call('IPS_SetName', [objectId, name]);
    }
    async setParent(objectId, parentId) {
        return this.call('IPS_SetParent', [objectId, parentId]);
    }
    // --- Skripte ---
    async createScript(scriptType) {
        return this.call('IPS_CreateScript', [scriptType]);
    }
    async setScriptContent(scriptId, content) {
        return this.call('IPS_SetScriptContent', [scriptId, content]);
    }
    async getScriptContent(scriptId) {
        return this.call('IPS_GetScriptContent', [scriptId]);
    }
    async deleteScript(scriptId) {
        return this.call('IPS_DeleteScript', [scriptId]);
    }
    async getScriptIdByName(scriptName, parentId) {
        return this.call('IPS_GetScriptIDByName', [scriptName, parentId]);
    }
    // --- Events (zyklisch / einmalig) ---
    async createEvent(eventType) {
        return this.call('IPS_CreateEvent', [eventType]);
    }
    async setEventCyclic(eventId, dateType, dateInterval, dateDay, dateDayInterval, timeType, timeInterval) {
        return this.call('IPS_SetEventCyclic', [
            eventId,
            dateType,
            dateInterval,
            dateDay,
            dateDayInterval,
            timeType,
            timeInterval,
        ]);
    }
    async setEventCyclicDateBounds(eventId, fromDate, toDate) {
        return this.call('IPS_SetEventCyclicDateBounds', [eventId, fromDate, toDate]);
    }
    async setEventCyclicTimeBounds(eventId, fromTime, toTime) {
        return this.call('IPS_SetEventCyclicTimeBounds', [eventId, fromTime, toTime]);
    }
    async setEventScript(eventId, eventScript) {
        return this.call('IPS_SetEventScript', [eventId, eventScript]);
    }
    async setEventActive(eventId, active) {
        return this.call('IPS_SetEventActive', [eventId, active]);
    }
    async deleteEvent(eventId) {
        return this.call('IPS_DeleteEvent', [eventId]);
    }
    async getEvent(eventId) {
        return this.call('IPS_GetEvent', [eventId]);
    }
    /**
     * Erstellt die Kategorie-Pfadkette unter parentId. Für jedes Segment: existiert bereits eine
     * Kategorie mit diesem Namen unter dem aktuellen Parent, wird deren ID genutzt; sonst wird
     * eine neue Kategorie erstellt, benannt und als Kind zugeordnet.
     * @returns ObjectID der letzten Kategorie im Pfad (dort können Skripte/Events abgelegt werden).
     */
    async getOrCreateCategoryPath(parentId, pathSegments) {
        let currentParentId = parentId;
        for (const segment of pathSegments) {
            if (!segment.trim())
                continue;
            try {
                const existingId = await this.getObjectIdByName(segment.trim(), currentParentId);
                if (existingId && existingId > 0) {
                    currentParentId = existingId;
                    continue;
                }
            }
            catch {
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
