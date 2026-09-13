/**
 * Unit tests for REST status TTL cache + in-flight fan-in
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  restStatusCache,
  REST_STATUS_CACHE_TTL_MS,
} from '../restStatusCache';
import type { EcoflowDeviceStatusResponse } from '../../types/ecoflow';

function makeStatus(deviceId: string, batteryLevel: number): EcoflowDeviceStatusResponse {
  return {
    deviceId,
    data: {
      deviceId,
      batteryLevel,
      chargeRate: 0,
      dischargeRate: 0,
      status: 'standby',
      timestamp: Date.now(),
    },
  };
}

describe('restStatusCache', () => {
  beforeEach(() => {
    restStatusCache.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    restStatusCache.clear();
  });

  it('returns cache hit within TTL without calling fetcher again', async () => {
    const fetcher = vi.fn().mockResolvedValue(makeStatus('SN1', 80));

    const first = await restStatusCache.getOrFetch('SN1', fetcher);
    expect(first.cacheHit).toBe(false);
    expect(first.response.data.batteryLevel).toBe(80);
    expect(fetcher).toHaveBeenCalledTimes(1);

    const second = await restStatusCache.getOrFetch('SN1', fetcher);
    expect(second.cacheHit).toBe(true);
    expect(second.response.data.batteryLevel).toBe(80);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('expires entries after TTL and refetches', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(makeStatus('SN1', 80))
      .mockResolvedValueOnce(makeStatus('SN1', 70));

    await restStatusCache.getOrFetch('SN1', fetcher);

    vi.advanceTimersByTime(REST_STATUS_CACHE_TTL_MS + 1);

    const afterTtl = await restStatusCache.getOrFetch('SN1', fetcher);
    expect(afterTtl.cacheHit).toBe(false);
    expect(afterTtl.response.data.batteryLevel).toBe(70);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('fans in concurrent fetches for the same SN into one REST call', async () => {
    let resolveFetch!: (value: EcoflowDeviceStatusResponse) => void;
    const fetcher = vi.fn(
      () =>
        new Promise<EcoflowDeviceStatusResponse>((resolve) => {
          resolveFetch = resolve;
        })
    );

    const p1 = restStatusCache.getOrFetch('SN1', fetcher);
    const p2 = restStatusCache.getOrFetch('SN1', fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);

    resolveFetch(makeStatus('SN1', 55));
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(r1.response.data.batteryLevel).toBe(55);
    expect(r2.response.data.batteryLevel).toBe(55);
    expect(r1.cacheHit).toBe(false);
    expect(r2.cacheHit).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Subsequent call within TTL is a cache hit
    const r3 = await restStatusCache.getOrFetch('SN1', fetcher);
    expect(r3.cacheHit).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not cache failures; next call retries', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('Ecoflow API error: signature is wrong'))
      .mockResolvedValueOnce(makeStatus('SN1', 40));

    await expect(restStatusCache.getOrFetch('SN1', fetcher)).rejects.toThrow(
      'signature is wrong'
    );
    expect(restStatusCache.size()).toBe(0);

    const ok = await restStatusCache.getOrFetch('SN1', fetcher);
    expect(ok.cacheHit).toBe(false);
    expect(ok.response.data.batteryLevel).toBe(40);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('isolates cache entries per device SN', async () => {
    const fetcherA = vi.fn().mockResolvedValue(makeStatus('A', 10));
    const fetcherB = vi.fn().mockResolvedValue(makeStatus('B', 90));

    await restStatusCache.getOrFetch('A', fetcherA);
    await restStatusCache.getOrFetch('B', fetcherB);

    expect(fetcherA).toHaveBeenCalledTimes(1);
    expect(fetcherB).toHaveBeenCalledTimes(1);

    await restStatusCache.getOrFetch('A', fetcherA);
    await restStatusCache.getOrFetch('B', fetcherB);

    expect(fetcherA).toHaveBeenCalledTimes(1);
    expect(fetcherB).toHaveBeenCalledTimes(1);
  });
});
