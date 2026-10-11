import type { Container, Sprite } from 'pixi.js';
import { MAIN_TEMPO, type Tempo } from '../shared/tempo';
import { TAU } from './paint';
import { type Look, type LookInput, type Spawn, angleSpring, fade, lerpAngle } from './player-look';
import type { Textures } from './textures';
import { POI_ORBIT, REFERENCE, STRAND_LENGTH } from './textures-looks';
import { add, hide, placeOutline, setTint } from './util';

const STRANDS = 5;
const HAIR = { stiffness: 0.3, damping: 0.38, tipStiffness: 0.2, tipDamping: 0.3 };
const HAIR_KICK = { normal: 0.12, calm: 0.05 };
const FLUTTER = { normal: 0.12, calm: 0.05 };
const WHIP_TICKS = 1.6;
const RECOIL = 5;
const NOVA_TICKS = 48;

// The poi make a turn per bar: they follow the time, not the frame.
export function poiAngle(now: number, { ticksPerBar }: Tempo = MAIN_TEMPO): number {
  return (((now % ticksPerBar) + ticksPerBar) % ticksPerBar) * (TAU / ticksPerBar);
}

// The last ball thrown alternates: the first shot throws ball 0.
export function whippedBall(fireCount: number): number {
  return (fireCount + 1) % 2;
}

// After the nova the poi fly out and come back on an elastic, then settle on their orbit.
export function novaStretch(sinceSkill: number): number {
  if (sinceSkill < 0 || sinceSkill >= NOVA_TICKS) {
    return 1;
  }
  return Math.max(0.6, 1 + 1.1 * Math.exp(-sinceSkill / 7) * Math.cos(sinceSkill * 0.38));
}

