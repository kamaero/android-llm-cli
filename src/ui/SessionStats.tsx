import React, { createContext, useContext, useState, useEffect, useCallback, memo } from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../theme.js';
import { AnimatedProgressBar, LoadingDots } from './AnimationUtils.js';
import { ResponsiveStatusBar } from './ResponsiveLayout.js';
import type { Message } from '../types.js';

// Session metrics interface
export interface SessionMetrics {
  // Basic statistics
  totalMessages: number;
  userMessages: number;
  assistantMessages: number;
  toolMessages: number;

  // Token tracking
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  averageTokensPerMessage: number;

  // Timing metrics
  sessionStartTime: number;
  sessionDuration: number;
  averageResponseTime: number;
  lastResponseTime: number;

  // Cost tracking
  estimatedCost: number;
  tokensPerSecond: number;

  // Tool usage
  toolCallCount: number;
  uniqueToolsUsed: Set<string>;
  toolSuccessRate: number;

  // Performance metrics
  messagesPerMinute: number;
  peakTokensPerSecond: number;
  slowestResponseTime: number;
  fastestResponseTime: number;
}

interface SessionAnalytics {
  metrics: SessionMetrics;
  updateMetrics: (messages: Message[]) => void;
  resetMetrics: () => void;
  getInsights: () => string[];
  exportAnalytics: () => string;
  startResponseTimer: () => void;
  stopResponseTimer: () => void;
}

const SessionContext = createContext<SessionAnalytics | null>(null);

export function useSessionStats() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSessionStats must be used within SessionStatsProvider');
  }
  return context;
}

// Token cost estimation (rough approximation)
const MODEL_COSTS = {
  'sonnet-4': { input: 0.000003, output: 0.000015 }, // $3/$15 per 1M tokens
  'opus-4': { input: 0.000015, output: 0.000075 },   // $15/$75 per 1M tokens
  'haiku-4': { input: 0.00000025, output: 0.00000125 }, // $0.25/$1.25 per 1M tokens
} as const;

