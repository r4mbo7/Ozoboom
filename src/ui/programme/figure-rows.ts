import { mostOf } from './figures';
import type { Figure } from './types';

// A row of a tab's sheets: the value an entry holds, absent when it holds none, how it reads when its
// number alone does not say it, and the most it fills against when that is not the tab's own.
export interface FigureRow<T> {
  readonly label: string;
  of(item: T): number | undefined;
  text?(value: number, item: T): string | undefined;
  readonly most?: number;
}

// Each entry's rows, each filled against the most the tab holds; a row an entry lacks is left out.
export function figureRows<T>(
  items: readonly T[],
  rows: readonly FigureRow<T>[],
): (item: T) => Figure[] {
  const most = rows.map((row) => row.most ?? mostOf(items.flatMap((item) => row.of(item) ?? [])));
  return (item) =>
    rows.flatMap((row, index) => {
      const value = row.of(item);
      if (value === undefined) {
        return [];
      }
      const text = row.text?.(value, item);
      return [
        {
          label: row.label,
          value,
          most: most[index] ?? 0,
          ...(text === undefined ? {} : { text }),
        },
      ];
    });
}
