/**
 * Persistente Wissensbasis: Geräte-Zuordnungen (z. B. „Büro Licht“ → Variable Zustand von EG-BU-LI-1).
 * Wird vom MCP-Server gelesen/geschrieben, damit die KI gelernte Zuordnungen nutzen kann.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_FILENAME = 'symcon-knowledge.json';
function getDataDir() {
    const envPath = process.env.SYMCON_KNOWLEDGE_PATH;
    if (envPath)
        return dirname(envPath);
    return join(process.cwd(), 'data');
}
function getFilePath() {
    const envPath = process.env.SYMCON_KNOWLEDGE_PATH;
    if (envPath)
        return envPath;
    return join(process.cwd(), 'data', DEFAULT_FILENAME);
}
export class KnowledgeStore {
    filePath = getFilePath();
    data = { deviceMappings: [] };
    loaded = false;
    async ensureLoaded() {
        if (this.loaded)
            return;
        try {
            const raw = await readFile(this.filePath, 'utf8');
            this.data = JSON.parse(raw);
            if (!Array.isArray(this.data.deviceMappings))
                this.data.deviceMappings = [];
        }
        catch {
            this.data = { deviceMappings: [] };
        }
        this.loaded = true;
    }
    async save() {
        const dir = dirname(this.filePath);
        await mkdir(dir, { recursive: true });
        await writeFile(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
    }
    async getMappings() {
        await this.ensureLoaded();
        return [...this.data.deviceMappings];
    }
    async addOrUpdateMapping(mapping) {
        await this.ensureLoaded();
        const id = mapping.id ?? this.slug(mapping.userLabel);
        const existing = this.data.deviceMappings.find((m) => m.id === id);
        const entry = {
            id,
            userLabel: mapping.userLabel.trim(),
            variableId: mapping.variableId,
            variableName: mapping.variableName.trim(),
            path: mapping.path?.trim(),
            objectId: mapping.objectId,
        };
        if (existing) {
            const idx = this.data.deviceMappings.indexOf(existing);
            this.data.deviceMappings[idx] = entry;
        }
        else {
            this.data.deviceMappings.push(entry);
        }
        await this.save();
        return entry;
    }
    /** Sucht anhand eines Nutzer-Phrase (z. B. "Büro Licht", "Licht im Büro") eine passende Zuordnung. */
    async resolve(userPhrase) {
        await this.ensureLoaded();
        const norm = this.normalize(userPhrase);
        if (!norm)
            return null;
        for (const m of this.data.deviceMappings) {
            if (this.normalize(m.userLabel).includes(norm) || norm.includes(this.normalize(m.userLabel)))
                return m;
        }
        return null;
    }
    slug(label) {
        return label
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');
    }
    normalize(s) {
        return s
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ');
    }
}
let defaultStore = null;
export function getKnowledgeStore() {
    if (!defaultStore)
        defaultStore = new KnowledgeStore();
    return defaultStore;
}
