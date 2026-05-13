import {
  appendFileSync,
  writeFileSync,
  existsSync,
  chmodSync,
  mkdirSync
} from 'fs';
import { join } from 'path';
import { getDataDir, ensureDir } from '../paths.js';
import { JOURNAL_SUMMARY_MAX, ARTIFACT_MAX_BYTES } from '../constants.js';

// ── Types ──

export interface JournalEntry {
  id: string;
  sessionId: string;
  timestamp: number;
  role: string; // 'user' | 'assistant' | 'tool'
  outputSummary: string;
  artifactPath?: string;
}

// ── Helpers ──

function journalDir(): string {
  const dir = join(getDataDir(), 'journal');
  ensureDir(dir);
  return dir;
}

function journalPath(): string {
  return join(journalDir(), 'journal.jsonl');
}

function artifactsDir(): string {
  const dir = join(journalDir(), 'artifacts');
  ensureDir(dir);
  return dir;
}

/**
 * Write a journal entry as a JSONL line.
 *
 * If fullOutput is provided and exceeds JOURNAL_SUMMARY_MAX (2 KB),
 * the full output is saved as a separate artifact file under
 * `journal/artifacts/<entry-id>.txt` and the JSONL entry records
 * the artifact path instead of the full output.
 *
 * Writes with mode 0o600 for security (API keys may appear in output).
 */
export function writeJournalEntry(entry: JournalEntry, fullOutput?: string): void {
  if (fullOutput !== undefined && fullOutput.length > JOURNAL_SUMMARY_MAX) {
    // Write artifact file
    const artifactDir = artifactsDir();
    const artifactFile = join(artifactDir, `${entry.id}.txt`);

    // Truncate to ARTIFACT_MAX_BYTES to prevent disk blow-up
    const truncated = fullOutput.slice(0, ARTIFACT_MAX_BYTES);
    writeFileSync(artifactFile, truncated, { mode: 0o600 });

    // Store relative path in the journal entry
    entry.artifactPath = join('journal', 'artifacts', `${entry.id}.txt`);
  }

  const dir = journalDir();
  const path = journalPath();

  // Ensure directory and file exist with correct permissions
  if (!existsSync(path)) {
    writeFileSync(path, '', { mode: 0o600 });
  }

  appendFileSync(path, JSON.stringify(entry) + '\n', { mode: 0o600 });
}
