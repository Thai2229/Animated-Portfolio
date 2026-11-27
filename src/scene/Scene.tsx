/* eslint-disable react-hooks/immutability -- three.js objects are mutated imperatively in the frame loop */
'use client';

import { useEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createValley } from './buildScene';
import { createStorm, MAX_FLASHES_PER_SECOND, type Storm } from './storm';
import { createStormFx, treesInView } from './stormFx';
import { createFires, clickIgnition } from './fires';
import { createClickStrikes, groundPoint, hitSect, shouldStrike, stormFlashOn, type SectProxy } from './clickStrike';
import { createClickFx } from './clickStrikeFx';
import { createFlyers } from './swordsmen';
import { createSwordsmenFx } from './swordsmenFx';
import { buildSects, makeHitProxy, type SectBuild } from './architecture';
import { flyPose, type Pose, type Vec3 } from './cameraPath';
import { HOME, LABEL_UP, sectPose, fovFor, offA } from './poses';
import { A2W, C, FALL_TOP, SITES, SUN_DIR, WATER_Y, type SiteKey } from '../terrain/layout';
import type { WorldData } from '../terrain/world';
import type { Profile } from '../terrain/profile';
import { SECTS } from '../content/sects';

const GOLD = new THREE.Color('#e0b36a');
const FLY_SECONDS = 1.7;
const STORM_SKY = new THREE.Color('#3c4652');
const FLASH_TINT = new THREE.Color('#c8d4ff');

type Props = {
  world: WorldData;
  profile: Profile;
  hovered: string | null;
  active: string | null;
  mobile: boolean;
  reduced: boolean;
  labelRefs: RefObject<(HTMLElement | null)[]>;
  onHover: (slug: string | null) => void;
  onSelect: (slug: string) => void;
  onReady: () => void;
};

