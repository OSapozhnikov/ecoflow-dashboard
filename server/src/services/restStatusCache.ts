/**
 * Short-TTL cache + in-flight fan-in for successful REST device status.
 * Reduces repeated Ecoflow quota/all calls when MQTT cache misses and
 * multiple clients poll the same SN (e.g. three DeviceCards + remounts).
 * Failures are never cached — callers still get honest 502s.
 */

import type { EcoflowDeviceStatusResponse } from '../types/ecoflow';

/** Default TTL: absorb concurrent/rapid polls without going stale vs 30s client refetch. */
export const REST_STATUS_CACHE_TTL_MS = 15_000;

interface CacheEntry {
  response: EcoflowDeviceStatusResponse;
  fetchedAt: number;
}

export type RestStatusFetchResult = {
  response: EcoflowDeviceStatusResponse;
  /** True when served from a fresh TTL entry (not an in-flight coalesce). */
  cacheHit: boolean;
};

class RestStatusCache {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inflight = new Map<string, Promise<EcoflowDeviceStatusResponse>>();

  get(deviceSn: string, now = Date.now(), ttlMs = REST_STATUS_CACHE_TTL_MS): EcoflowDeviceStatusResponse | null {
    const entry = this.cache.get(deviceSn);
    if (!entry) {
      return null;
    }
    if (now - entry.fetchedAt > ttlMs) {
      this.cache.delete(deviceSn);
      return null;
    }
    return entry.response;
  }

  set(deviceSn: string, response: EcoflowDeviceStatusResponse, fetchedAt = Date.now()): void {
    this.cache.set(deviceSn, { response, fetchedAt });
  }

  /**
   * Return a fresh cache hit, share an in-flight REST call, or run fetcher once.
   * Only successful responses are stored; rejections propagate and are not cached.
   */
  async getOrFetch(
    deviceSn: string,
    fetcher: () => Promise<EcoflowDeviceStatusResponse>,
    ttlMs = REST_STATUS_CACHE_TTL_MS
  ): Promise<RestStatusFetchResult> {
    const cached = this.get(deviceSn, Date.now(), ttlMs);
    if (cached) {
      return { response: cached, cacheHit: true };
    }

    const existing = this.inflight.get(deviceSn);
    if (existing) {
      const response = await existing;
      return { response, cacheHit: false };
    }

    const promise = fetcher()
      .then((response) => {
        this.set(deviceSn, response);
        return response;
      })
      .finally(() => {
        this.inflight.delete(deviceSn);
      });

    this.inflight.set(deviceSn, promise);
    const response = await promise;
    return { response, cacheHit: false };
  }

  /** Test helper — clear TTL entries and in-flight map. */
  clear(): void {
    this.cache.clear();
    this.inflight.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

export const restStatusCache = new RestStatusCache();