// La Luxiole: five ribbons in her hair on springs, and two poi of which the last thrown whips
// toward the aim on every shot while her body recoils a little.
export function createPoiLook(bodies: Container, textures: Textures, spawn: Spawn): Look {
  const t = textures.players;
  const parts = t.poi;
  const arms = [add(bodies, parts.arm), add(bodies, parts.arm)] as const;
  const outline = add(bodies, t.shoulders);
  const shoulders = add(bodies, t.shoulders);
  const head = add(bodies, t.head);
  const roots: Sprite[] = [];
  const tips: Sprite[] = [];
  const beads: Sprite[] = [];
  for (let index = 0; index < STRANDS; index += 1) {
    roots.push(add(bodies, parts.strandRoot));
    tips.push(add(bodies, parts.strandTip));
    beads.push(add(bodies, parts.bead));
  }
  const balls = [add(bodies, parts.ball), add(bodies, parts.ball)] as const;
  const sprites = [...arms, outline, shoulders, head, ...roots, ...tips, ...beads, ...balls];
  // Per ribbon: root angle, its speed, tip angle, its speed.
  const hair = new Float64Array(STRANDS * 4);
  let fresh = true;
  let lastBeat = -1;
  let lastFire = 0;

  function placeHair(input: LookInput, x: number, y: number): void {
    const { angle, scale, color, frame, dt } = input;
    const kick =
      input.beatIndex !== lastBeat ? (frame.calm ? HAIR_KICK.calm : HAIR_KICK.normal) : 0;
    lastBeat = input.beatIndex;
    const flutter = frame.calm ? FLUTTER.calm : FLUTTER.normal;
    const pull = input.moving * Math.min(1, input.speed) * 0.45;
    const behind = angle + Math.PI;
    const away = input.heading + Math.PI;
    const length = STRAND_LENGTH * scale;
    for (let index = 0; index < STRANDS; index += 1) {
      const spread = index / 2 - 1;
      const at = index * 4;
      const target =
        lerpAngle(behind + spread * 0.45, away + spread * 0.3, pull) +
        flutter * Math.sin(frame.now * 0.45 + index * 1.3);
      if (fresh) {
        hair[at] = hair[at + 2] = target;
        hair[at + 1] = hair[at + 3] = 0;
      }
      hair[at + 1] = (hair[at + 1] ?? 0) + (index % 2 === 0 ? kick : -kick);
      angleSpring(hair, at, target, HAIR.stiffness, HAIR.damping, dt);
      angleSpring(hair, at + 2, hair[at] ?? 0, HAIR.tipStiffness, HAIR.tipDamping, dt);
      const rootAngle = hair[at] ?? 0;
      const tipAngle = hair[at + 2] ?? 0;
      const anchor = behind + spread * 0.75;
      const rootX = x + Math.cos(anchor) * 8 * scale;
      const rootY = y + Math.sin(anchor) * 8 * scale;
      const tipX = rootX + Math.cos(rootAngle) * length;
      const tipY = rootY + Math.sin(rootAngle) * length;
      const root = roots[index];
      const tip = tips[index];
      const bead = beads[index];
      if (root === undefined || tip === undefined || bead === undefined) {
        continue;
      }
      root.position.set(rootX, rootY);
      root.rotation = rootAngle;
      tip.position.set(tipX, tipY);
      tip.rotation = tipAngle;
      bead.position.set(tipX + Math.cos(tipAngle) * length, tipY + Math.sin(tipAngle) * length);
      root.visible = tip.visible = bead.visible = true;
      root.scale.set(scale);
      tip.scale.set(scale);
      bead.scale.set(scale);
      const ribbon = index % 2 === 0 ? color : frame.palette.texte;
      setTint(root, ribbon);
      setTint(tip, ribbon);
      setTint(bead, frame.palette.or);
    }
    fresh = false;
  }

  return {
    reset() {
      fresh = true;
      lastBeat = -1;
      lastFire = 0;
    },
    hide() {
      hide(...sprites);
    },
    place(input) {
      const { x, y, angle, scale, color, frame } = input;
      const whip = input.fireCount > 0 ? fade(input.sinceFire, WHIP_TICKS) : 0;
      const fired = input.fireCount !== lastFire && !fresh;
      lastFire = input.fireCount;
      const bodyX = x - Math.cos(angle) * RECOIL * whip * scale;
      const bodyY = y - Math.sin(angle) * RECOIL * whip * scale;

      shoulders.visible = head.visible = true;
      shoulders.position.set(bodyX, bodyY);
      shoulders.rotation = angle;
      shoulders.scale.set(scale * (1 - 0.1 * whip), scale * (1 + 0.12 * whip));
      setTint(shoulders, color);
      head.position.set(bodyX, bodyY);
      head.rotation = angle;
      head.scale.set(scale);
      setTint(head, input.teint);
      placeOutline(outline, shoulders, t.shoulders.texture, REFERENCE, frame);

      const turn = poiAngle(frame.now, frame.tempo);
      const thrown = whippedBall(input.fireCount);
      const reach = POI_ORBIT * novaStretch(input.sinceSkill);
      for (let index = 0; index < 2; index += 1) {
        let ballAngle = turn + index * Math.PI;
        let radius = reach;
        let stretch = 1;
        if (index === thrown && whip > 0.02) {
          ballAngle = lerpAngle(ballAngle, angle, whip);
          radius *= 1 + 0.35 * whip;
          stretch = 1 + 0.9 * whip;
        }
        const arm = index === 0 ? arms[0] : arms[1];
        const ball = index === 0 ? balls[0] : balls[1];
        arm.visible = ball.visible = true;
        arm.position.set(bodyX, bodyY);
        arm.rotation = ballAngle;
        arm.scale.set((radius / POI_ORBIT) * scale);
        setTint(arm, color);
        const ballX = bodyX + Math.cos(ballAngle) * radius * scale;
        const ballY = bodyY + Math.sin(ballAngle) * radius * scale;
        ball.position.set(ballX, ballY);
        ball.rotation = ballAngle;
        ball.scale.set(scale * stretch, scale / Math.sqrt(stretch));
        setTint(ball, color);
        if (fired && index === thrown) {
          spawn(frame, {
            shape: textures.halo,
            now: frame.now,
            duration: 5,
            x: ballX,
            y: ballY,
            fromRadius: 8 * scale,
            toRadius: 30 * scale,
            tint: color,
            peak: 0.8,
          });
        }
      }
      placeHair(input, bodyX, bodyY);
      return 0;
    },
  };
}
