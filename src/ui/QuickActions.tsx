import React, { memo, useMemo } from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../theme.js';
import {
  ContextMenu,
  useGlobalActions,
  useConversationActions,
  useThemeActions,
  getMainMenuActions,
} from './ContextMenu.js';
import type { Message } from '../types.js';

interface QuickActionsProps {
  messages: Message[];
}

export const QuickActions = memo(function QuickActions({ messages }: QuickActionsProps) {
  const globalActions = useGlobalActions();
  const conversationActions = useConversationActions(messages);
  const themeActions = useThemeActions();

  // Memoize actions to prevent recreating on every render
  const mainMenuActions = useMemo(() => {
    return getMainMenuActions(conversationActions, themeActions);
  }, [conversationActions, themeActions]);

  const themeMenuActions = useMemo(() => {
    return themeActions.getThemeActions();
  }, [themeActions]);

  const exportMenuActions = useMemo(() => {
    return [
      {
        id: 'export-markdown',
        label: 'Export as Markdown',
        icon: '📝',
        hotkey: 'm',
        handler: conversationActions.exportAsMarkdown,
      },
      {
        id: 'export-json',
        label: 'Export as JSON',
        icon: '📄',
        hotkey: 'j',
        handler: conversationActions.exportAsJSON,
      },
      {
        id: 'export-txt',
        label: 'Export as Text',
        icon: '📄',
        hotkey: 't',
        handler: conversationActions.exportAsTXT,
      },
      {
        id: 'statistics',
        label: 'Show Statistics',
        icon: '📊',
        hotkey: 's',
        handler: conversationActions.getStatistics,
      },
    ];
  }, [conversationActions]);

  // Determine which menu to show
  const getMenuProps = () => {
    switch (globalActions.menuType) {
      case 'main':
        return {
          actions: mainMenuActions,
          title: '⚡ Quick Actions',
        };
      case 'export':
        return {
          actions: exportMenuActions,
          title: '📤 Export Options',
        };
      case 'theme':
        return {
          actions: themeMenuActions,
          title: '🎨 Theme Selection',
        };
      default:
        return {
          actions: mainMenuActions,
          title: '⚡ Quick Actions',
        };
    }
  };

  const menuProps = getMenuProps();

  return (
    <ContextMenu
      actions={menuProps.actions}
      isOpen={globalActions.isMenuOpen}
      onClose={globalActions.closeMenu}
      title={menuProps.title}
    />
  );
});

// Hook for keyboard shortcuts overlay
export function useKeyboardShortcuts() {
  const shortcuts = [
    { key: 'Ctrl+Space', description: 'Open quick actions menu' },
    { key: 'Ctrl+Shift+E', description: 'Open export menu' },
    { key: 'Ctrl+Shift+T', description: 'Open theme menu' },
    { key: 'Ctrl+D', description: 'Toggle detailed status bar' },
    { key: 'Ctrl+F', description: 'Search messages' },
    { key: 'Ctrl+C', description: 'Copy focused code block' },
    { key: 'Tab', description: 'Autocomplete command' },
    { key: '↑/↓', description: 'Command history' },
    { key: 'Shift+Enter', description: 'New line in input' },
    { key: 'ESC', description: 'Close menus/dialogs' },
  ];

  return shortcuts;
}

// Help overlay component
export const KeyboardShortcutsHelp = memo(function KeyboardShortcutsHelp({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const shortcuts = useKeyboardShortcuts();
  const theme = useTheme();

  if (!isOpen) return null;

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={theme.accent}
      paddingX={1}
      minWidth={50}
    >
      {/* Header */}
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold color={theme.accent}>⌨️ Keyboard Shortcuts</Text>
        <Text dimColor>ESC: close</Text>
      </Box>

      {/* Shortcuts list */}
      <Box flexDirection="column" marginTop={1}>
        {shortcuts.map((shortcut, index) => (
          <Box key={index} flexDirection="row" justifyContent="space-between" marginBottom={0}>
            <Text color={theme.accent} bold>{shortcut.key}</Text>
            <Text>{shortcut.description}</Text>
          </Box>
        ))}
      </Box>

      {/* Footer */}
      <Box marginTop={1} borderColor={theme.dim} borderStyle="single" paddingX={1}>
        <Text dimColor>💡 Tip: Most actions have hotkeys for quick access</Text>
      </Box>
    </Box>
  );
});

// Status indicator for active shortcuts
export const ShortcutsIndicator = memo(function ShortcutsIndicator({
  show,
}: {
  show: boolean;
}) {
  const theme = useTheme();

  if (!show) return null;

  return (
    <Box flexDirection="row" columnGap={2} paddingY={0}>
      <Text dimColor>Shortcuts:</Text>
      <Text color={theme.accent}>Ctrl+Space</Text>
      <Text dimColor>•</Text>
      <Text color={theme.accent}>Ctrl+Shift+E</Text>
      <Text dimColor>•</Text>
      <Text color={theme.accent}>Ctrl+D</Text>
      <Text dimColor>•</Text>
      <Text color={theme.accent}>?</Text>
      <Text dimColor>help</Text>
    </Box>
  );
});