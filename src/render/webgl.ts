import {
  type GlRenderingContext,
  WebGLRenderer,
  type WebGLOptions,
  getMaxFragmentPrecision,
  getTestContext,
} from 'pixi.js';

// A renderer that could not start, most often because the browser refused its WebGL context:
// none left on a phone that still holds the contexts of the page before, or no WebGL at all.
// The message keeps Pixi's, so that the crash reports tell a refusal from another failure.
export class RendererUnavailable extends Error {
  constructor(cause: unknown) {
    super(
      `No WebGL context for the renderer (${cause instanceof Error ? cause.message : String(cause)})`,
      { cause },
    );
    this.name = 'RendererUnavailable';
  }
}

// WebGL and nothing else: no probe that opens a context of its own first, and no silent fall back
// to WebGPU or to the canvas renderer, which the game is not drawn for.
export async function createWebGLRenderer(options: Partial<WebGLOptions>): Promise<WebGLRenderer> {
  const renderer = new WebGLRenderer();
  try {
    await renderer.init(options);
  } catch (error) {
    // A start that failed after its context was opened lets the context go at once.
    contextOf(renderer)?.getExtension('WEBGL_lose_context')?.loseContext();
    throw new RendererUnavailable(error);
  }
  releaseTestContext();
  return renderer;
}

// Pixi types it as always there, but a renderer that failed to start may have none.
function contextOf(renderer: WebGLRenderer): GlRenderingContext | undefined {
  return renderer.gl;
}

let testContextReleased = false;

// Pixi opens a context of its own to read what the GPU supports, and keeps it for the whole page:
// one more of the few a phone has. Its answers are cached once a renderer has started, so the
// context is let go, once: asking for it again would open a new one.
function releaseTestContext(): void {
  if (testContextReleased) {
    return;
  }
  testContextReleased = true;
  getMaxFragmentPrecision();
  testContext()?.getExtension('WEBGL_lose_context')?.loseContext();
}

// Pixi types it as always there, but the browser may have refused it.
function testContext(): GlRenderingContext | null {
  return getTestContext();
}
