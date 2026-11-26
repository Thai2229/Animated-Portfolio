import * as THREE from 'three';

// Wind shared by grass, pines and anything else that sways. uMotion is 0 under prefers-reduced-motion.
export type Shared = { uTime: { value: number }; uMotion: { value: number } };
export const makeShared = (): Shared => ({ uTime: { value: 0 }, uMotion: { value: 1 } });

export const WIND_GLSL = /* glsl */ `
uniform float uTime;
uniform float uMotion;
// sum of travelling sines over world position: broad gusts plus faster local flutter
vec2 windAt(vec2 p) {
  float a = sin(p.x * 0.35 + p.y * 0.21 + uTime * 1.1);
  float b = sin(p.x * 0.9 - p.y * 0.6 + uTime * 1.9 + a * 1.5);
  float g = sin(dot(p, vec2(0.12, 0.08)) - uTime * 0.45) * 0.5 + 0.5;
  vec2 dir = vec2(0.85, 0.5);
  float s = (a * 0.5 + b * 0.35 + 0.35) * (0.6 + 0.8 * g);
  return (dir * s + vec2(-dir.y, dir.x) * b * 0.2) * uMotion;
}
`;

// pines lean a little with the wind, more toward the crown
export function swayPines(mat: THREE.Material, shared: Shared) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = shared.uTime;
    sh.uniforms.uMotion = shared.uMotion;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${WIND_GLSL}`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec2 pw = windAt(instanceMatrix[3].xz);
        transformed.xz += pw * 0.05 * position.y * position.y;`,
      );
  };
}
