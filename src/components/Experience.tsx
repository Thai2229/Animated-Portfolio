'use client';

import { Component, useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import Link from 'next/link';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { Scene } from '../scene/Scene';
import { HOME } from '../scene/poses';
import { SECTS, type Sect } from '../content/sects';
import { pickProfile, type Profile } from '../terrain/profile';
import { useWorld } from './useWorld';
import { Panel } from './Panel';
import { ProjectLinks } from './ProjectLinks';

const mediaSubs = new Map<string, (cb: () => void) => () => void>();
const subscribeMedia = (q: string) => {
  let sub = mediaSubs.get(q);
  if (!sub) {
    sub = (cb) => {
      const m = window.matchMedia(q);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    };
    mediaSubs.set(q, sub);
  }
  return sub;
};
function useMedia(q: string) {
  return useSyncExternalStore(subscribeMedia(q), () => window.matchMedia(q).matches, () => false);
}

let glOk: boolean | null = null;
function hasWebGL() {
  if (glOk === null) glOk = probeWebGL();
  return glOk;
}
function probeWebGL() {
  const c = document.createElement('canvas');
  const gl = c.getContext('webgl2') || c.getContext('webgl');
  if (!gl) return false;
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return true;
}

class CanvasBoundary extends Component<{ onFail: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFail();
  }
  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

let cachedProfile: Profile | null = null;
const getProfile = () => {
  if (!cachedProfile) cachedProfile = pickProfile();
  return cachedProfile;
};
const noopSubscribe = () => () => {};

export function Experience() {
  const profile = useSyncExternalStore(noopSubscribe, getProfile, () => null);
  const mobile = useMedia('(max-width: 899px)');
  const reduced = useMedia('(prefers-reduced-motion: reduce)');
  const world = useWorld(profile);
  const [active, setActive] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [dpr, setDpr] = useState(1.5);
  const [noGL, setNoGL] = useState(false);
  const noWebGL = useSyncExternalStore(noopSubscribe, () => !hasWebGL(), () => false);
  const failGL = useCallback(() => setNoGL(true), []);
  const labelRefs = useRef<(HTMLElement | null)[]>([]);
  const opener = useRef<HTMLElement | null>(null);
  const activeSect = SECTS.find((s) => s.slug === active);

  const activeRef = useRef<string | null>(null);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  const select = useCallback((slug: string) => {
    if (activeRef.current !== null) return;
    opener.current = document.activeElement as HTMLElement | null;
    setHovered(null);
    setActive(slug);
  }, []);
  const close = useCallback(() => {
    setActive(null);
  }, []);
  // return focus to the control that opened the panel once it is visible and interactive again
  useEffect(() => {
    if (active === null) {
      opener.current?.focus();
      opener.current = null;
    }
  }, [active]);
  const onReady = useCallback(() => setReady(true), []);

  useEffect(() => {
    document.body.style.cursor = '';
    if (hovered) {
      document.body.style.cursor = 'pointer';
    }
    return () => {
      document.body.style.cursor = '';
    };
  }, [hovered]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, close]);

  let fraction = 1;
  if (world.status === 'loading') {
    fraction = world.fraction;
  }
  let stage = 'Raising the valley';
  if (world.status === 'loading') stage = world.stage;
  if (world.status === 'ready') stage = 'Lighting the lanterns';
  const failed = world.status === 'error' || noGL || noWebGL;
  const showLoader = !failed && !ready;
  const labelsHidden = active !== null || !ready;
  let frameloop: 'always' | 'demand' = 'always';
  if (reduced) {
    frameloop = 'demand';
  }

  return (
    <>
      <div className="stage" inert={active !== null} role="img" aria-label="Illustrated mountain valley with three sects, one for each project">
        {world.status === 'ready' && profile && !noGL && !noWebGL && (
          <CanvasBoundary onFail={failGL}>
          <Canvas
            frameloop={frameloop}
            shadows="soft"
            dpr={dpr}
            camera={{ fov: 36, near: 0.3, far: 400, position: HOME.position }}
            gl={{ antialias: true }}
            onCreated={({ gl }) => gl.domElement.addEventListener('webglcontextlost', failGL)}
          >
            <color attach="background" args={['#a9b8c4']} />
            <fog attach="fog" args={['#a8b8c6', 48, 135]} />
            <PerformanceMonitor onDecline={() => setDpr(1)} />
            <Scene
              world={world.world}
              profile={profile}
              hovered={hovered}
              active={active}
              mobile={mobile}
              reduced={reduced}
              labelRefs={labelRefs}
              onHover={setHovered}
              onSelect={select}
              onReady={onReady}
            />
          </Canvas>
          </CanvasBoundary>
        )}
      </div>
      <div className="vignette" />

      <div inert={active !== null}>
        <header className="top">
          <div className="brand">
            <b>Thai Van Le</b>
            <span>Software engineer · UC San Diego</span>
          </div>
          <nav aria-label="Primary">
            <button type="button" onClick={close}>Sects</button>
            <button type="button" onClick={() => select(SECTS[0].slug)}>Path</button>
            <Link href="/about">About</Link>
          </nav>
        </header>

        <div className="chrome" data-hidden={active !== null}>
          <div className="intro">
            <h1>Three sects,<br />three things I built.</h1>
            <p>Each sect in this valley guards one of my projects. Pick one to descend into it and open the live site.</p>
          </div>
          <div className="compass">Falls of the Jade Dragon · 412 m drop<br />N ↑ · 1 : 25,000</div>
        </div>

        <div className="labels" data-hidden={labelsHidden}>
          {SECTS.map((s, i) => (
            <SectLabel
              key={s.slug}
              sect={s}
              side={s.site === 'ledge'}
              on={hovered === s.slug}
              setRef={(el) => {
                labelRefs.current[i] = el;
              }}
              onHover={setHovered}
              onSelect={select}
            />
          ))}
        </div>

        <nav className="sheet" aria-label="Sects" data-hidden={active !== null || !ready}>
          {SECTS.map((s) => (
            <button key={s.slug} type="button" className="card" onClick={() => select(s.slug)}>
              <span className="k"><i>{s.numeral}</i>Sect {s.roman} · {s.sectName}</span>
              <span className="n">{s.project}</span>
              <span className="p">{s.blurb}</span>
            </button>
          ))}
        </nav>
      </div>

      {activeSect && <Panel sect={activeSect} onClose={close} />}

      {failed && (
        <div className="fallback" role="alert">
          <h2>The valley could not be raised here.</h2>
          <p>Your browser could not run the 3D scene. The projects are still a click away.</p>
          <ProjectLinks />
        </div>
      )}
      <div className="loader" data-done={!showLoader} aria-hidden={!showLoader} role="status">
        <div className="loader-inner">
          <b>Thai Van Le</b>
          <p>{stage}…</p>
          <div className="bar"><i style={{ transform: `scaleX(${fraction})` }} /></div>
        </div>
      </div>
    </>
  );
}

type LabelProps = {
  sect: Sect;
  side: boolean;
  on: boolean;
  setRef: (el: HTMLElement | null) => void;
  onHover: (slug: string | null) => void;
  onSelect: (slug: string) => void;
};

function SectLabel({ sect, side, on, setRef, onHover, onSelect }: LabelProps) {
  return (
    <div className={['label', side && 'side', on && 'on'].filter(Boolean).join(' ')} ref={setRef}>
      <span className="dot" />
      <span className="lead" />
      <button
        type="button"
        className="card"
        aria-label={`Sect ${sect.roman}, ${sect.sectName}: ${sect.project}. Open details`}
        onClick={() => onSelect(sect.slug)}
        onPointerEnter={() => onHover(sect.slug)}
        onPointerLeave={() => onHover(null)}
        onFocus={(e) => {
          if (e.currentTarget.matches(':focus-visible')) onHover(sect.slug);
        }}
        onBlur={() => onHover(null)}
      >
        <span className="k"><i>{sect.numeral}</i>Sect {sect.roman} · {sect.sectName}</span>
        <span className="n">{sect.project}</span>
        <span className="p">{sect.blurb}</span>
        <span className="go">Descend · open live site ↗</span>
      </button>
    </div>
  );
}
