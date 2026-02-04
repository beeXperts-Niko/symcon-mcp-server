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
    /**
     * Normalisiert den Wert für SetValue/RequestAction.
     * Symcon erwartet bei Float-Variablen (z. B. Level ~Intensity.1) einen passenden Typ;
     * über JSON-RPC werden ganze Zahlen als Integer übergeben, was zu "Parameter type of Value does not match" führt.
     * Zahlen werden daher als String gesendet, damit Symcon sie in den Variablentyp konvertieren kann.
     */
    private normalizeValue;
    setValue(variableId: number, value: unknown): Promise<void>;
    requestAction(variableId: number, value?: unknown): Promise<void>;
    getObject(objectId: number): Promise<unknown>;
    getChildrenIds(parentId: number): Promise<number[]>;
    runScript(scriptId: number): Promise<unknown>;
    /**
     * Startet ein Skript mit Parametern (asynchron). Das aufgerufene Skript erhält die Keys
     * von params in $_IPS (z. B. params.VariableID → $_IPS['VariableID']).
     */
    runScriptEx(scriptId: number, params: Record<string, unknown>): Promise<unknown>;
    getObjectIdByName(name: string, parentId?: number): Promise<number>;
    getVariable(variableId: number): Promise<unknown>;
    createCategory(): Promise<number>;
    setName(objectId: number, name: string): Promise<boolean>;
    setParent(objectId: number, parentId: number): Promise<boolean>;
    createScript(scriptType: number): Promise<number>;
    setScriptContent(scriptId: number, content: string): Promise<boolean>;
    getScriptContent(scriptId: number): Promise<string>;
    deleteScript(scriptId: number, deleteFile?: boolean): Promise<boolean>;
    getScriptIdByName(scriptName: string, parentId: number): Promise<number>;
    /** Erstellt eine Benutzer-Variable (Typ 0=Boolean, 1=Integer, 2=Float, 3=String). */
    createVariable(variableType: number): Promise<number>;
    createEvent(eventType: number): Promise<number>;
    setEventCyclic(eventId: number, dateType: number, dateInterval: number, dateDay: number, dateDayInterval: number, timeType: number, timeInterval: number): Promise<boolean>;
    setEventCyclicDateBounds(eventId: number, fromDate: number, toDate: number): Promise<boolean>;
    setEventCyclicTimeBounds(eventId: number, fromTime: number, toTime: number): Promise<boolean>;
    setEventScript(eventId: number, eventScript: string): Promise<boolean>;
    setEventActive(eventId: number, active: boolean): Promise<boolean>;
    deleteEvent(eventId: number): Promise<boolean>;
    getEvent(eventId: number): Promise<unknown>;
    /** Name des MCP-Control-Skripts für verzögerte Aktionen (Timer). Wird unter MCP Automations/Timer angelegt. */
    static readonly MCP_DELAYED_ACTION_CONTROL_SCRIPT_NAME = "MCP Delayed Action Control";
    /**
     * Erstellt oder liefert die Script-ID des MCP Control-Skripts für verzögerte Aktionen.
     * Das Skript erwartet per IPS_RunScriptEx: VariableID, Value, DelaySeconds.
     * Es erzeugt ein einmaliges Skript (sleep → RequestAction → IPS_DeleteScript(self, true)) und startet es asynchron.
     */
    getOrCreateDelayedActionControlScript(): Promise<number>;
    /**
     * Erstellt die Kategorie-Pfadkette unter parentId. Für jedes Segment: existiert bereits eine
     * Kategorie mit diesem Namen unter dem aktuellen Parent, wird deren ID genutzt; sonst wird
     * eine neue Kategorie erstellt, benannt und als Kind zugeordnet.
     * @returns ObjectID der letzten Kategorie im Pfad (dort können Skripte/Events abgelegt werden).
     */
    getOrCreateCategoryPath(parentId: number, pathSegments: string[]): Promise<number>;
}
