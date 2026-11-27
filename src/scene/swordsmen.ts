// Flying swordsmen: pure path logic (no three.js). Each flyer rides a closed loop that is pushed out of the hit
// proxies, lifted over the ground by a smoothed envelope, and resampled to constant 3D speed.
export type Vec3 = { x: number; y: number; z: number };
export type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number; maxY: number };
export type Cylinder = { x: number; z: number; r: number; top: number };
// bank is the roll about the heading axis as three.js applies it (rotation.z with the heading along +z):
// a left turn (yaw increasing) gives a negative bank, so the flyer leans into the turn
// pitch is the nose-up angle as three.js applies it (rotation.x is -pitch with the heading along +z)
export type FlyerPose = { x: number; y: number; z: number; yaw: number; bank: number; pitch: number };

export type Flyer = {
  // seconds for one full loop: pathAt(period) coincides with pathAt(0)
  period: number;
  // yaw = atan2(vx, vz) of the velocity; bank is signed roll in radians (|bank| <= MAX_BANK)
  // pose at time t seconds (paths loop; any t >= 0 is valid)
  // pass `out` to reuse a pose object and avoid allocating every frame
  pathAt: (t: number, out?: FlyerPose) => FlyerPose;
  // true for the flyers that skim the ground and swoop past the sects
  low: boolean;
};

export type FlyerOptions = {
  heightAt: (x: number, z: number) => number;
  clearance: number;
  proxies: Cylinder[];
  margin: number;
  // loop centres to favour (sects, waterfall); flyer i circles focus[i % length]
  focus?: { x: number; z: number }[];
};

export const SPEED_MIN = 4;
export const SPEED_MAX = 14;
export const MAX_BANK = 0.6;

const K = 2048; // dense samples of the raw loop
const M = 1024; // samples of the final constant-speed loop
const PAD = 8; // loops keep this far from the bounds
const PUSH = 1; // extra distance kept from a proxy beyond radius + margin, so smoothing cannot cut into it
const LIFT = 0.5; // extra height over the ground so a chord between samples never dips under the clearance
const TAU = Math.PI * 2;

const rngOf = (seed: number) => {
  let s = (Math.floor(seed) * 2654435761 + 1) % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
};
const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

// periodic box blur with half-width w (in samples), in place via scratch
function blur(a: Float64Array, tmp: Float64Array, w: number) {
  const n = a.length;
  let acc = 0;
  for (let k = -w; k <= w; k++) acc += a[(k + n) % n];
  for (let i = 0; i < n; i++) {
    tmp[i] = acc / (2 * w + 1);
    acc += a[(i + w + 1) % n] - a[(i - w + n) % n];
  }
  a.set(tmp);
}
// periodic running maximum with half-width w
function dilate(a: Float64Array, w: number) {
  const n = a.length;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let m = -Infinity;
    for (let k = -w; k <= w; k++) m = Math.max(m, a[(i + k + n) % n]);
    out[i] = m;
  }
  a.set(out);
}

// Replaces every stretch of the loop that dips into the circle (cx, cz, R) by an arc of that circle, going round
// on the side of the stretch's deepest point, so the loop passes the proxy instead of folding back on itself.
function detour(px: Float64Array, pz: Float64Array, cx: number, cz: number, R: number, arc = true) {
  const n = px.length;
  if (!arc) {
    for (let i = 0; i < n; i++) {
      const d = Math.hypot(px[i] - cx, pz[i] - cz);
      if (d < R && d > 1e-6) {
        px[i] = cx + ((px[i] - cx) / d) * R;
        pz[i] = cz + ((pz[i] - cz) / d) * R;
      }
    }
    return;
  }
  const dist = (i: number) => Math.hypot(px[i] - cx, pz[i] - cz);
  let start = -1;
  for (let i = 0; i < n; i++) {
    if (dist(i) >= R) {
      start = i;
      break;
    }
  }
  if (start < 0) return;
  let k = 1;
  while (k <= n) {
    const i = (start + k) % n;
    if (dist(i) >= R) {
      k++;
      continue;
    }
    // inside run: first inside index at k, last inside index at e
    let e = k;
    let deep = k;
    while (e + 1 <= n && dist((start + e + 1) % n) < R) {
      e++;
      if (dist((start + e) % n) < dist((start + deep) % n)) deep = e;
    }
    const i0 = (start + k - 1) % n;
    const i1 = (start + e + 1) % n;
    const a0 = Math.atan2(pz[i0] - cz, px[i0] - cx);
    const a1 = Math.atan2(pz[i1] - cz, px[i1] - cx);
    const id = (start + deep) % n;
    let an = Math.atan2(pz[id] - cz, px[id] - cx);
    if (dist(id) < 1e-3) an = a0 + wrapPi(a1 - a0) / 2;
    let d1 = wrapPi(a1 - a0);
    const dn = wrapPi(an - a0);
    // the way round must pass the deepest point's side
    if (Math.sign(dn) !== Math.sign(d1) || Math.abs(dn) > Math.abs(d1)) d1 -= Math.sign(d1 || 1) * TAU;
    const len = e - k + 2;
    for (let j = k; j <= e; j++) {
      const q = (j - k + 1) / len;
      const th = a0 + d1 * q;
      px[(start + j) % n] = cx + Math.cos(th) * R;
      pz[(start + j) % n] = cz + Math.sin(th) * R;
    }
    k = e + 1;
  }
}

