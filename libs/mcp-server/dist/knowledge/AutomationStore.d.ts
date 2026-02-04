/**
 * Persistente Registry für MCP-Automationen (Skripte + Events).
 * Ermöglicht der KI, angelegte Automationen wiederzufinden, zu aktualisieren oder zu löschen,
 * statt Duplikate zu erzeugen.
 */
export interface AutomationEntry {
    /** Eindeutige ID (Slug, z. B. "ambiente-licht-zeiten") */
    automationId: string;
    /** Lesbares Label (z. B. "Ambiente-Licht Zeiten") */
    label: string;
    /** Pfad der Kategorie im Objektbaum (z. B. ["MCP Automations", "Ambiente"]) */
    categoryPath: string[];
    /** Symcon ScriptID */
    scriptId: number;
    /** Symcon EventIDs (bei mehreren Zeitpunkten) */
    eventIds: number[];
    /** Optional: Raum (z. B. "Büro") */
    room?: string;
    /** Optional: Thema (z. B. "Timer", "Beleuchtung", "Ambiente") */
    theme?: string;
    /** Erstellungszeitpunkt (ISO-String) */
    createdAt: string;
}
export interface AutomationData {
    automations: AutomationEntry[];
}
export declare class AutomationStore {
    private filePath;
    private data;
    private loaded;
    private ensureLoaded;
    private save;
    getAll(): Promise<AutomationEntry[]>;
    getById(id: string): Promise<AutomationEntry | null>;
    getByLabel(label: string): Promise<AutomationEntry | null>;
    getByTheme(theme: string): Promise<AutomationEntry[]>;
    getByRoom(room: string): Promise<AutomationEntry[]>;
    addOrUpdate(entry: Omit<AutomationEntry, 'automationId' | 'createdAt'> & {
        automationId?: string;
        createdAt?: string;
    }): Promise<AutomationEntry>;
    remove(id: string): Promise<boolean>;
}
export declare function getAutomationStore(): AutomationStore;
