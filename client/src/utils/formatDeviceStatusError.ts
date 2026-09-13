/**
 * Shorten verbose Ecoflow status errors for card / detail UI.
 * Keeps vendor code when present; full ops text stays in server logs.
 */

export function formatDeviceStatusError(message: string | undefined | null): string {
  const text = (message ?? '').trim();
  if (!text) {
    return 'Status unavailable';
  }

  const isSignatureReject =
    /signature\s+is\s+wrong/i.test(text) || /rejected\s+quota\/all/i.test(text);

  if (!isSignatureReject) {
    return text;
  }

  const vendorMatch = text.match(/Vendor code:\s*([^\s.]+)/i);
  const vendorCode = vendorMatch?.[1];

  return vendorCode
    ? `Status unavailable (unsupported, offline, or not entitled). Vendor code: ${vendorCode}.`
    : 'Status unavailable (unsupported, offline, or not entitled).';
}
