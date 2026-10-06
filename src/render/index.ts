import { autoDetectRenderer } from 'pixi.js';
import { SUN_PALETTES } from '../shared/palette';
import { parseHexColor } from './palette';
import { type RenderContent, Scene } from './scene';
import type { RenderOptions, Renderer } from './types';

export type { RenderContent } from './scene';
export type { RenderOptions, Renderer } from './types';

// `light` draws a quarter of the pixels without antialiasing, for browser tests that render in software.
export async function createRenderer(
  container: HTMLElement,
  options: RenderOptions,
  content: RenderContent,
  light = false,
): Promise<Renderer> {
  const width = container.clientWidth;
  const height = container.clientHeight;
  const pixi = await autoDetectRenderer({
    preference: 'webgl',
    width,
    height,
    resolution: light ? 0.5 : Math.min(window.devicePixelRatio, 2),
    autoDensity: true,
    antialias: !light,
    background: parseHexColor(SUN_PALETTES.crepuscule.sol),
    skipExtensionImports: true,
  });
  container.appendChild(pixi.canvas);
  return new Scene(pixi, options, content, width, height);
}