export function SessionStatsProvider({ children }: { children: React.ReactNode }) {
  const [metrics, setMetrics] = useState<SessionMetrics>({
    totalMessages: 0,
    userMessages: 0,
    assistantMessages: 0,
    toolMessages: 0,
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    averageTokensPerMessage: 0,
    sessionStartTime: Date.now(),
    sessionDuration: 0,
    averageResponseTime: 0,
    lastResponseTime: 0,
    estimatedCost: 0,
    tokensPerSecond: 0,
    toolCallCount: 0,
    uniqueToolsUsed: new Set(),
    toolSuccessRate: 0,
    messagesPerMinute: 0,
    peakTokensPerSecond: 0,
    slowestResponseTime: 0,
    fastestResponseTime: Infinity,
  });

  const [responseStartTime, setResponseStartTime] = useState<number | null>(null);
  const [responseTimes, setResponseTimes] = useState<number[]>([]);

  const updateMetrics = useCallback((messages: Message[]) => {
    const now = Date.now();
    const sessionDuration = now - metrics.sessionStartTime;

    // Basic counts
    const userMessages = messages.filter(m => m.role === 'user').length;
    const assistantMessages = messages.filter(m => m.role === 'assistant').length;
    const toolMessages = messages.filter(m => m.role === 'tool').length;

    // Token calculations
    const totalTokens = messages.reduce((sum, m) => sum + (m.tokens || 0), 0);
    const inputTokens = messages
      .filter(m => m.role === 'user')
      .reduce((sum, m) => sum + (m.tokens || 0), 0);
    const outputTokens = messages
      .filter(m => m.role === 'assistant')
      .reduce((sum, m) => sum + (m.tokens || 0), 0);

    // Tool usage
    const toolCalls = messages.reduce((sum, m) => sum + (m.tool_calls?.length || 0), 0);
    const uniqueTools = new Set(
      messages.flatMap(m => m.tool_calls?.map(tc => tc.name) || [])
    );
    const toolErrors = messages.filter(m => m.tool_result?.is_error).length;
    const toolSuccessRate = toolCalls > 0 ? ((toolCalls - toolErrors) / toolCalls) * 100 : 100;

    // Cost estimation (using Sonnet-4 rates as default)
    const costs = MODEL_COSTS['sonnet-4'];
    const estimatedCost = (inputTokens * costs.input) + (outputTokens * costs.output);

    // Performance metrics
    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

    const tokensPerSecond = sessionDuration > 0 ? (totalTokens / (sessionDuration / 1000)) : 0;
    const messagesPerMinute = sessionDuration > 0 ? (messages.length / (sessionDuration / 60000)) : 0;

    setMetrics({
      totalMessages: messages.length,
      userMessages,
      assistantMessages,
      toolMessages,
      totalTokens,
      inputTokens,
      outputTokens,
      averageTokensPerMessage: messages.length > 0 ? totalTokens / messages.length : 0,
      sessionStartTime: metrics.sessionStartTime,
      sessionDuration,
      averageResponseTime: avgResponseTime,
      lastResponseTime: responseTimes[responseTimes.length - 1] || 0,
      estimatedCost,
      tokensPerSecond,
      toolCallCount: toolCalls,
      uniqueToolsUsed: uniqueTools,
      toolSuccessRate,
      messagesPerMinute,
      peakTokensPerSecond: Math.max(metrics.peakTokensPerSecond, tokensPerSecond),
      slowestResponseTime: Math.max(metrics.slowestResponseTime, ...responseTimes),
      fastestResponseTime: responseTimes.length > 0 ? Math.min(metrics.fastestResponseTime, ...responseTimes) : 0,
    });
  }, [metrics.sessionStartTime, responseTimes, metrics.peakTokensPerSecond, metrics.slowestResponseTime, metrics.fastestResponseTime]);

  const startResponseTimer = useCallback(() => {
    setResponseStartTime(Date.now());
  }, []);

  const stopResponseTimer = useCallback(() => {
    if (responseStartTime) {
      const responseTime = Date.now() - responseStartTime;
      setResponseTimes(prev => [...prev, responseTime]);
      setResponseStartTime(null);
    }
  }, [responseStartTime]);

  const resetMetrics = useCallback(() => {
    setMetrics({
      totalMessages: 0,
      userMessages: 0,
      assistantMessages: 0,
      toolMessages: 0,
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      averageTokensPerMessage: 0,
      sessionStartTime: Date.now(),
      sessionDuration: 0,
      averageResponseTime: 0,
      lastResponseTime: 0,
      estimatedCost: 0,
      tokensPerSecond: 0,
      toolCallCount: 0,
      uniqueToolsUsed: new Set(),
      toolSuccessRate: 0,
      messagesPerMinute: 0,
      peakTokensPerSecond: 0,
      slowestResponseTime: 0,
      fastestResponseTime: Infinity,
    });
    setResponseTimes([]);
  }, []);

  const getInsights = useCallback((): string[] => {
    const insights: string[] = [];

    // Performance insights
    if (metrics.tokensPerSecond > 100) {
      insights.push('🚀 High token throughput - excellent performance');
    } else if (metrics.tokensPerSecond < 20) {
      insights.push('🐌 Low token throughput - consider checking connection');
    }

    // Usage patterns
    if (metrics.toolCallCount > metrics.assistantMessages * 2) {
      insights.push('🔧 Tool-heavy session - great for complex tasks');
    }

    // Cost awareness
    if (metrics.estimatedCost > 0.10) {
      insights.push('💰 High token usage - monitor costs for budget management');
    }

    // Conversation health
    const userToAssistantRatio = metrics.userMessages / Math.max(metrics.assistantMessages, 1);
    if (userToAssistantRatio > 2) {
      insights.push('💬 High interaction rate - very engaged conversation');
    }

    // Response time insights
    if (metrics.averageResponseTime > 5000) {
      insights.push('⏱️ Long response times - complex processing or network issues');
    } else if (metrics.averageResponseTime < 1000) {
      insights.push('⚡ Fast responses - optimal system performance');
    }

    return insights;
  }, [metrics]);

  const exportAnalytics = useCallback((): string => {
    return JSON.stringify({
      sessionMetrics: {
        ...metrics,
        uniqueToolsUsed: Array.from(metrics.uniqueToolsUsed),
      },
      responseTimes,
      insights: getInsights(),
      exportedAt: new Date().toISOString(),
    }, null, 2);
  }, [metrics, responseTimes, getInsights]);

  return (
    <SessionContext.Provider value={{
      metrics,
      updateMetrics,
      resetMetrics,
      getInsights,
      exportAnalytics,
      startResponseTimer,
      stopResponseTimer,
    }}>
      {children}
    </SessionContext.Provider>
  );
}

