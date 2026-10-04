import { autoDetectRenderer } from 'pixi.js';
import { SUN_PALETTES } from '../shared/palette';
import { parseHexColor } from './palette';
import { type RenderContent, Scene } from './scene';
import type { RenderOptions, Renderer } from './types';

export type { RenderContent } from './scene';
export type { RenderOptions, Renderer } from './types';

export async function createRenderer(
  container: HTMLElement,
  options: RenderOptions,
  content: RenderContent,
): Promise<Renderer> {
  const width = container.clientWidth;
  const height = container.clientHeight;
  const pixi = await autoDetectRenderer({
    preference: 'webgl',
    width,
    height,
    resolution: Math.min(window.devicePixelRatio, 2),
    autoDensity: true,
    antialias: true,
    background: parseHexColor(SUN_PALETTES.crepuscule.sol),
    skipExtensionImports: true,
  });
  container.appendChild(pixi.canvas);
  return new Scene(pixi, options, content, width, height);
}
