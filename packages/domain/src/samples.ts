/**
 * Sample/label numbering helpers. Numbering formats are clinic-configurable;
 * these are the default generators used by the seed and standalone installs.
 */
export function nextSequentialNumber(current: number | undefined, prefix: string, padLength = 5): string {
  const next = (current ?? 0) + 1;
  return `${prefix}${String(next).padStart(padLength, '0')}`;
}

export function sampleBarcode(prefix: string, sequence: number): string {
  return `${prefix}${String(sequence).padStart(8, '0')}`;
}

/** Checksum digit (Luhn mod-10) appended to printable barcodes for scan integrity. */
export function luhnCheckDigit(digits: string): number {
  let sum = 0;
  let double = true;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return (10 - (sum % 10)) % 10;
}
