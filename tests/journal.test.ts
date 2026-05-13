import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync, statSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import type { JournalEntry } from '../src/storage/journal.js';
import { JOURNAL_SUMMARY_MAX } from '../src/constants.js';

// ── Helpers ──

function makeTempDataDir(): string {
  const dir = join(tmpdir(), `a-llmcli-test-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function makeJournalEntry(overrides?: Partial<JournalEntry>): JournalEntry {
  return {
    id: randomUUID(),
    sessionId: randomUUID(),
    timestamp: Date.now(),
    role: 'assistant',
    outputSummary: 'The user asked about TypeScript generics.',
    ...overrides
  };
}

// ── Tests ──

describe('Journal storage', () => {
  let dataDir: string;
  let journalModule: typeof import('../src/storage/journal.js');

  beforeEach(async () => {
    dataDir = makeTempDataDir();
    process.env.XDG_DATA_HOME = dataDir;

    // Re-import to pick up new env
    journalModule = await import('../src/storage/journal.js');
  });

  afterEach(() => {
    if (existsSync(dataDir)) {
      rmSync(dataDir, { recursive: true, force: true });
    }
    delete process.env.XDG_DATA_HOME;
  });

  it('writeJournalEntry creates a journal.jsonl file', () => {
    const entry = makeJournalEntry();
    journalModule.writeJournalEntry(entry);

    const journalFile = join(dataDir, 'a-llmcli', 'journal', 'journal.jsonl');
    expect(existsSync(journalFile)).toBe(true);

    const raw = readFileSync(journalFile, 'utf-8').trim();
    const parsed = JSON.parse(raw) as JournalEntry;

    expect(parsed.id).toBe(entry.id);
    expect(parsed.sessionId).toBe(entry.sessionId);
    expect(parsed.role).toBe('assistant');
    expect(parsed.outputSummary).toBe(entry.outputSummary);
  });

  it('writeJournalEntry appends multiple entries', () => {
    const entry1 = makeJournalEntry();
    const entry2 = makeJournalEntry();

    journalModule.writeJournalEntry(entry1);
    journalModule.writeJournalEntry(entry2);

    const journalFile = join(dataDir, 'a-llmcli', 'journal', 'journal.jsonl');
    const raw = readFileSync(journalFile, 'utf-8').trim();
    const lines = raw.split('\n');

    expect(lines).toHaveLength(2);

    const parsed1 = JSON.parse(lines[0]) as JournalEntry;
    const parsed2 = JSON.parse(lines[1]) as JournalEntry;

    expect(parsed1.id).toBe(entry1.id);
    expect(parsed2.id).toBe(entry2.id);
  });

  it('creates artifact file when fullOutput > JOURNAL_SUMMARY_MAX (2KB)', () => {
    const entry = makeJournalEntry();

    const largeOutput = 'x'.repeat(JOURNAL_SUMMARY_MAX + 100);
    journalModule.writeJournalEntry(entry, largeOutput);

    // Check artifact file exists
    const artifactFile = join(
      dataDir,
      'a-llmcli',
      'journal',
      'artifacts',
      `${entry.id}.txt`
    );
    expect(existsSync(artifactFile)).toBe(true);

    const artifactContent = readFileSync(artifactFile, 'utf-8');
    expect(artifactContent).toBe(largeOutput);

    // Check journal entry references artifact
    const journalFile = join(dataDir, 'a-llmcli', 'journal', 'journal.jsonl');
    const raw = readFileSync(journalFile, 'utf-8').trim();
    const parsed = JSON.parse(raw) as JournalEntry;

    expect(parsed.artifactPath).toBe(
      `journal/artifacts/${entry.id}.txt`
    );
  });

  it('does NOT create artifact file when fullOutput <= JOURNAL_SUMMARY_MAX', () => {
    const entry = makeJournalEntry();
    const smallOutput = 'Small output';

    journalModule.writeJournalEntry(entry, smallOutput);

    const artifactDir = join(dataDir, 'a-llmcli', 'journal', 'artifacts');
    // Artifact directory might not even exist
    if (existsSync(artifactDir)) {
      const artifactFile = join(artifactDir, `${entry.id}.txt`);
      expect(existsSync(artifactFile)).toBe(false);
    }

    const journalFile = join(dataDir, 'a-llmcli', 'journal', 'journal.jsonl');
    const raw = readFileSync(journalFile, 'utf-8').trim();
    const parsed = JSON.parse(raw) as JournalEntry;
    expect(parsed.artifactPath).toBeUndefined();
  });

  it('journal.jsonl has mode 0o600', () => {
    const entry = makeJournalEntry();
    journalModule.writeJournalEntry(entry);

    const journalFile = join(dataDir, 'a-llmcli', 'journal', 'journal.jsonl');
    const stats = statSync(journalFile);
    const mode = stats.mode & 0o777;

    expect(mode).toBe(0o600);
  });

  it('artifact file has mode 0o600', () => {
    const entry = makeJournalEntry();
    const largeOutput = 'y'.repeat(JOURNAL_SUMMARY_MAX + 50);
    journalModule.writeJournalEntry(entry, largeOutput);

    const artifactFile = join(
      dataDir,
      'a-llmcli',
      'journal',
      'artifacts',
      `${entry.id}.txt`
    );
    const stats = statSync(artifactFile);
    const mode = stats.mode & 0o777;

    expect(mode).toBe(0o600);
  });

  it('session JSON file has mode 0o600', async () => {
    // Test that session files also have 0o600
    const sessionModule = await import('../src/storage/session.js');
    const indexModule = await import('../src/storage/sessionIndex.js');

    // We need a Session object
    const session = {
      id: randomUUID(),
      title: 'Test',
      provider: 'anthropic',
      model: 'claude-4',
      mode: 'chat' as const,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    sessionModule.saveSession(session);

    const sessionFile = join(
      dataDir,
      'a-llmcli',
      'sessions',
      `${session.id}.json`
    );
    const stats = statSync(sessionFile);
    const mode = stats.mode & 0o777;
    expect(mode).toBe(0o600);
  });
});
