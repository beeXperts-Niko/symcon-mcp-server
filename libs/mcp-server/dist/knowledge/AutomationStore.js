/**
 * Persistente Registry für MCP-Automationen (Skripte + Events).
 * Ermöglicht der KI, angelegte Automationen wiederzufinden, zu aktualisieren oder zu löschen,
 * statt Duplikate zu erzeugen.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
const DEFAULT_FILENAME = 'symcon-automations.json';
function getFilePath() {
    const envPath = process.env.SYMCON_AUTOMATIONS_PATH;
    if (envPath)
        return envPath;
    return join(process.cwd(), 'data', DEFAULT_FILENAME);
}
function slug(label) {
    return label
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
}
function normalize(s) {
    return s
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}
export class AutomationStore {
    filePath = getFilePath();
    data = { automations: [] };
    loaded = false;
    async ensureLoaded() {
        if (this.loaded)
            return;
        try {
            const raw = await readFile(this.filePath, 'utf8');
            this.data = JSON.parse(raw);
            if (!Array.isArray(this.data.automations))
                this.data.automations = [];
        }
        catch {
            this.data = { automations: [] };
        }
        this.loaded = true;
    }
    async save() {
        const dir = dirname(this.filePath);
        await mkdir(dir, { recursive: true });
        await writeFile(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
    }
    async getAll() {
        await this.ensureLoaded();
        return [...this.data.automations];
    }
    async getById(id) {
        await this.ensureLoaded();
        return this.data.automations.find((a) => a.automationId === id) ?? null;
    }
    async getByLabel(label) {
        await this.ensureLoaded();
        const norm = normalize(label);
        return (this.data.automations.find((a) => normalize(a.label) === norm || normalize(a.label).includes(norm)) ?? null);
    }
    async getByTheme(theme) {
        await this.ensureLoaded();
        const norm = normalize(theme);
        return this.data.automations.filter((a) => a.theme && normalize(a.theme) === norm);
    }
    async getByRoom(room) {
        await this.ensureLoaded();
        const norm = normalize(room);
        return this.data.automations.filter((a) => a.room && normalize(a.room) === norm);
    }
    async addOrUpdate(entry) {
        await this.ensureLoaded();
        const id = entry.automationId ?? slug(entry.label);
        const existing = this.data.automations.find((a) => a.automationId === id);
        const now = new Date().toISOString();
        const full = {
            automationId: id,
            label: entry.label.trim(),
            categoryPath: entry.categoryPath,
            scriptId: entry.scriptId,
            eventIds: entry.eventIds ?? [],
            room: entry.room?.trim(),
            theme: entry.theme?.trim(),
            createdAt: entry.createdAt ?? (existing?.createdAt ?? now),
        };
        if (existing) {
            const idx = this.data.automations.indexOf(existing);
            this.data.automations[idx] = full;
        }
        else {
            this.data.automations.push(full);
        }
        await this.save();
        return full;
    }
    async remove(id) {
        await this.ensureLoaded();
        const idx = this.data.automations.findIndex((a) => a.automationId === id);
        if (idx === -1)
            return false;
        this.data.automations.splice(idx, 1);
        await this.save();
        return true;
    }
}
let defaultStore = null;
export function getAutomationStore() {
    if (!defaultStore)
        defaultStore = new AutomationStore();
    return defaultStore;
}
