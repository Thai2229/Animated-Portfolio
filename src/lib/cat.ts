// Low-poly tabby built from primitives, and an extruded surfboard. Ported from the design mockup (cat.js).
import * as THREE from "three";

function stripeTexture(base: string, dark: string, vertical: boolean) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = dark;
  g.lineCap = "round";
  for (let i = 0; i < 9; i++) {
    g.lineWidth = 5 + (i % 3) * 3;
    g.beginPath();
    const p = i * 30 + 8;
    if (vertical) {
      g.moveTo(p, 0);
      g.bezierCurveTo(p + 14, 80, p - 14, 170, p + 6, 256);
    } else {
      g.moveTo(0, p);
      g.bezierCurveTo(80, p + 12, 170, p - 12, 256, p + 4);
    }
    g.stroke();
  }
  let seed = 3;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 400; i++) {
    g.fillStyle = "rgba(30,20,10,.12)";
    if (rnd() > 0.5) {
      g.fillStyle = "rgba(255,240,220,.08)";
    }
    g.fillRect(rnd() * 256, rnd() * 256, 3, 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Mackerel tabby coat: warm grey-brown base, dark tapering stripes from the spine down the flanks, pale belly.
function tabbyBodyTexture() {
  const W = 512;
  const H = 512;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const base = g.createLinearGradient(0, 0, W, 0);
  base.addColorStop(0, "#6f5d4b");
  base.addColorStop(0.2, "#8d7860");
  base.addColorStop(0.42, "#a08a70");
  base.addColorStop(0.5, "#d2c2a6");
  base.addColorStop(0.58, "#a08a70");
  base.addColorStop(0.8, "#8d7860");
  base.addColorStop(1, "#6f5d4b");
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  g.fillStyle = "#2b231c";
  g.strokeStyle = "#2b231c";
  g.lineCap = "round";
  for (let k = 0; k < 16; k++) {
    const y0 = (k + 0.5) * (H / 16) + (rnd() - 0.5) * 10;
    for (const side of [0, 1]) {
      let prevX: number | null = null;
      let prevY = 0;
      const phase = rnd() * 6;
      const amp = 8 + rnd() * 8;
      for (let i = 0; i <= 60; i++) {
        const t = i / 60;
        let u = 1 - t * 0.46;
        if (side === 0) {
          u = t * 0.46;
        }
        const x = u * W;
        const y = y0 + Math.sin(t * 5 + phase) * amp * t;
        let w = (20 + rnd() * 4) * (1 - t * 0.85);
        if (t > 0.88) w = w * 0.3;
        if (prevX !== null && rnd() > 0.05) {
          g.lineWidth = w;
          g.beginPath();
          g.moveTo(prevX, prevY);
          g.lineTo(x, y);
          g.stroke();
        }
        prevX = x;
        prevY = y;
      }
    }
  }
  g.fillRect(0, 0, 16, H);
  g.fillRect(W - 16, 0, 16, H);
  for (let i = 0; i < 1800; i++) {
    g.fillStyle = "rgba(20,12,6,.10)";
    if (rnd() > 0.5) {
      g.fillStyle = "rgba(255,235,205,.10)";
    }
    g.fillRect(rnd() * W, rnd() * H, 2, 5);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

function tabbyHeadTexture() {
  const W = 1024;
  const H = 512;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  g.fillStyle = "#8f7a62";
  g.fillRect(0, 0, W, H);
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 2500; i++) {
    g.fillStyle = "rgba(20,12,6,.10)";
    if (rnd() > 0.5) {
      g.fillStyle = "rgba(255,235,205,.08)";
    }
    g.fillRect(rnd() * W, rnd() * H, 3, 6);
  }
  g.strokeStyle = "#2b231c";
  g.lineCap = "round";
  const stroke = (pts: number[][], w0: number, w1: number) => {
    for (let i = 1; i < pts.length; i++) {
      const t = i / (pts.length - 1);
      g.lineWidth = w0 + (w1 - w0) * t;
      g.beginPath();
      g.moveTo(pts[i - 1][0], pts[i - 1][1]);
      g.lineTo(pts[i][0], pts[i][1]);
      g.stroke();
    }
  };
  const FX = 512;
  [[-62, -1], [-22, -0.3], [22, 0.3], [62, 1]].forEach(([dx, k]) => {
    const pts: number[][] = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      pts.push([FX + dx + k * 14 * t * 3 + Math.sin(t * 3 + dx) * 4, 200 - t * 190]);
    }
    stroke(pts, 20, 7);
  });
  [-1, 1].forEach((sd) => {
    stroke([[FX + sd * 84, 238], [FX + sd * 120, 244], [FX + sd * 160, 256]], 10, 5);
    stroke([[FX + sd * 110, 270], [FX + sd * 140, 285], [FX + sd * 176, 300]], 11, 5);
    stroke([[FX + sd * 100, 300], [FX + sd * 128, 322], [FX + sd * 160, 340]], 11, 5);
    stroke([[FX + sd * 52, 196], [FX + sd * 78, 190], [FX + sd * 100, 196]], 8, 4);
  });
  stroke([[FX, 218], [FX, 258]], 7, 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeCat() {
  const cat = new THREE.Group();
  const furTex = tabbyBodyTexture();
  furTex.offset.x = 0.25;
  const headMat = new THREE.MeshStandardMaterial({ map: tabbyHeadTexture(), roughness: 0.95 });
  const fur = new THREE.MeshStandardMaterial({ map: furTex, roughness: 0.95, flatShading: true });
  const light = new THREE.MeshStandardMaterial({ color: "#cbb9a0", roughness: 1, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: "#1b1714", roughness: 0.6 });

  const bodyPts: THREE.Vector2[] = [];
  const L = 1.32;
  const N = 40;
  for (let i = 0; i <= N; i++) {
    const y = -L + (2 * L * i) / N;
    const q = Math.pow(Math.abs(y / L), 3.2);
    bodyPts.push(new THREE.Vector2(Math.max(0.001, 0.43 * Math.pow(1 - q, 0.5)), y));
  }
  const body = new THREE.Mesh(new THREE.LatheGeometry(bodyPts, 20), fur);
  body.rotation.z = Math.PI / 2;
  body.position.y = 0.78;
  body.scale.set(1, 1, 0.92);
  cat.add(body);

  const legMat = new THREE.MeshStandardMaterial({ color: "#9a8670", roughness: 1, flatShading: true });
  const legGeo = new THREE.CylinderGeometry(0.11, 0.1, 0.62, 7);
  const pawGeo = new THREE.SphereGeometry(0.13, 8, 6);
  [[0.48, 0.22], [0.48, -0.22], [-0.5, 0.22], [-0.5, -0.22]].forEach(([x, z]) => {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(x, 0.33, z);
    const paw = new THREE.Mesh(pawGeo, light);
    paw.scale.y = 0.6;
    paw.position.set(x, 0.05, z);
    cat.add(leg, paw);
  });

  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.85, body.position.y, 0),
    new THREE.Vector3(-1.25, body.position.y + 0.25, 0.1),
    new THREE.Vector3(-1.35, body.position.y + 0.85, 0.05),
    new THREE.Vector3(-1.1, body.position.y + 1.2, -0.1),
  ]);
  const tailTex = stripeTexture("#8c7862", "#3f342b", false);
  tailTex.repeat.set(1, 3);
  cat.add(new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 24, 0.09, 7), new THREE.MeshStandardMaterial({ map: tailTex, roughness: 1, flatShading: true })));

  const head = new THREE.Group();
  head.position.set(0.95, body.position.y + 0.55, 0);
  cat.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), headMat);
  skull.scale.set(0.95, 0.88, 1.05);
  head.add(skull);
  [0.13, -0.13].forEach((z) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), light);
    m.position.set(0.38, -0.16, z);
    m.scale.set(0.8, 0.75, 1);
    head.add(m);
  });
  const chin = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), light);
  chin.position.set(0.3, -0.3, 0);
  head.add(chin);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), new THREE.MeshStandardMaterial({ color: "#d4877a", roughness: 0.5 }));
  nose.position.set(0.49, -0.06, 0);
  nose.scale.set(0.8, 0.7, 1.2);
  head.add(nose);
  [0.19, -0.19].forEach((z) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.105, 12, 10), new THREE.MeshStandardMaterial({ color: "#a3a03c", roughness: 0.15, emissive: "#2a2a08" }));
    eye.position.set(0.4, 0.06, z);
    head.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), dark);
    pupil.position.set(0.48, 0.06, z * 1.02);
    pupil.scale.set(0.5, 1, 0.75);
    head.add(pupil);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), new THREE.MeshBasicMaterial({ color: "#fff" }));
    glint.position.set(0.51, 0.1, z + 0.025);
    head.add(glint);
  });
  const wMat = new THREE.LineBasicMaterial({ color: "#f4efe6" });
  [-1, 1].forEach((s) => {
    for (let k = 0; k < 3; k++) {
      const g = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0.44, -0.14, s * 0.12),
        new THREE.Vector3(0.55, -0.12 - k * 0.07 + 0.06, s * (0.62 + k * 0.04)),
      ]);
      head.add(new THREE.Line(g, wMat));
    }
  });
  const earMat = new THREE.MeshStandardMaterial({ color: "#8f7861", roughness: 1, flatShading: true });
  const innerMat = new THREE.MeshStandardMaterial({ color: "#e0a79a", roughness: 1, flatShading: true });
  [0.24, -0.24].forEach((z) => {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.34, 4), earMat);
    ear.position.set(0.02, 0.46, z);
    let earTilt = -0.35;
    if (z > 0) {
      earTilt = 0.35;
    }
    ear.rotation.set(earTilt, 0, -0.12);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 3), innerMat);
    inner.position.set(0.07, 0.43, z * 0.98);
    inner.rotation.copy(ear.rotation);
    head.add(ear, inner);
  });
  cat.userData.head = head;
  return cat;
}

