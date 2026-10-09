import { Filter, GlProgram, Rectangle } from 'pixi.js';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';

const TWO_PI = 2 * Math.PI;
const AMPLITUDE_PX = 12;
const WAVE_LENGTH_PX = 90;
const SATURATION_BOOST = 1;
const HUE_RADIANS_PER_TICK = 0.03;
const WAVE_RADIANS_PER_TICK = 0.08;
const CALM = { waveSpeed: 0.25, hue: 0.8 };

export interface GroundWave {
  amplitude: number;
  phase: number;
  hue: number;
  saturation: number;
  blend: number;
}

// The waves, the saturation and the share of shifted hue follow the filter; the hue cycles, except in the calm mode where it holds still.
export function groundWave(intensity: number, calm: boolean, now: number): GroundWave {
  return {
    amplitude: AMPLITUDE_PX * intensity,
    phase: now * WAVE_RADIANS_PER_TICK * (calm ? CALM.waveSpeed : 1),
    hue: calm ? CALM.hue * intensity : now * HUE_RADIANS_PER_TICK,
    saturation: 1 + SATURATION_BOOST * intensity,
    blend: intensity,
  };
}

const vertex = `
in vec2 aPosition;
out vec2 vTextureCoord;
uniform highp vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

void main(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  gl_Position = vec4(position, 0.0, 1.0);
  vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw);
}
`;

// Sine offsets across the picture, then a rotation of the chroma plane, one turn per screen width along diagonal bands, that leaves the lightness as it is.
const fragment = `
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform highp vec4 uInputSize;
uniform vec4 uWave;
uniform float uHue;

void main(void) {
  float shift = sin(vTextureCoord.y * uInputSize.y * ${String(TWO_PI / WAVE_LENGTH_PX)} + uWave.y) * uWave.x * uInputSize.z;
  vec4 color = texture(uTexture, vTextureCoord + vec2(shift, 0.0));
  vec3 rgb = color.a > 0.0 ? color.rgb / color.a : vec3(0.0);
  vec2 pixel = vTextureCoord * uInputSize.xy;
  float angle = uHue + (pixel.x + 0.6 * pixel.y) / uInputSize.x * ${String(TWO_PI)};
  vec2 turn = vec2(cos(angle), sin(angle));
  float y = dot(rgb, vec3(0.299, 0.587, 0.114));
  float i = dot(rgb, vec3(0.596, -0.274, -0.322));
  float q = dot(rgb, vec3(0.211, -0.523, 0.312));
  vec2 chroma = vec2(i * turn.x - q * turn.y, i * turn.y + q * turn.x) * uWave.z;
  vec3 shifted = clamp(vec3(y + 0.956 * chroma.x + 0.621 * chroma.y, y - 0.272 * chroma.x - 0.647 * chroma.y, y - 1.106 * chroma.x + 1.703 * chroma.y), 0.0, 1.0);
  rgb = mix(rgb, shifted, uWave.w);
  finalColor = vec4(rgb * color.a, color.a);
}
`;

// From the second drop, the ground layer alone waves and cycles its hues. Off the drop, the filter is removed.
export function createGroundWaves(ctx: RenderContext): Family {
  const { ground, world } = ctx.layers;
  const area = new Rectangle();
  ground.filterArea = area;
  const wave = new Float32Array(4);
  const hue = new Float32Array(1);
  let attached = false;
  const filter = new Filter({
    glProgram: new GlProgram({ vertex, fragment, name: 'ground-waves' }),
    resolution: 1,
    resources: {
      waveUniforms: {
        uWave: { value: wave, type: 'vec4<f32>' },
        uHue: { value: hue, type: 'f32' },
      },
    },
  });

  return {
    update(_state, _alpha, frame: Frame): void {
      if (frame.groundFilter <= 0) {
        if (attached) {
          ground.filters = [];
          attached = false;
        }
        return;
      }
      const params = groundWave(frame.groundFilter, frame.calm, frame.now);
      wave[0] = params.amplitude;
      wave[1] = params.phase;
      wave[2] = params.saturation;
      wave[3] = params.blend;
      hue[0] = params.hue;
      filter.padding = params.amplitude;
      const scale = world.scale.x;
      area.x = -world.x / scale;
      area.y = -world.y / scale;
      area.width = frame.camera.screenWidth / scale;
      area.height = frame.camera.screenHeight / scale;
      if (!attached) {
        ground.filters = [filter];
        attached = true;
      }
    },
    destroy(): void {
      ground.filters = [];
      filter.destroy();
    },
  };
}
