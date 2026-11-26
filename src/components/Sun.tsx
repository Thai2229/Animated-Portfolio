import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { glowTexture, sunMap, toTexture } from "../lib/planetTextures";
import { rng } from "../lib/noise";
import { SUN_POS, SUN_R } from "../layout";

const additive = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false } as const;

function Glow({ tex, size, opacity, z }: { tex: THREE.Texture; size: [number, number]; opacity: number; z: number }) {
  return (
    <sprite scale={[size[0], size[1], 1]} position={[0, 0, z]}>
      <spriteMaterial map={tex} opacity={opacity} {...additive} />
    </sprite>
  );
}

export function Sun() {
  const mesh = useRef<THREE.Mesh>(null);
  const map = useMemo(() => toTexture(sunMap(), 1024, 512, true), []);
  const [warm, hot] = useMemo(() => [glowTexture(255, 170, 60), glowTexture(255, 225, 150)], []);
  const halo = useMemo(() => {
    const r = rng(5);
    const n = 3500;
    const p = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const d = SUN_R * 1.08 + Math.pow(r(), 2.2) * 5.5;
      const a = r() * Math.PI * 2;
      p.set([Math.cos(a) * d, Math.sin(a) * d * 0.92, -0.3 + (r() - 0.5) * 0.4], i * 3);
      const b = Math.max(0.1, 1 - (d - SUN_R) / 5);
      col.set([b, b * 0.75, b * 0.4], i * 3);
    }
    return { p, col };
  }, []);
  useFrame((s) => {
    if (mesh.current) mesh.current.rotation.y = s.clock.elapsedTime * 0.03;
  });
  return (
    <group position={SUN_POS}>
      <mesh ref={mesh}>
        <sphereGeometry args={[SUN_R, 64, 48]} />
        <meshBasicMaterial map={map} color={[1.5, 1.35, 1.2]} toneMapped={false} />
      </mesh>
      <Glow tex={warm} size={[11, 11]} opacity={0.4} z={-2} />
      <Glow tex={hot} size={[5.4, 5.4]} opacity={0.55} z={-1} />
      <Glow tex={warm} size={[30, 10]} opacity={0.09} z={-3} />
      {Array.from({ length: 13 }, (_, k) => {
        // short, uneven flares rather than an even starburst
        const a = (k / 13) * Math.PI * 2 + Math.sin(k * 5.3) * 0.28;
        const len = 0.35 + (((k * 37) % 11) / 11) * 0.9;
        return (
          <mesh key={k} position={[Math.cos(a) * (SUN_R + len / 2), Math.sin(a) * (SUN_R + len / 2), -0.2]} rotation={[0, 0, a]}>
            <planeGeometry args={[len, 0.03 + (k % 4) * 0.012]} />
            <meshBasicMaterial color="#ffd28a" opacity={0.14 + (k % 3) * 0.04} {...additive} />
          </mesh>
        );
      })}
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[halo.p, 3]} />
          <bufferAttribute attach="attributes-color" args={[halo.col, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.03} vertexColors opacity={0.6} {...additive} />
      </points>
    </group>
  );
}