// Compact stats display for status bar
export const CompactStats = memo(function CompactStats() {
  const { metrics } = useSessionStats();
  const theme = useTheme();

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatCost = (cost: number) => {
    return cost < 0.01 ? '<$0.01' : `$${cost.toFixed(3)}`;
  };

  return (
    <Box flexDirection="row" columnGap={1}>
      <Text color={theme.accent}>
        {metrics.totalMessages}msg
      </Text>
      <Text dimColor>•</Text>
      <Text color={theme.accent}>
        {Math.round(metrics.totalTokens / 1000)}k tk
      </Text>
      <Text dimColor>•</Text>
      <Text color={theme.success}>
        {formatCost(metrics.estimatedCost)}
      </Text>
      <Text dimColor>•</Text>
      <Text color={theme.dim}>
        {formatDuration(metrics.sessionDuration)}
      </Text>
    </Box>
  );
});

// Detailed stats panel
interface DetailedStatsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DetailedStats = memo(function DetailedStats({ isOpen, onClose }: DetailedStatsProps) {
  const { metrics, getInsights, exportAnalytics } = useSessionStats();
  const theme = useTheme();

  if (!isOpen) return null;

  const insights = getInsights();

  const formatNumber = (num: number, decimals = 1) => {
    return num.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    const seconds = ms / 1000;
    if (seconds < 60) return `${formatNumber(seconds)}s`;
    const minutes = seconds / 60;
    if (minutes < 60) return `${formatNumber(minutes, 0)}m ${formatNumber(seconds % 60, 0)}s`;
    const hours = minutes / 60;
    return `${formatNumber(hours, 0)}h ${formatNumber(minutes % 60, 0)}m`;
  };

  return (
    <Box
      borderStyle="double"
      borderColor={theme.accent}
      flexDirection="column"
      paddingX={1}
      minWidth={60}
    >
      {/* Header */}
      <Box flexDirection="row" justifyContent="space-between" marginBottom={1}>
        <Text bold color={theme.accent}>📊 Session Analytics</Text>
        <Text dimColor onPress={onClose}>ESC: close</Text>
      </Box>

      {/* Main metrics grid */}
      <Box flexDirection="column" rowGap={1}>
        {/* Message counts */}
        <Box borderStyle="single" borderColor={theme.dim} paddingX={1}>
          <Text bold>💬 Messages</Text>
          <Box flexDirection="row" columnGap={2} marginTop={1}>
            <Box flexDirection="column">
              <Text>Total: {metrics.totalMessages}</Text>
              <Text>User: {metrics.userMessages}</Text>
            </Box>
            <Box flexDirection="column">
              <Text>Assistant: {metrics.assistantMessages}</Text>
              <Text>Tool: {metrics.toolMessages}</Text>
            </Box>
          </Box>
        </Box>

        {/* Token metrics */}
        <Box borderStyle="single" borderColor={theme.dim} paddingX={1}>
          <Text bold>🎯 Tokens</Text>
          <Box flexDirection="row" columnGap={2} marginTop={1}>
            <Box flexDirection="column">
              <Text>Total: {formatNumber(metrics.totalTokens, 0)}</Text>
              <Text>Input: {formatNumber(metrics.inputTokens, 0)}</Text>
              <Text>Output: {formatNumber(metrics.outputTokens, 0)}</Text>
            </Box>
            <Box flexDirection="column">
              <Text>Avg/msg: {formatNumber(metrics.averageTokensPerMessage, 0)}</Text>
              <Text>Rate: {formatNumber(metrics.tokensPerSecond)}/s</Text>
              <Text>Peak: {formatNumber(metrics.peakTokensPerSecond)}/s</Text>
            </Box>
          </Box>
        </Box>

        {/* Performance */}
        <Box borderStyle="single" borderColor={theme.dim} paddingX={1}>
          <Text bold>⚡ Performance</Text>
          <Box flexDirection="row" columnGap={2} marginTop={1}>
            <Box flexDirection="column">
              <Text>Avg response: {formatDuration(metrics.averageResponseTime)}</Text>
              <Text>Fastest: {formatDuration(metrics.fastestResponseTime)}</Text>
              <Text>Slowest: {formatDuration(metrics.slowestResponseTime)}</Text>
            </Box>
            <Box flexDirection="column">
              <Text>Session: {formatDuration(metrics.sessionDuration)}</Text>
              <Text>Msgs/min: {formatNumber(metrics.messagesPerMinute)}</Text>
              <Text>Cost: ${formatNumber(metrics.estimatedCost, 4)}</Text>
            </Box>
          </Box>
        </Box>

        {/* Tool usage */}
        {metrics.toolCallCount > 0 && (
          <Box borderStyle="single" borderColor={theme.dim} paddingX={1}>
            <Text bold>🔧 Tools</Text>
            <Box flexDirection="row" columnGap={2} marginTop={1}>
              <Box flexDirection="column">
                <Text>Calls: {metrics.toolCallCount}</Text>
                <Text>Success: {formatNumber(metrics.toolSuccessRate, 0)}%</Text>
              </Box>
              <Box flexDirection="column">
                <Text>Unique: {metrics.uniqueToolsUsed.size}</Text>
                <Text>
                  Types: {Array.from(metrics.uniqueToolsUsed).slice(0, 3).join(', ')}
                  {metrics.uniqueToolsUsed.size > 3 && '...'}
                </Text>
              </Box>
            </Box>
          </Box>
        )}

        {/* Insights */}
        {insights.length > 0 && (
          <Box borderStyle="single" borderColor={theme.success} paddingX={1}>
            <Text bold color={theme.success}>💡 Insights</Text>
            <Box flexDirection="column" marginTop={1}>
              {insights.slice(0, 3).map((insight, i) => (
                <Text key={i} dimColor>{insight}</Text>
              ))}
            </Box>
          </Box>
        )}

        {/* Live progress */}
        <Box borderStyle="single" borderColor={theme.accent} paddingX={1}>
          <Text bold color={theme.accent}>📈 Live Metrics</Text>
          <Box flexDirection="column" marginTop={1} rowGap={1}>
            <Box flexDirection="row" justifyContent="space-between">
              <Text>Token throughput:</Text>
              <LoadingDots count={3} speed={200} enabled={metrics.tokensPerSecond > 0} />
            </Box>
            <AnimatedProgressBar
              progress={Math.min((metrics.tokensPerSecond / 100) * 100, 100)}
              width={30}
              showPercent={false}
              color={theme.accent}
            />
          </Box>
        </Box>
      </Box>

      {/* Footer actions */}
      <Box marginTop={1} flexDirection="row" justifyContent="space-between">
        <Text dimColor>Ctrl+E: export • Ctrl+R: reset</Text>
        <Text color={theme.success}>Live updating</Text>
      </Box>
    </Box>
  );
});

