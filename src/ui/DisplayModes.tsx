import React, { createContext, useContext, useState, useCallback, memo } from 'react';
import { Box, Text, useInput } from 'ink';
import { useTheme } from '../theme.js';
import type { Message } from '../types.js';

// Display mode types
export type DisplayMode = 'normal' | 'reading' | 'compact' | 'debug' | 'focus';

interface DisplayModeConfig {
  id: DisplayMode;
  name: string;
  description: string;
  icon: string;
  hotkey: string;
  features: {
    showToolCalls: boolean;
    showTimestamps: boolean;
    showTokens: boolean;
    showMetadata: boolean;
    showStatusBar: boolean;
    compactMessages: boolean;
    hideSystemUI: boolean;
    highlightCode: boolean;
    showScrollbar: boolean;
  };
}

// Display mode configurations
export const DISPLAY_MODES: Record<DisplayMode, DisplayModeConfig> = {
  normal: {
    id: 'normal',
    name: 'Normal',
    description: 'Standard view with all features',
    icon: '📄',
    hotkey: '1',
    features: {
      showToolCalls: true,
      showTimestamps: false,
      showTokens: true,
      showMetadata: false,
      showStatusBar: true,
      compactMessages: false,
      hideSystemUI: false,
      highlightCode: true,
      showScrollbar: false,
    },
  },
  reading: {
    id: 'reading',
    name: 'Reading',
    description: 'Clean view focused on content',
    icon: '📖',
    hotkey: '2',
    features: {
      showToolCalls: false,
      showTimestamps: false,
      showTokens: false,
      showMetadata: false,
      showStatusBar: false,
      compactMessages: false,
      hideSystemUI: true,
      highlightCode: true,
      showScrollbar: false,
    },
  },
  compact: {
    id: 'compact',
    name: 'Compact',
    description: 'Compressed view for small screens',
    icon: '📱',
    hotkey: '3',
    features: {
      showToolCalls: true,
      showTimestamps: false,
      showTokens: false,
      showMetadata: false,
      showStatusBar: true,
      compactMessages: true,
      hideSystemUI: false,
      highlightCode: false,
      showScrollbar: false,
    },
  },
  debug: {
    id: 'debug',
    name: 'Debug',
    description: 'Full details for debugging',
    icon: '🐛',
    hotkey: '4',
    features: {
      showToolCalls: true,
      showTimestamps: true,
      showTokens: true,
      showMetadata: true,
      showStatusBar: true,
      compactMessages: false,
      hideSystemUI: false,
      highlightCode: true,
      showScrollbar: true,
    },
  },
  focus: {
    id: 'focus',
    name: 'Focus',
    description: 'Distraction-free writing',
    icon: '🎯',
    hotkey: '5',
    features: {
      showToolCalls: false,
      showTimestamps: false,
      showTokens: false,
      showMetadata: false,
      showStatusBar: false,
      compactMessages: false,
      hideSystemUI: true,
      highlightCode: false,
      showScrollbar: false,
    },
  },
};

// Display mode context
interface DisplayModeContextType {
  currentMode: DisplayMode;
  config: DisplayModeConfig;
  setMode: (mode: DisplayMode) => void;
  toggleMode: () => void;
}

const DisplayModeContext = createContext<DisplayModeContextType | null>(null);

export function useDisplayMode() {
  const context = useContext(DisplayModeContext);
  if (!context) {
    throw new Error('useDisplayMode must be used within a DisplayModeProvider');
  }
  return context;
}

