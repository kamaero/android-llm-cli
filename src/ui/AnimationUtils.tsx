import React, { useState, useEffect, useCallback, memo } from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../theme.js';

// Animation timing utilities
export function useAnimationTimer(
  duration: number,
  enabled = true
): { progress: number; isComplete: boolean; restart: () => void } {
  const [startTime, setStartTime] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const restart = useCallback(() => {
    if (enabled) {
      setStartTime(Date.now());
      setProgress(0);
      setIsComplete(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    if (startTime === null) {
      setStartTime(Date.now());
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min(elapsed / duration, 1);

      setProgress(newProgress);

      if (newProgress >= 1) {
        setIsComplete(true);
        clearInterval(interval);
      }
    }, 16); // ~60fps

    return () => clearInterval(interval);
  }, [startTime, duration, enabled]);

  return { progress, isComplete, restart };
}

// Easing functions
export const easings = {
  linear: (t: number) => t,
  easeInOut: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeOut: (t: number) => t * (2 - t),
  easeIn: (t: number) => t * t,
  bounce: (t: number) => {
    if (t < 1/2.75) return 7.5625 * t * t;
    if (t < 2/2.75) return 7.5625 * (t -= 1.5/2.75) * t + 0.75;
    if (t < 2.5/2.75) return 7.5625 * (t -= 2.25/2.75) * t + 0.9375;
    return 7.5625 * (t -= 2.625/2.75) * t + 0.984375;
  },
};

// Typewriter effect hook
export function useTypewriter(
  text: string,
  speed = 50,
  enabled = true
): { displayText: string; isComplete: boolean; restart: () => void } {
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const restart = useCallback(() => {
    setDisplayText('');
    setCurrentIndex(0);
    setIsComplete(false);
  }, []);

  useEffect(() => {
    if (!enabled || isComplete || currentIndex >= text.length) {
      if (currentIndex >= text.length) {
        setIsComplete(true);
      }
      return;
    }

    const timer = setTimeout(() => {
      setDisplayText(prev => prev + text[currentIndex]);
      setCurrentIndex(prev => prev + 1);
    }, speed);

    return () => clearTimeout(timer);
  }, [currentIndex, text, speed, enabled, isComplete]);

  return { displayText, isComplete, restart };
}

// Fade in/out animation component
interface FadeProps {
  children: React.ReactNode;
  duration?: number;
  direction?: 'in' | 'out';
  enabled?: boolean;
  onComplete?: () => void;
}

export const FadeAnimation = memo(function FadeAnimation({
  children,
  duration = 500,
  direction = 'in',
  enabled = true,
  onComplete,
}: FadeProps) {
  const { progress, isComplete } = useAnimationTimer(duration, enabled);
  const opacity = direction === 'in' ? progress : 1 - progress;

  useEffect(() => {
    if (isComplete && onComplete) {
      onComplete();
    }
  }, [isComplete, onComplete]);

  if (!enabled) {
    return <>{children}</>;
  }

  // In terminal, we simulate fade with dimness
  if (opacity < 0.3) {
    return null; // Fully faded out
  } else if (opacity < 0.7) {
    return (
      <Box>
        <Text dimColor>{children}</Text>
      </Box>
    );
  } else {
    return <>{children}</>;
  }
});

// Slide animation component
interface SlideProps {
  children: React.ReactNode;
  direction: 'up' | 'down' | 'left' | 'right';
  duration?: number;
  enabled?: boolean;
}

export const SlideAnimation = memo(function SlideAnimation({
  children,
  direction,
  duration = 300,
  enabled = true,
}: SlideProps) {
  const { progress } = useAnimationTimer(duration, enabled);
  const eased = easings.easeOut(progress);

  if (!enabled || eased >= 0.9) {
    return <>{children}</>;
  }

  // In terminal, simulate slide by gradually revealing content
  if (direction === 'up' || direction === 'down') {
    const revealRatio = eased;
    if (revealRatio < 0.5) {
      return <Text dimColor>Loading...</Text>;
    }
  }

  return <>{children}</>;
});

// Typewriter text component
interface TypewriterTextProps {
  text: string;
  speed?: number;
  cursor?: boolean;
  onComplete?: () => void;
  enabled?: boolean;
}

export const TypewriterText = memo(function TypewriterText({
  text,
  speed = 30,
  cursor = true,
  onComplete,
  enabled = true,
}: TypewriterTextProps) {
  const { displayText, isComplete } = useTypewriter(text, speed, enabled);
  const [showCursor, setShowCursor] = useState(true);

  // Cursor blinking
  useEffect(() => {
    if (!cursor) return;

    const interval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 500);

    return () => clearInterval(interval);
  }, [cursor]);

  // Call onComplete when typing is done
  useEffect(() => {
    if (isComplete && onComplete) {
      onComplete();
    }
  }, [isComplete, onComplete]);

  if (!enabled) {
    return <Text>{text}</Text>;
  }

  return (
    <Text>
      {displayText}
      {cursor && !isComplete && showCursor && '█'}
      {cursor && isComplete && ' '}
    </Text>
  );
});

