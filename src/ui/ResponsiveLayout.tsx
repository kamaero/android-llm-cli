import React, { useState, useEffect, useCallback, memo } from 'react';
import { Box, Text, measureElement } from 'ink';
import { useTheme } from '../theme.js';

// Terminal size detection hook
export function useTerminalSize() {
  const [size, setSize] = useState({
    width: process.stdout.columns || 80,
    height: process.stdout.rows || 24,
  });

  useEffect(() => {
    const updateSize = () => {
      setSize({
        width: process.stdout.columns || 80,
        height: process.stdout.rows || 24,
      });
    };

    // Listen for terminal resize
    process.stdout.on('resize', updateSize);

    // Initial size
    updateSize();

    return () => {
      process.stdout.off('resize', updateSize);
    };
  }, []);

  return size;
}

// Breakpoint system for terminal widths
export const breakpoints = {
  xs: 40,   // Very narrow (mobile terminals)
  sm: 60,   // Small terminals
  md: 80,   // Medium terminals (default)
  lg: 120,  // Large terminals
  xl: 160,  // Extra large terminals
} as const;

export type Breakpoint = keyof typeof breakpoints;

export function useBreakpoint(): Breakpoint {
  const { width } = useTerminalSize();

  if (width >= breakpoints.xl) return 'xl';
  if (width >= breakpoints.lg) return 'lg';
  if (width >= breakpoints.md) return 'md';
  if (width >= breakpoints.sm) return 'sm';
  return 'xs';
}

// Responsive component that adapts based on screen size
interface ResponsiveProps {
  children: React.ReactNode;
  xs?: React.ReactNode;
  sm?: React.ReactNode;
  md?: React.ReactNode;
  lg?: React.ReactNode;
  xl?: React.ReactNode;
}

export const Responsive = memo(function Responsive({
  children,
  xs,
  sm,
  md,
  lg,
  xl,
}: ResponsiveProps) {
  const breakpoint = useBreakpoint();

  switch (breakpoint) {
    case 'xs':
      return <>{xs || children}</>;
    case 'sm':
      return <>{sm || xs || children}</>;
    case 'md':
      return <>{md || sm || xs || children}</>;
    case 'lg':
      return <>{lg || md || sm || xs || children}</>;
    case 'xl':
      return <>{xl || lg || md || sm || xs || children}</>;
    default:
      return <>{children}</>;
  }
});

// Grid system for terminal
interface GridProps {
  children: React.ReactNode;
  columns?: number;
  gap?: number;
  responsive?: Partial<Record<Breakpoint, number>>;
}

