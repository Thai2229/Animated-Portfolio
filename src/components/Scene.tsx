import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import { Planet } from "./Planets";
import { Rider } from "./Rider";
import { Sun } from "./Sun";
import { rng } from "../lib/noise";
import { SLOTS, SUN_DIR } from "../layout";
import { projects } from "../projects";

export type LabelRefs = {
  tags: (HTMLElement | null)[];
  leads: (HTMLElement | null)[];
};

type Props = {
  reduced: boolean;
  hover: string | null;
  setHover: (id: string | null) => void;
  labels: React.RefObject<LabelRefs>;
};

function Stars() {
  const p = useMemo(() => {
    const r = rng(1);
    const a = new Float32Array(2200 * 3);
    for (let i = 0; i < 2200; i++) a.set([(r() - 0.5) * 90, (r() - 0.5) * 60, -20 - r() * 40], i * 3);
    return a;
  }, []);
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[p, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#ffffff" size={0.12} transparent opacity={0.7} />
    </points>
  );
}

export function Scene({ reduced, hover, setHover, labels }: Props) {
  const { size } = useThree();
  const planets = useRef<(THREE.Group | null)[]>([]);
  const v = useMemo(() => new THREE.Vector3(), []);

  // Shrink the whole composition on narrow viewports so the sun and orbit stay on screen.
  const aspect = size.width / size.height;
  const fit = Math.min(1, Math.max(0.42, aspect / 1.6));
  let shiftY = 0;
  if (aspect < 1) shiftY = 2.4;

  // Project each planet to the screen and move its label and leader line there.
  useFrame((state) => {
    projects.forEach((_, i) => {
      const g = planets.current[i];
      const tag = labels.current.tags[i];
      const lead = labels.current.leads[i];
      const slot = SLOTS[i];
      if (!g || !tag || !lead || !slot) return;
      g.updateWorldMatrix(true, false);
      g.getWorldPosition(v).project(state.camera);
      const x = ((v.x + 1) / 2) * size.width;
      const y = ((1 - v.y) / 2) * size.height;
      const [dx, dy] = slot.label;
      tag.style.transform = `translate(${x + dx - 10}px, ${y + dy - 14}px) translateX(-100%)`;
      lead.style.width = `${Math.hypot(dx, dy)}px`;
      lead.style.transform = `translate(${x}px, ${y}px) rotate(${Math.atan2(dy, dx)}rad)`;
      tag.dataset.ready = "1";
      lead.dataset.ready = "1";
    });
  });

  return (
    <>
      <color attach="background" args={["#020202"]} />
      <Stars />
      <directionalLight color="#ffe9c8" intensity={2.8} position={SUN_DIR} />
      <ambientLight color="#9fb0c8" intensity={0.12} />
      <group scale={fit} position={[0, shiftY, 0]}>
        <Sun />
        {projects.map((project, i) => (
          <Planet
            key={project.id}
            project={project}
            position={SLOTS[i].pos}
            hovered={hover === project.id}
            setHover={setHover}
            group={(g) => {
              planets.current[i] = g;
            }}
          />
        ))}
        <Rider reduced={reduced} />
      </group>
      <EffectComposer multisampling={4}>
        <Bloom intensity={0.7} luminanceThreshold={0.85} luminanceSmoothing={0.3} mipmapBlur />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </>
  );
}
