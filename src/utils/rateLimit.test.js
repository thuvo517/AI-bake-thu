import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isRateLimited, _resetRateLimitState } from './rateLimit.js';

describe('isRateLimited', () => {
  beforeEach(() => {
    _resetRateLimitState();
  });

  it('allows requests under the limit', () => {
    expect(isRateLimited('session-a', { maxRequests: 3, windowMs: 60000 })).toBe(false);
    expect(isRateLimited('session-a', { maxRequests: 3, windowMs: 60000 })).toBe(false);
    expect(isRateLimited('session-a', { maxRequests: 3, windowMs: 60000 })).toBe(false);
  });

  it('blocks once the limit is reached within the window', () => {
    isRateLimited('session-b', { maxRequests: 2, windowMs: 60000 });
    isRateLimited('session-b', { maxRequests: 2, windowMs: 60000 });
    expect(isRateLimited('session-b', { maxRequests: 2, windowMs: 60000 })).toBe(true);
  });

  it('tracks keys independently', () => {
    isRateLimited('session-c', { maxRequests: 1, windowMs: 60000 });
    expect(isRateLimited('session-c', { maxRequests: 1, windowMs: 60000 })).toBe(true);
    expect(isRateLimited('session-d', { maxRequests: 1, windowMs: 60000 })).toBe(false);
  });

  it('allows requests again once old hits fall outside the window', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(0);
      isRateLimited('session-e', { maxRequests: 1, windowMs: 1000 });
      expect(isRateLimited('session-e', { maxRequests: 1, windowMs: 1000 })).toBe(true);

      vi.setSystemTime(1500);
      expect(isRateLimited('session-e', { maxRequests: 1, windowMs: 1000 })).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
