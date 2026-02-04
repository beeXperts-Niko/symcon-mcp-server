/**
 * Symcon JSON-RPC API client.
 * Calls IP-Symcon API (Befehlsreferenz) via HTTP JSON-RPC.
 */
export interface SymconRpcResponse<T = unknown> {
    jsonrpc: '2.0';
    result?: T;
    error?: {
        code: number;
        message: string;
        data?: unknown;
    };
    id: number | string | null;
}
export type SymconAuth = {
    type: 'basic';
    username: string;
    password: string;
} | {
    type: 'header';
    name: string;
    value: string;
};
export declare class SymconClient {
    private readonly baseUrl;
    private readonly timeoutMs;
    private requestId;
    private readonly authHeader?;
    constructor(baseUrl: string, timeoutMs?: number, auth?: SymconAuth);
    /**
     * Call a Symcon RPC method (Befehlsreferenz method names).
     */
    call<T = unknown>(method: string, params?: unknown[] | Record<string, unknown>): Promise<T>;
    private paramsToArray;
    getValue(variableId: number): Promise<unknown>;
    setValue(variableId: number, value: unknown): Promise<void>;
    requestAction(variableId: number, value?: unknown): Promise<void>;
    getObject(objectId: number): Promise<unknown>;
    getChildrenIds(parentId: number): Promise<number[]>;
    runScript(scriptId: number): Promise<unknown>;
    getObjectIdByName(name: string, parentId?: number): Promise<number>;
    getVariable(variableId: number): Promise<unknown>;
    createCategory(): Promise<number>;
    setName(objectId: number, name: string): Promise<boolean>;
    setParent(objectId: number, parentId: number): Promise<boolean>;
    createScript(scriptType: number): Promise<number>;
    setScriptContent(scriptId: number, content: string): Promise<boolean>;
    getScriptContent(scriptId: number): Promise<string>;
    deleteScript(scriptId: number): Promise<boolean>;
    getScriptIdByName(scriptName: string, parentId: number): Promise<number>;
    createEvent(eventType: number): Promise<number>;
    setEventCyclic(eventId: number, dateType: number, dateInterval: number, dateDay: number, dateDayInterval: number, timeType: number, timeInterval: number): Promise<boolean>;
    setEventCyclicDateBounds(eventId: number, fromDate: number, toDate: number): Promise<boolean>;
    setEventCyclicTimeBounds(eventId: number, fromTime: number, toTime: number): Promise<boolean>;
    setEventScript(eventId: number, eventScript: string): Promise<boolean>;
    setEventActive(eventId: number, active: boolean): Promise<boolean>;
    deleteEvent(eventId: number): Promise<boolean>;
    getEvent(eventId: number): Promise<unknown>;
    /**
     * Erstellt die Kategorie-Pfadkette unter parentId. Für jedes Segment: existiert bereits eine
     * Kategorie mit diesem Namen unter dem aktuellen Parent, wird deren ID genutzt; sonst wird
     * eine neue Kategorie erstellt, benannt und als Kind zugeordnet.
     * @returns ObjectID der letzten Kategorie im Pfad (dort können Skripte/Events abgelegt werden).
     */
    getOrCreateCategoryPath(parentId: number, pathSegments: string[]): Promise<number>;
}
