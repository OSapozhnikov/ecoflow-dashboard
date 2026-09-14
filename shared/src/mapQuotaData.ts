/**
 * Public quota mapper entry: contract engine first, hardcoded fallback second.
 */

import {
  mapQuotaDataHardcoded,
  type MapQuotaOptions,
  type MappedQuota,
} from './quotaMapper';
import { mapPayloadWithContract, resolveContract } from './contractEngine';

/**
 * Map raw quota / MQTT payload fields into normalized watts and SOC.
 * When `sn` / `productName` resolve a DeviceContract, mapping is contract-driven;
 * otherwise uses the hardcoded key lists in {@link mapQuotaDataHardcoded}.
 */
export function mapQuotaData(
  data: Record<string, unknown> | Record<string, unknown>[],
  options: MapQuotaOptions = {}
): MappedQuota {
  const sources = Array.isArray(data) ? data.filter(Boolean) : [data];
  const contract = resolveContract({
    sn: options.sn,
    productName: options.productName,
  });

  if (contract) {
    return mapPayloadWithContract(contract, sources, options);
  }

  return mapQuotaDataHardcoded(data, options);
}
