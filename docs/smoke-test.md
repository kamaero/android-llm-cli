# Smoke Test — android-llm-cli

Checklist for manual offline testing on Termux / desktop.

## Prerequisites

- Node.js >= 20 installed
- `npm install -g .` or install from tarball
- No config file required when using `--mock`

---

## 1. Basic chat mode (no config)

- `a-llmcli --mock` — starts without any config file
- Type a message → mock responds with "Hello from mock!"
- `Ctrl+C` exits cleanly
- `/clear` resets the conversation
- `/model` shows "mock / mock-model"
- `/help` shows available slash commands

## 2. Agent mode with tool confirmation

- `a-llmcli --mock --mode agent`
- Mock "calls" the `bash` tool: `echo hello from mock`
- **Confirmation prompt appears** with the command to execute
- Press Enter to confirm → tool result is displayed
- Session continues after tool result is shown

## 3. Offline independence

- `a-llmcli --mock` — works with zero internet access
- Disconnect network → still works
- No API keys, no config file needed

## 4. Crash recovery

- `a-llmcli --mock` → start chatting → `kill -9 <PID>`
- Restart: `a-llmcli --mock`
- **Recovery prompt appears** with WAL journal listing recent messages
- Recovery restores last ~5 messages

## 5. Environment context (mock + agent mode)

- Run `a-llmcli --mock --mode agent`
- Type "what environment am I in?"
- The **Termux environment prompt** should appear in the system context
- The `bash` tool schema should contain Termux-specific description

---

## Notes for reviewers

- `--mock` bypasses `loadConfig()` entirely — no config file is read or validated
- The MockProvider generates deterministic output with no external dependencies
- `--mock --mode agent` is the primary acceptance path: validates tool confirmation UI without live API
