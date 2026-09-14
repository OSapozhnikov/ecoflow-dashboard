/**
 * Settings routes — GET/PUT /api/settings, Telegram test
 */

import { Router, Request, Response } from 'express';
import { readSettings, writeSettings, SettingsSchema } from '../services/dataFiles';
import { testTelegram } from '../services/alertService';
import { logger } from '../utils/logger';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const settings = readSettings();
  // Never echo full bot token in GET — mask middle
  const token = settings.telegram.botToken;
  const masked =
    token.length > 8
      ? `${token.slice(0, 4)}…${token.slice(-4)}`
      : token
        ? '****'
        : '';
  res.json({
    ...settings,
    telegram: {
      botToken: masked,
      chatId: settings.telegram.chatId,
      configured: Boolean(settings.telegram.botToken && settings.telegram.chatId),
    },
  });
});

router.put('/', (req: Request, res: Response) => {
  try {
    const body = req.body ?? {};
    // Allow writing real token; empty string means "keep existing"
    const current = readSettings();
    const telegramIn = body.telegram ?? {};
    const botToken =
      typeof telegramIn.botToken === 'string' && telegramIn.botToken.includes('…')
        ? current.telegram.botToken
        : typeof telegramIn.botToken === 'string'
          ? telegramIn.botToken
          : current.telegram.botToken;

    const next = writeSettings({
      telegram: {
        botToken,
        chatId:
          typeof telegramIn.chatId === 'string'
            ? telegramIn.chatId
            : current.telegram.chatId,
      },
      thresholds: body.thresholds,
      retention: body.retention,
    });
    // Validate shape
    SettingsSchema.parse(next);
    res.json({ ok: true, settings: { ...next, telegram: { ...next.telegram, botToken: next.telegram.botToken ? '****' : '' } } });
  } catch (err) {
    const error = err as Error;
    logger.warn('Invalid settings update', { error: error.message });
    res.status(400).json({
      error: { message: error.message, code: 'INVALID_SETTINGS' },
    });
  }
});

router.post('/telegram/test', async (_req: Request, res: Response) => {
  try {
    await testTelegram();
    res.json({ ok: true });
  } catch (err) {
    const error = err as Error;
    res.status(400).json({
      error: { message: error.message, code: 'TELEGRAM_TEST_FAILED' },
    });
  }
});

export default router;
