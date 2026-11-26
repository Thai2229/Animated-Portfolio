import { useMemo } from "react";
import * as THREE from "three";
import { SUN_DIR } from "../layout";

const vertex = /* glsl */ `
varying vec3 vN; varying vec3 vV;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - w.xyz);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

// Fresnel rim: bright at grazing angles, fades at the outer silhouette, stronger on the sunlit side.
const fragment = /* glsl */ `
uniform vec3 color; uniform float power; uniform float strength; uniform vec3 sun;
varying vec3 vN; varying vec3 vV;
void main() {
  float d = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
  float rim = pow(1.0 - d, power) * smoothstep(0.0, 0.3, d);
  float lit = 0.2 + 0.8 * smoothstep(-0.3, 0.5, dot(normalize(vN), sun));
  gl_FragColor = vec4(color * rim * lit * strength, 1.0);
}`;

export function Atmosphere({ radius, color, power = 3, strength = 1 }: { radius: number; color: string; power?: number; strength?: number }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          color: { value: new THREE.Color(color) },
          power: { value: power },
          strength: { value: strength },
          sun: { value: new THREE.Vector3(...SUN_DIR).normalize() },
        },
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [color, power, strength],
  );
  return (
    <mesh material={material}>
      <sphereGeometry args={[radius, 64, 48]} />
    </mesh>
  );
}
