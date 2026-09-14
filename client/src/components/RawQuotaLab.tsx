/**
 * Lab: on-demand raw quota/all + MQTT dump (manual fetch only).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../services/api';

export interface QuotaRawResponse {
  deviceId: string;
  fetchedAt: number;
  rest: {
    ok: boolean;
    code?: string | number;
    message?: string;
    data?: unknown;
    raw?: unknown;
  };
  mqtt: null | {
    timestamp: number;
    topic: string;
    last: unknown;
    merged: Record<string, unknown>;
    messageCount: number;
  };
  matched?: Record<string, string | undefined>;
  normalized?: Record<string, unknown>;
}

interface RawQuotaLabProps {
  deviceId: string;
  /** Expand and scroll when opened via ?lab=raw */
  autoOpen?: boolean;
}

type Tab = 'rest' | 'mqtt-merged' | 'mqtt-last';

function pretty(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function countKeys(obj: unknown, depth = 0): number {
  if (!obj || typeof obj !== 'object' || depth > 4) return 0;
  if (Array.isArray(obj)) return obj.length;
  return Object.keys(obj as object).reduce((sum, k) => {
    const v = (obj as Record<string, unknown>)[k];
    return sum + 1 + (typeof v === 'object' && v ? countKeys(v, depth + 1) : 0);
  }, 0);
}

export function RawQuotaLab({ deviceId, autoOpen = false }: RawQuotaLabProps) {
  const [open, setOpen] = useState(autoOpen);
  const [tab, setTab] = useState<Tab>('rest');
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

  const fetchRaw = useMutation({
    mutationFn: () => api.get<QuotaRawResponse>(`/api/devices/${deviceId}/quota/raw`),
    onSuccess: (data) => {
      // Prefer richest view after fetch: REST data, else merged MQTT, else last MQTT
      if (data.rest.ok && data.rest.data) {
        setTab('rest');
      } else if (data.mqtt && countKeys(data.mqtt.merged) > countKeys(data.mqtt.last)) {
        setTab('mqtt-merged');
      } else if (data.mqtt) {
        setTab('mqtt-last');
      } else {
        setTab('rest');
      }
    },
  });

  useEffect(() => {
    if (autoOpen) {
      setOpen(true);
      const t = window.setTimeout(() => {
        sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
      return () => window.clearTimeout(t);
    }
  }, [autoOpen]);

  const displayJson = useMemo(() => {
    const data = fetchRaw.data;
    if (!data) return null;
    if (tab === 'mqtt-merged') {
      if (!data.mqtt) {
        return { note: 'No MQTT quota cached yet for this SN' };
      }
      return {
        note: 'Accumulated fields from MQTT heartbeats since server start (partial messages merged).',
        topic: data.mqtt.topic,
        messageCount: data.mqtt.messageCount,
        updatedAt: data.mqtt.timestamp,
        merged: data.mqtt.merged,
      };
    }
    if (tab === 'mqtt-last') {
      if (!data.mqtt) {
        return { note: 'No MQTT quota cached yet for this SN' };
      }
      return {
        note: 'Single last MQTT message — Ecoflow often sends only a few fields per heartbeat.',
        timestamp: data.mqtt.timestamp,
        topic: data.mqtt.topic,
        payload: data.mqtt.last,
      };
    }
    return {
      ok: data.rest.ok,
      code: data.rest.code,
      message: data.rest.message,
      data: data.rest.data,
      raw: data.rest.raw,
    };
  }, [fetchRaw.data, tab]);

  const onCopy = async () => {
    if (displayJson == null) return;
    try {
      await navigator.clipboard.writeText(pretty(displayJson));
      setCopyMsg('Copied');
      window.setTimeout(() => setCopyMsg(null), 1500);
    } catch {
      setCopyMsg('Copy failed');
    }
  };

  const tabBtn = (id: Tab, label: string) => (
    <button
      type="button"
      key={id}
      className={`px-3 py-1 rounded text-xs font-medium ${
        tab === id
          ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900'
          : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
      }`}
      onClick={() => setTab(id)}
    >
      {label}
    </button>
  );

  return (
    <section ref={sectionRef} id="lab-raw-quota" className="scroll-mt-8">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
          Lab — raw quota
        </h2>
        <button
          type="button"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Hide' : 'Show'}
        </button>
      </div>

      {open && (
        <div className="space-y-3 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manual fetch only. REST <code className="font-mono text-xs">quota/all</code> is the
            full dump when entitled. MQTT heartbeats are partial — use{' '}
            <strong>MQTT merged</strong> to accumulate fields over time.
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
              disabled={fetchRaw.isPending}
              onClick={() => fetchRaw.mutate()}
            >
              {fetchRaw.isPending ? 'Fetching…' : 'Fetch raw'}
            </button>
            {fetchRaw.data && (
              <>
                {tabBtn('rest', 'REST')}
                {tabBtn('mqtt-merged', 'MQTT merged')}
                {tabBtn('mqtt-last', 'MQTT last')}
                <button
                  type="button"
                  className="px-3 py-1 rounded text-xs border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
                  onClick={() => void onCopy()}
                >
                  Copy
                </button>
                {copyMsg && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">{copyMsg}</span>
                )}
              </>
            )}
          </div>

          {fetchRaw.isError && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {(fetchRaw.error as Error)?.message || 'Fetch failed'}
            </p>
          )}

          {fetchRaw.data && !fetchRaw.data.rest.ok && tab === 'rest' && (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              REST quota rejected
              {fetchRaw.data.rest.code != null ? ` (code ${fetchRaw.data.rest.code})` : ''}.
              Switch to <strong>MQTT merged</strong> for accumulated live fields, or check Open API
              entitlement for this SN.
            </p>
          )}

          {fetchRaw.data?.mqtt && tab.startsWith('mqtt') && (
            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
              MQTT messages merged: {fetchRaw.data.mqtt.messageCount} · keys≈
              {countKeys(fetchRaw.data.mqtt.merged)}
            </p>
          )}

          {fetchRaw.data?.matched && tab === 'rest' && fetchRaw.data.rest.ok && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Matched keys
              </h3>
              <ul className="font-mono text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
                {Object.entries(fetchRaw.data.matched)
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <li key={k}>
                      {k}: {v}
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {displayJson != null && (
            <pre className="text-xs overflow-auto max-h-96 p-3 rounded bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700">
              {pretty(displayJson)}
            </pre>
          )}
        </div>
      )}
    </section>
  );
}
