import { expect, test, type Page } from '@playwright/test';
import {
  PALETTE_TOKENS,
  SUN_PALETTES,
  type SunMoment,
  paletteAt,
  relativeLuminance,
} from '../src/shared/palette';
import { UI_FIXTURE_SCREENS } from '../src/ui/fixtures';
import { LOBBY_FIXTURES } from '../src/ui/lobby-fixtures';

const MOMENTS = Object.keys(SUN_PALETTES) as SunMoment[];
// The set blends one moment into the next: the dawn and the dusk are where a blend can dip.
const BLENDS = [0.125, 0.43, 0.725, 0.925];
const SKIES: { label: string; param: string; fraction: number | null }[] = [
  ...MOMENTS.map((moment) => ({ label: moment, param: moment, fraction: null })),
  ...BLENDS.map((fraction) => ({
    label: `blend ${String(fraction)}`,
    param: String(fraction),
    fraction,
  })),
];
const SCREENS = [
  ...UI_FIXTURE_SCREENS.map((screen) => `screen=${screen}`),
  ...LOBBY_FIXTURES.map((name) => `lobby=${name}`),
  'notice=desync',
  'notice=hostLeft',
  'notice=connectionLost',
  'screen=feedback',
];

interface Failure {
  text: string;
  where: string;
  ratio: number;
  min: number;
  color: string;
  background: string;
}

// The scene shows through the translucent panels. Text must hold on both ends of what it can be:
// the lightest and the darkest colour of the moment, bar the text colour itself.
function sceneExtremes(sky: { param: string; fraction: number | null }): [string, string] {
  const palette =
    sky.fraction === null ? SUN_PALETTES[sky.param as SunMoment] : paletteAt(sky.fraction);
  const colors = PALETTE_TOKENS.filter((token) => token !== 'texte').map((token) => palette[token]);
  const byLuminance = [...colors].sort((a, b) => relativeLuminance(a) - relativeLuminance(b));
  return [byLuminance[0] ?? '#000000', byLuminance[byLuminance.length - 1] ?? '#ffffff'];
}

// SwiftShader sometimes drops a capture while the WebGL-free page repaints: ask again.
async function screenshotWithRetry(page: Page): Promise<Buffer> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await page.screenshot();
    } catch (error) {
      if (attempt === 3) {
        throw error;
      }
      await page.waitForTimeout(250);
    }
  }
}

