/**
 * Telegram alerts on status transitions (low SOC, offline, plug anomaly).
 */

import type { EcoflowDeviceStatus } from '../types/ecoflow';
import { readSettings, isDeviceDisabled } from './dataFiles';
import { logger } from '../utils/logger';

const DEFAULT_COOLDOWN_MS = 45 * 60 * 1000;

type AlertRule = 'low_soc' | 'offline' | 'plug_anomaly';

interface PriorState {
  online?: boolean;
  batteryLevel?: number;
  plugWattsAnomalous?: boolean;
  lastSuccessAt?: number;
}

const priorByDevice = new Map<string, PriorState>();
const cooldownUntil = new Map<string, number>();

function cooldownKey(rule: AlertRule, deviceId: string): string {
  return `${rule}:${deviceId}`;
}

function inCooldown(rule: AlertRule, deviceId: string): boolean {
  const until = cooldownUntil.get(cooldownKey(rule, deviceId)) ?? 0;
  return Date.now() < until;
}

function markCooldown(rule: AlertRule, deviceId: string, ms = DEFAULT_COOLDOWN_MS): void {
  cooldownUntil.set(cooldownKey(rule, deviceId), Date.now() + ms);
}

export async function sendTelegramMessage(text: string): Promise<void> {
  const settings = readSettings();
  const { botToken, chatId } = settings.telegram;
  if (!botToken || !chatId) {
    throw new Error('Telegram botToken and chatId must be configured in settings');
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Telegram API ${res.status}: ${body.slice(0, 200)}`);
  }
}

export async function testTelegram(): Promise<{ ok: true }> {
  await sendTelegramMessage('Ecoflow Monitor: Telegram test message ✅');
  return { ok: true };
}

async function maybeAlert(
  rule: AlertRule,
  deviceId: string,
  text: string
): Promise<void> {
  if (inCooldown(rule, deviceId)) {
    return;
  }
  try {
    await sendTelegramMessage(text);
    markCooldown(rule, deviceId);
    logger.info(`Alert sent [${rule}] for ${deviceId}`);
  } catch (err) {
    logger.warn(`Alert send failed [${rule}] ${deviceId}: ${(err as Error).message}`);
  }
}

/**
 * Evaluate device status for alert transitions.
 * Call on MQTT cache updates and REST status success/failure paths.
 */
export function evaluateStatus(
  deviceId: string,
  status: EcoflowDeviceStatus | null | undefined,
  online?: boolean
): void {
  if (isDeviceDisabled(deviceId)) {
    return;
  }

  const settings = readSettings();
  const { lowSocPercent, offlineAfterMinutes, plugWattsAnomalyMax } =
    settings.thresholds;
  const prior = priorByDevice.get(deviceId) ?? {};
  const now = Date.now();

  const isOnline =
    typeof online === 'boolean'
      ? online
      : typeof status?.online === 'boolean'
        ? status.online
        : undefined;

  // Offline after prior success / online → offline
  if (isOnline === false && prior.online === true) {
    void maybeAlert(
      'offline',
      deviceId,
      `⚠️ Ecoflow ${deviceId} went offline`
    );
  } else if (
    isOnline === false &&
    prior.lastSuccessAt &&
    now - prior.lastSuccessAt > offlineAfterMinutes * 60_000
  ) {
    void maybeAlert(
      'offline',
      deviceId,
      `⚠️ Ecoflow ${deviceId} offline for >${offlineAfterMinutes} min`
    );
  }

  if (status) {
    const isPlug = Boolean(status.isPlug);
    if (
      !isPlug &&
      typeof status.batteryLevel === 'number' &&
      status.batteryLevel <= lowSocPercent &&
      (prior.batteryLevel === undefined || prior.batteryLevel > lowSocPercent)
    ) {
      void maybeAlert(
        'low_soc',
        deviceId,
        `🔋 Ecoflow ${deviceId} low SOC: ${status.batteryLevel}% (≤${lowSocPercent}%)`
      );
    }

    const anomalous =
      Boolean(status.plugWattsAnomalous) ||
      (typeof status.plugWatts === 'number' &&
        status.plugWatts > plugWattsAnomalyMax);

    if (anomalous && !prior.plugWattsAnomalous) {
      void maybeAlert(
        'plug_anomaly',
        deviceId,
        `⚡ Ecoflow ${deviceId} plug watts anomalous: ${status.plugWatts ?? '?'} W (max ${plugWattsAnomalyMax})`
      );
    }

    priorByDevice.set(deviceId, {
      online: isOnline ?? prior.online,
      batteryLevel: typeof status.batteryLevel === 'number' ? status.batteryLevel : prior.batteryLevel,
      plugWattsAnomalous: anomalous,
      lastSuccessAt: now,
    });
  } else {
    priorByDevice.set(deviceId, {
      ...prior,
      online: isOnline ?? prior.online,
    });
  }
}

/** Clear cooldowns / prior state (tests). */
export function resetAlertState(): void {
  priorByDevice.clear();
  cooldownUntil.clear();
}

export function startAlertService(): void {
  logger.info('Alert service ready (Telegram on status transitions)');
}
