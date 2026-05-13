import {
  writeFileSync,
  readFileSync,
  appendFileSync,
  renameSync,
  existsSync,
  unlinkSync
} from 'fs';
import { join } from 'path';
import type { Session, StreamChunk } from '../types.js';
import { getDataDir, ensureDir } from '../paths.js';

function sessionsDir(): string {
  const dir = join(getDataDir(), 'sessions');
  ensureDir(dir);
  return dir;
}

function sessionPath(id: string): string {
  return join(sessionsDir(), `${id}.json`);
}

function walPath(id: string): string {
  return join(sessionsDir(), `${id}.wal`);
}

/**
 * Atomically save a session: writes to a temporary file, then renames
 * to the final path to avoid partial writes on crash.
 */
export function saveSession(session: Session): void {
  const target = sessionPath(session.id);
  const tmp = `${target}.tmp.${Date.now()}`;

  const json = JSON.stringify(session, null, 2);
  writeFileSync(tmp, json, { mode: 0o600 });
  renameSync(tmp, target);
}

/**
 * Load a session from its JSON file.
 * Throws if the session file does not exist.
 */
export function loadSession(id: string): Session {
  const path = sessionPath(id);
  const raw = readFileSync(path, 'utf-8');
  return JSON.parse(raw) as Session;
}

/**
 * Append a single StreamChunk as a JSONL line to the WAL file.
 */
export function appendWalEntry(id: string, chunk: StreamChunk): void {
  const path = walPath(id);
  appendFileSync(path, JSON.stringify(chunk) + '\n', { mode: 0o600 });
}

/**
 * Recover stream chunks from the WAL file.
 * Returns an empty array if the WAL file does not exist.
 */
export function recoverFromWal(id: string): StreamChunk[] {
  const path = walPath(id);

  if (!existsSync(path)) {
    return [];
  }

  const raw = readFileSync(path, 'utf-8').trim();
  if (raw === '') {
    return [];
  }

  const lines = raw.split('\n');
  const chunks: StreamChunk[] = [];

  for (const line of lines) {
    if (line.trim() === '') continue;
    chunks.push(JSON.parse(line) as StreamChunk);
  }

  return chunks;
}

/**
 * Remove a session file (for cleanup after recovery, etc.).
 */
export function deleteSessionFile(id: string): void {
  const sPath = sessionPath(id);
  if (existsSync(sPath)) {
    unlinkSync(sPath);
  }
}

/**
 * Remove a WAL file.
 */
export function deleteWalFile(id: string): void {
  const wPath = walPath(id);
  if (existsSync(wPath)) {
    unlinkSync(wPath);
  }
}
