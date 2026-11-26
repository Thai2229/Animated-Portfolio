import { useMemo, useRef } from "react";
import { useCursor } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Atmosphere } from "./Atmosphere";
import { cloudMap, earthMaps, giantMap, marsMaps, ringMap, toTexture } from "../lib/planetTextures";
import type { Project } from "../projects";

type BodyProps = {
  project: Project;
  position: [number, number, number];
  tilt: number;
  hovered: boolean;
  setHover: (id: string | null) => void;
  group: (g: THREE.Group | null) => void;
  children: React.ReactNode;
};

// Pointer handling shared by every planet: hover highlights the label, click opens the live site in a new tab.
function Body({ project, position, tilt, hovered, setHover, group, children }: BodyProps) {
  const ref = useRef<THREE.Group>(null);
  useCursor(hovered);
  useFrame((_, dt) => {
    if (!ref.current) return;
    let target = 1;
    if (hovered) target = 1.07;
    ref.current.scale.setScalar(THREE.MathUtils.damp(ref.current.scale.x, target, 8, dt));
  });
  return (
    <group
      position={position}
      rotation={[0, 0, tilt]}
      ref={(g) => {
        ref.current = g;
        group(g);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(project.id);
      }}
      onPointerOut={() => setHover(null)}
      onClick={(e) => {
        e.stopPropagation();
        window.open(project.url, "_blank", "noopener,noreferrer");
      }}
    >
      {children}
    </group>
  );
}

function useSpin(speed: number, offset = 0) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (ref.current) ref.current.rotation.y = offset + s.clock.elapsedTime * speed;
  });
  return ref;
}

function Mars() {
  const spin = useSpin(0.12, 2.2);
  const [map, bump] = useMemo(() => {
    const m = marsMaps();
    return [toTexture(m.color, m.w, m.h, true), toTexture(m.bump, m.w, m.h, false)];
  }, []);
  return (
    <>
      <mesh ref={spin}>
        <sphereGeometry args={[0.62, 64, 48]} />
        <meshStandardMaterial map={map} bumpMap={bump} bumpScale={2} roughness={0.95} />
      </mesh>
      <Atmosphere radius={0.68} color="#ff8a4a" power={3.5} strength={0.55} />
    </>
  );
}

function Earth() {
  const spin = useSpin(0.08, 2.2);
  const cloudSpin = useSpin(0.12, 1.4);
  const [map, bump, rough, clouds] = useMemo(() => {
    const m = earthMaps();
    return [
      toTexture(m.color, m.w, m.h, true),
      toTexture(m.bump, m.w, m.h, false),
      toTexture(m.rough, m.w, m.h, false),
      toTexture(cloudMap(), 512, 256, true),
    ];
  }, []);
  return (
    <>
      <mesh ref={spin}>
        <sphereGeometry args={[1.05, 96, 64]} />
        <meshStandardMaterial map={map} bumpMap={bump} bumpScale={3} roughnessMap={rough} roughness={1} />
      </mesh>
      <mesh ref={cloudSpin}>
        <sphereGeometry args={[1.07, 96, 64]} />
        <meshStandardMaterial map={clouds} transparent depthWrite={false} roughness={1} />
      </mesh>
      <Atmosphere radius={1.14} color="#4f94ff" power={2.6} strength={1.4} />
    </>
  );
}

function Giant() {
  const spin = useSpin(0.05, 0.4);
  const [map, ring] = useMemo(() => [toTexture(giantMap(), 512, 256, true), toTexture(ringMap(), 512, 512, true)], []);
  return (
    <>
      <mesh ref={spin}>
        <sphereGeometry args={[1.12, 64, 48]} />
        <meshStandardMaterial map={map} roughness={0.9} />
      </mesh>
      <mesh rotation={[-1.22, 0.32, 0]}>
        <ringGeometry args={[1.5, 2.65, 160]} />
        <meshStandardMaterial map={ring} transparent side={THREE.DoubleSide} roughness={1} depthWrite={false} />
      </mesh>
    </>
  );
}

const tilts = { mars: 0.3, earth: 0.41, giant: -0.22 };

export function Planet(props: Omit<BodyProps, "tilt" | "children">) {
  const kind = props.project.planet;
  return (
    <Body {...props} tilt={tilts[kind]}>
      {kind === "mars" && <Mars />}
      {kind === "earth" && <Earth />}
      {kind === "giant" && <Giant />}
    </Body>
  );
}
