/**
 * Persistente Registry für MCP-Automationen (Skripte + Events).
 * Ermöglicht der KI, angelegte Automationen wiederzufinden, zu aktualisieren oder zu löschen,
 * statt Duplikate zu erzeugen.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

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

const DEFAULT_FILENAME = 'symcon-automations.json';

function getFilePath(): string {
  const envPath = process.env.SYMCON_AUTOMATIONS_PATH;
  if (envPath) return envPath;
  return join(process.cwd(), 'data', DEFAULT_FILENAME);
}

function slug(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export class AutomationStore {
  private filePath: string = getFilePath();
  private data: AutomationData = { automations: [] };
  private loaded = false;

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await readFile(this.filePath, 'utf8');
      this.data = JSON.parse(raw) as AutomationData;
      if (!Array.isArray(this.data.automations)) this.data.automations = [];
    } catch {
      this.data = { automations: [] };
    }
    this.loaded = true;
  }

  private async save(): Promise<void> {
    const dir = dirname(this.filePath);
    await mkdir(dir, { recursive: true });
    await writeFile(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
  }

  async getAll(): Promise<AutomationEntry[]> {
    await this.ensureLoaded();
    return [...this.data.automations];
  }

  async getById(id: string): Promise<AutomationEntry | null> {
    await this.ensureLoaded();
    return this.data.automations.find((a) => a.automationId === id) ?? null;
  }

  async getByLabel(label: string): Promise<AutomationEntry | null> {
    await this.ensureLoaded();
    const norm = normalize(label);
    return (
      this.data.automations.find((a) => normalize(a.label) === norm || normalize(a.label).includes(norm)) ?? null
    );
  }

  async getByTheme(theme: string): Promise<AutomationEntry[]> {
    await this.ensureLoaded();
    const norm = normalize(theme);
    return this.data.automations.filter((a) => a.theme && normalize(a.theme) === norm);
  }

  async getByRoom(room: string): Promise<AutomationEntry[]> {
    await this.ensureLoaded();
    const norm = normalize(room);
    return this.data.automations.filter((a) => a.room && normalize(a.room) === norm);
  }

  async addOrUpdate(entry: Omit<AutomationEntry, 'automationId' | 'createdAt'> & { automationId?: string; createdAt?: string }): Promise<AutomationEntry> {
    await this.ensureLoaded();
    const id = entry.automationId ?? slug(entry.label);
    const existing = this.data.automations.find((a) => a.automationId === id);
    const now = new Date().toISOString();
    const full: AutomationEntry = {
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
    } else {
      this.data.automations.push(full);
    }
    await this.save();
    return full;
  }

  async remove(id: string): Promise<boolean> {
    await this.ensureLoaded();
    const idx = this.data.automations.findIndex((a) => a.automationId === id);
    if (idx === -1) return false;
    this.data.automations.splice(idx, 1);
    await this.save();
    return true;
  }
}

let defaultStore: AutomationStore | null = null;

export function getAutomationStore(): AutomationStore {
  if (!defaultStore) defaultStore = new AutomationStore();
  return defaultStore;
}
