import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { SpeakerDefinition, WeaponEffect } from '../data/types';
import { weaponGlyph } from '../data/weapon-glyphs';
import { t } from '../shared/i18n';
import type { Vec2 } from '../shared/vec';
import type { SimState } from '../sim/state';
import { worldToScreen } from './camera';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { paintGlyph } from './glyph';
import type { Shape } from './paint';
import { CORNER, TAIL, TAIL_HALF, bubble, paintVolume } from './speaker-bubble';
import { speakerToken } from './speaker-kit';
import { LABEL_FONT_PX, LABEL_PAD, NAME_TEXTURE_SCALE, createLineTextures } from './textures-names';
import { lookup, setTint } from './util';
import { ViewPool } from './views';
import { styleOf } from './weapon-looks';

const NEAR = 170;
const MARGIN = 12;
const PAD = 9;
const RIM_WIDTH = 1.8;
const LIFT = 1.9;
const DROP = 1.6;
const ICON = 36;
const VOLUME = 24;
const GAP = 10;
const NAME_GAP = 6;
const ROW_GAP = 4;
const WASH = 0.14;
const DIVIDER = 0.25;
const PHRASE_WEIGHT = 600;
const VOLUME_WEIGHT = 700;
const GAIN_SCALE = 1.3;
const VOLUME_TEXT = '+1';
const GLYPH_DENSITY = 2;

type CardDefinition = Pick<SpeakerDefinition, 'description' | 'unlocksWeaponId'>;

export function isNear(speaker: Vec2, players: readonly Vec2[]): boolean {
  return players.some(
    (player) => (player.x - speaker.x) ** 2 + (player.y - speaker.y) ** 2 < NEAR * NEAR,
  );
}

export function cardScale(width: number, screenWidth: number): number {
  return Math.min(1, (screenWidth - 2 * MARGIN) / width);
}

// Above the top speaker, the card would hide under the HUD's top bar.
export function opensBelow(speakerY: number, arenaHeight: number): boolean {
  return speakerY < arenaHeight / 2;
}

export function cardOrigin(
  anchorX: number,
  anchorY: number,
  width: number,
  height: number,
  screenWidth: number,
  screenHeight: number,
  below: boolean,
): Vec2 {
  const top = below ? anchorY : anchorY - height;
  return {
    x: Math.max(MARGIN, Math.min(screenWidth - MARGIN - width, Math.round(anchorX - width / 2))),
    y: Math.max(MARGIN, Math.min(screenHeight - MARGIN - height, Math.round(top))),
  };
}

interface CardView {
  readonly root: Container;
  readonly panel: Graphics;
  readonly wash: Graphics;
  readonly rim: Graphics;
  readonly divider: Graphics;
  readonly volume: Sprite;
  readonly gain: Sprite;
  readonly weapon: Sprite;
  readonly name: Sprite;
  readonly phrase: Sprite;
  id: string;
  width: number;
  height: number;
  tipX: number;
  below: boolean;
}

// A line texture carries its edge and pad around the text: this is the width the text takes.
function textWidth(texture: Texture): number {
  return texture.width / NAME_TEXTURE_SCALE - 2 * LABEL_PAD;
}

