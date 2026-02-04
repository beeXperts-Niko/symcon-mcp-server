/**
 * Persistente Wissensbasis: Geräte-Zuordnungen (z. B. „Büro Licht“ → Variable Zustand von EG-BU-LI-1).
 * Wird vom MCP-Server gelesen/geschrieben, damit die KI gelernte Zuordnungen nutzen kann.
 */
export interface DeviceMapping {
    /** Eindeutige ID (z. B. "buero-licht") */
    id: string;
    /** Nutzer-Label für Sprache: "Büro Licht", "Bürolicht", "Licht im Büro" */
    userLabel: string;
    /** Symcon VariableID (für SetValue/RequestAction) */
    variableId: number;
    /** Name der Variable in Symcon (z. B. "Zustand") */
    variableName: string;
    /** Optional: Pfad im Objektbaum (z. B. "Räume/Erdgeschoss/Büro/EG-BU-LI-1/Zustand") */
    path?: string;
    /** Optional: ObjectID des übergeordneten Geräts (z. B. EG-BU-LI-1) */
    objectId?: number;
}
export interface KnowledgeData {
    deviceMappings: DeviceMapping[];
}
export declare class KnowledgeStore {
    private filePath;
    private data;
    private loaded;
    private ensureLoaded;
    private save;
    getMappings(): Promise<DeviceMapping[]>;
    addOrUpdateMapping(mapping: Omit<DeviceMapping, 'id'> & {
        id?: string;
    }): Promise<DeviceMapping>;
    /** Sucht anhand eines Nutzer-Phrase (z. B. "Büro Licht", "Licht im Büro") eine passende Zuordnung. */
    resolve(userPhrase: string): Promise<DeviceMapping | null>;
    private slug;
    private normalize;
}
export declare function getKnowledgeStore(): KnowledgeStore;
