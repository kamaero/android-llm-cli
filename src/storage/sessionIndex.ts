import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  statSync
} from 'fs';
import { join } from 'path';
import type { Session } from '../types.js';
import { getDataDir, ensureDir } from '../paths.js';

// ── Types ──

export interface SessionIndexEntry {
  id: string;
  title: string;
  provider: string;
  model: string;
  mode: string;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
}

// ── Helpers ──

function indexPath(): string {
  return join(getDataDir(), 'index.json');
}

function sessionsDirPath(): string {
  return join(getDataDir(), 'sessions');
}

function indexDir(): string {
  ensureDir(getDataDir());
  return getDataDir();
}

// ── Public API ──

/**
 * Read the session index from index.json.
 * Returns an empty array if the index file does not exist.
 */
export function getIndex(): SessionIndexEntry[] {
  const path = indexPath();
  indexDir();

  if (!existsSync(path)) {
    return [];
  }

  const raw = readFileSync(path, 'utf-8').trim();
  if (raw === '') {
    return [];
  }

  return JSON.parse(raw) as SessionIndexEntry[];
}

/**
 * Write the full index array to index.json (overwrites).
 */
function writeIndex(entries: SessionIndexEntry[]): void {
  const path = indexPath();
  indexDir();
  writeFileSync(path, JSON.stringify(entries, null, 2), { mode: 0o600 });
}

/**
 * Extract an index entry from a Session.
 */
export function sessionToIndexEntry(session: Session): SessionIndexEntry {
  return {
    id: session.id,
    title: session.title,
    provider: session.provider,
    model: session.model,
    mode: session.mode,
    messageCount: session.messages.length,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt
  };
}

/**
 * Upsert an index entry for the given session:
 *   - if an entry with the same id exists, update it
 *   - otherwise, append a new entry
 */
export function upsertIndexEntry(session: Session): void {
  const entries = getIndex();
  const entry = sessionToIndexEntry(session);

  const idx = entries.findIndex((e) => e.id === session.id);
  if (idx >= 0) {
    entries[idx] = entry;
  } else {
    entries.push(entry);
  }

  writeIndex(entries);
}

/**
 * Rebuild the index by scanning all .json session files in the sessions/
 * directory. This is a recovery operation — it overwrites index.json
 * with entries derived from every session file found on disk.
 */
export function rebuildIndex(): SessionIndexEntry[] {
  const dir = sessionsDirPath();
  ensureDir(dir);

  const entries: SessionIndexEntry[] = [];
  const files = readdirSync(dir);

  for (const file of files) {
    if (!file.endsWith('.json')) continue;

    const fullPath = join(dir, file);
    try {
      const raw = readFileSync(fullPath, 'utf-8');
      const session = JSON.parse(raw) as Session;
      entries.push(sessionToIndexEntry(session));
    } catch {
      // Skip corrupted files silently — they'll be visible by absence
      continue;
    }
  }

  // Sort by updatedAt descending (newest first)
  entries.sort((a, b) => b.updatedAt - a.updatedAt);

  writeIndex(entries);
  return entries;
}
