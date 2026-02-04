/**
 * Persistente Wissensbasis: Geräte-Zuordnungen (z. B. „Büro Licht“ → Variable Zustand von EG-BU-LI-1).
 * Wird vom MCP-Server gelesen/geschrieben, damit die KI gelernte Zuordnungen nutzen kann.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

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

const DEFAULT_FILENAME = 'symcon-knowledge.json';

function getDataDir(): string {
  const envPath = process.env.SYMCON_KNOWLEDGE_PATH;
  if (envPath) return dirname(envPath);
  return join(process.cwd(), 'data');
}

function getFilePath(): string {
  const envPath = process.env.SYMCON_KNOWLEDGE_PATH;
  if (envPath) return envPath;
  return join(process.cwd(), 'data', DEFAULT_FILENAME);
}

export class KnowledgeStore {
  private filePath: string = getFilePath();
  private data: KnowledgeData = { deviceMappings: [] };
  private loaded = false;

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await readFile(this.filePath, 'utf8');
      this.data = JSON.parse(raw) as KnowledgeData;
      if (!Array.isArray(this.data.deviceMappings)) this.data.deviceMappings = [];
    } catch {
      this.data = { deviceMappings: [] };
    }
    this.loaded = true;
  }

  private async save(): Promise<void> {
    const dir = dirname(this.filePath);
    await mkdir(dir, { recursive: true });
    await writeFile(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
  }

  async getMappings(): Promise<DeviceMapping[]> {
    await this.ensureLoaded();
    return [...this.data.deviceMappings];
  }

  async addOrUpdateMapping(mapping: Omit<DeviceMapping, 'id'> & { id?: string }): Promise<DeviceMapping> {
    await this.ensureLoaded();
    const id = mapping.id ?? this.slug(mapping.userLabel);
    const existing = this.data.deviceMappings.find((m) => m.id === id);
    const entry: DeviceMapping = {
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
    } else {
      this.data.deviceMappings.push(entry);
    }
    await this.save();
    return entry;
  }

  /** Sucht anhand eines Nutzer-Phrase (z. B. "Büro Licht", "Licht im Büro") eine passende Zuordnung. */
  async resolve(userPhrase: string): Promise<DeviceMapping | null> {
    await this.ensureLoaded();
    const norm = this.normalize(userPhrase);
    if (!norm) return null;
    for (const m of this.data.deviceMappings) {
      if (this.normalize(m.userLabel).includes(norm) || norm.includes(this.normalize(m.userLabel))) return m;
    }
    return null;
  }

  private slug(label: string): string {
    return label
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  }

  private normalize(s: string): string {
    return s
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }
}

let defaultStore: KnowledgeStore | null = null;

export function getKnowledgeStore(): KnowledgeStore {
  if (!defaultStore) defaultStore = new KnowledgeStore();
  return defaultStore;
}
