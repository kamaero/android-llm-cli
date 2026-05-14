import React, { useState, useEffect, memo } from 'react';
import { Box, Text, useInput } from 'ink';
import type { AppState } from '../types.js';
import { useTheme } from '../theme.js';
import { StreamingProgressIndicator, RetryProgressIndicator } from './ProgressIndicator.js';
import { useConversationAnalytics } from './MessageNavigation.js';

interface StatusBarProps {
  state: AppState;
  showDetailed?: boolean;
  onToggleDetailed?: () => void;
}

// Connection status hook
function useConnectionStatus() {
  const [status, setStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connected');
  const [lastCheck, setLastCheck] = useState<number>(Date.now());

  useEffect(() => {
    // Simple connection check - in a real app, this would ping the API
    const checkConnection = () => {
      setLastCheck(Date.now());
      // For now, always assume connected in mock mode
      setStatus('connected');
    };

    const interval = setInterval(checkConnection, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  return { status, lastCheck };
}

// Cost estimation hook
function useCostEstimation(totalTokens: number, model: string) {
  const [cost, setCost] = useState(0);

  useEffect(() => {
    // Simplified cost calculation (would be more complex in real app)
    const estimateCost = () => {
      const costPerThousandTokens = getCostPerThousandTokens(model);
      const estimatedCost = (totalTokens / 1000) * costPerThousandTokens;
      setCost(estimatedCost);
    };

    estimateCost();
  }, [totalTokens, model]);

  return cost;
}

function getCostPerThousandTokens(model: string): number {
  // Simplified pricing model - would be more comprehensive in real app
  const pricing: Record<string, number> = {
    'gpt-4': 0.03,
    'gpt-3.5-turbo': 0.002,
    'claude-3-opus': 0.015,
    'claude-3-sonnet': 0.003,
    'claude-3-haiku': 0.00025,
  };

  return pricing[model] || 0.01; // Default price
}

// Performance metrics hook
function usePerformanceMetrics() {
  const [metrics, setMetrics] = useState({
    averageResponseTime: 0,
    peakMemoryUsage: 0,
    activeConnections: 1,
  });

  useEffect(() => {
    // Mock performance data - in real app would come from monitoring
    const updateMetrics = () => {
      setMetrics({
        averageResponseTime: Math.random() * 2000 + 500, // 500-2500ms
        peakMemoryUsage: Math.random() * 100 + 50, // 50-150MB
        activeConnections: 1,
      });
    };

    const interval = setInterval(updateMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  return metrics;
}

function StatusBarInner({ state, showDetailed = false, onToggleDetailed }: StatusBarProps) {
  const theme = useTheme();
  const { session, status, retryState } = state;
  const analytics = useConversationAnalytics(session.messages);
  const connectionStatus = useConnectionStatus();
  const estimatedCost = useCostEstimation(analytics.totalTokens, session.model);
  const performanceMetrics = usePerformanceMetrics();

  const isStreaming = status === 'streaming';
  const isRetrying = status === 'retrying';
  const isError = status === 'error';
  const barColor = isError ? theme.error : isStreaming || isRetrying ? theme.warning : theme.success;

  // Handle Ctrl+D to toggle detailed view
  useInput((input, key) => {
    if (key.ctrl && input === 'd') {
      onToggleDetailed?.();
    }
  });

  // Format duration
  const formatDuration = (ms: number): string => {
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
    return `${Math.round(ms / 3600000)}h`;
  };

  // Format cost
  const formatCost = (cost: number): string => {
    if (cost < 0.001) return '<$0.001';
    return `$${cost.toFixed(3)}`;
  };

  if (showDetailed) {
    return (
      <Box flexDirection="column" borderStyle="double" borderColor={barColor} paddingX={1}>
        {/* Header */}
        <Box flexDirection="row" justifyContent="space-between">
          <Text bold color={barColor}>📊 Detailed Status</Text>
          <Text dimColor>Ctrl+D: toggle</Text>
        </Box>

        {/* Core info */}
        <Box flexDirection="row" columnGap={2} marginTop={1}>
          <Box flexDirection="column">
            <Text bold color={theme.accent}>System</Text>
            <Text>Provider: <Text color={barColor}>{session.provider}</Text></Text>
            <Text>Model: <Text color={theme.accent}>{session.model}</Text></Text>
            <Text>Mode: <Text color={theme.accent}>{session.mode}</Text></Text>
            <Text>Security: <Text color={state.securityMode === 'hardcore' ? theme.error : theme.success}>
              {state.securityMode}
            </Text></Text>
          </Box>

          <Box flexDirection="column">
            <Text bold color={theme.accent}>Session</Text>
            <Text>Messages: <Text color={theme.accent}>{analytics.messageCount}</Text></Text>
            <Text>Duration: <Text color={theme.accent}>{formatDuration(analytics.duration)}</Text></Text>
            <Text>Tokens: <Text color={theme.accent}>{analytics.totalTokens.toLocaleString()}</Text></Text>
            <Text>Est. Cost: <Text color={theme.warning}>{formatCost(estimatedCost)}</Text></Text>
          </Box>

          <Box flexDirection="column">
            <Text bold color={theme.accent}>Performance</Text>
            <Text>Avg Response: <Text color={theme.accent}>
              {Math.round(performanceMetrics.averageResponseTime)}ms
            </Text></Text>
            <Text>Memory: <Text color={theme.accent}>
              {Math.round(performanceMetrics.peakMemoryUsage)}MB
            </Text></Text>
            <Text>Connection: <Text color={
              connectionStatus.status === 'connected' ? theme.success :
              connectionStatus.status === 'connecting' ? theme.warning : theme.error
            }>
              {connectionStatus.status}
            </Text></Text>
          </Box>
        </Box>

        {/* Message breakdown */}
        <Box flexDirection="row" columnGap={4} marginTop={1}>
          <Box flexDirection="column">
            <Text bold color={theme.accent}>Message Types</Text>
            <Text>👤 User: <Text color={theme.accent}>{analytics.roleCounts.user}</Text></Text>
            <Text>🤖 Assistant: <Text color={theme.accent}>{analytics.roleCounts.assistant}</Text></Text>
            <Text>🔧 Tool: <Text color={theme.accent}>{analytics.roleCounts.tool}</Text></Text>
            <Text>❌ Errors: <Text color={theme.error}>{analytics.errorCount}</Text></Text>
          </Box>

          <Box flexDirection="column">
            <Text bold color={theme.accent}>Tool Usage</Text>
            {Object.entries(analytics.toolCallTypes).slice(0, 4).map(([tool, count]) => (
              <Text key={tool}>
                {tool}: <Text color={theme.accent}>{count}</Text>
              </Text>
            ))}
          </Box>
        </Box>

        {/* Current status */}
        {(isStreaming || isRetrying) && (
          <Box marginTop={1} paddingY={0} borderStyle="single" borderColor={barColor} paddingX={1}>
            {isStreaming && <StreamingProgressIndicator />}
            {isRetrying && retryState && (
              <RetryProgressIndicator
                attempt={retryState.attempt}
                maxAttempts={retryState.maxAttempts}
              />
            )}
          </Box>
        )}

        {/* Error display */}
        {isError && state.error && (
          <Box marginTop={1} borderStyle="single" borderColor={theme.error} paddingX={1}>
            <Text color={theme.error}>❌ {state.error}</Text>
          </Box>
        )}
      </Box>
    );
  }

  // Compact view
  return (
    <Box borderStyle="single" borderColor={barColor} paddingX={1}>
      <Box flexDirection="row" columnGap={1}>
        {/* Basic info */}
        <Text color={barColor} bold>{session.provider || 'no-provider'}</Text>
        <Text dimColor> │ </Text>
        <Text>{session.model || 'no-model'}</Text>
        <Text dimColor> │ </Text>
        <Text color={theme.accent}>{session.mode}</Text>
        <Text dimColor> │ </Text>
        <Text color={state.securityMode === 'hardcore' ? theme.error : theme.success}>
          {state.securityMode}
        </Text>

        {/* Metrics */}
        <Text dimColor> │ </Text>
        <Text dimColor>
          {analytics.messageCount}msg • {analytics.totalTokens}tok
        </Text>

        {/* Cost */}
        <Text dimColor> │ </Text>
        <Text color={theme.warning}>{formatCost(estimatedCost)}</Text>

        {/* Connection status */}
        <Text dimColor> │ </Text>
        <Text color={
          connectionStatus.status === 'connected' ? theme.success :
          connectionStatus.status === 'connecting' ? theme.warning : theme.error
        }>
          {connectionStatus.status === 'connected' ? '🟢' :
           connectionStatus.status === 'connecting' ? '🟡' : '🔴'}
        </Text>

        {/* Current activity */}
        {isStreaming && (
          <>
            <Text dimColor> │ </Text>
            <StreamingProgressIndicator />
          </>
        )}
        {isRetrying && retryState && (
          <>
            <Text dimColor> │ </Text>
            <RetryProgressIndicator
              attempt={retryState.attempt}
              maxAttempts={retryState.maxAttempts}
            />
          </>
        )}

        {/* Toggle hint */}
        <Box flexGrow={1} />
        <Text dimColor>Ctrl+D</Text>
      </Box>

      {/* Error in compact view */}
      {isError && state.error && (
        <Text color={theme.error}>❌ {state.error}</Text>
      )}
    </Box>
  );
}

export const EnhancedStatusBar = memo(StatusBarInner, (prev, next) => {
  const a = prev.state;
  const b = next.state;
  if (a.status !== b.status) return false;
  if (a.error !== b.error) return false;
  if (a.session.provider !== b.session.provider) return false;
  if (a.session.model !== b.session.model) return false;
  if (a.session.mode !== b.session.mode) return false;
  if (a.securityMode !== b.securityMode) return false;
  if (a.retryState?.attempt !== b.retryState?.attempt) return false;
  if (a.session.messages.length !== b.session.messages.length) return false;
  if (prev.showDetailed !== next.showDetailed) return false;

  const lastA = a.session.messages.at(-1);
  const lastB = b.session.messages.at(-1);
  if (lastA?.tokens !== lastB?.tokens) return false;
  return true;
});

// Hook for managing detailed status bar state
export function useStatusBarState() {
  const [showDetailed, setShowDetailed] = useState(false);

  const toggleDetailed = () => setShowDetailed(prev => !prev);
  const hideDetailed = () => setShowDetailed(false);
  const showDetailedView = () => setShowDetailed(true);

  return {
    showDetailed,
    toggleDetailed,
    hideDetailed,
    showDetailedView,
  };
}