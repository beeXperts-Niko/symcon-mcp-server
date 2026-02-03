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
export declare class SymconClient {
    private readonly baseUrl;
    private readonly timeoutMs;
    private requestId;
    constructor(baseUrl: string, timeoutMs?: number);
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
}
