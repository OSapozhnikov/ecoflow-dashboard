/**
 * Ensure DATA_DIR (and contracts subfolder) exist.
 */

import fs from 'fs';
import path from 'path';
import { getConfig } from '../config/env';

export function ensureDataDir(): string {
  const dataDir = path.resolve(getConfig().dataDir);
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(path.join(dataDir, 'contracts'), { recursive: true });
  return dataDir;
}

export function getDataDir(): string {
  return path.resolve(getConfig().dataDir);
}
