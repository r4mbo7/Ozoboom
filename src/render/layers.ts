import { Container } from 'pixi.js';
import type { Frame } from './frame';

export interface Layers {
  readonly world: Container;
  readonly screen: Container;
  readonly ground: Container;
  readonly echoes: Container;
  readonly speakers: Container;
  readonly glow: Container;
  readonly enemies: Container;
  readonly enemyShots: Container;
  readonly traps: Container;
  readonly core: Container;
  readonly pickups: Container;
  readonly zones: Container;
  readonly bystanders: Container;
  readonly fx: Container;
  readonly shots: Container;
  readonly weapons: Container;
  readonly players: Container;
  readonly bubbles: Container;
}

function layer(parent: Container): Container {
  const container = new Container();
  parent.addChild(container);
  return container;
}

// Order is the draw order. glow, fx and shots hold the halos and trails, whose blend follows the light.
export function createLayers(stage: Container): Layers {
  const world = layer(stage);
  return {
    world,
    ground: layer(world),
    echoes: layer(world),
    speakers: layer(world),
    glow: layer(world),
    enemies: layer(world),
    enemyShots: layer(world),
    traps: layer(world),
    core: layer(world),
    pickups: layer(world),
    zones: layer(world),
    bystanders: layer(world),
    fx: layer(world),
    shots: layer(world),
    weapons: layer(world),
    players: layer(world),
    bubbles: layer(world),
    screen: layer(stage),
  };
}

export function applyLight(layers: Layers, frame: Pick<Frame, 'light'>): void {
  const blendMode = frame.light.additive ? 'add' : 'normal';
  layers.glow.blendMode = blendMode;
  layers.fx.blendMode = blendMode;
  layers.shots.blendMode = blendMode;
  layers.echoes.blendMode = blendMode;
}