// Real-time cost monitor
export const CostMonitor = memo(function CostMonitor() {
  const { metrics } = useSessionStats();
  const theme = useTheme();
  const [costAlert, setCostAlert] = useState(false);

  useEffect(() => {
    // Alert when cost exceeds $0.05
    if (metrics.estimatedCost > 0.05 && !costAlert) {
      setCostAlert(true);
    }
  }, [metrics.estimatedCost, costAlert]);

  const getCostColor = () => {
    if (metrics.estimatedCost > 0.10) return theme.error;
    if (metrics.estimatedCost > 0.05) return theme.warning;
    return theme.success;
  };

  return (
    <Box flexDirection="row" columnGap={1}>
      <Text>💰</Text>
      <Text color={getCostColor()}>
        ${metrics.estimatedCost.toFixed(4)}
      </Text>
      {costAlert && (
        <Text color={theme.warning}>⚠️</Text>
      )}
    </Box>
  );
});

// Hook for integrating stats with existing components
export function useSessionAnalytics(messages: Message[]) {
  const { updateMetrics, startResponseTimer, stopResponseTimer } = useSessionStats();

  // Update metrics when messages change
  useEffect(() => {
    updateMetrics(messages);
  }, [messages, updateMetrics]);

  return {
    startResponseTimer,
    stopResponseTimer,
    updateMetrics,
  };
}