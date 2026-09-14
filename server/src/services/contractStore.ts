/**
 * Device contract store — loads DATA_DIR/contracts, seeds from bundled defaults.
 * Restart-only (no hot reload). Re-registers into shared contractEngine.
 */

import fs from 'fs';
import path from 'path';
import {
  DeviceContractSchema,
  getBuiltinContracts,
  registerContracts,
  type DeviceContract,
} from '@ecoflow/shared';
import { getDataDir } from './dataDir';
import { logger } from '../utils/logger';

function bundledDefaultsDir(): string {
  // Prefer cwd copy (Docker: /app/contracts/defaults), then source-relative.
  const candidates = [
    path.join(process.cwd(), 'contracts', 'defaults'),
    path.join(__dirname, '..', 'contracts', 'defaults'),
    path.join(__dirname, '..', '..', 'src', 'contracts', 'defaults'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) {
      return dir;
    }
  }
  return candidates[0];
}

function readJsonContracts(dir: string): DeviceContract[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  const contracts: DeviceContract[] = [];
  for (const file of files) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      contracts.push(DeviceContractSchema.parse(raw));
    } catch (err) {
      const error = err as Error;
      logger.warn(`Skipping invalid contract ${file}: ${error.message}`);
    }
  }
  return contracts;
}

function seedContractsDir(contractsDir: string): void {
  fs.mkdirSync(contractsDir, { recursive: true });
  const existing = fs.readdirSync(contractsDir).filter((f) => f.endsWith('.json'));
  if (existing.length > 0) {
    return;
  }

  const defaultsDir = bundledDefaultsDir();
  const fromDisk = readJsonContracts(defaultsDir);
  const toWrite = fromDisk.length > 0 ? fromDisk : getBuiltinContracts();

  for (const contract of toWrite) {
    const dest = path.join(contractsDir, `${contract.id}.json`);
    fs.writeFileSync(dest, `${JSON.stringify(contract, null, 2)}\n`, 'utf8');
  }
  logger.info(`Seeded ${toWrite.length} contract(s) into ${contractsDir}`);
}

/**
 * Load contracts from DATA_DIR (seed if empty), fall back to builtins, register.
 */
export function loadContracts(): DeviceContract[] {
  const contractsDir = path.join(getDataDir(), 'contracts');
  seedContractsDir(contractsDir);

  const fromData = readJsonContracts(contractsDir);
  const builtins = getBuiltinContracts();

  // Merge by id: DATA_DIR overrides builtins; missing ids fall back to builtins
  const byId = new Map<string, DeviceContract>();
  for (const c of builtins) {
    byId.set(c.id, c);
  }
  for (const c of fromData) {
    byId.set(c.id, c);
  }

  const merged = Array.from(byId.values());
  registerContracts(merged);
  logger.info(`Loaded ${merged.length} device contract(s)`, {
    ids: merged.map((c) => c.id),
  });
  return merged;
}