export const Grid = memo(function Grid({
  children,
  columns = 1,
  gap = 1,
  responsive,
}: GridProps) {
  const breakpoint = useBreakpoint();
  const actualColumns = responsive?.[breakpoint] || columns;

  const items = React.Children.toArray(children);
  const rows: React.ReactNode[][] = [];

  // Group items into rows
  for (let i = 0; i < items.length; i += actualColumns) {
    rows.push(items.slice(i, i + actualColumns));
  }

  return (
    <Box flexDirection="column" rowGap={gap}>
      {rows.map((row, rowIndex) => (
        <Box key={rowIndex} flexDirection="row" columnGap={gap}>
          {row.map((item, colIndex) => (
            <Box key={colIndex} flexGrow={1}>
              {item}
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
});

// Responsive text that wraps appropriately
interface ResponsiveTextProps {
  children: string;
  maxWidth?: number;
  responsive?: Partial<Record<Breakpoint, number>>;
}

export const ResponsiveText = memo(function ResponsiveText({
  children,
  maxWidth,
  responsive,
}: ResponsiveTextProps) {
  const breakpoint = useBreakpoint();
  const { width } = useTerminalSize();

  const actualMaxWidth = responsive?.[breakpoint] || maxWidth || width - 4;

  // Simple word wrapping
  const wrapText = (text: string, maxWidth: number): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;

      if (testLine.length <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          // Word is too long, break it
          lines.push(word.slice(0, maxWidth));
          currentLine = word.slice(maxWidth);
        }
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  };

  const lines = wrapText(children, actualMaxWidth);

  return (
    <Box flexDirection="column">
      {lines.map((line, index) => (
        <Text key={index}>{line}</Text>
      ))}
    </Box>
  );
});

// Adaptive layout component
interface AdaptiveLayoutProps {
  sidebar?: React.ReactNode;
  main: React.ReactNode;
  footer?: React.ReactNode;
  sidebarWidth?: number;
  collapseSidebar?: Breakpoint;
}

export const AdaptiveLayout = memo(function AdaptiveLayout({
  sidebar,
  main,
  footer,
  sidebarWidth = 25,
  collapseSidebar = 'sm',
}: AdaptiveLayoutProps) {
  const breakpoint = useBreakpoint();
  const { width } = useTerminalSize();

  const shouldCollapseSidebar = breakpoints[breakpoint] <= breakpoints[collapseSidebar];
  const showSidebar = sidebar && !shouldCollapseSidebar && width > sidebarWidth + 20;

  if (showSidebar) {
    // Side-by-side layout for large screens
    return (
      <Box flexDirection="column" width="100%">
        <Box flexDirection="row" flexGrow={1}>
          <Box width={sidebarWidth} flexDirection="column">
            {sidebar}
          </Box>
          <Box flexGrow={1} flexDirection="column">
            {main}
          </Box>
        </Box>
        {footer && (
          <Box>
            {footer}
          </Box>
        )}
      </Box>
    );
  } else {
    // Stacked layout for small screens
    return (
      <Box flexDirection="column" width="100%">
        {main}
        {footer && (
          <Box>
            {footer}
          </Box>
        )}
      </Box>
    );
  }
});

// Responsive status bar
interface ResponsiveStatusBarProps {
  items: Array<{
    key: string;
    content: React.ReactNode;
    priority: number; // Lower number = higher priority
    hideOn?: Breakpoint[];
  }>;
}

export const ResponsiveStatusBar = memo(function ResponsiveStatusBar({
  items,
}: ResponsiveStatusBarProps) {
  const breakpoint = useBreakpoint();
  const { width } = useTerminalSize();
  const theme = useTheme();

  // Filter and sort items by priority
  const visibleItems = items
    .filter(item => !item.hideOn?.includes(breakpoint))
    .sort((a, b) => a.priority - b.priority);

  // Estimate available width and show as many items as possible
  const estimatedItemWidth = 15; // Average width per item
  const maxItems = Math.floor(width / estimatedItemWidth);
  const displayItems = visibleItems.slice(0, maxItems);

  return (
    <Box borderStyle="single" borderColor={theme.accent} paddingX={1}>
      <Box flexDirection="row" justifyContent="space-between" width="100%">
        {displayItems.map((item, index) => (
          <React.Fragment key={item.key}>
            {index > 0 && <Text dimColor> │ </Text>}
            {item.content}
          </React.Fragment>
        ))}
        {visibleItems.length > displayItems.length && (
          <>
            <Text dimColor> │ </Text>
            <Text dimColor>+{visibleItems.length - displayItems.length} more</Text>
          </>
        )}
      </Box>
    </Box>
  );
});

// Responsive input that adapts to screen size
interface ResponsiveInputProps {
  value: string;
  placeholder?: string;
  multiline?: boolean;
  maxHeight?: number;
}

export const ResponsiveInput = memo(function ResponsiveInput({
  value,
  placeholder,
  multiline = false,
  maxHeight = 5,
}: ResponsiveInputProps) {
  const { width } = useTerminalSize();
  const breakpoint = useBreakpoint();
  const theme = useTheme();

  // Adjust input behavior based on screen size
  const inputWidth = width - 4; // Account for borders and padding
  const showFullPlaceholder = breakpoint !== 'xs';

  const displayPlaceholder = showFullPlaceholder
    ? placeholder
    : placeholder?.split(' ').slice(0, 3).join(' ') + '...';

  return (
    <Box
      borderStyle="single"
      borderColor={theme.accent}
      paddingX={1}
      flexDirection="column"
      width={inputWidth}
    >
      {multiline ? (
        <Box flexDirection="column" maxHeight={maxHeight}>
          {value ? (
            <ResponsiveText maxWidth={inputWidth - 4}>
              {value}
            </ResponsiveText>
          ) : (
            <Text dimColor>{displayPlaceholder}</Text>
          )}
        </Box>
      ) : (
        <Text>
          {value || <Text dimColor>{displayPlaceholder}</Text>}
        </Text>
      )}
    </Box>
  );
});

// Hook for responsive behavior
export function useResponsive() {
  const breakpoint = useBreakpoint();
  const terminalSize = useTerminalSize();

  const isMobile = breakpoint === 'xs' || breakpoint === 'sm';
  const isDesktop = breakpoint === 'lg' || breakpoint === 'xl';
  const isTablet = breakpoint === 'md';

  const getColumns = (xs = 1, sm = 1, md = 2, lg = 3, xl = 4) => {
    switch (breakpoint) {
      case 'xs': return xs;
      case 'sm': return sm;
      case 'md': return md;
      case 'lg': return lg;
      case 'xl': return xl;
      default: return 1;
    }
  };

  const hideOn = (breakpoints: Breakpoint[]) => {
    return breakpoints.includes(breakpoint);
  };

  const showOn = (breakpoints: Breakpoint[]) => {
    return breakpoints.includes(breakpoint);
  };

  return {
    breakpoint,
    terminalSize,
    isMobile,
    isDesktop,
    isTablet,
    getColumns,
    hideOn,
    showOn,
  };
}

// Performance optimization: only re-render when size actually changes significantly
export function useResponsiveThrottled(threshold = 10) {
  const size = useTerminalSize();
  const [throttledSize, setThrottledSize] = useState(size);

  useEffect(() => {
    const widthDiff = Math.abs(size.width - throttledSize.width);
    const heightDiff = Math.abs(size.height - throttledSize.height);

    if (widthDiff >= threshold || heightDiff >= threshold) {
      setThrottledSize(size);
    }
  }, [size, throttledSize, threshold]);

  return throttledSize;
}