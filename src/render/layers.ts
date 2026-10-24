import { Container } from 'pixi.js';
import type { Frame } from './frame';

export interface Layers {
  readonly world: Container;
  readonly screen: Container;
  readonly ground: Container;
  readonly decor: Container;
  readonly echoes: Container;
  readonly speakers: Container;
  readonly glow: Container;
  // Darkens the floor before a boss lands.
  readonly dim: Container;
  readonly enemies: Container;
  readonly enemyShots: Container;
  readonly traps: Container;
  readonly core: Container;
  // What flies over the stage: the masks that fly, and what flies with them.
  readonly sky: Container;
  readonly pickups: Container;
  readonly zones: Container;
  readonly bystanders: Container;
  readonly recruits: Container;
  // A chased boss smiles and bursts above what it dropped.
  readonly farewells: Container;
  readonly fx: Container;
  readonly shots: Container;
  readonly weapons: Container;
  // Mutes the world round a player of this screen who lies down, under the players and their marks.
  readonly veil: Container;
  readonly players: Container;
  // What the players walk under: the roofs and garlands of a path.
  readonly canopy: Container;
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
    decor: layer(world),
    echoes: layer(world),
    speakers: layer(world),
    glow: layer(world),
    dim: layer(world),
    enemies: layer(world),
    enemyShots: layer(world),
    traps: layer(world),
    core: layer(world),
    sky: layer(world),
    pickups: layer(world),
    zones: layer(world),
    bystanders: layer(world),
    recruits: layer(world),
    farewells: layer(world),
    fx: layer(world),
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