// Display mode provider
export function DisplayModeProvider({ children }: { children: React.ReactNode }) {
  const [currentMode, setCurrentMode] = useState<DisplayMode>('normal');

  const config = DISPLAY_MODES[currentMode];

  const setMode = useCallback((mode: DisplayMode) => {
    setCurrentMode(mode);
  }, []);

  const toggleMode = useCallback(() => {
    const modes: DisplayMode[] = ['normal', 'reading', 'compact', 'debug', 'focus'];
    const currentIndex = modes.indexOf(currentMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setCurrentMode(modes[nextIndex]);
  }, [currentMode]);

  // Global hotkeys for mode switching
  useInput((input, key) => {
    // Number keys 1-5 for mode switching
    if (!key.ctrl && !key.meta && input >= '1' && input <= '5') {
      const modes: DisplayMode[] = ['normal', 'reading', 'compact', 'debug', 'focus'];
      const modeIndex = parseInt(input) - 1;
      if (modes[modeIndex]) {
        setMode(modes[modeIndex]);
      }
    }

    // Ctrl+M to cycle through modes
    if (key.ctrl && input === 'm') {
      toggleMode();
    }
  });

  return (
    <DisplayModeContext.Provider value={{ currentMode, config, setMode, toggleMode }}>
      {children}
    </DisplayModeContext.Provider>
  );
}

// Mode selector component
interface ModeSelectorProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ModeSelector = memo(function ModeSelector({ isOpen, onClose }: ModeSelectorProps) {
  const theme = useTheme();
  const { currentMode, setMode } = useDisplayMode();
  const [selectedIndex, setSelectedIndex] = useState(0);

  const modes = Object.values(DISPLAY_MODES);

  useInput(
    (input, key) => {
      if (!isOpen) return;

      if (key.escape) {
        onClose();
        return;
      }

      if (key.return) {
        setMode(modes[selectedIndex].id);
        onClose();
        return;
      }

      if (key.upArrow) {
        setSelectedIndex(prev => Math.max(0, prev - 1));
        return;
      }

      if (key.downArrow) {
        setSelectedIndex(prev => Math.min(modes.length - 1, prev + 1));
        return;
      }

      // Direct selection with number keys
      if (input >= '1' && input <= '5') {
        const index = parseInt(input) - 1;
        if (modes[index]) {
          setMode(modes[index].id);
          onClose();
        }
      }
    },
    { isActive: isOpen }
  );

  if (!isOpen) return null;

  return (
    <Box
      borderStyle="double"
      borderColor={theme.accent}
      flexDirection="column"
      paddingX={1}
      minWidth={50}
    >
      {/* Header */}
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold color={theme.accent}>👁️ Display Modes</Text>
        <Text dimColor>ESC: close</Text>
      </Box>

      {/* Current mode */}
      <Box marginTop={1} borderStyle="single" borderColor={theme.success} paddingX={1}>
        <Text color={theme.success}>
          Current: {DISPLAY_MODES[currentMode].icon} {DISPLAY_MODES[currentMode].name}
        </Text>
      </Box>

      {/* Mode list */}
      <Box flexDirection="column" marginTop={1}>
        {modes.map((mode, index) => (
          <Box
            key={mode.id}
            borderStyle={index === selectedIndex ? "single" : undefined}
            borderColor={index === selectedIndex ? theme.accent : undefined}
            paddingX={index === selectedIndex ? 1 : 0}
            flexDirection="row"
            justifyContent="space-between"
          >
            <Box flexDirection="row" columnGap={1}>
              <Text
                color={mode.id === currentMode ? theme.success : undefined}
                bold={mode.id === currentMode}
              >
                {mode.icon}
              </Text>
              <Text
                color={mode.id === currentMode ? theme.success : undefined}
                bold={mode.id === currentMode}
              >
                {mode.name}
              </Text>
              <Text dimColor>— {mode.description}</Text>
            </Box>
            <Text dimColor>[{mode.hotkey}]</Text>
          </Box>
        ))}
      </Box>

      {/* Help text */}
      <Box marginTop={1}>
        <Text dimColor>
          ↑↓: navigate • Enter: select • 1-5: direct • Ctrl+M: cycle
        </Text>
      </Box>
    </Box>
  );
});

// Filtered message component that respects display mode
interface FilteredMessageProps {
  message: Message;
  compact?: boolean;
  showMetadata?: boolean;
  showTimestamps?: boolean;
  showTokens?: boolean;
  showToolCalls?: boolean;
}

export const FilteredMessage = memo(function FilteredMessage({
  message,
  compact = false,
  showMetadata = false,
  showTimestamps = false,
  showTokens = false,
  showToolCalls = true,
}: FilteredMessageProps) {
  const theme = useTheme();

  const renderRoleHeader = () => {
    let color: string;
    let label: string;

    switch (message.role) {
      case 'user':
        color = theme.user;
        label = compact ? '👤' : 'You';
        break;
      case 'assistant':
        color = theme.assistant;
        label = compact ? '🤖' : 'Assistant';
        break;
      case 'tool':
        color = message.tool_result?.is_error ? theme.error : theme.tool;
        label = compact ? '🔧' : 'Tool';
        break;
      default:
        color = theme.dim;
        label = '❓';
    }

    return (
      <Box flexDirection="row" columnGap={1}>
        <Text bold color={color}>{label}</Text>
        {showTimestamps && (
          <Text dimColor>
            [{new Date(message.timestamp).toLocaleTimeString()}]
          </Text>
        )}
        {showTokens && message.tokens && (
          <Text dimColor>({message.tokens} tokens)</Text>
        )}
      </Box>
    );
  };

  const renderContent = () => {
    if (message.role === 'tool' && !showToolCalls) {
      return null;
    }

    const content = message.tool_result?.output || message.content;

    if (compact) {
      // Truncate long messages in compact mode
      const truncated = content.length > 100 ? content.slice(0, 97) + '...' : content;
      return (
        <Box paddingLeft={compact ? 1 : 2}>
          <Text>{truncated}</Text>
        </Box>
      );
    } else {
      return (
        <Box paddingLeft={2}>
          <Text>{content}</Text>
        </Box>
      );
    }
  };

  const renderToolCalls = () => {
    if (!showToolCalls || !message.tool_calls || message.tool_calls.length === 0) {
      return null;
    }

    return (
      <Box flexDirection="column" marginTop={compact ? 0 : 1}>
        {message.tool_calls.map((toolCall) => (
          <Box
            key={toolCall.id}
            borderStyle={compact ? undefined : "round"}
            borderColor={compact ? undefined : theme.accent}
            paddingX={compact ? 0 : 1}
            flexDirection={compact ? "row" : "column"}
            columnGap={compact ? 1 : undefined}
          >
            <Text color={theme.accent}>
              {compact ? `⚡${toolCall.name}` : `⚡ ${toolCall.name}`}
            </Text>
            {!compact && (
              <Text dimColor>
                {JSON.stringify(toolCall.input, null, 2)}
              </Text>
            )}
          </Box>
        ))}
      </Box>
    );
  };

  const renderMetadata = () => {
    if (!showMetadata) return null;

    return (
      <Box marginTop={1} borderStyle="single" borderColor={theme.dim} paddingX={1}>
        <Text dimColor>
          ID: {message.id} | Role: {message.role} | Time: {message.timestamp}
          {message.reasoningContent && ` | Reasoning: ${message.reasoningContent.length} chars`}
        </Text>
      </Box>
    );
  };

  return (
    <Box flexDirection="column" marginBottom={compact ? 0 : 1}>
      {renderRoleHeader()}
      {renderContent()}
      {renderToolCalls()}
      {renderMetadata()}
    </Box>
  );
});

// Display mode aware message list
interface ModeAwareMessageListProps {
  messages: Message[];
}

export const ModeAwareMessageList = memo(function ModeAwareMessageList({
  messages,
}: ModeAwareMessageListProps) {
  const { config } = useDisplayMode();
  const theme = useTheme();

  if (messages.length === 0) {
    return (
      <Box flexGrow={1} alignItems="center" justifyContent="center">
        <Text dimColor>No messages yet. Start typing below.</Text>
      </Box>
    );
  }

  const MAX_VISIBLE = config.features.compactMessages ? 100 : 50;
  const hidden = Math.max(0, messages.length - MAX_VISIBLE);
  const visible = messages.slice(-MAX_VISIBLE);

  return (
    <Box flexGrow={1} flexDirection="column" paddingX={config.features.compactMessages ? 0 : 1}>
      {hidden > 0 && (
        <Text dimColor>
          ↑ {hidden} older message{hidden === 1 ? '' : 's'}
        </Text>
      )}

      {visible.map((msg) => (
        <FilteredMessage
          key={msg.id}
          message={msg}
          compact={config.features.compactMessages}
          showMetadata={config.features.showMetadata}
          showTimestamps={config.features.showTimestamps}
          showTokens={config.features.showTokens}
          showToolCalls={config.features.showToolCalls}
        />
      ))}

      {config.features.showScrollbar && messages.length > MAX_VISIBLE && (
        <Box borderColor={theme.dim} borderStyle="single" paddingX={1}>
          <Text dimColor>
            📜 Scroll: {visible.length}/{messages.length} messages visible
          </Text>
        </Box>
      )}
    </Box>
  );
});

// Mode indicator for status display
export const ModeIndicator = memo(function ModeIndicator() {
  const { currentMode, config } = useDisplayMode();
  const theme = useTheme();

  return (
    <Box flexDirection="row" columnGap={1}>
      <Text color={theme.accent}>{config.icon}</Text>
      <Text color={theme.accent}>{config.name}</Text>
    </Box>
  );
});

// Hook for mode-aware layout decisions
export function useModeAwareLayout() {
  const { config } = useDisplayMode();

  const shouldShow = useCallback((feature: keyof DisplayModeConfig['features']) => {
    return config.features[feature];
  }, [config.features]);

  const getLayoutProps = useCallback(() => {
    return {
      showStatusBar: config.features.showStatusBar,
      hideSystemUI: config.features.hideSystemUI,
      compactMode: config.features.compactMessages,
    };
  }, [config.features]);

  return {
    shouldShow,
    getLayoutProps,
    config,
  };
}