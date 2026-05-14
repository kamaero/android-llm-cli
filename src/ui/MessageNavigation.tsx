import { useState, useCallback } from 'react';
import type { Message } from '../types.js';

// Message navigation hook
export function useMessageNavigation(messages: Message[]) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [bookmarks, setBookmarks] = useState<Set<number>>(new Set());

  const goToMessage = useCallback((index: number) => {
    if (index >= 0 && index < messages.length) {
      setCurrentIndex(index);
    }
  }, [messages.length]);

  const nextMessage = useCallback(() => {
    setCurrentIndex(prev => Math.min(messages.length - 1, prev + 1));
  }, [messages.length]);

  const prevMessage = useCallback(() => {
    setCurrentIndex(prev => Math.max(0, prev - 1));
  }, []);

  const toggleBookmark = useCallback((index?: number) => {
    const targetIndex = index ?? currentIndex;
    setBookmarks(prev => {
      const newBookmarks = new Set(prev);
      if (newBookmarks.has(targetIndex)) {
        newBookmarks.delete(targetIndex);
      } else {
        newBookmarks.add(targetIndex);
      }
      return newBookmarks;
    });
  }, [currentIndex]);

  const nextBookmark = useCallback(() => {
    const sortedBookmarks = Array.from(bookmarks).sort((a, b) => a - b);
    const nextBookmark = sortedBookmarks.find(b => b > currentIndex);
    if (nextBookmark !== undefined) {
      setCurrentIndex(nextBookmark);
    }
  }, [bookmarks, currentIndex]);

  const prevBookmark = useCallback(() => {
    const sortedBookmarks = Array.from(bookmarks).sort((a, b) => b - a);
    const prevBookmark = sortedBookmarks.find(b => b < currentIndex);
    if (prevBookmark !== undefined) {
      setCurrentIndex(prevBookmark);
    }
  }, [bookmarks, currentIndex]);

  const goToLastMessage = useCallback(() => {
    setCurrentIndex(messages.length - 1);
  }, [messages.length]);

  const goToFirstMessage = useCallback(() => {
    setCurrentIndex(0);
  }, []);

  const isBookmarked = useCallback((index?: number) => {
    const targetIndex = index ?? currentIndex;
    return bookmarks.has(targetIndex);
  }, [bookmarks, currentIndex]);

  // Find tool calls in messages
  const toolCallMessages = useCallback(() => {
    return messages
      .map((msg, index) => ({ message: msg, index }))
      .filter(({ message }) => message.tool_calls && message.tool_calls.length > 0);
  }, [messages]);

  const nextToolCall = useCallback(() => {
    const toolCalls = toolCallMessages();
    const nextToolCall = toolCalls.find(({ index }) => index > currentIndex);
    if (nextToolCall) {
      setCurrentIndex(nextToolCall.index);
    }
  }, [toolCallMessages, currentIndex]);

  const prevToolCall = useCallback(() => {
    const toolCalls = toolCallMessages().reverse();
    const prevToolCall = toolCalls.find(({ index }) => index < currentIndex);
    if (prevToolCall) {
      setCurrentIndex(prevToolCall.index);
    }
  }, [toolCallMessages, currentIndex]);

  // Statistics
  const stats = useCallback(() => {
    const userMessages = messages.filter(m => m.role === 'user').length;
    const assistantMessages = messages.filter(m => m.role === 'assistant').length;
    const toolMessages = messages.filter(m => m.role === 'tool').length;
    const totalToolCalls = messages
      .filter(m => m.tool_calls)
      .reduce((sum, m) => sum + (m.tool_calls?.length || 0), 0);

    return {
      total: messages.length,
      user: userMessages,
      assistant: assistantMessages,
      tool: toolMessages,
      toolCalls: totalToolCalls,
      bookmarks: bookmarks.size,
    };
  }, [messages, bookmarks]);

  return {
    currentIndex,
    bookmarks,
    goToMessage,
    nextMessage,
    prevMessage,
    toggleBookmark,
    nextBookmark,
    prevBookmark,
    goToFirstMessage,
    goToLastMessage,
    isBookmarked,
    nextToolCall,
    prevToolCall,
    toolCallMessages,
    stats,
  };
}

