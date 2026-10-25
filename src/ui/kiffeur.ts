const ROUND = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';

export const KIFFEUR_MARK =
  '<circle cx="12" cy="12" r="4" fill="currentColor"/>' +
  Array.from({ length: 10 }, (_, petal) => {
    const angle = (petal * Math.PI) / 5;
    const x = (12 + 8 * Math.cos(angle)).toFixed(2);
    const y = (12 + 8 * Math.sin(angle)).toFixed(2);
    return petal % 2 === 0
      ? `<circle cx="${x}" cy="${y}" r="2.2" fill="currentColor"/>`
      : `<circle cx="${x}" cy="${y}" r="1.7" fill="none" stroke="currentColor" stroke-width="1.2"/>`;
  }).join('');

export const OLA_ICON =
  [
    [5, 16.5],
    [12, 12],
    [19, 16.5],
  ]
    .map(
      ([x = 0, y = 0]) =>
        `<circle cx="${String(x)}" cy="${String(y)}" r="2" fill="currentColor"/>` +
        `<path d="M${String(x - 3.2)} ${String(y - 6)}L${String(x)} ${String(y - 2.4)}L${String(x + 3.2)} ${String(y - 6)}" ${ROUND} stroke-width="1.8"/>`,
    )
    .join('') + `<path d="M2 21.5c3-2.4 7-2.4 10 0s7 2.4 10 0" ${ROUND} stroke-width="1.8"/>`;
