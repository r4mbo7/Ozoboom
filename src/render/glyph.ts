import { isOneOf } from '../shared/guards';
import { WHITE, paint, type Ctx, type Shape } from './paint';

const BOX = 24;
const SVG_NS = 'http://www.w3.org/2000/svg';
const CAPS: readonly CanvasLineCap[] = ['butt', 'round', 'square'];
const JOINS: readonly CanvasLineJoin[] = ['miter', 'round', 'bevel'];
const ROTATE = /^rotate\((-?[\d.]+)(?:[ ,]+(-?[\d.]+)[ ,]+(-?[\d.]+))?\)$/;

function number(element: Element, name: string, fallback = 0): number {
  const value = element.getAttribute(name);
  return value === null ? fallback : Number(value);
}

function outline(element: Element): Path2D {
  const path = new Path2D();
  switch (element.localName) {
    case 'path':
      path.addPath(new Path2D(element.getAttribute('d') ?? ''));
      return path;
    case 'circle':
      path.arc(number(element, 'cx'), number(element, 'cy'), number(element, 'r'), 0, 2 * Math.PI);
      return path;
    case 'ellipse':
      path.ellipse(
        number(element, 'cx'),
        number(element, 'cy'),
        number(element, 'rx'),
        number(element, 'ry'),
        0,
        0,
        2 * Math.PI,
      );
      return path;
    default:
      throw new Error(`A picto cannot be painted with <${element.localName}>`);
  }
}

function rotate(ctx: Ctx, transform: string): void {
  const match = ROTATE.exec(transform);
  if (match === null) {
    throw new Error(`A picto cannot be painted with the transform "${transform}"`);
  }
  const [, degrees = '0', cx = '0', cy = '0'] = match;
  ctx.translate(Number(cx), Number(cy));
  ctx.rotate((Number(degrees) * Math.PI) / 180);
  ctx.translate(-Number(cx), -Number(cy));
}

function draw(ctx: Ctx, element: Element): void {
  ctx.save();
  ctx.globalAlpha *= number(element, 'opacity', 1);
  const transform = element.getAttribute('transform');
  if (transform !== null) {
    rotate(ctx, transform);
  }
  const path = outline(element);
  if (element.getAttribute('fill') !== 'none') {
    ctx.fill(path);
  }
  const stroke = element.getAttribute('stroke');
  if (stroke !== null && stroke !== 'none') {
    ctx.lineWidth = number(element, 'stroke-width', 1);
    const cap = element.getAttribute('stroke-linecap');
    const join = element.getAttribute('stroke-linejoin');
    ctx.lineCap = isOneOf(cap, CAPS) ? cap : 'butt';
    ctx.lineJoin = isOneOf(join, JOINS) ? join : 'miter';
    ctx.setLineDash(
      (element.getAttribute('stroke-dasharray') ?? '').split(/[ ,]+/).filter(Boolean).map(Number),
    );
    ctx.stroke(path);
  }
  ctx.restore();
}

// An interface picto, an SVG in a box of 24, painted white at `size` for a tint to color it: the
// game shows the same drawing in its pages and in the arena.
export function paintGlyph(svg: string, size: number, density: number): Shape {
  const parsed = new DOMParser().parseFromString(
    `<svg xmlns="${SVG_NS}">${svg}</svg>`,
    'image/svg+xml',
  );
  const elements = [...parsed.documentElement.children];
  return paint(
    size,
    size,
    size / 2,
    (ctx) => {
      ctx.scale(size / BOX, size / BOX);
      ctx.translate(-BOX / 2, -BOX / 2);
      ctx.fillStyle = WHITE;
      ctx.strokeStyle = WHITE;
      for (const element of elements) {
        draw(ctx, element);
      }
    },
    density,
  );
}
