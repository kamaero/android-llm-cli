import React, { memo, useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../theme.js';
import {
  TypewriterText,
  FadeAnimation,
  AnimatedProgressBar,
  PulseAnimation,
  LoadingDots,
} from './AnimationUtils.js';
import type { Message } from '../types.js';

interface AnimatedMessageProps {
  message: Message;
  isLatest?: boolean;
  enableTypewriter?: boolean;
  enableFadeIn?: boolean;
  showProgress?: boolean;
  onAnimationComplete?: () => void;
}

export const AnimatedMessage = memo(function AnimatedMessage({
  message,
  isLatest = false,
  enableTypewriter = true,
  enableFadeIn = true,
  showProgress = false,
  onAnimationComplete,
}: AnimatedMessageProps) {
  const theme = useTheme();
  const [contentVisible, setContentVisible] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  // Show content after fade-in completes
  const handleFadeComplete = () => {
    setContentVisible(true);
    if (isLatest && enableTypewriter && message.role === 'assistant') {
      setIsTyping(true);
    }
  };

  const handleTypewriterComplete = () => {
    setIsTyping(false);
    onAnimationComplete?.();
  };

  // For latest assistant messages, use typewriter effect
  const shouldUseTypewriter = isLatest &&
                             enableTypewriter &&
                             message.role === 'assistant' &&
                             contentVisible &&
                             isTyping;

  const renderRoleHeader = () => {
    let color: string;
    let icon: string;

    switch (message.role) {
      case 'user':
        color = theme.user;
        icon = '👤';
        break;
      case 'assistant':
        color = theme.assistant;
        icon = '🤖';
        break;
      case 'tool':
        color = message.tool_result?.is_error ? theme.error : theme.tool;
        icon = message.tool_result?.is_error ? '❌' : '🔧';
        break;
      default:
        color = theme.dim;
        icon = '❓';
    }

    return (
      <Box flexDirection="row" columnGap={1}>
        <Text>{icon}</Text>
        <Text bold color={color}>
          {message.role === 'user' ? 'You' :
           message.role === 'assistant' ? 'Assistant' :
           'Tool'}
        </Text>
        {isTyping && <LoadingDots count={3} speed={300} />}
      </Box>
    );
  };

  const renderContent = () => {
    if (!contentVisible) {
      return null;
    }

    // Tool results have special formatting
    if (message.role === 'tool') {
      const isError = message.tool_result?.is_error;
      return (
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor={isError ? theme.error : theme.toolBorder}
          paddingX={1}
          marginTop={1}
        >
          <Text color={isError ? theme.error : undefined}>
            {message.tool_result?.output || message.content}
          </Text>
        </Box>
      );
    }

    // Regular message content
    if (shouldUseTypewriter) {
      return (
        <Box paddingLeft={2} marginTop={1}>
          <TypewriterText
            text={message.content}
            speed={20}
            cursor={true}
            onComplete={handleTypewriterComplete}
            enabled={true}
          />
        </Box>
      );
    } else {
      return (
        <Box paddingLeft={2} marginTop={1}>
          <Text>{message.content}</Text>
        </Box>
      );
    }
  };

  const renderToolCalls = () => {
    if (!message.tool_calls || message.tool_calls.length === 0) {
      return null;
    }

    return (
      <Box flexDirection="column" marginTop={1}>
        {message.tool_calls.map((toolCall, index) => (
          <PulseAnimation key={toolCall.id} enabled={isLatest} duration={2000}>
            <Box
              borderStyle="round"
              borderColor={theme.accent}
              paddingX={1}
              marginTop={1}
              flexDirection="column"
            >
              <Box flexDirection="row" columnGap={1}>
                <Text>⚡</Text>
                <Text bold color={theme.accent}>
                  {toolCall.name}
                </Text>
                {isLatest && (
                  <LoadingDots count={3} speed={200} enabled={true} />
                )}
              </Box>
              <Text dimColor>
                {JSON.stringify(toolCall.input, null, 2)}
              </Text>
            </Box>
          </PulseAnimation>
        ))}
      </Box>
    );
  };

  const renderTokenInfo = () => {
    if (!message.tokens || !isLatest) return null;

    return (
      <Box marginTop={1} paddingLeft={2}>
        <Text dimColor>
          💰 {message.tokens} tokens
        </Text>
      </Box>
    );
  };

  const renderProgress = () => {
    if (!showProgress || !isLatest || message.role !== 'assistant') {
      return null;
    }

    // Simulate progress based on content length
    const expectedLength = 500; // Assume average response length
    const currentLength = message.content.length;
    const progress = Math.min((currentLength / expectedLength) * 100, 95);

    return (
      <Box marginTop={1} paddingLeft={2}>
        <AnimatedProgressBar
          progress={progress}
          width={30}
          showPercent={false}
          color={theme.accent}
          animated={true}
        />
      </Box>
    );
  };

  return (
    <FadeAnimation
      direction="in"
      duration={enableFadeIn ? 300 : 0}
      enabled={enableFadeIn}
      onComplete={handleFadeComplete}
    >
      <Box flexDirection="column" marginBottom={1}>
        {renderRoleHeader()}
        {renderContent()}
        {renderToolCalls()}
        {renderProgress()}
        {renderTokenInfo()}
      </Box>
    </FadeAnimation>
  );
});

// Enhanced MessageList with animations
interface AnimatedMessageListProps {
  messages: Message[];
  enableAnimations?: boolean;
  showProgress?: boolean;
  onMessageAnimationComplete?: (messageId: string) => void;
}

export const AnimatedMessageList = memo(function AnimatedMessageList({
  messages,
  enableAnimations = true,
  showProgress = false,
  onMessageAnimationComplete,
}: AnimatedMessageListProps) {
  const theme = useTheme();

  if (messages.length === 0) {
    return (
      <Box flexGrow={1} alignItems="center" justifyContent="center">
        <FadeAnimation direction="in" duration={500} enabled={enableAnimations}>
          <Text dimColor>✨ Ready to chat! Start typing below.</Text>
        </FadeAnimation>
      </Box>
    );
  }

  // Keep only recent messages for performance
  const MAX_VISIBLE = 50;
  const hidden = Math.max(0, messages.length - MAX_VISIBLE);
  const visible = messages.slice(-MAX_VISIBLE);

  return (
    <Box flexGrow={1} flexDirection="column" paddingX={1}>
      {hidden > 0 && (
        <FadeAnimation direction="in" duration={300} enabled={enableAnimations}>
          <Text dimColor>
            ⬆️ {hidden} older message{hidden === 1 ? '' : 's'} (scroll up)
          </Text>
        </FadeAnimation>
      )}

      {visible.map((msg, index) => {
        const isLatest = index === visible.length - 1;

        return (
          <AnimatedMessage
            key={msg.id}
            message={msg}
            isLatest={isLatest}
            enableTypewriter={enableAnimations && isLatest}
            enableFadeIn={enableAnimations}
            showProgress={showProgress}
            onAnimationComplete={() => onMessageAnimationComplete?.(msg.id)}
          />
        );
      })}
    </Box>
  );
});

// Hook for managing message animations
export function useMessageAnimations() {
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [progressEnabled, setProgressEnabled] = useState(false);
  const [typewriterSpeed, setTypewriterSpeed] = useState(20);

  const toggleAnimations = () => setAnimationsEnabled(prev => !prev);
  const toggleProgress = () => setProgressEnabled(prev => !prev);

  const setSpeed = (speed: number) => {
    setTypewriterSpeed(Math.max(1, Math.min(100, speed)));
  };

  return {
    animationsEnabled,
    progressEnabled,
    typewriterSpeed,
    toggleAnimations,
    toggleProgress,
    setSpeed,
  };
}

// Streaming response animation component
interface StreamingResponseProps {
  isActive: boolean;
  speed?: number;
}

export const StreamingResponse = memo(function StreamingResponse({
  isActive,
  speed = 30,
}: StreamingResponseProps) {
  const theme = useTheme();
  const [dots, setDots] = useState('');

  useEffect(() => {
    if (!isActive) {
      setDots('');
      return;
    }

    let dotCount = 0;
    const interval = setInterval(() => {
      dotCount = (dotCount + 1) % 4;
      setDots('.'.repeat(dotCount));
    }, speed * 10);

    return () => clearInterval(interval);
  }, [isActive, speed]);

  if (!isActive) return null;

  return (
    <Box flexDirection="row" columnGap={1}>
      <Text color={theme.accent}>🤖 Assistant is typing</Text>
      <Text color={theme.accent}>{dots}</Text>
    </Box>
  );
});