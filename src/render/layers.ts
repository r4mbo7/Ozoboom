import { Container } from 'pixi.js';
import type { Frame } from './frame';

export interface Layers {
  readonly world: Container;
  readonly ground: Container;
  readonly speakers: Container;
  readonly glow: Container;
  readonly enemies: Container;
  readonly enemyShots: Container;
  readonly traps: Container;
  readonly core: Container;
  readonly pickups: Container;
  readonly bystanders: Container;
  readonly fx: Container;
  readonly weapons: Container;
  readonly players: Container;
}

function layer(parent: Container): Container {
  const container = new Container();
  parent.addChild(container);
  return container;
}

// Order is the draw order. glow and fx hold the halos and trails, whose blend follows the light.
export function createLayers(stage: Container): Layers {
  const world = layer(stage);
  return {
    world,
    ground: layer(world),
    speakers: layer(world),
    glow: layer(world),
    enemies: layer(world),
    enemyShots: layer(world),
    traps: layer(world),
    core: layer(world),
    pickups: layer(world),
    bystanders: layer(world),
    fx: layer(world),
    weapons: layer(world),
    players: layer(world),
  };
}

export function applyLight(layers: Layers, frame: Pick<Frame, 'light'>): void {
  const blendMode = frame.light.additive ? 'add' : 'normal';
  layers.glow.blendMode = blendMode;
  layers.fx.blendMode = blendMode;
}
