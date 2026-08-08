/**
 * Filesystem-safe filename building for exported receipts (Part G).
 *
 * Windows (the client install target) forbids < > : " / \ | ? * and control
 * chars in filenames; spaces and punctuation are legal but awkward. We keep
 * Unicode letters/digits (so an Urdu or English customer name survives) and
 * collapse everything else to single underscores, then bound the length so a
 * very long name/device can't produce an unwieldy filename.
 */
export function sanitizeFilenamePart(value: string, fallback: string): string {
  const cleaned = value
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
  return cleaned || fallback
}

/**
 * {CustomerName}_{DeviceName}_{shortCode}.pdf — shortCode is the last 6 of the
 * repair id (stable per repair), guaranteeing uniqueness across repeat
 * customers/devices without a timestamp.
 */
export function receiptFileName(
  customerName: string | null | undefined,
  deviceBrand: string,
  deviceModel: string,
  repairId: string
): string {
  const customer = sanitizeFilenamePart(customerName ?? '', 'Customer')
  const device = sanitizeFilenamePart(`${deviceBrand} ${deviceModel}`, 'Device')
  const shortCode = repairId.slice(-6).toUpperCase()
  return `${customer}_${device}_${shortCode}.pdf`
}
