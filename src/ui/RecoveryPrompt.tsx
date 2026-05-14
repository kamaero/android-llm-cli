import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { WalScanEntry } from '../storage/session.js';
import { useTheme } from '../theme.js';

interface RecoveryPromptProps {
  orphans: WalScanEntry[];
  onRecoverAll: () => Promise<void> | void;
  onDiscardAll: () => Promise<void> | void;
  onDone: () => void;
}

export function RecoveryPrompt({
  orphans,
  onRecoverAll,
  onDiscardAll,
  onDone,
}: RecoveryPromptProps) {
  const theme = useTheme();
  const [busyLabel, setBusyLabel] = useState<string | null>(null);

  useInput((input) => {
    const key = input.toLowerCase();
    if (busyLabel) {
      return;
    }

    if (key === 'y') {
      setBusyLabel('Recovering sessions…');
      void Promise.resolve(onRecoverAll())
        .then(onDone)
        .catch((err: unknown) => {
          setBusyLabel(`Error: ${err instanceof Error ? err.message : String(err)}`);
          setTimeout(() => setBusyLabel(null), 3000);
        });
      return;
    }

    if (key === 'd') {
      setBusyLabel('Discarding WAL files…');
      void Promise.resolve(onDiscardAll())
        .then(onDone)
        .catch((err: unknown) => {
          setBusyLabel(`Error: ${err instanceof Error ? err.message : String(err)}`);
          setTimeout(() => setBusyLabel(null), 3000);
        });
      return;
    }

    if (key === 's') {
      onDone();
    }
  });

  return (
    <Box flexDirection="column" width="100%" paddingX={1}>
      <Text bold color={theme.warning}>
        Recovery available
      </Text>
      <Text>
        Found {orphans.length} orphan {orphans.length === 1 ? 'session' : 'sessions'} from an interrupted
        stream.
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {orphans.map((orphan) => (
          <Text key={orphan.id}>
            {orphan.preview.slice(0, 60)}
          </Text>
        ))}
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text>[Y]es recover all</Text>
        <Text>[D]iscard all</Text>
        <Text>[S]kip for now</Text>
      </Box>
      {busyLabel ? (
        <Box marginTop={1}>
          <Text dimColor>{busyLabel}</Text>
        </Box>
      ) : null}
    </Box>
  );
}
