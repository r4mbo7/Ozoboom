export const PIPS = 5;

// The pips a value fills out of five: any value above nothing shows at least one.
export function pipsOf(value: number, most: number): number {
  if (value <= 0 || most <= 0) {
    return 0;
  }
  return Math.min(PIPS, Math.max(1, Math.round((value / most) * PIPS)));
}

// The value that fills a row's five pips: the most any entry of the tab holds.
export function mostOf(values: readonly number[]): number {
  return Math.max(0, ...values);
}
