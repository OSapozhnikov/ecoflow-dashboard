/**
 * Unit tests for RateLimiter
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimiter, debounce, throttle } from '../rateLimiter';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter(5, 1000); // 5 requests per 1000ms
  });

  describe('canMakeRequest', () => {
    it('should allow requests within the limit', () => {
      expect(rateLimiter.canMakeRequest()).toBe(true);
      expect(rateLimiter.canMakeRequest()).toBe(true);
      expect(rateLimiter.canMakeRequest()).toBe(true);
      expect(rateLimiter.canMakeRequest()).toBe(true);
      expect(rateLimiter.canMakeRequest()).toBe(true);
    });

    it('should block requests exceeding the limit', () => {
      // Make 5 requests (the limit)
      for (let i = 0; i < 5; i++) {
        expect(rateLimiter.canMakeRequest()).toBe(true);
      }

      // 6th request should be blocked
      expect(rateLimiter.canMakeRequest()).toBe(false);
    });

    it('should allow requests after time window expires', async () => {
      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        rateLimiter.canMakeRequest();
      }

      // Wait for time window to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should allow requests again
      expect(rateLimiter.canMakeRequest()).toBe(true);
    });

    it('should handle different max requests and window sizes', () => {
      const limiter = new RateLimiter(10, 2000);

      // Should allow 10 requests
      for (let i = 0; i < 10; i++) {
        expect(limiter.canMakeRequest()).toBe(true);
      }

      // 11th should be blocked
      expect(limiter.canMakeRequest()).toBe(false);
    });
  });

  describe('getTimeUntilNextRequest', () => {
    it('should return 0 when requests are available', () => {
      expect(rateLimiter.getTimeUntilNextRequest()).toBe(0);
      rateLimiter.canMakeRequest();
      expect(rateLimiter.getTimeUntilNextRequest()).toBe(0);
    });

    it('should return time until next request when limit is reached', () => {
      // Make 5 requests (the limit)
      for (let i = 0; i < 5; i++) {
        rateLimiter.canMakeRequest();
      }

      const timeUntilNext = rateLimiter.getTimeUntilNextRequest();
      expect(timeUntilNext).toBeGreaterThan(0);
      expect(timeUntilNext).toBeLessThanOrEqual(1000);
    });

    it('should return decreasing time as window expires', async () => {
      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        rateLimiter.canMakeRequest();
      }

      const initialTime = rateLimiter.getTimeUntilNextRequest();
      expect(initialTime).toBeGreaterThan(0);

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 200));

      const laterTime = rateLimiter.getTimeUntilNextRequest();
      expect(laterTime).toBeLessThan(initialTime);
    });
  });

  describe('reset', () => {
    it('should reset the rate limiter', () => {
      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        rateLimiter.canMakeRequest();
      }

      // Should be blocked
      expect(rateLimiter.canMakeRequest()).toBe(false);

      // Reset
      rateLimiter.reset();

      // Should allow requests again
      expect(rateLimiter.canMakeRequest()).toBe(true);
    });
  });
});

describe('debounce', () => {
  it('should delay function execution', async () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 100);

    debouncedFn();
    expect(mockFn).not.toHaveBeenCalled();

    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should reset timer on multiple calls', async () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 100);

    debouncedFn();
    await new Promise((resolve) => setTimeout(resolve, 50));
    debouncedFn();
    await new Promise((resolve) => setTimeout(resolve, 50));
    debouncedFn();

    expect(mockFn).not.toHaveBeenCalled();

    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should pass arguments correctly', async () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 100);

    debouncedFn('arg1', 'arg2');

    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
  });
});

describe('throttle', () => {
  it('should limit function execution frequency', async () => {
    const mockFn = vi.fn();
    const throttledFn = throttle(mockFn, 100);

    throttledFn();
    expect(mockFn).toHaveBeenCalledTimes(1);

    throttledFn();
    expect(mockFn).toHaveBeenCalledTimes(1); // Still 1, throttled

    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(mockFn).toHaveBeenCalledTimes(2); // Now called again
  });

  it('should allow immediate execution if enough time has passed', async () => {
    const mockFn = vi.fn();
    const throttledFn = throttle(mockFn, 100);

    throttledFn();
    expect(mockFn).toHaveBeenCalledTimes(1);

    await new Promise((resolve) => setTimeout(resolve, 150));

    throttledFn();
    expect(mockFn).toHaveBeenCalledTimes(2); // Immediate execution
  });

  it('should pass arguments correctly', async () => {
    const mockFn = vi.fn();
    const throttledFn = throttle(mockFn, 100);

    throttledFn('arg1', 'arg2');
    expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
  });
});

