# Full Codebase Fix + Security Model Redesign

## Part 1: Fix All 14 Bugs

### CRITICAL

**Bug #1 — anthropic.ts: tool call input always {}**
File: `src/providers/anthropic.ts`
Problem: `content_block_start` with type `tool_use` emits tool_call immediately, but at that point `input` is always `{}`. The actual input arrives via `content_block_delta` with `type: 'input_json_delta'`. The parser ignores input_json_delta entirely.
Fix: Accumulate input_json_delta in a map keyed by block index, then emit the full tool_call at `content_block_stop` with accumulated input.

**Bug #2 — setup.ts: readline created at module level**
File: `src/setup.ts:11`
Problem: `const rl = readline.createInterface(...)` runs at module import time. If the app starts without setup, this readline clutters stdin and conflicts with Ink's raw mode.
Fix: Move `rl` inside the `setup()` function body. Only create it when setup actually runs.

### MAJOR

**Bug #3 — MessageItem.tsx: React.memo comparator ignores tool_calls**
File: `src/ui/MessageItem.tsx:187-196`
Problem: The custom comparator only checks `id`, `content`, `role`, `tool_result`. When tool_calls updates (streaming tool_call event), the component doesn't re-render.
Fix: Add `a.tool_calls !== b.tool_calls` to the comparator.

**Bug #4 — RecoveryPrompt.tsx: Promise rejections silently swallowed**
File: `src/ui/RecoveryPrompt.tsx:28,34`
Problem: `void Promise.resolve(onRecoverAll()).then(onDone)` — if onRecoverAll() rejects, the rejection is unhandled. The UI stays in "busy" state forever.
Fix: Add `.catch((err) => { setBusyLabel(null); ... })` to handle rejection gracefully.

**Bug #5 — agentLoop.ts: retry dispatches RESUME_STREAMING in wrong state**
File: `src/agent/agentLoop.ts:96-100`
Problem: On retry, `RESUME_STREAMING` is dispatched inside the retry callback, but the app state may still be in 'streaming' status from the previous attempt.
Fix: The retry should cleanly reset state before starting the new stream attempt.

**Bug #6 — agentLoop.ts: requiresConfirmation only checks bashConfirmation**
File: `src/agent/agentLoop.ts:84`
Problem: `const requiresConfirmation = sessionPolicy.bashConfirmation === 'always'` ignores file/network/peripheral policies. All tool types get the same treatment.
Fix: This will be eliminated by the security model redesign (Part 2). Remove `requiresConfirmation` flag entirely.

**Bug #7 — setup.ts: buildYaml doesn't escape API key**
File: `src/setup.ts`
Problem: When writing the YAML config, the API key is interpolated directly. A key containing `&`, `:`, `#`, `%` would break YAML parsing.
Fix: Properly escape the API key value before inserting into YAML, or use a YAML library.

### MINOR

**Bug #8 — app.tsx: dead mode state variable**
File: `src/app.tsx:403`
Problem: `const [mode] = useState<'chat' | 'agent'>(config.default_mode)` — `mode` is never read.
Fix: Remove unused state variable.

**Bug #9 — sessionIndex.ts: dead existsSync after ensureDir**
File: `src/storage/sessionIndex.ts`
Problem: `ensureDir` is called before `existsSync` check — the check is always true.
Fix: Remove the redundant existsSync check.

**Bug #10 — StatusBar.tsx: misleading comment + triple reduce**
File: `src/ui/StatusBar.tsx:17-22, 61-73`
Problem: Comment says "only from the last message" but code reduces all messages. The React.memo comparator also does two full reduces. Tokens computed 3× per render.
Fix: Update comment. In memo comparator, compare only last message tokens. In render, compute tokens only once.

**Bug #11 — readFile.ts: isSensitivePath too broad**
File: `src/tools/readFile.ts:15`
Problem: `/[/\\]config\.(yaml|yml)$/` blocks ANY config.yaml anywhere, not just the app's config.
Fix: Remove the generic config.yaml rule. The app's config is already covered by `[/\\\\]\.config[/\\\\]a-llmcli[/\\\\]`.

