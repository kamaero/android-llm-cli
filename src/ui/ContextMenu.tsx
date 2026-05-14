import React, { useState, useCallback, memo } from 'react';
import { Box, Text, useInput } from 'ink';
import { useTheme } from '../theme.js';
import { useClipboard, useToast } from './NotificationToast.js';
import type { Message } from '../types.js';

export interface ContextAction {
  id: string;
  label: string;
  icon: string;
  hotkey?: string;
  description?: string;
  handler: () => void | Promise<void>;
  disabled?: boolean;
  destructive?: boolean;
}

interface ContextMenuProps {
  actions: ContextAction[];
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

export const ContextMenu = memo(function ContextMenu({
  actions,
  isOpen,
  onClose,
  title = 'Quick Actions',
}: ContextMenuProps) {
  const theme = useTheme();
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Handle keyboard input
  useInput(
    (input, key) => {
      if (!isOpen) return;

      if (key.escape) {
        onClose();
        return;
      }

      if (key.return) {
        const action = actions[selectedIndex];
        if (action && !action.disabled) {
          action.handler();
          onClose();
        }
        return;
      }

      if (key.upArrow) {
        setSelectedIndex(prev => {
          const availableActions = actions.filter(a => !a.disabled);
          const currentInAvailable = availableActions.findIndex(a => a.id === actions[prev].id);
          const newIndex = Math.max(0, currentInAvailable - 1);
          return actions.findIndex(a => a.id === availableActions[newIndex].id);
        });
        return;
      }

      if (key.downArrow) {
        setSelectedIndex(prev => {
          const availableActions = actions.filter(a => !a.disabled);
          const currentInAvailable = availableActions.findIndex(a => a.id === actions[prev].id);
          const newIndex = Math.min(availableActions.length - 1, currentInAvailable + 1);
          return actions.findIndex(a => a.id === availableActions[newIndex].id);
        });
        return;
      }

      // Handle hotkey input
      if (!key.ctrl && !key.meta && input) {
        const action = actions.find(a => a.hotkey?.toLowerCase() === input.toLowerCase());
        if (action && !action.disabled) {
          action.handler();
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
      minWidth={40}
    >
      {/* Header */}
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold color={theme.accent}>{title}</Text>
        <Text dimColor>ESC: close</Text>
      </Box>

      {/* Actions */}
      <Box flexDirection="column" marginTop={1}>
        {actions.map((action, index) => (
          <Box
            key={action.id}
            borderStyle={index === selectedIndex && !action.disabled ? "single" : undefined}
            borderColor={index === selectedIndex && !action.disabled ? theme.accent : undefined}
            paddingX={index === selectedIndex && !action.disabled ? 1 : 0}
            flexDirection="row"
            justifyContent="space-between"
          >
            <Box flexDirection="row" columnGap={1}>
              <Text color={action.disabled ? theme.dim : action.destructive ? theme.error : undefined}>
                {action.icon}
              </Text>
              <Text
                color={action.disabled ? theme.dim : action.destructive ? theme.error : undefined}
                strikethrough={action.disabled}
              >
                {action.label}
              </Text>
            </Box>
            {action.hotkey && (
              <Text dimColor>[{action.hotkey}]</Text>
            )}
          </Box>
        ))}
      </Box>

      {/* Help text */}
      <Box marginTop={1}>
        <Text dimColor>↑↓: navigate • Enter: execute • hotkey: quick action</Text>
      </Box>
    </Box>
  );
});

// Quick actions for messages
export function useMessageActions(message: Message) {
  const { copyToClipboard } = useClipboard();
  const toast = useToast();

  const copyContent = useCallback(async () => {
    await copyToClipboard(message.content, 'Message content');
  }, [message.content, copyToClipboard]);

  const copyAsMarkdown = useCallback(async () => {
    const markdown = `**${message.role}**: ${message.content}`;
    await copyToClipboard(markdown, 'Message as markdown');
  }, [message, copyToClipboard]);

  const copyWithMetadata = useCallback(async () => {
    const metadata = JSON.stringify({
      id: message.id,
      role: message.role,
      content: message.content,
      timestamp: message.timestamp,
      tokens: message.tokens,
    }, null, 2);
    await copyToClipboard(metadata, 'Message with metadata');
  }, [message, copyToClipboard]);

  const regenerateMessage = useCallback(() => {
    toast.info('Regenerate', 'Feature coming soon');
  }, [toast]);

  const bookmarkMessage = useCallback(() => {
    toast.success('Bookmarked', 'Message bookmarked for later reference');
  }, [toast]);

  return {
    copyContent,
    copyAsMarkdown,
    copyWithMetadata,
    regenerateMessage,
    bookmarkMessage,
  };
}

// Quick actions for conversations
export function useConversationActions(messages: Message[]) {
  const { copyToClipboard } = useClipboard();
  const toast = useToast();

  const exportAsMarkdown = useCallback(async () => {
    const markdown = messages
      .map(msg => {
        const role = msg.role === 'user' ? '**You**' : msg.role === 'assistant' ? '**Assistant**' : '**Tool**';
        return `${role}: ${msg.content}\n`;
      })
      .join('\n');

    await copyToClipboard(markdown, 'Conversation as markdown');
  }, [messages, copyToClipboard]);

  const exportAsJSON = useCallback(async () => {
    const json = JSON.stringify(messages, null, 2);
    await copyToClipboard(json, 'Conversation as JSON');
  }, [messages, copyToClipboard]);

  const exportAsTXT = useCallback(async () => {
    const txt = messages
      .map(msg => `[${msg.role.toUpperCase()}]: ${msg.content}`)
      .join('\n\n');

    await copyToClipboard(txt, 'Conversation as text');
  }, [messages, copyToClipboard]);

  const getStatistics = useCallback(() => {
    const stats = {
      totalMessages: messages.length,
      userMessages: messages.filter(m => m.role === 'user').length,
      assistantMessages: messages.filter(m => m.role === 'assistant').length,
      toolMessages: messages.filter(m => m.role === 'tool').length,
      totalTokens: messages.reduce((sum, m) => sum + (m.tokens || 0), 0),
      averageMessageLength: messages.reduce((sum, m) => sum + m.content.length, 0) / messages.length,
      firstMessage: messages[0]?.timestamp,
      lastMessage: messages[messages.length - 1]?.timestamp,
    };

    const statsText = `📊 Conversation Statistics:

Messages: ${stats.totalMessages} total
- User: ${stats.userMessages}
- Assistant: ${stats.assistantMessages}
- Tool: ${stats.toolMessages}

Tokens: ${stats.totalTokens.toLocaleString()}
Average message length: ${Math.round(stats.averageMessageLength)} characters

Duration: ${stats.lastMessage && stats.firstMessage ?
  Math.round((stats.lastMessage - stats.firstMessage) / 1000 / 60) + ' minutes' : 'N/A'}`;

    copyToClipboard(statsText, 'Conversation statistics');
  }, [messages, copyToClipboard]);

  const clearConversation = useCallback(() => {
    toast.warning('Clear conversation', 'Feature coming soon - this will clear all messages');
  }, [toast]);

  return {
    exportAsMarkdown,
    exportAsJSON,
    exportAsTXT,
    getStatistics,
    clearConversation,
  };
}

// Theme quick actions
export function useThemeActions() {
  const toast = useToast();

  const themes = ['default', 'nord', 'dracula', 'monokai', 'cyberpunk'];

  const switchTheme = useCallback((themeName: string) => {
    toast.info('Theme switched', `Switched to ${themeName} theme`);
    // In real implementation, would dispatch theme change action
  }, [toast]);

  const getThemeActions = useCallback((): ContextAction[] => {
    return themes.map(theme => ({
      id: `theme-${theme}`,
      label: `Switch to ${theme}`,
      icon: '🎨',
      handler: () => switchTheme(theme),
    }));
  }, [switchTheme]);

  return { getThemeActions };
}

// Global quick actions hook
export function useGlobalActions() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuType, setMenuType] = useState<'main' | 'message' | 'export' | 'theme'>('main');

  const openMainMenu = useCallback(() => {
    setMenuType('main');
    setIsMenuOpen(true);
  }, []);

  const openMessageMenu = useCallback(() => {
    setMenuType('message');
    setIsMenuOpen(true);
  }, []);

  const openExportMenu = useCallback(() => {
    setMenuType('export');
    setIsMenuOpen(true);
  }, []);

  const openThemeMenu = useCallback(() => {
    setMenuType('theme');
    setIsMenuOpen(true);
  }, []);

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  // Global hotkeys
  useInput((input, key) => {
    // Ctrl+Space for main menu
    if (key.ctrl && input === ' ') {
      openMainMenu();
      return;
    }

    // Ctrl+Shift+E for export menu
    if (key.ctrl && key.shift && input === 'e') {
      openExportMenu();
      return;
    }

    // Ctrl+Shift+T for theme menu
    if (key.ctrl && key.shift && input === 't') {
      openThemeMenu();
      return;
    }
  });

  return {
    isMenuOpen,
    menuType,
    openMainMenu,
    openMessageMenu,
    openExportMenu,
    openThemeMenu,
    closeMenu,
  };
}

// Predefined action sets
export function getMainMenuActions(
  conversationActions: ReturnType<typeof useConversationActions>,
  themeActions: ReturnType<typeof useThemeActions>
): ContextAction[] {
  return [
    {
      id: 'export-markdown',
      label: 'Export as Markdown',
      icon: '📝',
      hotkey: 'm',
      description: 'Export conversation in Markdown format',
      handler: conversationActions.exportAsMarkdown,
    },
    {
      id: 'export-json',
      label: 'Export as JSON',
      icon: '📄',
      hotkey: 'j',
      description: 'Export raw conversation data',
      handler: conversationActions.exportAsJSON,
    },
    {
      id: 'statistics',
      label: 'Show Statistics',
      icon: '📊',
      hotkey: 's',
      description: 'Display conversation analytics',
      handler: conversationActions.getStatistics,
    },
    {
      id: 'clear',
      label: 'Clear Conversation',
      icon: '🗑️',
      hotkey: 'c',
      description: 'Clear all messages',
      handler: conversationActions.clearConversation,
      destructive: true,
    },
  ];
}

export function getMessageMenuActions(
  message: Message,
  messageActions: ReturnType<typeof useMessageActions>
): ContextAction[] {
  return [
    {
      id: 'copy-content',
      label: 'Copy Content',
      icon: '📋',
      hotkey: 'c',
      handler: messageActions.copyContent,
    },
    {
      id: 'copy-markdown',
      label: 'Copy as Markdown',
      icon: '📝',
      hotkey: 'm',
      handler: messageActions.copyAsMarkdown,
    },
    {
      id: 'copy-metadata',
      label: 'Copy with Metadata',
      icon: '🏷️',
      hotkey: 'd',
      handler: messageActions.copyWithMetadata,
    },
    {
      id: 'bookmark',
      label: 'Bookmark Message',
      icon: '🔖',
      hotkey: 'b',
      handler: messageActions.bookmarkMessage,
    },
    ...(message.role === 'assistant' ? [{
      id: 'regenerate',
      label: 'Regenerate Response',
      icon: '🔄',
      hotkey: 'r',
      handler: messageActions.regenerateMessage,
    }] : []),
  ];
}