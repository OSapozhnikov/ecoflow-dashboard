/**
 * Settings page — Telegram, thresholds, locations
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

interface AppSettings {
  telegram: { botToken: string; chatId: string };
  thresholds: {
    lowSocPercent: number;
    offlineAfterMinutes: number;
    plugWattsAnomalyMax: number;
  };
  retention: { rawDays: number; aggregateMonths: number };
}

interface LocationsFile {
  locations: Array<{ id: string; name: string; deviceIds: string[] }>;
}

interface DeviceList {
  devices: Array<{ sn: string; deviceName: string }>;
  total: number;
}

const emptySettings: AppSettings = {
  telegram: { botToken: '', chatId: '' },
  thresholds: {
    lowSocPercent: 20,
    offlineAfterMinutes: 10,
    plugWattsAnomalyMax: 4000,
  },
  retention: { rawDays: 30, aggregateMonths: 13 },
};

export function Settings() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const raw = await api.get<AppSettings & { telegram: AppSettings['telegram'] & { configured?: boolean } }>(
        '/api/settings'
      );
      return {
        telegram: {
          botToken: raw.telegram?.botToken ?? '',
          chatId: raw.telegram?.chatId ?? '',
        },
        thresholds: raw.thresholds ?? emptySettings.thresholds,
        retention: raw.retention ?? emptySettings.retention,
      } satisfies AppSettings;
    },
  });
  const { data: locationsData } = useQuery({
    queryKey: ['locations'],
    queryFn: () => api.get<LocationsFile>('/api/locations'),
  });
  const { data: devicesData } = useQuery({
    queryKey: ['devices'],
    queryFn: () => api.get<DeviceList>('/api/devices'),
  });

  const [form, setForm] = useState<AppSettings>(emptySettings);
  const [locName, setLocName] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const saveSettings = useMutation({
    mutationFn: (body: AppSettings) =>
      api.put<{ ok: boolean; settings: AppSettings }>('/api/settings', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      setMessage('Settings saved');
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const testTelegram = useMutation({
    mutationFn: () => api.post<{ ok: boolean }>('/api/settings/telegram/test'),
    onSuccess: () => setMessage('Telegram test message sent'),
    onError: (e: Error) => setMessage(e.message),
  });

  const saveLocations = useMutation({
    mutationFn: (body: LocationsFile) => api.put<LocationsFile>('/api/locations', body),
    onSuccess: (data) => {
      queryClient.setQueryData(['locations'], data);
      setMessage('Locations saved');
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const locations = locationsData?.locations ?? [];
  const devices = devicesData?.devices ?? [];

  const addLocation = () => {
    const name = locName.trim();
    if (!name) return;
    const id = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '');
    if (!id) return;
    saveLocations.mutate({
      locations: [...locations, { id, name, deviceIds: [] }],
    });
    setLocName('');
  };

  const toggleDevice = (locationId: string, sn: string) => {
    const next = locations.map((loc) => {
      if (loc.id !== locationId) return loc;
      const has = loc.deviceIds.includes(sn);
      return {
        ...loc,
        deviceIds: has
          ? loc.deviceIds.filter((id) => id !== sn)
          : [...loc.deviceIds, sn],
      };
    });
    saveLocations.mutate({ locations: next });
  };

  const renameLocation = (locationId: string, name: string) => {
    saveLocations.mutate({
      locations: locations.map((loc) =>
        loc.id === locationId ? { ...loc, name } : loc
      ),
    });
  };

  const removeLocation = (locationId: string) => {
    saveLocations.mutate({
      locations: locations.filter((loc) => loc.id !== locationId),
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        <p className="text-gray-500 dark:text-gray-400">Loading settings…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <Link
            to="/"
            className="text-blue-500 hover:text-blue-700 dark:text-blue-400"
          >
            ← Back to Dashboard
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">
            Settings
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Stored under DATA_DIR (settings.json / locations.json). LAN home-lab only.
          </p>
        </div>

        {message && (
          <p className="text-sm text-gray-700 dark:text-gray-200" role="status">
            {message}
          </p>
        )}

        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Telegram alerts
          </h2>
          <label className="block text-sm">
            <span className="text-gray-600 dark:text-gray-300">Bot token</span>
            <input
              type="password"
              className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2"
              value={form.telegram.botToken}
              onChange={(e) =>
                setForm({
                  ...form,
                  telegram: { ...form.telegram, botToken: e.target.value },
                })
              }
              autoComplete="off"
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600 dark:text-gray-300">Chat ID</span>
            <input
              className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2"
              value={form.telegram.chatId}
              onChange={(e) =>
                setForm({
                  ...form,
                  telegram: { ...form.telegram, chatId: e.target.value },
                })
              }
            />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="block text-sm">
              <span className="text-gray-600 dark:text-gray-300">Low SOC %</span>
              <input
                type="number"
                className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2"
                value={form.thresholds.lowSocPercent}
                onChange={(e) =>
                  setForm({
                    ...form,
                    thresholds: {
                      ...form.thresholds,
                      lowSocPercent: Number(e.target.value),
                    },
                  })
                }
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600 dark:text-gray-300">Offline after (min)</span>
              <input
                type="number"
                className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2"
                value={form.thresholds.offlineAfterMinutes}
                onChange={(e) =>
                  setForm({
                    ...form,
                    thresholds: {
                      ...form.thresholds,
                      offlineAfterMinutes: Number(e.target.value),
                    },
                  })
                }
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600 dark:text-gray-300">Plug anomaly W</span>
              <input
                type="number"
                className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2"
                value={form.thresholds.plugWattsAnomalyMax}
                onChange={(e) =>
                  setForm({
                    ...form,
                    thresholds: {
                      ...form.thresholds,
                      plugWattsAnomalyMax: Number(e.target.value),
                    },
                  })
                }
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="px-4 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
              onClick={() => saveSettings.mutate(form)}
            >
              Save settings
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm text-gray-800 dark:text-gray-200"
              onClick={() => testTelegram.mutate()}
            >
              Send test Telegram
            </button>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Locations
          </h2>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              placeholder="New location name"
              value={locName}
              onChange={(e) => setLocName(e.target.value)}
            />
            <button
              type="button"
              className="px-4 py-2 rounded bg-blue-600 text-white text-sm"
              onClick={addLocation}
            >
              Add
            </button>
          </div>
          {locations.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">No locations yet.</p>
          )}
          {locations.map((loc) => (
            <div
              key={loc.id}
              className="border border-gray-200 dark:border-gray-700 rounded p-4 space-y-2"
            >
              <div className="flex items-center gap-2">
                <input
                  className="flex-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
                  value={loc.name}
                  onChange={(e) => renameLocation(loc.id, e.target.value)}
                />
                <button
                  type="button"
                  className="text-sm text-red-600 dark:text-red-400"
                  onClick={() => removeLocation(loc.id)}
                >
                  Remove
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {devices.map((d) => {
                  const checked = loc.deviceIds.includes(d.sn);
                  return (
                    <label
                      key={d.sn}
                      className="inline-flex items-center gap-1 text-xs text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded px-2 py-1"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleDevice(loc.id, d.sn)}
                      />
                      {d.deviceName || d.sn}
                    </label>
                  );
                })}
                {devices.length === 0 && (
                  <span className="text-xs text-gray-500">No devices loaded</span>
                )}
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