// Surfboard: real outline (pointed nose, squash tail), extruded, silver metal graphic on the deck.
export function makeBoard(envMap: THREE.Texture, length = 2.5, width = 0.68) {
  const L = length;
  const W = width;
  const s = new THREE.Shape();
  s.moveTo(0, L / 2);
  s.bezierCurveTo(W * 0.32, L * 0.42, W * 0.52, L * 0.2, W * 0.5, -L * 0.05);
  s.bezierCurveTo(W * 0.48, -L * 0.3, W * 0.36, -L * 0.46, W * 0.18, -L / 2);
  s.lineTo(-W * 0.18, -L / 2);
  s.bezierCurveTo(-W * 0.36, -L * 0.46, -W * 0.48, -L * 0.3, -W * 0.5, -L * 0.05);
  s.bezierCurveTo(-W * 0.52, L * 0.2, -W * 0.32, L * 0.42, 0, L / 2);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.03, bevelSegments: 3, curveSegments: 28 });
  geo.translate(0, 0, -0.025);

  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 1024;
  const g = c.getContext("2d")!;
  const gr = g.createLinearGradient(0, 0, 256, 0);
  gr.addColorStop(0, "#9aa0a8");
  gr.addColorStop(0.5, "#f4f6f8");
  gr.addColorStop(1, "#8d939b");
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 1024);
  g.fillStyle = "rgba(40,44,50,.55)";
  g.fillRect(124, 0, 8, 1024);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set(1 / W, 1 / L);
  tex.offset.set(0.5, 0.5);
  const silver = { metalness: 1, roughness: 0.16, envMap, envMapIntensity: 0.75 };
  const deck = new THREE.MeshStandardMaterial({ map: tex, ...silver });
  const rail = new THREE.MeshStandardMaterial({ color: "#d9dce1", ...silver });
  const mesh = new THREE.Mesh(geo, [deck, rail]);
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 3), rail);
  fin.scale.set(0.25, 1, 1.4);
  fin.rotation.x = -Math.PI / 2;
  fin.position.set(0, -L * 0.4, -0.16);
  mesh.add(fin);
  return mesh;
}