**Bug #12 — anthropic.ts: input_tokens always 0**
File: `src/providers/anthropic.ts:141-147`
Problem: `message_delta.usage.input_tokens` is always undefined. message_start (which has real input_tokens) is not handled.
Fix: Add `case 'message_start'` that captures `event.message.usage.input_tokens`. In `message_delta`, set inputTokens to 0 and outputTokens from event.usage.output_tokens.

**Bug #13 — setup.ts: UI in Russian**
File: `src/setup.ts:176-295`
Problem: All setup wizard prompts are in Russian, but the rest of the project is English.
Fix: Translate all prompts to English.

**Bug #14 — setup.ts: xAI test URL missing /v1**
File: `src/setup.ts:137`
Problem: For xAI, baseUrl is `https://api.x.ai`, test URL becomes `https://api.x.ai/chat/completions` instead of `https://api.x.ai/v1/chat/completions`. Always 404.
Fix: Normalize baseUrl to include `/v1` before appending the path.

---

## Part 2: Redesign Security Model

The current model is over-engineered: 4 confirmation dimensions (bash/file/network/peripheral) × 3 modes each + 3 profiles. Simplify to 2 clean modes.

### New Config

Replace `session_policy` block with:

```yaml
# ---- Security ----
security:
  mode: normal               # "normal" or "hardcore"
  workspace_root: "$HOME/projects"
```

Remove from types.ts:
- `ProfileType` enum  
- `SessionPolicy` interface
- All 4 confirmation fields

Add:
- `SecurityMode: 'normal' | 'hardcore'`
- `SecurityConfig: { mode: SecurityMode; workspaceRoot: string }`

### Normal Mode Behavior

**Auto-run (no confirm) in bash tool:**
- `pwd`, `ls`, `find`, `grep`, `cat` — but ONLY when path/args are inside workspace
- `git status`, `git diff`, `git log`
- `npm test`
- `npm run build`, `npm run *`
- `node`, `tsc`, `python3`, `python` (running scripts inside workspace)
- `mkdir` inside workspace
- `touch` inside workspace
- `cd`, `echo`

**Ask for confirm in bash tool:**
- `rm`, `mv`, `chmod`, `chown`
- `pkg install`, `apt`, `apt-get`, `npm install`, `pip install`
- `curl`, `wget`
- `ssh`, `scp`
- Any command with `sudo`
- Any command with `|` (pipes — too hard to classify)
- Any command NOT in the auto-run list

**Auto-run in write_file tool:**
- Inside workspace root — auto-approve, but show compact diff in UI (not per-file confirm, just visual feedback)
- Outside workspace — ask for confirm

**Auto-run in read_file tool:**
- Inside workspace — auto-run
- Paths matching `.ssh`, `.env`, `.config/a-llmcli`, `config.yaml` — ask for confirm

**Ask for ALL other tools:**
- Any custom tool that isn't bash/read_file/write_file

### Hardcore Mode Behavior

No confirmations for ANY tool. Full send. Agent auto-executes everything.

### Architecture Changes

1. Remove `formatSessionPolicy` — replace with `formatSecurityConfig` that tells the LLM what mode it's in and what tools it can auto-run vs ask.

2. In `agentLoop.ts`:
   - Replace `requiresConfirmation = sessionPolicy.bashConfirmation === 'always'`
   - With `needsConfirm(toolCall, securityConfig): boolean` — classifies each tool call

3. In `ToolConfirmBox.tsx`:
   - In normal mode, show the confirm box only for tools that `needsConfirm()`
   - Show COMPACT DIFF for write_file operations (show the actual changed content inline)
   - In hardcore mode, skip confirm entirely

4. Update `config.example.yaml` with new security block

5. Update `schemas.ts` — replace `SessionPolicySchema` with `SecuritySchema`

6. Remove dead config: `dry_run_first` field

### Implementation Order

1. First fix all bugs from Part 1
2. Then implement Part 2 redesign
3. Update config.example.yaml
4. Verify TypeScript compiles with `npm run build`

### Don't touch
- The core provider streaming logic (anthropic.ts streaming, openai.ts streaming)
- The storage/session.ts persistence layer
- The message types (they work fine)
- The Ink layout structure (Layout.tsx)