// Pagination hook for large conversations
export function usePagination<T>(items: T[], pageSize = 10) {
  const [currentPage, setCurrentPage] = useState(0);

  const totalPages = Math.ceil(items.length / pageSize);
  const startIndex = currentPage * pageSize;
  const endIndex = Math.min(startIndex + pageSize, items.length);
  const currentItems = items.slice(startIndex, endIndex);

  const nextPage = useCallback(() => {
    setCurrentPage(prev => Math.min(totalPages - 1, prev + 1));
  }, [totalPages]);

  const prevPage = useCallback(() => {
    setCurrentPage(prev => Math.max(0, prev - 1));
  }, []);

  const goToPage = useCallback((page: number) => {
    setCurrentPage(Math.max(0, Math.min(totalPages - 1, page)));
  }, [totalPages]);

  const goToLastPage = useCallback(() => {
    setCurrentPage(totalPages - 1);
  }, [totalPages]);

  const goToFirstPage = useCallback(() => {
    setCurrentPage(0);
  }, []);

  return {
    currentPage,
    totalPages,
    currentItems,
    startIndex,
    endIndex,
    nextPage,
    prevPage,
    goToPage,
    goToFirstPage,
    goToLastPage,
    hasNextPage: currentPage < totalPages - 1,
    hasPrevPage: currentPage > 0,
  };
}

// Advanced search functionality
export function useAdvancedSearch(messages: Message[]) {
  const [filters, setFilters] = useState({
    role: 'all' as 'all' | 'user' | 'assistant' | 'tool',
    dateFrom: null as Date | null,
    dateTo: null as Date | null,
    hasToolCalls: false,
    hasErrors: false,
  });

  const filteredMessages = useCallback(() => {
    return messages.filter(message => {
      // Role filter
      if (filters.role !== 'all' && message.role !== filters.role) {
        return false;
      }

      // Date filters
      if (filters.dateFrom && message.timestamp < filters.dateFrom.getTime()) {
        return false;
      }
      if (filters.dateTo && message.timestamp > filters.dateTo.getTime()) {
        return false;
      }

      // Tool calls filter
      if (filters.hasToolCalls && (!message.tool_calls || message.tool_calls.length === 0)) {
        return false;
      }

      // Error filter
      if (filters.hasErrors && !message.tool_result?.is_error) {
        return false;
      }

      return true;
    });
  }, [messages, filters]);

  const updateFilters = useCallback((newFilters: Partial<typeof filters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      role: 'all',
      dateFrom: null,
      dateTo: null,
      hasToolCalls: false,
      hasErrors: false,
    });
  }, []);

  return {
    filters,
    filteredMessages: filteredMessages(),
    updateFilters,
    clearFilters,
  };
}

// Conversation analytics
export function useConversationAnalytics(messages: Message[]) {
  const analytics = useCallback(() => {
    const totalTokens = messages.reduce((sum, msg) => sum + (msg.tokens || 0), 0);
    const averageMessageLength = messages.length > 0
      ? messages.reduce((sum, msg) => sum + msg.content.length, 0) / messages.length
      : 0;

    const roleCounts = {
      user: messages.filter(m => m.role === 'user').length,
      assistant: messages.filter(m => m.role === 'assistant').length,
      tool: messages.filter(m => m.role === 'tool').length,
    };

    const toolCallTypes = new Map<string, number>();
    messages.forEach(msg => {
      if (msg.tool_calls) {
        msg.tool_calls.forEach(tc => {
          toolCallTypes.set(tc.name, (toolCallTypes.get(tc.name) || 0) + 1);
        });
      }
    });

    const errorCount = messages.filter(m => m.tool_result?.is_error).length;

    const firstMessage = messages[0];
    const lastMessage = messages[messages.length - 1];
    const duration = firstMessage && lastMessage
      ? lastMessage.timestamp - firstMessage.timestamp
      : 0;

    return {
      messageCount: messages.length,
      totalTokens,
      averageMessageLength: Math.round(averageMessageLength),
      roleCounts,
      toolCallTypes: Object.fromEntries(toolCallTypes),
      errorCount,
      duration,
      averageResponseTime: roleCounts.assistant > 0 ? duration / roleCounts.assistant : 0,
    };
  }, [messages]);

  return analytics();
}