async function measure(
  page: Page,
  query: string,
  param: string,
  scene: string,
): Promise<Failure[]> {
  await page.goto(`/dev/ui.html?${query}&sun=${param}`);
  await page.addStyleTag({
    content: `*, *::before, *::after { animation: none !important; transition: none !important; }
      .dev-stage { background: ${scene} !important; } .dev-stage span { display: none; }`,
  });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);

  const runs = await page.evaluate(() => {
    const result: {
      text: string;
      where: string;
      rects: { x: number; y: number; width: number; height: number }[];
      color: string;
      opacity: number;
      large: boolean;
    }[] = [];
    const opacityOf = (node: Element) => {
      let opacity = 1;
      for (let at: Element | null = node; at !== null; at = at.parentElement) {
        opacity *= Number(getComputedStyle(at).opacity);
      }
      return opacity;
    };
    const push = (node: Element, text: string, rects: DOMRect[], color: string) => {
      const style = getComputedStyle(node);
      const size = Number.parseFloat(style.fontSize);
      const bold = Number(style.fontWeight) >= 700;
      const kept = rects.filter((rect) => rect.width >= 4 && rect.height >= 4);
      if (kept.length > 0) {
        result.push({
          text: text.trim().slice(0, 60),
          where: `${node.tagName.toLowerCase()}.${[...node.classList].join('.')}`,
          rects: kept.map(({ x, y, width, height }) => ({ x, y, width, height })),
          color,
          opacity: opacityOf(node),
          large: size >= 24 || (size >= 18.66 && bold),
        });
      }
    };
    const isVisuallyHidden = (node: Element) => {
      for (let at: Element | null = node; at !== null; at = at.parentElement) {
        const box = at.getBoundingClientRect();
        const style = getComputedStyle(at);
        const clipped = style.clipPath !== 'none' || style.overflow !== 'visible';
        if (clipped && box.width <= 1 && box.height <= 1) {
          return true;
        }
      }
      return false;
    };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const parent = node.parentElement;
      if (
        parent === null ||
        (node.textContent ?? '').trim() === '' ||
        parent.closest('script, style, textarea') !== null ||
        !parent.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) ||
        isVisuallyHidden(parent)
      ) {
        continue;
      }
      const range = document.createRange();
      range.selectNodeContents(node);
      push(
        parent,
        node.textContent ?? '',
        [...range.getClientRects()],
        getComputedStyle(parent).color,
      );
    }
    for (const field of document.querySelectorAll('input, textarea')) {
      if (!field.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) {
        continue;
      }
      const value = (field as HTMLInputElement).value;
      const color =
        value === ''
          ? getComputedStyle(field, '::placeholder').color
          : getComputedStyle(field).color;
      const text = value === '' ? (field.getAttribute('placeholder') ?? '') : value;
      if (text !== '') {
        const box = field.getBoundingClientRect();
        const style = getComputedStyle(field);
        const edge = (side: string) =>
          Number.parseFloat(style.getPropertyValue(`padding-${side}`)) +
          Number.parseFloat(style.getPropertyValue(`border-${side}-width`));
        const lineHeight =
          Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.3;
        const content = new DOMRect(
          box.x + edge('left'),
          box.y + edge('top'),
          box.width - edge('left') - edge('right'),
          Math.min(box.height - edge('top') - edge('bottom'), lineHeight * 3),
        );
        push(field, text, [content], color);
      }
    }
    return result;
  });

  await page.addStyleTag({
    content: `* { color: transparent !important; -webkit-text-fill-color: transparent !important;
      text-shadow: none !important; caret-color: transparent !important; }
      ::placeholder { color: transparent !important; }`,
  });
  const image = (await screenshotWithRetry(page)).toString('base64');

  expect(runs.length, 'no text found to measure').toBeGreaterThan(0);

  return page.evaluate(
    async ({ runs: texts, image: png }) => {
      const picture = new Image();
      picture.src = `data:image/png;base64,${png}`;
      await picture.decode();
      const canvas = document.createElement('canvas');
      canvas.width = picture.width;
      canvas.height = picture.height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (context === null) {
        throw new Error('No 2D context');
      }
      context.drawImage(picture, 0, 0);
      const scale = picture.width / innerWidth;
      const lin = (value: number) => {
        const v = value / 255;
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      const lum = (r: number, g: number, b: number) =>
        0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
      const failures: {
        text: string;
        where: string;
        ratio: number;
        min: number;
        color: string;
        background: string;
      }[] = [];
      const canvasColor = document.createElement('canvas').getContext('2d');
      const parse = (css: string): [number, number, number, number] => {
        if (canvasColor === null) {
          throw new Error('No 2D context');
        }
        canvasColor.clearRect(0, 0, 1, 1);
        canvasColor.fillStyle = '#000';
        canvasColor.fillStyle = css;
        canvasColor.fillRect(0, 0, 1, 1);
        const [r = 0, g = 0, b = 0, a = 0] = canvasColor.getImageData(0, 0, 1, 1).data;
        return [r, g, b, a / 255];
      };
      for (const run of texts) {
        const [fr, fg, fb, fa] = parse(run.color);
        const alpha = fa * run.opacity;
        let worst = Number.POSITIVE_INFINITY;
        let worstBackground = '';
        for (const rect of run.rects) {
          const x0 = Math.max(0, Math.floor(rect.x * scale));
          const y0 = Math.max(0, Math.floor(rect.y * scale));
          const x1 = Math.min(canvas.width, Math.ceil((rect.x + rect.width) * scale));
          const y1 = Math.min(canvas.height, Math.ceil((rect.y + rect.height) * scale));
          if (x1 <= x0 || y1 <= y0) {
            continue;
          }
          const { data } = context.getImageData(x0, y0, x1 - x0, y1 - y0);
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i] ?? 0;
            const g = data[i + 1] ?? 0;
            const b = data[i + 2] ?? 0;
            const text = lum(
              fr * alpha + r * (1 - alpha),
              fg * alpha + g * (1 - alpha),
              fb * alpha + b * (1 - alpha),
            );
            const back = lum(r, g, b);
            const ratio = (Math.max(text, back) + 0.05) / (Math.min(text, back) + 0.05);
            if (ratio < worst) {
              worst = ratio;
              worstBackground = `rgb(${String(r)} ${String(g)} ${String(b)})`;
            }
          }
        }
        const min = run.large ? 3 : 4.5;
        if (worst < min) {
          failures.push({
            text: run.text,
            where: run.where,
            ratio: Math.round(worst * 100) / 100,
            min,
            color: run.opacity < 1 ? `${run.color} x ${run.opacity.toFixed(2)}` : run.color,
            background: worstBackground,
          });
        }
      }
      return failures;
    },
    { runs, image },
  );
}

// Every screen at every moment takes minutes: run it with CONTRAST=1 when touching colours.
test.skip(process.env.CONTRAST === undefined, 'set CONTRAST=1 to measure every screen');

for (const query of SCREENS) {
  for (const sky of SKIES) {
    test(`${query} keeps its text readable at ${sky.label}`, async ({ page }) => {
      const failures: Failure[] = [];
      for (const scene of sceneExtremes(sky)) {
        failures.push(...(await measure(page, query, sky.param, scene)));
      }
      const unique = [
        ...new Map(
          failures.sort((a, b) => b.ratio - a.ratio).map((failure) => [failure.text, failure]),
        ).values(),
      ];
      expect(unique).toEqual([]);
    });
  }
}
