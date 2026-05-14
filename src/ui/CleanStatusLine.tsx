import React, { memo } from 'react';
import { Box, Text } from 'ink';
import type { AppState } from '../types.js';
import { useTheme } from '../theme.js';
import { useConversationAnalytics } from './MessageNavigation.js';

interface CleanStatusLineProps {
  state: AppState;
}

export const CleanStatusLine = memo(function CleanStatusLine({ state }: CleanStatusLineProps) {
  const theme = useTheme();
  const { session, status } = state;
  const analytics = useConversationAnalytics(session.messages);

  // Status indicators
  const getStatusIcon = () => {
    switch (status) {
      case 'streaming': return '⚡';
      case 'retrying': return '🔄';
      case 'error': return '❌';
      case 'awaiting-tool-confirm': return '⏳';
      default: return '🟢';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'error': return theme.error;
      case 'streaming':
      case 'retrying': return theme.warning;
      case 'awaiting-tool-confirm': return theme.accent;
      default: return theme.success;
    }
  };

  // Format duration
  const formatDuration = (ms: number): string => {
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
    return `${Math.round(ms / 3600000)}h`;
  };

  // Format cost estimation
  const formatCost = (totalTokens: number): string => {
    const costPer1K = 0.003; // Simplified Claude pricing
    const cost = (totalTokens / 1000) * costPer1K;
    if (cost < 0.001) return '<$0.001';
    return `$${cost.toFixed(3)}`;
  };

  // Format numbers with K/M suffixes
  const formatNumber = (num: number): string => {
    if (num < 1000) return num.toString();
    if (num < 1000000) return `${(num / 1000).toFixed(1)}K`;
    return `${(num / 1000000).toFixed(1)}M`;
  };

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Line 1: Primary status and model info */}
      <Box flexDirection="row" columnGap={1}>
        <Text color={getStatusColor()}>{getStatusIcon()}</Text>
        <Text bold>{session.provider || 'local'}</Text>
        <Text dimColor>•</Text>
        <Text color={theme.accent}>{session.model || 'unknown'}</Text>
        <Text dimColor>•</Text>
        <Text>{session.mode || 'chat'}</Text>
        <Text dimColor>•</Text>
        <Text color={state.securityMode === 'hardcore' ? theme.error : theme.success}>
          {state.securityMode}
        </Text>
      </Box>

      {/* Line 2: Session metrics */}
      <Box flexDirection="row" columnGap={1}>
        <Text dimColor>Session:</Text>
        <Text color={theme.accent}>{analytics.messageCount} msgs</Text>
        <Text dimColor>•</Text>
        <Text color={theme.accent}>{formatNumber(analytics.totalTokens)} tokens</Text>
        <Text dimColor>•</Text>
        <Text color={theme.warning}>{formatCost(analytics.totalTokens)}</Text>
        <Text dimColor>•</Text>
        <Text color={theme.dim}>{formatDuration(analytics.duration)}</Text>
        {analytics.errorCount > 0 && (
          <>
            <Text dimColor>•</Text>
            <Text color={theme.error}>{analytics.errorCount} errors</Text>
          </>
        )}
      </Box>

      {/* Line 3: Activity and breakdown (only when detailed info is useful) */}
      {(analytics.messageCount > 2 || Object.keys(analytics.toolCallTypes).length > 0) && (
        <Box flexDirection="row" columnGap={1}>
          <Text dimColor>Activity:</Text>
          <Text color={theme.user}>👤{analytics.roleCounts.user}</Text>
          <Text color={theme.assistant}>🤖{analytics.roleCounts.assistant}</Text>
          {analytics.roleCounts.tool > 0 && (
            <Text color={theme.tool}>🔧{analytics.roleCounts.tool}</Text>
          )}

          {/* Show most used tools */}
          {Object.entries(analytics.toolCallTypes).length > 0 && (
            <>
              <Text dimColor>•</Text>
              <Text dimColor>tools:</Text>
              {Object.entries(analytics.toolCallTypes)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 3)
                .map(([tool, count], index) => (
                  <React.Fragment key={tool}>
                    {index > 0 && <Text dimColor>,</Text>}
                    <Text color={theme.tool}>{tool}×{count}</Text>
                  </React.Fragment>
                ))
              }
            </>
          )}

          {/* Show current activity status */}
          {status !== 'idle' && (
            <>
              <Text dimColor>•</Text>
              <Text color={getStatusColor()}>
                {status === 'streaming' ? 'responding...' :
                 status === 'retrying' ? 'retrying...' :
                 status === 'awaiting-tool-confirm' ? 'awaiting confirmation' :
                 status === 'error' ? 'error occurred' :
                 status}
              </Text>
            </>
          )}
        </Box>
      )}

      {/* Error line (only when there's an error) */}
      {status === 'error' && state.error && (
        <Box flexDirection="row" columnGap={1}>
          <Text color={theme.error}>Error:</Text>
          <Text color={theme.error}>{state.error}</Text>
        </Box>
      )}
    </Box>
  );
});