import React, { createContext, useContext, useState, useCallback, useEffect, memo } from 'react';
import { Box, Text, useInput } from 'ink';
import { useTheme } from '../theme.js';
import { TypewriterText, FadeAnimation, LoadingDots } from './AnimationUtils.js';
import { useBreakpoint } from './ResponsiveLayout.js';

// Help topic structure
export interface HelpTopic {
  id: string;
  title: string;
  category: string;
  description: string;
  content: string;
  tags: string[];
  shortcuts?: Array<{
    keys: string;
    description: string;
  }>;
  examples?: string[];
  relatedTopics?: string[];
}

// Tutorial step structure
export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  demonstration: string;
  userAction?: string;
  nextStepTrigger?: 'keypress' | 'timeout' | 'manual';
  duration?: number;
}

const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'basic-usage',
    title: 'Basic Usage',
    category: 'Getting Started',
    description: 'How to start a conversation',
    content: `Start typing your message in the input box at the bottom. Press Enter to send.

For multi-line messages, use Shift+Enter to create new lines.

The assistant will respond with helpful information and can use tools to help you with various tasks.`,
    tags: ['basics', 'chat', 'input'],
    shortcuts: [
      { keys: 'Enter', description: 'Send message' },
      { keys: 'Shift+Enter', description: 'New line' },
    ],
    examples: [
      'Hello! How can I help you today?',
      'Can you explain how React hooks work?',
      'Please create a simple TypeScript function'
    ]
  },
  {
    id: 'keyboard-shortcuts',
    title: 'Keyboard Shortcuts',
    category: 'Interface',
    description: 'All available keyboard shortcuts',
    content: `Global shortcuts:
• Ctrl+F: Open search
• Ctrl+D: Toggle detailed status bar
• Ctrl+Space: Open main menu
• Ctrl+H: Open this help system

Display modes:
• 1-5: Switch between display modes
• Ctrl+M: Cycle through modes

Input shortcuts:
• ↑/↓: Navigate command history
• Tab: Autocomplete slash commands
• Shift+Enter: Multi-line input`,
    tags: ['shortcuts', 'keyboard', 'hotkeys'],
    shortcuts: [
      { keys: 'Ctrl+F', description: 'Search messages' },
      { keys: 'Ctrl+D', description: 'Toggle status bar' },
      { keys: 'Ctrl+Space', description: 'Main menu' },
      { keys: 'Ctrl+H', description: 'Help system' },
      { keys: '1-5', description: 'Display modes' },
      { keys: 'Tab', description: 'Autocomplete' },
    ]
  },
  {
    id: 'display-modes',
    title: 'Display Modes',
    category: 'Interface',
    description: 'Different viewing modes for the interface',
    content: `Five display modes are available:

1. Normal (1): Standard view with all features
2. Reading (2): Clean view focused on content
3. Compact (3): Compressed view for small screens
4. Debug (4): Full details for debugging
5. Focus (5): Distraction-free writing mode

Each mode shows/hides different UI elements like tool calls, timestamps, tokens, and metadata.`,
    tags: ['display', 'modes', 'ui'],
    shortcuts: [
      { keys: '1', description: 'Normal mode' },
      { keys: '2', description: 'Reading mode' },
      { keys: '3', description: 'Compact mode' },
      { keys: '4', description: 'Debug mode' },
      { keys: '5', description: 'Focus mode' },
      { keys: 'Ctrl+M', description: 'Cycle modes' },
    ],
    relatedTopics: ['keyboard-shortcuts', 'interface-overview']
  },
  {
    id: 'search-functionality',
    title: 'Search & Navigation',
    category: 'Features',
    description: 'How to search through conversation history',
    content: `Press Ctrl+F to open the search box. Features include:

• Full-text search across all messages
• Case-sensitive option (toggle with Ctrl+Shift+C)
• Regular expression support
• Navigate results with ↑/↓ arrows
• Real-time highlighting of matches
• Search within specific message roles

Use quotes for exact phrases: "exact match"
Use regex for patterns: \\b\\w+@\\w+\\.\\w+\\b (emails)`,
    tags: ['search', 'navigation', 'regex'],
    shortcuts: [
      { keys: 'Ctrl+F', description: 'Open search' },
      { keys: 'Escape', description: 'Close search' },
      { keys: '↑/↓', description: 'Navigate results' },
    ],
    examples: [
      'Search for "TypeScript"',
      'Find all error messages',
      'Look for specific function names'
    ]
  },
  {
    id: 'slash-commands',
    title: 'Slash Commands',
    category: 'Advanced',
    description: 'Special commands starting with /',
    content: `Commands available in the input:

/help - Open help system
/search <query> - Quick search
/clear - Clear conversation (if available)
/stats - Show session statistics
/export - Export conversation data

Type / and use Tab for autocomplete to see all available commands.`,
    tags: ['commands', 'slash', 'autocomplete'],
    shortcuts: [
      { keys: 'Tab', description: 'Autocomplete commands' },
      { keys: '/', description: 'Start command' },
    ],
    examples: [
      '/help keyboard-shortcuts',
      '/search typescript',
      '/stats'
    ],
    relatedTopics: ['basic-usage', 'keyboard-shortcuts']
  },
  {
    id: 'context-menu',
    title: 'Context Menu & Actions',
    category: 'Features',
    description: 'Quick actions and export options',
    content: `Access quick actions with keyboard shortcuts:

• Ctrl+Space: Main context menu
• Export conversation in various formats
• Copy message content to clipboard
• View conversation statistics
• Bookmark important messages

Each action has keyboard shortcuts for quick access.`,
    tags: ['context', 'menu', 'export', 'actions'],
    shortcuts: [
      { keys: 'Ctrl+Space', description: 'Open main menu' },
      { keys: 'Escape', description: 'Close menu' },
      { keys: '↑/↓', description: 'Navigate options' },
      { keys: 'Enter', description: 'Execute action' },
    ]
  },
  {
    id: 'session-analytics',
    title: 'Session Analytics',
    category: 'Advanced',
    description: 'Understanding your conversation metrics',
    content: `The status bar shows live metrics:

• Message counts and token usage
• Estimated cost and duration
• Response times and performance
• Tool usage statistics

Press Ctrl+D for detailed analytics including:
• Token throughput rates
• Performance insights
• Cost monitoring alerts
• Tool success rates`,
    tags: ['analytics', 'metrics', 'performance', 'cost'],
    shortcuts: [
      { keys: 'Ctrl+D', description: 'Toggle detailed stats' },
      { keys: 'Ctrl+E', description: 'Export analytics' },
      { keys: 'Ctrl+R', description: 'Reset metrics' },
    ],
    relatedTopics: ['interface-overview']
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    category: 'Help',
    description: 'Common issues and solutions',
    content: `Common problems and fixes:

Screen flickering:
• Reduce terminal font size
• Ensure stable network connection
• Switch to compact display mode (3)

Slow responses:
• Check network connectivity
• Monitor token usage (Ctrl+D)
• Try shorter, more focused messages

Input not working:
• Ensure focus is in input box
• Check for conflicting shortcuts
• Try Escape to reset input state

Performance issues:
• Switch to reading mode (2) for better performance
• Clear conversation history if very long
• Monitor cost and token usage`,
    tags: ['troubleshooting', 'performance', 'issues'],
    examples: [
      'My screen keeps flickering',
      'Responses are very slow',
      'Keyboard shortcuts not working'
    ]
  }
];

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to LLM CLI',
    description: 'Let\'s take a quick tour of the interface',
    demonstration: 'Welcome! This is your AI assistant in the terminal. Let me show you around.',
    nextStepTrigger: 'keypress',
  },
  {
    id: 'basic-chat',
    title: 'Basic Conversation',
    description: 'How to chat with the assistant',
    demonstration: 'Type your message in the input box below and press Enter to send. Try saying hello!',
    userAction: 'Type a message and press Enter',
    nextStepTrigger: 'manual',
  },
  {
    id: 'display-modes',
    title: 'Display Modes',
    description: 'Customize your viewing experience',
    demonstration: 'Press numbers 1-5 to switch between different display modes. Try pressing 2 for reading mode.',
    userAction: 'Press 2 for reading mode',
    nextStepTrigger: 'keypress',
  },
  {
    id: 'search',
    title: 'Search Feature',
    description: 'Find content in your conversation',
    demonstration: 'Press Ctrl+F to search through messages. Perfect for long conversations!',
    userAction: 'Press Ctrl+F to open search',
    nextStepTrigger: 'keypress',
  },
  {
    id: 'shortcuts',
    title: 'Keyboard Shortcuts',
    description: 'Boost your productivity',
    demonstration: 'Use Ctrl+Space for quick actions, Ctrl+D for detailed stats, and Ctrl+H for help anytime.',
    nextStepTrigger: 'timeout',
    duration: 3000,
  },
  {
    id: 'complete',
    title: 'Tour Complete!',
    description: 'You\'re ready to go',
    demonstration: 'Great! You now know the basics. Press Ctrl+H anytime for help, or Ctrl+Space for quick actions.',
    nextStepTrigger: 'keypress',
  }
];

