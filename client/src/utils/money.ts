// Money display. The API and the app keep money as INTEGER agorot (2550 =
// ₪25.50); we divide by 100 only here, at the moment of showing it, so float
// rounding never touches a real amount.
//
// Intl.NumberFormat is the browser's built-in formatter: currency symbol,
// thousands separators and exactly 2 decimals, without hand-made string code.
const ils = new Intl.NumberFormat('en-IL', {
  style: 'currency',
  currency: 'ILS',
  currencyDisplay: 'narrowSymbol', // "₪", not "ILS"
});

/** 425000 -> "₪4,250.00" */
export function formatAgorot(agorot: number): string {
  return ils.format(agorot / 100);
}

/**
 * What the user typed in ₪ -> integer agorot, or null if it isn't an amount.
 * "25" -> 2500, "25.5" -> 2550, "0.29" -> 29, "1,250.75" -> 125075.
 *
 * Works on the TEXT, never via floats: parseFloat("0.29") * 100 is
 * 28.999999999999996, because binary floating point can't store most
 * decimal fractions exactly. Splitting at the dot and adding whole numbers
 * is exact every time.
 */
export function parseShekelsToAgorot(text: string): number | null {
  // Allow thousands commas and spaces ("1,250.75"); at most 2 decimals.
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text.replace(/[,\s]/g, ''));
  if (!match) return null;
  const whole = Number(match[1]);
  const cents = Number((match[2] ?? '').padEnd(2, '0')); // "5" -> "50", "" -> "00"
  return whole * 100 + cents;
}

/** -2500 -> "− ₪25.00", 15000 -> "+ ₪150.00" (a real minus sign, not a hyphen) */
export function formatSignedAgorot(agorot: number): string {
  const sign = agorot < 0 ? '−' : '+';
  return `${sign} ${formatAgorot(Math.abs(agorot))}`;
}
