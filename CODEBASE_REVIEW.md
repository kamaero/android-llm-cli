# Full Codebase Review: android-llm-cli

You are a senior code reviewer. Perform a thorough audit of the **entire codebase** in `/root/projects/android-llm-cli/src/`. Look for:

## 1. BUGS
- Race conditions (async state, stale closures in Ink components)
- Memory leaks (unsubscribed listeners, orphaned refs)
- Off-by-one, null/undefined crashes (consider `useStdin`/`useInput` edge cases)
- Incorrect state transitions
- Any `any` or `as unknown` that could mask a real bug

## 2. TYPE SAFETY
- Missing or incorrect TypeScript types
- Incorrect discriminated union checks (especially in `appReducer`)
- Unused or dead code paths

## 3. INK / TERMINAL ISSUES
- Components missing `React.memo` that cause unnecessary re-renders
- Cursor positioning issues (especially `InputBox.tsx` cursor rendering)
- Text wrapping or overflow problems
- Race between state updates and Ink's render cycle

## 4. PERFORMANCE
- Unnecessary re-renders (especially during streaming — only the last message should update)
- Inefficient array operations in render path (e.g., `reduce` in `StatusBar`)
- Large objects recreated every render

## 5. UX ON MOBILE (TERMUX)
- Does any component assume full terminal width?
- Are there hardcoded dimensions that break on narrow screens?
- Does the tool confirmation flow work without mouse?

## 6. SECURITY
- Do any tool results get rendered unsanitized?
- Are there any code injection vectors via message content?
- Are SSH keys, tokens, or environment variables at risk?

## Rules
- Be specific: file, line number, why it's a problem, how to fix
- Prioritize actual bugs over style nits
- Ignore formatting/prettier issues
- If you find 5+ bugs, rank them by severity (critical > major > minor)