export function Scene({ world, profile, hovered, active, mobile, reduced, labelRefs, onHover, onSelect, onReady }: Props) {
  const { gl, scene, camera, size, invalidate } = useThree();
  const valley = useMemo(() => createValley(world, profile), [world, profile]);
  const sects = useMemo(() => buildSects(valley.heightAt, world.siteHeights, profile.name === 'high'), [valley, world, profile]);
  const builds = useMemo<Record<SiteKey, SectBuild>>(() => ({ ledge: sects.ledge, valley: sects.valley, lake: sects.lake }), [sects]);

  // hit proxies make hovering stable across gaps between pillars and roofs
  useEffect(() => {
    const proxies: THREE.Mesh[] = [];
    for (const k of Object.keys(builds) as SiteKey[]) {
      const hit = makeHitProxy(builds[k].group, SITES[k], world.siteHeights[k]);
      proxies.push(hit);
    }
    return () => proxies.forEach((h) => h.removeFromParent());
  }, [builds, world]);

  // ground glow ring per sect for hover
  const rings = useMemo(() => {
    const out = {} as Record<SiteKey, THREE.Mesh>;
    for (const k of Object.keys(SITES) as SiteKey[]) {
      const s = SITES[k];
      const w = A2W(s.a, s.b);
      const m = new THREE.Mesh(
        new THREE.RingGeometry(s.r * 0.92, s.r * 1.08, 64).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, fog: false }),
      );
      m.position.set(w.x, world.siteHeights[k] + 0.08, w.z);
      out[k] = m;
    }
    return out;
  }, [world]);

  // environment light, as in the mock
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.35;
    invalidate();
    return () => {
      scene.environment = null;
      env.dispose();
      pm.dispose();
    };
  }, [gl, scene, invalidate]);

  // sun target + readiness
  const sunTarget = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(C.x, 0, C.z);
    return o;
  }, []);
  const sunPos = useMemo(() => {
    const l = Math.hypot(SUN_DIR.x, SUN_DIR.y, SUN_DIR.z);
    return new THREE.Vector3(SUN_DIR.x / l, SUN_DIR.y / l, SUN_DIR.z / l).multiplyScalar(60).add(new THREE.Vector3(C.x, 0, C.z));
  }, []);
  useEffect(() => {
    let a = 0;
    let b = 0;
    a = requestAnimationFrame(() => {
      b = requestAnimationFrame(onReady);
    });
    return () => {
      cancelAnimationFrame(a);
      cancelAnimationFrame(b);
    };
  }, [onReady]);

  // camera rig
  const cur = useRef<Pose>({ position: [...HOME.position], target: [...HOME.target] });
  const anim = useRef<{ from: Pose; to: Pose; t0: number } | null>(null);
  const drift = useRef(1);
  const camPinned = useRef(false); // debug: __camLook pins the camera, no idle drift
  const pos = useMemo(() => new THREE.Vector3(), []);
  const tgt = useMemo(() => new THREE.Vector3(), []);
  const wanted = useMemo<Pose>(() => {
    const s = SECTS.find((x) => x.slug === active);
    if (!s) return HOME;
    return sectPose(s.site, world.siteHeights[s.site], mobile);
  }, [active, world, mobile]);

  useEffect(() => {
    if (reduced) {
      cur.current = { position: [...wanted.position], target: [...wanted.target] };
      anim.current = null;
      invalidate();
      return;
    }
    anim.current = { from: { position: [...cur.current.position], target: [...cur.current.target] }, to: wanted, t0: -1 };
  }, [wanted, reduced, invalidate]);

  const glow = useRef<Record<SiteKey, number>>({ ledge: 0, valley: 0, lake: 0 });
  const baseEmissive = useMemo(() => {
    const m = new Map<THREE.MeshStandardMaterial, { c: THREE.Color; i: number }>();
    for (const k of Object.keys(builds) as SiteKey[]) {
      for (const mat of builds[k].materials) m.set(mat, { c: mat.emissive.clone(), i: mat.emissiveIntensity });
    }
    return m;
  }, [builds]);

  const anchors = useMemo(
    () => SECTS.map((s) => {
      const w = A2W(SITES[s.site].a, SITES[s.site].b);
      return new THREE.Vector3(w.x, valley.heightAt(w.x, w.z) + LABEL_UP[s.site], w.z);
    }),
    [valley],
  );
  const v3 = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    valley.setReduced(reduced);
    invalidate();
  }, [valley, reduced, invalidate]);

  // storm: clouds, lightning, a burning pine; ?storm=now starts the first one after ~3 s (client only)
  const hemi = useRef<THREE.HemisphereLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  // the storm's struck tree and click strikes share one set of fires (6 at a time) and their tree positions
  const fires = useMemo(() => createFires({}), [world, profile, valley]); // eslint-disable-line react-hooks/exhaustive-deps
  const treeAt = useMemo(() => {
    const out = new Float32Array(world.treeCount * 3);
    for (let i = 0; i < world.treeCount; i++) {
      out[i * 3] = world.treeMatrices[i * 16 + 12];
      out[i * 3 + 1] = world.treeMatrices[i * 16 + 13];
      out[i * 3 + 2] = world.treeMatrices[i * 16 + 14];
    }
    return out;
  }, [world]);
  const fx = useMemo(() => createStormFx(world, profile, valley.crown, fires), [world, profile, valley, fires]);
  const testStorm = useMemo(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('storm') === 'now', []);
  // created in an effect so the random seed never runs during render; ?storm=now keeps a fixed seed
  const stormRef = useRef<Storm | null>(null);
  useEffect(() => {
    const cam = new THREE.PerspectiveCamera(fovFor(size.width / size.height), size.width / size.height, 0.3, 400);
    cam.position.set(...(HOME.position as Vec3));
    cam.lookAt(...(HOME.target as Vec3));
    const o = { treeCount: world.treeCount, enabled: !reduced, firstGap: undefined as number | undefined, candidates: treesInView(world, cam, 0.7) };
    let seed = 2024;
    if (testStorm) o.firstGap = 3;
    if (!testStorm) seed = Math.floor(Math.random() * 2147483647);
    stormRef.current = createStorm(seed, o);
    return () => {
      stormRef.current = null;
    };
    // the view only seeds the candidate list; a later resize does not need a new storm
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, reduced, testStorm]);
  const skip = useRef(0);
  const seekStrike = useRef(false);
  const skyBase = useMemo(() => ({ bg: new THREE.Color(), fog: new THREE.Color(), have: false }), []);
  useEffect(() => {
    if (!testStorm) return;
    // debug hook for screenshots: jump the storm clock, or park the camera next to the struck tree
    const w = window as unknown as { __camLook?: (p: Vec3, t: Vec3) => void; __stormSeek?: (s: number) => void; __stormLook?: () => void; __stormStrike?: () => void; __stormFreeze?: boolean; __stormState?: unknown };
    w.__stormSeek = (s) => {
      skip.current += s;
    };
    w.__stormStrike = () => {
      seekStrike.current = true;
    };
    w.__camLook = (p, t) => {
      cur.current = { position: [...p], target: [...t] };
      anim.current = null;
      camPinned.current = true;
      drift.current = 0;
    };
    w.__stormLook = () => {
      const p = fx.treeTop;
      cur.current = { position: [p.x - 1.6, p.y + 0.9, p.z - 2.6], target: [p.x, p.y - 0.2, p.z] };
      anim.current = null;
    };
    return () => {
      delete w.__stormSeek;
      delete w.__stormLook;
      delete w.__camLook;
      delete w.__stormStrike;
      delete w.__stormState;
    };
  }, [testStorm, fx]);
  // flying swordsmen loop over the valley and massif, round the sects (outside their hit proxies) and the waterfall;
  // hidden under reduced motion; ?swords=close parks the camera beside the first flyer
  const swords = useMemo(() => {
    const half = world.worldSize / 2;
    const bounds = { minX: -half, maxX: half, minZ: -half, maxZ: half, maxY: 70 };
    const proxies = (Object.keys(SITES) as SiteKey[]).map((k) => {
      const w = A2W(SITES[k].a, SITES[k].b);
      return { x: w.x, z: w.z, r: SITES[k].r * 1.1, top: world.siteHeights[k] + 6.8 };
    });
    const fall = A2W(FALL_TOP.a, FALL_TOP.b);
    const focus = [A2W(SITES.valley.a, SITES.valley.b), A2W(30, 34), fall, A2W(SITES.lake.a, SITES.lake.b), A2W(-5, 20), A2W(SITES.ledge.a, SITES.ledge.b)];
    let count = 3;
    if (profile.name === 'high') count = 6;
    const flyers = createFlyers(77, count, bounds, { heightAt: valley.heightAt, clearance: 3, proxies, margin: 1.5, focus });
    return createSwordsmenFx(flyers, !reduced);
  }, [world, profile, valley, reduced]);
  // 'close' looks at the first flyer from the front, 'close-back' from behind (hair and sleeves)
  const closeSwords = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('swords') ?? '';
  }, []);
  useEffect(() => {
    scene.add(swords.group);
    return () => {
      scene.remove(swords.group);
      swords.dispose();
    };
  }, [scene, swords]);
  useEffect(() => {
    scene.add(fx.group);
    return () => {
      scene.remove(fx.group);
      fx.dispose();
    };
  }, [scene, fx]);

  // click strike: a click on open ground or water casts a bolt there; sects, the open panel and UI never strike
  const clicks = useMemo(() => createClickStrikes(), []);
  const ground = useMemo(() => (x: number, z: number) => Math.max(valley.heightAt(x, z), WATER_Y), [valley]);
  const clickFx = useMemo(() => createClickFx(profile, ground), [profile, ground]);
  useEffect(() => {
    scene.add(clickFx.group);
    return () => {
      scene.remove(clickFx.group);
      clickFx.dispose();
    };
  }, [scene, clickFx]);
  const stormFlash = useRef({ flash: 0, active: false });
  const clickLog = useRef<number[]>([]);
  const clickDebug = useRef({ count: 0, skipped: 0 });
  const clickTime = useRef({ freeze: false, skip: 0 });
  const tryStrike = useMemo(() => {
    const proxies: SectProxy[] = (Object.keys(SITES) as SiteKey[]).map((k) => {
      const w = A2W(SITES[k].a, SITES[k].b);
      return { x: w.x, z: w.z, r: SITES[k].r * 1.1, top: world.siteHeights[k] + 6.8 };
    });
    const half = world.worldSize / 2;
    const bounds = { minX: -half, maxX: half, minZ: -half, maxZ: half };
    const last = { at: -Infinity };
    // the flash budget is 3 per second in total: skip while a storm flash is on, and leave the storm one slot while it is active
    return (ray: THREE.Ray, sectHit: boolean, dragPx: number, onUi: boolean, panelOpen: boolean, point?: { x: number; z: number }) => {
      const now = performance.now() / 1000;
      let p = null;
      if (point) p = { x: point.x, y: ground(point.x, point.z), z: point.z };
      else p = groundPoint(ray.origin, ray.direction, ground, bounds);
      if (p === null) return;
      const input = { hitSect: sectHit || hitSect(p, proxies), panelOpen, reduced, onUi, dragPx, now, lastStrikeAt: last.at };
      let limit = MAX_FLASHES_PER_SECOND;
      if (stormFlash.current.active) limit -= 1;
      const log = clickLog.current;
      while (log.length > 0 && now - log[0] >= 1) log.shift();
      if (!shouldStrike(input) || stormFlashOn(stormFlash.current.flash) || log.length >= limit) {
        if (!input.hitSect && !panelOpen && !onUi) clickDebug.current.skipped++;
        return;
      }
      if (!clicks.strike(p, now)) return;
      // the bolt sets the nearest trees alight; reduced motion never reaches here, so it never starts a fire
      clickIgnition(p, treeAt, fires, { now });
      last.at = now;
      log.push(now);
      clickDebug.current.count++;
    };
  }, [world, ground, clicks, reduced, treeAt, fires]);
  useEffect(() => {
    const el = gl.domElement;
    const down = { x: 0, y: 0 };
    const rc = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const groups = (Object.keys(builds) as SiteKey[]).map((k) => builds[k].group);
    const onDown = (e: PointerEvent) => {
      down.x = e.clientX;
      down.y = e.clientY;
    };
    const onUp = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      rc.setFromCamera(ndc, camera);
      // the same raycast the sect onClick handlers rely on, so a click that opens the panel never also strikes
      const sectHit = rc.intersectObjects(groups, true).length > 0;
      tryStrike(rc.ray, sectHit, Math.hypot(e.clientX - down.x, e.clientY - down.y), e.target !== el, active !== null);
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
    };
  }, [gl, camera, builds, tryStrike, active]);
  useEffect(() => {
    if (!testStorm) return;
    // debug hook for screenshots (only with ?storm=now): window.__clickStrikeAt(x, z) strikes that ground point,
    // __clickFreeze stops the strike clock, __clickSeek(s) advances it, __clickStats is { count, skipped };
    // __fires.step(0) lists the burning trees and __treeAt holds every tree's x, y, z
    const w = window as unknown as { __fires?: unknown; __treeAt?: Float32Array; __clickStrikeAt?: (x: number, z: number) => void; __clickSeek?: (s: number) => void; __clickFreeze?: boolean; __clickStats?: unknown };
    w.__clickStrikeAt = (x, z) => tryStrike(new THREE.Ray(), false, 0, false, false, { x, z });
    w.__clickSeek = (sec) => {
      clickTime.current.skip += sec;
    };
    Object.defineProperty(w, '__clickFreeze', { configurable: true, get: () => clickTime.current.freeze, set: (v: boolean) => {
        clickTime.current.freeze = v;
      } });
    w.__clickStats = clickDebug.current;
    w.__fires = fires;
    w.__treeAt = treeAt;
    return () => {
      delete w.__clickStrikeAt;
      delete w.__clickSeek;
      delete w.__clickFreeze;
      delete w.__clickStats;
      delete w.__fires;
      delete w.__treeAt;
    };
  }, [testStorm, tryStrike, fires, treeAt]);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    if (!reduced) valley.update(t);
    if (!reduced) swords.update(t);
    if (!reduced && closeSwords.startsWith('close')) {
      // beside the first flyer and ahead of it (or behind it), looking at it
      const p = swords.position(0);
      const yaw = swords.heading(0);
      const sy = Math.sin(yaw);
      const cy = Math.cos(yaw);
      let ahead = 3.2;
      if (closeSwords === 'close-back') ahead = -3.6;
      cur.current = { position: [p.x + 2.6 * cy + ahead * sy, p.y + 1.1, p.z - 2.6 * sy + ahead * cy], target: [p.x, p.y + 0.8, p.z] };
      anim.current = null;
    }

    const w = window as unknown as { __stormFreeze?: boolean; __stormState?: unknown };
    let sdt = Math.min(dt, 0.25);
    if (testStorm && w.__stormFreeze) sdt = 0;
    const storm = stormRef.current;
    // fires burn in real time; the debug seeks and freezes move them along with the storm and click clocks
    let fdt = Math.min(dt, 0.25);
    if (clickTime.current.freeze || (testStorm && w.__stormFreeze)) fdt = 0;
    fdt += skip.current + clickTime.current.skip;
    let cdt = Math.min(dt, 0.25);
    if (clickTime.current.freeze) cdt = 0;
    cdt += clickTime.current.skip;
    clickTime.current.skip = 0;
    const cs = clicks.step(cdt);
    const px = (size.height * gl.getPixelRatio()) / (2 * Math.tan(((camera as THREE.PerspectiveCamera).fov * Math.PI) / 360));
    clickFx.update(cs, cdt, px);
    if (storm) {
      let ss = storm.step(sdt + skip.current);
      skip.current = 0;
      // debug: advance in 0.05 s steps until a strike has just started
      for (let i = 0; seekStrike.current && i < 2000; i++) {
        ss = storm.step(0.05);
        if (ss.strike) seekStrike.current = false;
      }
      seekStrike.current = false;
      if (testStorm) w.__stormState = ss;
      fx.update(ss, t, px, fdt);
      stormFlash.current.flash = ss.flash;
      stormFlash.current.active = ss.phase === 'active';
      const flash = Math.max(ss.flash, cs.flash);
      if (hemi.current && sun.current && scene.background instanceof THREE.Color && scene.fog) {
        if (!skyBase.have) {
          skyBase.bg.copy(scene.background);
          skyBase.fog.copy(scene.fog.color);
          skyBase.have = true;
        }
        // cloud 0 restores the exact base values; the flash only lifts the hemisphere light
        hemi.current.intensity = 1.15 * (1 - 0.45 * ss.cloud) + flash * 1.4;
        sun.current.intensity = 3.0 * (1 - 0.75 * ss.cloud);
        // the terrain albedo has its lighting baked in, so the storm's darkening goes through exposure (1 when clear)
        gl.toneMappingExposure = 1 - 0.4 * ss.cloud + flash * 0.6;
        scene.background.copy(skyBase.bg).lerp(STORM_SKY, ss.cloud * 0.75).lerp(FLASH_TINT, flash * 0.3);
        scene.fog.color.copy(skyBase.fog).lerp(STORM_SKY, ss.cloud * 0.75).lerp(FLASH_TINT, flash * 0.3);
      }
    }

    // camera: eased fly between poses, plus a slow drift while idle at home
    if (anim.current) {
      if (anim.current.t0 < 0) anim.current.t0 = t;
      const k = (t - anim.current.t0) / FLY_SECONDS;
      const p = flyPose(anim.current.from, anim.current.to, k);
      cur.current = p;
      if (k >= 1) anim.current = null;
    }
    let driftTarget = 0;
    if (!reduced && active === null && anim.current === null && !camPinned.current) driftTarget = 1;
    drift.current += (driftTarget - drift.current) * Math.min(1, dt * 1.5);
    const d = offA(Math.sin(t * 0.12) * 1.8, Math.sin(t * 0.07 + 1) * 0.8);
    const dy = Math.sin(t * 0.09) * 0.5;
    const cp = cur.current.position as Vec3;
    pos.set(cp[0] + d.x * drift.current, cp[1] + dy * drift.current, cp[2] + d.z * drift.current);
    tgt.set(...(cur.current.target as Vec3));
    const cam = camera as THREE.PerspectiveCamera;
    const fov = fovFor(size.width / size.height);
    if (cam.fov !== fov || cam.aspect !== size.width / size.height) {
      cam.fov = fov;
      cam.aspect = size.width / size.height;
      cam.updateProjectionMatrix();
    }
    cam.position.copy(pos);
    cam.lookAt(tgt);
    cam.updateMatrixWorld();
    valley.setCamera(cam.position);

    // hover glow (emissive on the sect's own materials + ground ring)
    for (const k of Object.keys(builds) as SiteKey[]) {
      let goal = 0;
      if (hovered !== null && SECTS.find((s) => s.slug === hovered)?.site === k) {
        goal = 1;
      }
      let g = goal;
      if (!reduced) g = glow.current[k] + (goal - glow.current[k]) * Math.min(1, dt * 8);
      glow.current[k] = g;
      for (const mat of builds[k].materials) {
        const b = baseEmissive.get(mat);
        if (!b) continue;
        mat.emissive.copy(b.c).lerp(GOLD, g * 0.2);
        mat.emissiveIntensity = b.i + (1 - b.i) * g * 0.35;
      }
      (rings[k].material as THREE.MeshBasicMaterial).opacity = g * 0.85;
    }

    // project the HTML labels
    const els = labelRefs.current;
    anchors.forEach((a, i) => {
      const el = els[i];
      if (!el) return;
      v3.copy(a).project(cam);
      el.style.transform = `translate(${((v3.x + 1) / 2) * size.width}px, ${((1 - v3.y) / 2) * size.height}px)`;
    });
  });

  useEffect(() => {
    invalidate();
  }, [hovered, invalidate]);

  const click = (slug: string) => (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    onSelect(slug);
  };

  return (
    <>
      <hemisphereLight ref={hemi} args={['#e4ecf4', '#5d5848', 1.15]} />
      <directionalLight
        ref={sun}
        position={sunPos}
        target={sunTarget}
        intensity={3.0}
        color="#fff1dc"
        castShadow
        shadow-mapSize={[profile.shadowMap, profile.shadowMap]}
        shadow-camera-left={-45}
        shadow-camera-right={45}
        shadow-camera-top={45}
        shadow-camera-bottom={-45}
        shadow-camera-near={1}
        shadow-camera-far={140}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-radius={3}
      />
      <primitive object={sunTarget} />
      <primitive object={valley.group} />
      <primitive object={sects.bridge} />
      {SECTS.map((s) => (
        <primitive
          key={s.slug}
          object={builds[s.site].group}
          onPointerOver={(e: { stopPropagation: () => void }) => {
            e.stopPropagation();
            if (active === null) onHover(s.slug);
          }}
          onPointerOut={() => onHover(null)}
          onClick={click(s.slug)}
        />
      ))}
      {SECTS.map((s) => (
        <primitive key={'ring-' + s.slug} object={rings[s.site]} />
      ))}
    </>
  );
}