// Progress bar with animation
interface AnimatedProgressBarProps {
  progress: number; // 0-100
  width?: number;
  showPercent?: boolean;
  color?: string;
  animated?: boolean;
}

export const AnimatedProgressBar = memo(function AnimatedProgressBar({
  progress,
  width = 20,
  showPercent = true,
  color,
  animated = true,
}: AnimatedProgressBarProps) {
  const theme = useTheme();
  const [currentProgress, setCurrentProgress] = useState(0);

  // Smooth progress animation
  useEffect(() => {
    if (!animated) {
      setCurrentProgress(progress);
      return;
    }

    const increment = (progress - currentProgress) / 10;
    const timer = setInterval(() => {
      setCurrentProgress(prev => {
        const next = prev + increment;
        if (Math.abs(next - progress) < 0.1) {
          clearInterval(timer);
          return progress;
        }
        return next;
      });
    }, 50);

    return () => clearInterval(timer);
  }, [progress, currentProgress, animated]);

  const filledWidth = Math.round((currentProgress / 100) * width);
  const emptyWidth = width - filledWidth;

  return (
    <Box flexDirection="row" columnGap={1}>
      <Box flexDirection="row">
        <Text color={color || theme.accent}>{'█'.repeat(filledWidth)}</Text>
        <Text dimColor>{'░'.repeat(emptyWidth)}</Text>
      </Box>
      {showPercent && (
        <Text>{Math.round(currentProgress)}%</Text>
      )}
    </Box>
  );
});

// Pulse animation for elements
interface PulseProps {
  children: React.ReactNode;
  duration?: number;
  enabled?: boolean;
}

export const PulseAnimation = memo(function PulseAnimation({
  children,
  duration = 1000,
  enabled = true,
}: PulseProps) {
  const [phase, setPhase] = useState(0); // 0 = normal, 1 = highlighted

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      setPhase(prev => (prev + 1) % 2);
    }, duration / 2);

    return () => clearInterval(interval);
  }, [duration, enabled]);

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <Box>
      <Text inverse={phase === 1}>{children}</Text>
    </Box>
  );
});

// Loading dots animation
interface LoadingDotsProps {
  count?: number;
  speed?: number;
  enabled?: boolean;
}

export const LoadingDots = memo(function LoadingDots({
  count = 3,
  speed = 400,
  enabled = true,
}: LoadingDotsProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % count);
    }, speed);

    return () => clearInterval(interval);
  }, [count, speed, enabled]);

  if (!enabled) {
    return <Text>{'•'.repeat(count)}</Text>;
  }

  const dots = Array.from({ length: count }, (_, i) => (
    i === activeIndex ? '●' : '○'
  )).join(' ');

  return <Text>{dots}</Text>;
});

// Transition wrapper for switching between components
interface TransitionProps {
  children: React.ReactNode;
  transitionKey: string;
  duration?: number;
  type?: 'fade' | 'slide';
}

export const Transition = memo(function Transition({
  children,
  transitionKey,
  duration = 300,
  type = 'fade',
}: TransitionProps) {
  const [currentKey, setCurrentKey] = useState(transitionKey);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (transitionKey !== currentKey) {
      setIsTransitioning(true);

      setTimeout(() => {
        setCurrentKey(transitionKey);
        setIsTransitioning(false);
      }, duration / 2);
    }
  }, [transitionKey, currentKey, duration]);

  if (type === 'fade') {
    return (
      <FadeAnimation
        direction={isTransitioning ? 'out' : 'in'}
        duration={duration / 2}
        enabled={true}
      >
        {children}
      </FadeAnimation>
    );
  }

  return <>{children}</>;
});

// Hook for managing smooth scroll in terminal
export function useSmoothScroll() {
  const [scrollPosition, setScrollPosition] = useState(0);
  const [targetPosition, setTargetPosition] = useState(0);

  const scrollTo = useCallback((position: number, smooth = true) => {
    setTargetPosition(position);

    if (!smooth) {
      setScrollPosition(position);
      return;
    }

    // Animate scroll in terminal context
    const startPos = scrollPosition;
    const distance = position - startPos;
    const startTime = Date.now();
    const duration = 300;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easings.easeOut(progress);

      const currentPos = startPos + distance * eased;
      setScrollPosition(currentPos);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [scrollPosition]);

  return {
    scrollPosition,
    scrollTo,
  };
}