// Help context
interface HelpContextType {
  isOpen: boolean;
  currentTopic: string | null;
  searchQuery: string;
  isInTutorial: boolean;
  currentTutorialStep: number;
  openHelp: (topicId?: string) => void;
  closeHelp: () => void;
  searchTopics: (query: string) => void;
  startTutorial: () => void;
  nextTutorialStep: () => void;
  skipTutorial: () => void;
}

const HelpContext = createContext<HelpContextType | null>(null);

export function useHelp() {
  const context = useContext(HelpContext);
  if (!context) {
    throw new Error('useHelp must be used within HelpProvider');
  }
  return context;
}

export function HelpProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentTopic, setCurrentTopic] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isInTutorial, setIsInTutorial] = useState(false);
  const [currentTutorialStep, setCurrentTutorialStep] = useState(0);

  const openHelp = useCallback((topicId?: string) => {
    setIsOpen(true);
    setCurrentTopic(topicId || null);
    setSearchQuery('');
  }, []);

  const closeHelp = useCallback(() => {
    setIsOpen(false);
    setCurrentTopic(null);
    setSearchQuery('');
  }, []);

  const searchTopics = useCallback((query: string) => {
    setSearchQuery(query);
    setCurrentTopic(null);
  }, []);

  const startTutorial = useCallback(() => {
    setIsInTutorial(true);
    setCurrentTutorialStep(0);
  }, []);

  const nextTutorialStep = useCallback(() => {
    if (currentTutorialStep < TUTORIAL_STEPS.length - 1) {
      setCurrentTutorialStep(prev => prev + 1);
    } else {
      setIsInTutorial(false);
    }
  }, [currentTutorialStep]);

  const skipTutorial = useCallback(() => {
    setIsInTutorial(false);
  }, []);

  // Global help hotkey
  useInput((input, key) => {
    if (key.ctrl && input === 'h' && !isOpen) {
      openHelp();
    }
  });

  return (
    <HelpContext.Provider value={{
      isOpen,
      currentTopic,
      searchQuery,
      isInTutorial,
      currentTutorialStep,
      openHelp,
      closeHelp,
      searchTopics,
      startTutorial,
      nextTutorialStep,
      skipTutorial,
    }}>
      {children}
    </HelpContext.Provider>
  );
}

