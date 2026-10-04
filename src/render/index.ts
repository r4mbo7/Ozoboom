import { autoDetectRenderer } from 'pixi.js';
import { PALETTE } from './palette';
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
    background: PALETTE.night,
    skipExtensionImports: true,
  });
  container.appendChild(pixi.canvas);
  return new Scene(pixi, options, content, width, height);
}
