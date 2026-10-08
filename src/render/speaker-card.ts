import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { SpeakerDefinition } from '../data/types';
import { TICKS_PER_BAR, TICKS_PER_BEAT } from '../shared/tempo';
import type { Vec2 } from '../shared/vec';
import type { SimState, SpeakerState } from '../sim/state';
import { worldToScreen } from './camera';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { speakerToken } from './speaker-kit';
import { LABEL_FONT_PX, LABEL_PAD, NAME_TEXTURE_SCALE, createLineTextures } from './textures-names';
import { lookup, setTint } from './util';
import { ViewPool } from './views';

const NEAR = 170;
const COUNT_WORDS = ['zéro', 'une', 'deux', 'trois', 'quatre'];
const PLUGGED = -1;
const IDLE = 0;
const MARGIN = 12;
const PAD = 10;
const LINE_HEIGHT = LABEL_FONT_PX * 1.35;
const CORNER = 12;
const RIM_WIDTH = 1.5;
const LIFT = 1.9;
const LINES = [
  { weight: 700, alpha: 1 },
  { weight: 500, alpha: 0.8 },
  { weight: 500, alpha: 1 },
  { weight: 400, alpha: 0.8 },
] as const;

type CardDefinition = Pick<SpeakerDefinition, 'name' | 'description' | 'plugBars'>;

// PLUGGED once plugged, IDLE while nobody stands in it, else the beats still needed.
export function plugStep(speaker: Pick<SpeakerState, 'plugTicks' | 'plugged'>, plugBars: number) {
  if (speaker.plugged) {
    return PLUGGED;
  }
  if (speaker.plugTicks <= 0) {
    return IDLE;
  }
  const left = plugBars * TICKS_PER_BAR - speaker.plugTicks;
  return Math.max(1, Math.ceil(left / TICKS_PER_BEAT));
}

function stateLine(step: number, plugBars: number): string {
  if (step === PLUGGED) {
    return 'branchée';
  }
  if (step === IDLE) {
    const word = COUNT_WORDS[plugBars] ?? String(plugBars);
    return `reste ${word} mesure${plugBars > 1 ? 's' : ''} dedans`;
  }
  return `branchement : encore ${String(step)} temps`;
}

export function cardLines(
  definition: CardDefinition,
  weaponName: string | null,
  step: number,
  plugBars: number,
): readonly string[] {
  return [
    definition.name,
    stateLine(step, plugBars),
    weaponName === null ? 'Volume +1' : `Volume +1 · ouvre ${weaponName}`,
    definition.description,
  ];
}

export function isNear(speaker: Vec2, players: readonly Vec2[]): boolean {
  return players.some(
    (player) => (player.x - speaker.x) ** 2 + (player.y - speaker.y) ** 2 < NEAR * NEAR,
  );
}

// Top left corner of a card centered above its anchor, kept whole on the screen.
export function cardOrigin(
  anchorX: number,
  anchorY: number,
  width: number,
  height: number,
  screenWidth: number,
  screenHeight: number,
): Vec2 {
  return {
    x: Math.max(MARGIN, Math.min(screenWidth - MARGIN - width, Math.round(anchorX - width / 2))),
    y: Math.max(MARGIN, Math.min(screenHeight - MARGIN - height, Math.round(anchorY - height))),
  };
}

interface CardView {
  readonly root: Container;
  readonly panel: Graphics;
  readonly rim: Graphics;
  readonly lines: readonly Sprite[];
  id: string;
  step: number;
  width: number;
  height: number;
}

// Screen space: above a side speaker a player comes near, what it is, gives and asks for.
export function createSpeakerCards(ctx: RenderContext): Family {
  const root = ctx.layers.screen.addChild(new Container());
  const texts = createLineTextures();
  const views = new ViewPool<CardView>(
    () => {
      const card = root.addChild(new Container());
      const panel = card.addChild(new Graphics());
      const rim = card.addChild(new Graphics());
      const lines = LINES.map(() => {
        const line = card.addChild(new Sprite(Texture.EMPTY));
        line.scale.set(1 / NAME_TEXTURE_SCALE);
        return line;
      });
      return { root: card, panel, rim, lines, id: '', step: Number.NaN, width: 0, height: 0 };
    },
    (view) => {
      view.root.visible = false;
    },
  );

  function layOut(
    view: CardView,
    definition: CardDefinition & Pick<SpeakerDefinition, 'unlocksWeaponId'>,
  ) {
    const weapon =
      definition.unlocksWeaponId === undefined
        ? null
        : lookup(ctx.weaponLooks, definition.unlocksWeaponId, 'weapon').name;
    const lines = cardLines(definition, weapon, view.step, definition.plugBars);
    let widest = 0;
    for (const [index, sprite] of view.lines.entries()) {
      const texture = texts.get(lines[index] ?? '', LINES[index]?.weight ?? 400);
      sprite.texture = texture;
      widest = Math.max(widest, texture.width / NAME_TEXTURE_SCALE - 2 * LABEL_PAD);
      sprite.position.set(
        PAD - LABEL_PAD,
        Math.round(
          PAD + LABEL_FONT_PX / 2 + index * LINE_HEIGHT - texture.height / NAME_TEXTURE_SCALE / 2,
        ),
      );
    }
    const width = Math.ceil(widest) + 2 * PAD;
    const height = Math.round(LINES.length * LINE_HEIGHT - (LINE_HEIGHT - LABEL_FONT_PX) + 2 * PAD);
    if (width !== view.width || height !== view.height) {
      view.width = width;
      view.height = height;
      view.panel.clear().roundRect(0, 0, width, height, CORNER).fill(0xffffff);
      view.rim
        .clear()
        .roundRect(0, 0, width, height, CORNER)
        .stroke({ width: RIM_WIDTH, color: 0xffffff });
    }
  }

  return {
    update(state: SimState, _alpha: number, frame: Frame): void {
      views.begin();
      const speakers = state.speakers ?? [];
      const looks = speakers.length > 0 ? lookup(ctx.speakerLooks, state.setId, 'set') : null;
      const { camera, palette, light } = frame;
      for (const [index, speaker] of speakers.entries()) {
        if (looks === null || !isNear(speaker, state.players)) {
          continue;
        }
        const definition = lookup(looks, speaker.id, 'speaker');
        const view = views.acquire(index);
        const step = plugStep(speaker, definition.plugBars);
        if (view.id !== speaker.id || view.step !== step) {
          view.id = speaker.id;
          view.step = step;
          layOut(view, definition);
        }
        const color = palette[speakerToken(speaker.id)];
        setTint(view.panel, palette.solClair);
        view.panel.alpha = light.additive ? 0.88 : 0.94;
        setTint(view.rim, color);
        view.rim.alpha = 0.7;
        for (const [line, sprite] of view.lines.entries()) {
          setTint(sprite, line === 0 ? color : palette.texte);
          sprite.alpha = LINES[line]?.alpha ?? 1;
        }
        const anchor = worldToScreen(camera, {
          x: speaker.x,
          y: speaker.y - speaker.radius * LIFT,
        });
        const origin = cardOrigin(
          anchor.x,
          anchor.y,
          view.width,
          view.height,
          camera.screenWidth,
          camera.screenHeight,
        );
        view.root.visible = true;
        view.root.position.set(origin.x, origin.y);
      }
      views.end();
    },
    destroy(): void {
      root.destroy({ children: true });
      texts.destroy();
    },
  };
}