// Main help interface
interface HelpSystemProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpSystem = memo(function HelpSystem({ isOpen, onClose }: HelpSystemProps) {
  const theme = useTheme();
  const breakpoint = useBreakpoint();
  const { currentTopic, searchQuery, searchTopics } = useHelp();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchInput, setSearchInput] = useState('');

  // Filter topics based on search
  const filteredTopics = HELP_TOPICS.filter(topic => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      topic.title.toLowerCase().includes(query) ||
      topic.description.toLowerCase().includes(query) ||
      topic.content.toLowerCase().includes(query) ||
      topic.tags.some(tag => tag.includes(query))
    );
  });

  const selectedTopic = currentTopic
    ? HELP_TOPICS.find(t => t.id === currentTopic)
    : null;

  useInput(
    (input, key) => {
      if (!isOpen) return;

      if (key.escape) {
        onClose();
        return;
      }

      if (key.return && !selectedTopic) {
        // Open selected topic
        const topic = filteredTopics[selectedIndex];
        if (topic) {
          searchTopics('');
          setSelectedIndex(0);
        }
        return;
      }

      if (key.upArrow && !selectedTopic) {
        setSelectedIndex(prev => Math.max(0, prev - 1));
        return;
      }

      if (key.downArrow && !selectedTopic) {
        setSelectedIndex(prev => Math.min(filteredTopics.length - 1, prev + 1));
        return;
      }

      // Search input
      if (!selectedTopic && input && !key.ctrl) {
        setSearchInput(prev => prev + input);
        searchTopics(searchInput + input);
      }

      if (key.backspace && !selectedTopic) {
        const newInput = searchInput.slice(0, -1);
        setSearchInput(newInput);
        searchTopics(newInput);
      }
    },
    { isActive: isOpen }
  );

  if (!isOpen) return null;

  const isCompact = breakpoint === 'xs' || breakpoint === 'sm';

  return (
    <Box
      borderStyle="double"
      borderColor={theme.accent}
      flexDirection="column"
      paddingX={1}
      minWidth={isCompact ? 40 : 70}
      height={isCompact ? 20 : 30}
    >
      {/* Header */}
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold color={theme.accent}>
          {selectedTopic ? `📖 ${selectedTopic.title}` : '❓ Help & Documentation'}
        </Text>
        <Text dimColor>ESC: close</Text>
      </Box>

      {selectedTopic ? (
        /* Topic detail view */
        <TopicDetail topic={selectedTopic} onBack={() => searchTopics('')} />
      ) : (
        /* Topic list view */
        <>
          {/* Search box */}
          <Box marginTop={1} borderStyle="single" borderColor={theme.dim} paddingX={1}>
            <Text dimColor>Search: {searchInput}█</Text>
          </Box>

          {/* Category sections */}
          <Box flexDirection="column" marginTop={1} flexGrow={1} overflowY="hidden">
            {['Getting Started', 'Interface', 'Features', 'Advanced', 'Help'].map(category => {
              const categoryTopics = filteredTopics.filter(t => t.category === category);
              if (categoryTopics.length === 0) return null;

              return (
                <Box key={category} flexDirection="column" marginBottom={1}>
                  <Text bold color={theme.accent}>{category}</Text>
                  {categoryTopics.map((topic, index) => {
                    const globalIndex = filteredTopics.indexOf(topic);
                    const isSelected = globalIndex === selectedIndex;

                    return (
                      <Box
                        key={topic.id}
                        borderStyle={isSelected ? "single" : undefined}
                        borderColor={isSelected ? theme.accent : undefined}
                        paddingX={isSelected ? 1 : 0}
                        paddingLeft={isSelected ? 1 : 2}
                      >
                        <Box flexDirection="row" columnGap={1}>
                          <Text bold={isSelected}>{topic.title}</Text>
                          <Text dimColor>— {topic.description}</Text>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              );
            })}
          </Box>

          {/* Footer */}
          <Box marginTop={1} borderColor={theme.dim} borderStyle="single" paddingX={1}>
            <Text dimColor>
              ↑↓: navigate • Enter: open topic • Type: search • /tutorial: start tutorial
            </Text>
          </Box>
        </>
      )}
    </Box>
  );
});

// Topic detail component
interface TopicDetailProps {
  topic: HelpTopic;
  onBack: () => void;
}

const TopicDetail = memo(function TopicDetail({ topic, onBack }: TopicDetailProps) {
  const theme = useTheme();
  const [showShortcuts, setShowShortcuts] = useState(false);

  useInput((input, key) => {
    if (key.backspace || (key.ctrl && input === '[')) {
      onBack();
    }

    if (input === 's' && topic.shortcuts) {
      setShowShortcuts(prev => !prev);
    }
  });

  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* Topic content */}
      <Box
        flexDirection="column"
        marginTop={1}
        flexGrow={1}
        borderStyle="single"
        borderColor={theme.dim}
        paddingX={1}
      >
        <Text>{topic.content}</Text>

        {/* Examples */}
        {topic.examples && topic.examples.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Text bold color={theme.accent}>Examples:</Text>
            {topic.examples.map((example, i) => (
              <Text key={i} dimColor>• {example}</Text>
            ))}
          </Box>
        )}

        {/* Related topics */}
        {topic.relatedTopics && topic.relatedTopics.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Text bold color={theme.accent}>Related:</Text>
            <Text dimColor>
              {topic.relatedTopics.map(id => {
                const related = HELP_TOPICS.find(t => t.id === id);
                return related?.title || id;
              }).join(', ')}
            </Text>
          </Box>
        )}
      </Box>

      {/* Shortcuts panel */}
      {showShortcuts && topic.shortcuts && (
        <Box
          marginTop={1}
          borderStyle="single"
          borderColor={theme.success}
          paddingX={1}
          flexDirection="column"
        >
          <Text bold color={theme.success}>Keyboard Shortcuts:</Text>
          {topic.shortcuts.map((shortcut, i) => (
            <Box key={i} flexDirection="row" justifyContent="space-between">
              <Text>{shortcut.description}</Text>
              <Text color={theme.accent}>[{shortcut.keys}]</Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Footer */}
      <Box marginTop={1} flexDirection="row" justifyContent="space-between">
        <Text dimColor>Backspace: back</Text>
        {topic.shortcuts && (
          <Text dimColor>S: {showShortcuts ? 'hide' : 'show'} shortcuts</Text>
        )}
      </Box>
    </Box>
  );
});

// Interactive tutorial overlay
interface TutorialProps {
  isActive: boolean;
  currentStep: number;
  onNext: () => void;
  onSkip: () => void;
}

export const Tutorial = memo(function Tutorial({ isActive, currentStep, onNext, onSkip }: TutorialProps) {
  const theme = useTheme();
  const [showDemo, setShowDemo] = useState(false);

  const step = TUTORIAL_STEPS[currentStep];

  useEffect(() => {
    if (isActive && step) {
      setShowDemo(true);

      if (step.nextStepTrigger === 'timeout' && step.duration) {
        const timer = setTimeout(onNext, step.duration);
        return () => clearTimeout(timer);
      }
    }
  }, [isActive, step, onNext]);

  useInput(
    (input, key) => {
      if (!isActive) return;

      if (key.escape) {
        onSkip();
        return;
      }

      if (step?.nextStepTrigger === 'keypress') {
        onNext();
      }
    },
    { isActive }
  );

  if (!isActive || !step) return null;

  return (
    <FadeAnimation direction="in" duration={300} enabled={true}>
      <Box
        position="absolute"
        top={2}
        right={2}
        borderStyle="double"
        borderColor={theme.accent}
        paddingX={2}
        paddingY={1}
        backgroundColor="black"
        flexDirection="column"
        minWidth={40}
      >
        {/* Header */}
        <Box flexDirection="row" justifyContent="space-between" marginBottom={1}>
          <Text bold color={theme.accent}>
            🎓 Tutorial ({currentStep + 1}/{TUTORIAL_STEPS.length})
          </Text>
          <Text dimColor onPress={onSkip}>ESC: skip</Text>
        </Box>

        {/* Step title */}
        <Text bold>{step.title}</Text>

        {/* Demonstration */}
        <Box marginTop={1} borderStyle="single" borderColor={theme.dim} paddingX={1}>
          {showDemo ? (
            <TypewriterText
              text={step.demonstration}
              speed={30}
              cursor={false}
              enabled={true}
            />
          ) : (
            <LoadingDots count={3} speed={300} enabled={true} />
          )}
        </Box>

        {/* User action required */}
        {step.userAction && (
          <Box marginTop={1} borderStyle="single" borderColor={theme.success} paddingX={1}>
            <Text color={theme.success}>👋 Try this: {step.userAction}</Text>
          </Box>
        )}

        {/* Progress indicator */}
        <Box marginTop={1} flexDirection="row" columnGap={1}>
          {TUTORIAL_STEPS.map((_, i) => (
            <Text key={i} color={i === currentStep ? theme.accent : theme.dim}>
              {i <= currentStep ? '●' : '○'}
            </Text>
          ))}
        </Box>

        {/* Footer */}
        <Box marginTop={1} justifyContent="center">
          <Text dimColor>
            {step.nextStepTrigger === 'keypress'
              ? 'Press any key to continue'
              : step.nextStepTrigger === 'manual'
              ? step.userAction
              : 'Please wait...'}
          </Text>
        </Box>
      </Box>
    </FadeAnimation>
  );
});

// Quick help tooltip
export const QuickHelp = memo(function QuickHelp({ shortcut }: { shortcut: string }) {
  const theme = useTheme();

  return (
    <Box borderStyle="round" borderColor={theme.dim} paddingX={1}>
      <Text dimColor>Press {shortcut} for help</Text>
    </Box>
  );
});

// Context-sensitive help hook
export function useContextualHelp(context: string) {
  const { openHelp } = useHelp();

  const getRelevantTopics = useCallback((context: string): string[] => {
    switch (context) {
      case 'input':
        return ['basic-usage', 'slash-commands'];
      case 'search':
        return ['search-functionality'];
      case 'status':
        return ['session-analytics'];
      case 'menu':
        return ['context-menu'];
      default:
        return ['basic-usage'];
    }
  }, []);

  const showHelp = useCallback((topicId?: string) => {
    const topics = getRelevantTopics(context);
    openHelp(topicId || topics[0]);
  }, [context, getRelevantTopics, openHelp]);

  return { showHelp, getRelevantTopics };
}