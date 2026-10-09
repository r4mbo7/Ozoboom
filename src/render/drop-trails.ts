import {
  ColorMatrixFilter,
  Container,
  FilterPipe,
  FilterSystem,
  type Renderer,
  RenderTexture,
  Sprite,
  extensions,
} from 'pixi.js';
import type { Frame } from './frame';
import type { Layers } from './layers';

extensions.add(FilterSystem, FilterPipe);

const BUFFER_SCALE = 0.5;
const KEEP_PER_TICK = { low: 0.55, high: 0.88 };
const MAX_STEP_TICKS = 4;
const HUE_TURN_TICKS = 192;
const ECHO_ALPHA = { night: 0.9, day: 0.45 };

function hueChannel(turn: number, offset: number): number {
  return 0.5 + 0.5 * Math.cos(2 * Math.PI * (turn + offset));
}

// Echoes of our players, their shots and the stage: a half-resolution buffer fed back into itself, drawn under the entities.
export function createDropTrails(pixi: Renderer, layers: Layers) {
  const sources = new Set<Container>([layers.core, layers.shots, layers.weapons, layers.players]);
  const display = layers.echoes.addChild(new Sprite());
  const compose = new Container();
  const previous = compose.addChild(new Sprite());
  const echo = compose.addChild(new Sprite());
  const silhouette = new ColorMatrixFilter();
  echo.filters = [silhouette];
  const flat = silhouette.matrix;
  flat.fill(0);
  flat[18] = 1;
  const lastWorld = { x: 0, y: 0, scale: 0 };
  let size = { width: 0, height: 0 };
  let buffers: RenderTexture[] = [];
  let capture: RenderTexture | null = null;
  let dirty = false;
  let lastNow = Number.NEGATIVE_INFINITY;
  display.visible = false;

  function release(): void {
    for (const texture of [...buffers, ...(capture === null ? [] : [capture])]) {
      texture.destroy(true);
    }
    buffers = [];
    capture = null;
  }

  function allocate(width: number, height: number): void {
    release();
    const options = { width, height, resolution: pixi.resolution * BUFFER_SCALE };
    buffers = [RenderTexture.create(options), RenderTexture.create(options)];
    capture = RenderTexture.create(options);
    size = { width, height };
  }

  function clear(target: RenderTexture): void {
    pixi.render({ container: new Container(), target, clear: true });
  }

  function drawSources(world: Container, target: RenderTexture): void {
    const shown = world.children.map((child) => child.visible);
    world.children.forEach((child) => {
      child.visible = child.visible && sources.has(child);
    });
    pixi.render({ container: world, target, clear: true });
    world.children.forEach((child, index) => {
      child.visible = shown[index] ?? true;
    });
  }

  return {
    update(frame: Frame, width: number, height: number): void {
      const active = frame.dropFilter > 0 && !frame.calm;
      const step = Math.min(frame.now - lastNow, MAX_STEP_TICKS);
      lastNow = frame.now;
      display.visible = active;
      if (!active) {
        if (dirty) {
          buffers.forEach(clear);
          dirty = false;
        }
        return;
      }
      const { world } = layers;
      if (size.width !== width || size.height !== height) {
        allocate(width, height);
      } else if (world.scale.x !== lastWorld.scale) {
        buffers.forEach(clear);
      }
      const [read, write] = buffers;
      if (step <= 0) {
        display.visible = dirty;
        return;
      }
      const shot = capture;
      if (read === undefined || write === undefined || shot === null) {
        return;
      }
      const night = frame.light.additive;
      display.visible = false;
      drawSources(world, shot);

      previous.texture = read;
      previous.position.set(world.x - lastWorld.x, world.y - lastWorld.y);
      const keep = KEEP_PER_TICK.low + (KEEP_PER_TICK.high - KEEP_PER_TICK.low) * frame.dropFilter;
      previous.alpha = keep ** step;
      echo.texture = shot;
      echo.alpha = night ? ECHO_ALPHA.night : ECHO_ALPHA.day;
      echo.blendMode = night ? 'add' : 'normal';
      const turn = frame.now / HUE_TURN_TICKS;
      flat[4] = hueChannel(turn, 0);
      flat[9] = hueChannel(turn, 1 / 3);
      flat[14] = hueChannel(turn, 2 / 3);
      pixi.render({ container: compose, target: write, clear: true });
      buffers = [write, read];
      dirty = true;
      lastWorld.x = world.x;
      lastWorld.y = world.y;
      lastWorld.scale = world.scale.x;

      display.texture = write;
      display.visible = true;
      const scale = 1 / world.scale.x;
      display.scale.set(scale);
      display.position.set(-world.x * scale, -world.y * scale);
    },
    destroy(): void {
      release();
      compose.destroy({ children: true });
      silhouette.destroy();
    },
  };
}
