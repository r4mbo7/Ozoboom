import { Container } from 'pixi.js';
import type { Frame } from './frame';

export interface Layers {
  readonly world: Container;
  // What the Faux contact's blank drains: all but the players, their shots and what is above them.
  readonly setting: Container;
  readonly screen: Container;
  readonly ground: Container;
  readonly decor: Container;
  readonly echoes: Container;
  readonly speakers: Container;
  readonly glow: Container;
  readonly dim: Container;
  readonly enemies: Container;
  readonly enemyShots: Container;
  readonly traps: Container;
  readonly core: Container;
  readonly sky: Container;
  readonly pickups: Container;
  readonly zones: Container;
  readonly bystanders: Container;
  readonly recruits: Container;
  readonly farewells: Container;
  readonly fx: Container;
  readonly shots: Container;
  readonly weapons: Container;
  readonly veil: Container;
  readonly players: Container;
  readonly canopy: Container;
  readonly bubbles: Container;
}

function layer(parent: Container): Container {
  const container = new Container();
  parent.addChild(container);
  return container;
}

// Order is the draw order. glow, fx and shots hold halos and trails, whose blend follows the light.
export function createLayers(stage: Container): Layers {
  const world = layer(stage);
  const setting = layer(world);
  return {
    world,
    setting,
    ground: layer(setting),
    decor: layer(setting),
    echoes: layer(setting),
    speakers: layer(setting),
    glow: layer(setting),
    dim: layer(setting),
    enemies: layer(setting),
    enemyShots: layer(setting),
    traps: layer(setting),
    core: layer(setting),
    sky: layer(setting),
    pickups: layer(setting),
    zones: layer(setting),
    bystanders: layer(setting),
    recruits: layer(setting),
    farewells: layer(setting),
    fx: layer(setting),
    shots: layer(world),
    weapons: layer(world),
    veil: layer(world),
    players: layer(world),
    canopy: layer(world),
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