function makeFlyer(rnd: () => number, bounds: Bounds, opts: FlyerOptions, index: number, low: boolean): Flyer {
  const { heightAt, clearance, proxies, margin, focus } = opts;
  const minX = bounds.minX + PAD;
  const maxX = bounds.maxX - PAD;
  const minZ = bounds.minZ + PAD;
  const maxZ = bounds.maxZ - PAD;
  const px = new Float64Array(K);
  const pz = new Float64Array(K);
  // draw loops until one clears every proxy without crossing it (an orbit round a proxy is fine); keep the last as a
  // fallback that the relaxation below pushes out
  let clear = false;
  for (let attempt = 0; attempt < 400 && !clear; attempt++) {
    const rx = 16 + rnd() * 14;
    const rz = 15 + rnd() * 14;
    const a2 = 0.5 + rnd() * 1.5;
    const a3 = 0.3 + rnd() * 0.7;
    // the loop fits a circle of this radius around its centre, so the bounds clamp below stays a safety net
    const ext = Math.max(rx, rz) + a2 + a3;
    let cx = minX + ext + rnd() * Math.max(0, maxX - minX - 2 * ext);
    let cz = minZ + ext + rnd() * Math.max(0, maxZ - minZ - 2 * ext);
    if (focus && focus.length > 0) {
      const f = focus[index % focus.length];
      cx = Math.min(maxX - ext, Math.max(minX + ext, f.x + (rnd() - 0.5) * 8));
      cz = Math.min(maxZ - ext, Math.max(minZ + ext, f.z + (rnd() - 0.5) * 8));
    }
    const tilt = rnd() * TAU;
    const dir = 1 - 2 * Math.floor(rnd() * 2);
    const p2 = rnd() * TAU;
    const p3 = rnd() * TAU;
    const phase = rnd() * TAU;
    clear = true;
    for (let i = 0; i < K; i++) {
      const u = phase + dir * (i / K) * TAU;
      const lx = rx * Math.cos(u) + a2 * Math.cos(2 * u + p2);
      const lz = rz * Math.sin(u) + a3 * Math.sin(3 * u + p3);
      px[i] = cx + lx * Math.cos(tilt) - lz * Math.sin(tilt);
      pz[i] = cz + lx * Math.sin(tilt) + lz * Math.cos(tilt);
      for (const c of proxies) {
        if (Math.hypot(px[i] - c.x, pz[i] - c.z) < c.r + margin + PUSH + 2) clear = false;
      }
    }
  }
  const tmp = new Float64Array(K);
  if (!clear) {
    for (const c of proxies) detour(px, pz, c.x, c.z, c.r + margin + PUSH);
  }
  // relax the loop: smooth it, then project it back out of every proxy, so it hugs the proxies tangentially
  for (let r = 0; r < 40 && !clear; r++) {
    blur(px, tmp, 24);
    blur(pz, tmp, 24);
    for (const c of proxies) detour(px, pz, c.x, c.z, c.r + margin + PUSH, false);
    for (let i = 0; i < K; i++) {
      px[i] = Math.min(maxX, Math.max(minX, px[i]));
      pz[i] = Math.min(maxZ, Math.max(minZ, pz[i]));
    }
  }

  // height: ground envelope (dilated then blurred, so it stays above the ground and is smooth), plus a cruise offset
  let cruise = 6 + rnd() * 8;
  if (low) cruise = 0.2 + rnd() * 1.2;
  const W = Math.round(K * 0.12);
  const py = new Float64Array(K);
  for (let i = 0; i < K; i++) py[i] = heightAt(px[i], pz[i]) + clearance + LIFT;
  dilate(py, 6);
  const ground = Float64Array.from(py);
  for (let i = 0; i < K; i++) py[i] += cruise;
  // never cruise above the ceiling, but the ground floor wins if the two conflict
  for (let i = 0; i < K; i++) py[i] = Math.max(ground[i], Math.min(py[i], bounds.maxY));
  dilate(py, W);
  for (let b = 0; b < 3; b++) blur(py, tmp, Math.floor(W / 3));
  for (let i = 0; i < K; i++) py[i] = Math.min(py[i], Math.max(bounds.maxY, ground[i]));

  // resample to uniform 3D arclength
  const cum = new Float64Array(K + 1);
  for (let i = 0; i < K; i++) {
    const j = (i + 1) % K;
    cum[i + 1] = cum[i] + Math.hypot(px[j] - px[i], py[j] - py[i], pz[j] - pz[i]);
  }
  const L = cum[K];
  const xs = new Float64Array(M);
  const ys = new Float64Array(M);
  const zs = new Float64Array(M);
  let seg = 0;
  for (let k = 0; k < M; k++) {
    const s = (k / M) * L;
    while (seg < K - 1 && cum[seg + 1] < s) seg++;
    const f = (s - cum[seg]) / Math.max(1e-9, cum[seg + 1] - cum[seg]);
    const j = (seg + 1) % K;
    xs[k] = px[seg] + (px[j] - px[seg]) * f;
    ys[k] = py[seg] + (py[j] - py[seg]) * f;
    zs[k] = pz[seg] + (pz[j] - pz[seg]) * f;
  }
  const speed = 5 + rnd() * 1.8;
  const period = L / speed;
  const dt = period / M;

  // heading from a central difference, bank from the smoothed yaw rate
  const yaw = new Float64Array(M);
  for (let k = 0; k < M; k++) {
    const a = (k + M - 2) % M;
    const b = (k + 2) % M;
    yaw[k] = Math.atan2(xs[b] - xs[a], zs[b] - zs[a]);
  }
  const bank = new Float64Array(M);
  for (let k = 0; k < M; k++) {
    bank[k] = wrapPi(yaw[(k + 1) % M] - yaw[(k + M - 1) % M]) / (2 * dt);
  }
  const mtmp = new Float64Array(M);
  blur(bank, mtmp, 12);
  blur(bank, mtmp, 12);
  for (let k = 0; k < M; k++) bank[k] = Math.max(-MAX_BANK, Math.min(MAX_BANK, -bank[k] * 1.4));

  const pitch = new Float64Array(M);
  for (let k = 0; k < M; k++) {
    const a = (k + M - 3) % M;
    const b = (k + 3) % M;
    pitch[k] = Math.atan2(ys[b] - ys[a], Math.hypot(xs[b] - xs[a], zs[b] - zs[a]));
  }
  const pathAt = (t: number, out?: FlyerPose): FlyerPose => {
    const q = ((((t % period) + period) % period) / period) * M;
    const k = Math.floor(q) % M;
    const j = (k + 1) % M;
    const f = q - Math.floor(q);
    const o = out ?? { x: 0, y: 0, z: 0, yaw: 0, bank: 0, pitch: 0 };
    o.x = xs[k] + (xs[j] - xs[k]) * f;
    o.y = ys[k] + (ys[j] - ys[k]) * f;
    o.z = zs[k] + (zs[j] - zs[k]) * f;
    o.yaw = yaw[k] + wrapPi(yaw[j] - yaw[k]) * f;
    o.bank = bank[k] + (bank[j] - bank[k]) * f;
    o.pitch = pitch[k] + (pitch[j] - pitch[k]) * f;
    return o;
  };
  return { period, pathAt, low };
}

export function createFlyers(seed: number, count: number, bounds: Bounds, opts: FlyerOptions): Flyer[] {
  const rnd = rngOf(seed);
  const out: Flyer[] = [];
  for (let i = 0; i < count; i++) {
    // every third flyer skims the ground
    out.push(makeFlyer(rnd, bounds, opts, i, i % 3 === 2));
  }
  return out;
}

// advances a flyer by dt seconds from time t and returns the new time and pose
export function stepFlyer(flyer: Flyer, t: number, dt: number, out?: FlyerPose): { t: number; pose: FlyerPose } {
  if (!(dt >= 0)) throw new Error('stepFlyer: dt must be >= 0');
  const nt = (t + dt) % flyer.period;
  return { t: nt, pose: flyer.pathAt(nt, out) };
}
