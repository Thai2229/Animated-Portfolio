import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { makeBoard, makeCat } from "../lib/cat";
import { PERIOD, position, tangent } from "../orbit";
import { rng } from "../lib/noise";
import { SUN_POS } from "../layout";

const TRAIL = 700;
const TRAIL_SECONDS = 3.4;
const STILL_T = 3.5;

export function Rider({ reduced }: { reduced: boolean }) {
  const { gl } = useThree();
  const root = useRef<THREE.Group>(null);
  const lean = useRef<THREE.Group>(null);
  const trail = useRef<THREE.BufferAttribute>(null);
  const { cat, board } = useMemo(() => {
    const env = new THREE.PMREMGenerator(gl).fromScene(new RoomEnvironment(), 0.04).texture;
    const board = makeBoard(env);
    board.rotation.x = -Math.PI / 2;
    const cat = makeCat();
    cat.scale.setScalar(0.74);
    cat.position.set(0, 0.05, 0.05);
    cat.rotation.y = Math.PI / 2;
    cat.userData.head.rotation.set(0.1, -0.7, 0.05);
    return { cat, board };
  }, [gl]);
  const trailData = useMemo(() => {
    const r = rng(9);
    const jitter = new Float32Array(TRAIL * 3);
    const col = new Float32Array(TRAIL * 3);
    for (let i = 0; i < TRAIL; i++) {
      jitter.set([r() - 0.5, r() - 0.5, r() - 0.5], i * 3);
      const b = Math.pow(1 - i / TRAIL, 1.6);
      col.set([b, b * 0.82, b * 0.52], i * 3);
    }
    return { jitter, col, pos: new Float32Array(TRAIL * 3) };
  }, []);
  const orbitLine = useMemo(() => {
    const p = new Float32Array(200 * 3);
    for (let i = 0; i < 200; i++) p.set(position((i / 200) * PERIOD), i * 3);
    return p;
  }, []);

  useFrame((s) => {
    let t = s.clock.elapsedTime;
    if (reduced) t = STILL_T;
    const g = root.current;
    const l = lean.current;
    const a = trail.current;
    if (!g || !l || !a) return;
    const p = position(t);
    const d = tangent(t);
    g.position.set(SUN_POS[0] + p[0], SUN_POS[1] + p[1], SUN_POS[2] + p[2]);
    g.lookAt(g.position.x + d[0], g.position.y + d[1], g.position.z + d[2]);
    // subtle bob and lean; the bank shows the deck to the camera on both sides of the orbit
    l.position.y = Math.sin(t * 2.1) * 0.05;
    l.rotation.z = -Math.tanh(d[0] * 3) * 0.45 + Math.sin(t * 1.3) * 0.07;
    l.rotation.x = Math.sin(t * 1.7) * 0.04;
    // comet trail: replay the orbit function over the recent past
    const out = a.array as Float32Array;
    for (let i = 0; i < TRAIL; i++) {
      const age = (i / TRAIL) * TRAIL_SECONDS;
      const q = position(t - age);
      const spread = 0.04 + age * 0.05;
      out[i * 3] = SUN_POS[0] + q[0] + trailData.jitter[i * 3] * spread;
      out[i * 3 + 1] = SUN_POS[1] + q[1] + trailData.jitter[i * 3 + 1] * spread;
      out[i * 3 + 2] = SUN_POS[2] + q[2] + trailData.jitter[i * 3 + 2] * spread;
    }
    a.needsUpdate = true;
  });

  return (
    <>
      <group ref={root} scale={0.72}>
        <group ref={lean}>
          <group rotation={[0, Math.PI, 0]}>
            <primitive object={board} />
            <primitive object={cat} />
          </group>
        </group>
      </group>
      <directionalLight color="#ffe2c4" intensity={2.6} position={[-3, 6, 12]} />
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute ref={trail} attach="attributes-position" args={[trailData.pos, 3]} />
          <bufferAttribute attach="attributes-color" args={[trailData.col, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.06} vertexColors transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
      </points>
      <lineLoop position={SUN_POS}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[orbitLine, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#ffffff" transparent opacity={0.14} depthWrite={false} />
      </lineLoop>
    </>
  );
}
