import React, { useState, useEffect, memo } from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../theme.js';

interface ProgressIndicatorProps {
  type: 'streaming' | 'tool' | 'retry';
  message?: string;
  progress?: number; // 0-100 for progress bar
  speed?: number; // tokens/sec for streaming
  attempt?: number; // for retry
  maxAttempts?: number; // for retry
  animated?: boolean;
}

// Animation frames for spinner
const SPINNER_FRAMES = ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'];
const DOT_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

function useAnimation(frames: string[], interval = 100): string {
  const [currentFrame, setCurrentFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentFrame(prev => (prev + 1) % frames.length);
    }, interval);

    return () => clearInterval(timer);
  }, [frames, interval]);

  return frames[currentFrame];
}

function ProgressBar({ progress, width = 20, fillChar = '█', emptyChar = '░' }: {
  progress: number;
  width?: number;
  fillChar?: string;
  emptyChar?: string;
}) {
  const filled = Math.round((progress / 100) * width);
  const empty = width - filled;

  return (
    <Text>
      {fillChar.repeat(filled)}
      {emptyChar.repeat(empty)}
    </Text>
  );
}

function StreamingIndicator({ speed, animated = true }: {
  speed?: number;
  animated?: boolean;
}) {
  const theme = useTheme();
  const spinner = useAnimation(animated ? SPINNER_FRAMES : [SPINNER_FRAMES[0]], 120);

  return (
    <Box flexDirection="row" columnGap={1}>
      <Text color={theme.accent}>{spinner}</Text>
      <Text color={theme.accent}>Streaming</Text>
      {speed && (
        <Text dimColor>({Math.round(speed)} tok/s)</Text>
      )}
    </Box>
  );
}

function ToolIndicator({ message, progress, animated = true }: {
  message?: string;
  progress?: number;
  animated?: boolean;
}) {
  const theme = useTheme();
  const spinner = useAnimation(animated ? DOT_FRAMES : [DOT_FRAMES[0]], 80);

  return (
    <Box flexDirection="column">
      <Box flexDirection="row" columnGap={1}>
        <Text color={theme.warning}>{spinner}</Text>
        <Text color={theme.warning}>Running tool</Text>
        {message && <Text>{message}</Text>}
      </Box>
      {typeof progress === 'number' && (
        <Box flexDirection="row" columnGap={1} marginTop={0}>
          <ProgressBar progress={progress} />
          <Text dimColor>{Math.round(progress)}%</Text>
        </Box>
      )}
    </Box>
  );
}

function RetryIndicator({ attempt = 1, maxAttempts = 3, animated = true }: {
  attempt?: number;
  maxAttempts?: number;
  animated?: boolean;
}) {
  const theme = useTheme();
  const spinner = useAnimation(animated ? ['⟲', '⟳'] : ['⟲'], 200);

  return (
    <Box flexDirection="row" columnGap={1}>
      <Text color={theme.error}>{spinner}</Text>
      <Text color={theme.error}>Retrying</Text>
      <Text dimColor>({attempt}/{maxAttempts})</Text>
    </Box>
  );
}

export const ProgressIndicator = memo(function ProgressIndicator({
  type,
  message,
  progress,
  speed,
  attempt,
  maxAttempts,
  animated = true,
}: ProgressIndicatorProps) {
  const theme = useTheme();

  switch (type) {
    case 'streaming':
      return <StreamingIndicator speed={speed} animated={animated} />;

    case 'tool':
      return <ToolIndicator message={message} progress={progress} animated={animated} />;

    case 'retry':
      return <RetryIndicator attempt={attempt} maxAttempts={maxAttempts} animated={animated} />;

    default:
      return (
        <Box flexDirection="row" columnGap={1}>
          <Text color={theme.dim}>⏳</Text>
          <Text>{message || 'Working...'}</Text>
        </Box>
      );
  }
});

// Specific indicator components for common use cases
export function StreamingProgressIndicator({ speed }: { speed?: number }) {
  return <ProgressIndicator type="streaming" speed={speed} />;
}

export function ToolProgressIndicator({
  message,
  progress
}: {
  message?: string;
  progress?: number;
}) {
  return <ProgressIndicator type="tool" message={message} progress={progress} />;
}

export function RetryProgressIndicator({
  attempt,
  maxAttempts
}: {
  attempt?: number;
  maxAttempts?: number;
}) {
  return <ProgressIndicator type="retry" attempt={attempt} maxAttempts={maxAttempts} />;
}

// Speed calculator hook for streaming
export function useStreamingSpeed() {
  const [tokens, setTokens] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [speed, setSpeed] = useState(0);

  const addTokens = (count: number) => {
    if (startTime === null) {
      setStartTime(Date.now());
    }
    setTokens(prev => {
      const newTotal = prev + count;
      if (startTime !== null) {
        const elapsed = (Date.now() - startTime) / 1000;
        setSpeed(elapsed > 0 ? newTotal / elapsed : 0);
      }
      return newTotal;
    });
  };

  const reset = () => {
    setTokens(0);
    setStartTime(null);
    setSpeed(0);
  };

  return { speed, addTokens, reset };
}

// Token counter hook - estimates tokens from text
export function useTokenCounter() {
  const [totalTokens, setTotalTokens] = useState(0);

  // Simple token estimation (roughly 4 chars per token)
  const estimateTokens = (text: string): number => {
    return Math.ceil(text.length / 4);
  };

  const addText = (text: string) => {
    const tokens = estimateTokens(text);
    setTotalTokens(prev => prev + tokens);
    return tokens;
  };

  const reset = () => {
    setTotalTokens(0);
  };

  return { totalTokens, addText, estimateTokens, reset };
}