export function createSpeakerCards(ctx: RenderContext): Family {
  const root = ctx.layers.screen.addChild(new Container());
  const texts = createLineTextures();
  const volumeShape = paintVolume();
  // The interface's picto of each weapon kind, painted the first time a bubble opens it.
  const glyphs = new Map<WeaponEffect['kind'], Shape>();
  const glyphOf = (effect: WeaponEffect): Shape => {
    let glyph = glyphs.get(effect.kind);
    if (glyph === undefined) {
      glyph = paintGlyph(weaponGlyph(effect), ICON, GLYPH_DENSITY);
      glyphs.set(effect.kind, glyph);
    }
    return glyph;
  };
  const views = new ViewPool<CardView>(
    () => {
      const card = root.addChild(new Container());
      const panel = card.addChild(new Graphics());
      const wash = card.addChild(new Graphics());
      const rim = card.addChild(new Graphics());
      const divider = card.addChild(new Graphics());
      const sprite = (texture: Texture) => {
        const made = card.addChild(new Sprite(texture));
        made.anchor.set(0.5);
        return made;
      };
      const volume = sprite(volumeShape.texture);
      volume.scale.set(VOLUME / (2 * volumeShape.radius));
      const text = (texture: Texture) => {
        const made = sprite(texture);
        made.scale.set(1 / NAME_TEXTURE_SCALE);
        return made;
      };
      const big = (texture: Texture) => {
        const made = text(texture);
        made.scale.set(GAIN_SCALE / NAME_TEXTURE_SCALE);
        return made;
      };
      const gain = big(texts.get(VOLUME_TEXT, VOLUME_WEIGHT));
      return {
        root: card,
        panel,
        wash,
        rim,
        divider,
        volume,
        gain,
        weapon: sprite(Texture.EMPTY),
        name: big(Texture.EMPTY),
        phrase: text(Texture.EMPTY),
        id: '',
        width: 0,
        height: 0,
        tipX: Number.NaN,
        below: false,
      };
    },
    (view) => {
      view.root.visible = false;
    },
  );

  // The pictos on top, the gain then the weapon it opens and its name, and the phrase of the aura
  // under them.
  function layOut(view: CardView, definition: CardDefinition) {
    const phrase = texts.get(t(definition.description), PHRASE_WEIGHT);
    view.phrase.texture = phrase;
    const gainWidth = textWidth(view.gain.texture) * GAIN_SCALE;
    const style =
      definition.unlocksWeaponId === undefined ? null : styleOf(ctx, definition.unlocksWeaponId);
    view.name.texture =
      style === null ? Texture.EMPTY : texts.get(t(style.look.name), VOLUME_WEIGHT);
    const nameWidth = style === null ? 0 : textWidth(view.name.texture) * GAIN_SCALE;
    const row =
      VOLUME + ROW_GAP + gainWidth + (style === null ? 0 : 2 * GAP + ICON + NAME_GAP + nameWidth);
    const width = Math.ceil(Math.max(row, textWidth(phrase))) + 2 * PAD;
    const height = PAD + ICON + ROW_GAP + LABEL_FONT_PX + PAD;
    const rowY = PAD + ICON / 2;
    let x = (width - row) / 2;
    view.volume.position.set(x + VOLUME / 2, rowY);
    x += VOLUME + ROW_GAP;
    view.gain.position.set(Math.round(x + gainWidth / 2), rowY);
    x += gainWidth + GAP;
    view.divider.clear();
    view.weapon.visible = view.name.visible = style !== null;
    if (style !== null) {
      view.divider
        .moveTo(x, rowY - ICON * 0.35)
        .lineTo(x, rowY + ICON * 0.35)
        .stroke({ width: 1.2, color: 0xffffff });
      const shape = glyphOf(style.look.effect);
      view.weapon.texture = shape.texture;
      view.weapon.scale.set(ICON / (2 * shape.radius));
      x += GAP;
      view.weapon.position.set(x + ICON / 2, rowY);
      x += ICON + NAME_GAP;
      view.name.position.set(Math.round(x + nameWidth / 2), rowY);
    }
    view.phrase.position.set(
      Math.round(width / 2),
      Math.round(PAD + ICON + ROW_GAP + LABEL_FONT_PX / 2),
    );
    view.width = width;
    view.height = height;
    view.tipX = Number.NaN;
  }

  function shape(view: CardView, tipX: number, below: boolean) {
    if (tipX === view.tipX && below === view.below) {
      return;
    }
    view.tipX = tipX;
    view.below = below;
    const { width, height } = view;
    bubble(view.panel.clear(), width, height, tipX, below);
    view.panel.fill(0xffffff);
    bubble(view.wash.clear(), width, height, tipX, below);
    view.wash.fill(0xffffff);
    bubble(view.rim.clear(), width, height, tipX, below);
    view.rim.stroke({ width: RIM_WIDTH, color: 0xffffff });
  }

  return {
    update(state: SimState, _alpha: number, frame: Frame): void {
      views.begin();
      const speakers = state.speakers ?? [];
      const looks = speakers.length > 0 ? lookup(ctx.speakerLooks, state.setId, 'set') : null;
      const { camera, palette, light } = frame;
      for (const [index, speaker] of speakers.entries()) {
        // Once plugged, the gain is had and the weapon open: the bubble has nothing left to offer.
        if (looks === null || speaker.plugged || !isNear(speaker, state.players)) {
          continue;
        }
        const definition = lookup(looks, speaker.id, 'speaker');
        const view = views.acquire(index);
        if (view.id !== speaker.id) {
          view.id = speaker.id;
          layOut(view, definition);
        }
        const color = palette[speakerToken(speaker.id)];
        setTint(view.panel, palette.solClair);
        view.panel.alpha = light.additive ? 0.88 : 0.94;
        setTint(view.wash, color);
        view.wash.alpha = WASH;
        setTint(view.rim, color);
        setTint(view.divider, color);
        view.divider.alpha = DIVIDER;
        setTint(view.volume, color);
        setTint(view.gain, color);
        setTint(view.name, color);
        setTint(view.phrase, palette.texte);
        setTint(view.weapon, color);
        const below = opensBelow(speaker.y, state.arena.height);
        const anchor = worldToScreen(camera, {
          x: speaker.x,
          y: speaker.y + speaker.radius * (below ? DROP : -LIFT),
        });
        const scale = cardScale(view.width, camera.screenWidth);
        const tail = TAIL * scale;
        const origin = cardOrigin(
          anchor.x,
          anchor.y + (below ? tail : -tail),
          view.width * scale,
          view.height * scale,
          camera.screenWidth,
          camera.screenHeight,
          below,
        );
        const reach = CORNER + TAIL_HALF;
        shape(
          view,
          Math.round(Math.max(reach, Math.min(view.width - reach, (anchor.x - origin.x) / scale))),
          below,
        );
        view.root.visible = true;
        view.root.scale.set(scale);
        view.root.position.set(origin.x, origin.y);
      }
      views.end();
    },
    destroy(): void {
      root.destroy({ children: true });
      texts.destroy();
      volumeShape.texture.destroy(true);
      for (const glyph of glyphs.values()) {
        glyph.texture.destroy(true);
      }
    },
  };
}
