// La bibliothèque en 3D : une pièce à mezzanine, tes livres sur la travée centrale du mur du fond.
// États de caméra : "room" (vue d'ensemble) → "shelf" (devant les rayons) ; "ceiling" (levée vers le plafond étoilé : comptes et réglages).
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js";

const W = 4.8, ZB = -4, ZF = 5, H1 = 3.3, SLAB = 0.2, H = 6.9, BAL_B = 1.25, BAL_S = 0.62, CASE_D = 0.32;
const BAY = { x0: -1.3, x1: 1.3, y0: 0.35, rowH: 0.56, rows: 5 };
const LEATHERS = ["#4a1a1a", "#1b3629", "#16264a", "#3a2415", "#232226", "#38203f", "#153a3d", "#4c3515", "#431727", "#26391f"];
const GENERIC = ["#5b3a22", "#6e4a2b", "#7c5a36", "#8a6b45", "#a58a62", "#c2ab84", "#4a2a1c", "#3d2a20", "#5a2320", "#2f3b2c", "#2c3340", "#94764a", "#b59a70", "#6a3a2a"];
const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.codePointAt(0), 16777619); return h >>> 0; };
const rnd = seed => () => ((seed = Math.imul(seed ^ (seed >>> 15), 2246822519) ^ Math.imul(seed ^ (seed >>> 13), 3266489917)) >>> 0) / 4294967296;
const ease = t => 1 - Math.pow(1 - t, 4);
const SANS = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", system-ui, sans-serif';

// ───────────── Textures dessinées ─────────────
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function woodTex(base, dark, light, repeat) {
  return canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h); const r = rnd(7);
    for (let i = 0; i < 260; i++) { g.strokeStyle = r() > .5 ? dark : light; g.globalAlpha = .05 + r() * .22; g.lineWidth = .5 + r() * 2.2;
      const x = r() * w, wob = (r() - .5) * 26; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + wob, h * .33, x - wob, h * .66, x + wob * .4, h); g.stroke(); }
    g.globalAlpha = 1;
  }, repeat);
}
function floorTex() {
  return canvasTex(512, 512, (g, w, h) => {
    const r = rnd(21), pw = w / 8;
    for (let i = 0; i < 8; i++) for (let j = -1; j < 5; j++) {
      const y = j * 128 + (i % 2) * 64, l = 60 + r() * 22; g.fillStyle = `hsl(24 38% ${l * .34}%)`; g.fillRect(i * pw, y, pw - 1, 127);
      g.globalAlpha = .18; g.strokeStyle = "#1a0d06"; for (let k = 0; k < 5; k++) { const x = i * pw + r() * pw; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - .5) * 6, y + 127); g.stroke(); } g.globalAlpha = 1;
    }
  }, [3, 6]);
}
function rugTex() {
  return canvasTex(512, 1024, (g, w, h) => {
    g.fillStyle = "#3a1414"; g.fillRect(0, 0, w, h);
    const band = (m, c, lw) => { g.strokeStyle = c; g.lineWidth = lw; g.strokeRect(m, m, w - 2 * m, h - 2 * m); };
    band(10, "#c9a466", 8); band(30, "#16223f", 22); band(52, "#c9a466", 4); band(70, "#7a2a22", 14);
    const r = rnd(5); g.fillStyle = "#c9a466";
    for (let x = 40; x < w - 30; x += 28) for (const y of [30, h - 30]) { g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
    for (let y = 40; y < h - 30; y += 28) for (const x of [30, w - 30]) { g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
    for (let i = 0; i < 150; i++) { const x = 100 + r() * (w - 200), y = 100 + r() * (h - 200); g.fillStyle = ["#c9a466", "#16223f", "#8a3a2a", "#d8c9a0"][i % 4]; g.globalAlpha = .75;
      g.save(); g.translate(x, y); g.rotate(Math.PI / 4); g.fillRect(-5, -5, 10, 10); g.restore(); }
    g.globalAlpha = 1;
    const loz = (rx, ry, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(w / 2, h / 2 - ry); g.lineTo(w / 2 + rx, h / 2); g.lineTo(w / 2, h / 2 + ry); g.lineTo(w / 2 - rx, h / 2); g.closePath(); g.fill(); };
    loz(150, 270, "#16223f"); loz(132, 240, "#b8935a"); loz(122, 224, "#4a1818"); loz(60, 110, "#16223f"); loz(46, 86, "#b8935a"); loz(34, 64, "#3a1414");
  });
}
function skyTex() {
  return canvasTex(1024, 1024, (g, w, h) => {
    const bg = g.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, w * .72); bg.addColorStop(0, "#2c4a96"); bg.addColorStop(.55, "#14265a"); bg.addColorStop(1, "#070d26");
    g.fillStyle = bg; g.fillRect(0, 0, w, h); const r = rnd(3);
    for (let i = 0; i < 9; i++) { const x = r() * w, y = r() * h, s = 120 + r() * 200, cl = g.createRadialGradient(x, y, 0, x, y, s); cl.addColorStop(0, "rgba(150,175,230,.16)"); cl.addColorStop(1, "rgba(150,175,230,0)"); g.fillStyle = cl; g.fillRect(x - s, y - s, 2 * s, 2 * s); }
    g.fillStyle = "#f3dfa8";
    for (let i = 0; i < 420; i++) { g.globalAlpha = .35 + r() * .65; g.beginPath(); g.arc(r() * w, r() * h, .6 + r() * 1.7, 0, 7); g.fill(); }
    for (let i = 0; i < 46; i++) { const x = r() * w, y = r() * h, s = 5 + r() * 9; g.globalAlpha = .9; g.beginPath();
      g.moveTo(x, y - s); g.quadraticCurveTo(x, y, x + s, y); g.quadraticCurveTo(x, y, x, y + s); g.quadraticCurveTo(x, y, x - s, y); g.quadraticCurveTo(x, y, x, y - s); g.fill(); }
    g.globalAlpha = 1; g.strokeStyle = "#c9a466"; g.lineWidth = 14; g.strokeRect(7, 7, w - 14, h - 14); g.lineWidth = 3; g.strokeRect(30, 30, w - 60, h - 60);
  });
}
function paintingTex(seed) {
  return canvasTex(256, 192, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, "#6b6a4a"); sky.addColorStop(.55, "#8a6a3a"); sky.addColorStop(1, "#2a2414"); g.fillStyle = sky; g.fillRect(0, 0, w, h);
    const r = rnd(seed); for (let i = 0; i < 26; i++) { g.fillStyle = ["#1d2414", "#3a3a1e", "#54401f", "#16180f"][i % 4]; g.globalAlpha = .55; g.beginPath(); g.ellipse(r() * w, h * (.55 + r() * .45), 20 + r() * 60, 10 + r() * 34, 0, 0, 7); g.fill(); }
    g.globalAlpha = 1;
  });
}
function glowTex() {
  return canvasTex(128, 128, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, "rgba(255,214,150,.95)"); gr.addColorStop(.3, "rgba(255,180,100,.35)"); gr.addColorStop(1, "rgba(255,160,80,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
}
function leatherFill(g, w, h, color, seed) {
  g.fillStyle = color; g.fillRect(0, 0, w, h); const r = rnd(seed);
  for (let i = 0; i < 900; i++) { g.fillStyle = r() > .5 ? "#000" : "#fff"; g.globalAlpha = .035; g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3); } g.globalAlpha = 1;
}
function wrapWords(g, text, max) {
  const words = text.split(/\s+/), lines = []; let cur = "";
  for (const wd of words) { const t = cur ? cur + " " + wd : wd; if (g.measureText(t).width > max && cur) { lines.push(cur); cur = wd; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}
function spineTex(book, color, horizontal, ratio = .25) {
  const h = 512, w = Math.max(64, Math.round(h * ratio));
  return canvasTex(horizontal ? h : w, horizontal ? w : h, g => {
    if (horizontal) { g.translate(h, 0); g.rotate(Math.PI / 2); }
    leatherFill(g, w, h, color, hash(book.title));
    const sh = g.createLinearGradient(0, 0, w, 0); sh.addColorStop(0, "rgba(0,0,0,.45)"); sh.addColorStop(.25, "rgba(255,255,255,.06)"); sh.addColorStop(1, "rgba(0,0,0,.4)"); g.fillStyle = sh; g.fillRect(0, 0, w, h);
    g.fillStyle = "#d9b972"; g.fillRect(0, 34, w, 3); g.fillRect(0, h - 37, w, 3); const maxSize = Math.min(38, w * .42);
    g.save(); g.translate(w / 2, h / 2); g.rotate(-Math.PI / 2); g.fillStyle = "#f0e4c6"; g.textAlign = "center"; g.textBaseline = "middle";
    let size = maxSize, lines; const title = book.title.toUpperCase();
    for (;; size -= 3) { g.font = `600 ${size}px ${SANS}`; lines = wrapWords(g, title, h - 110); if ((lines.length <= (w > 90 ? 2 : 1) && lines.every(l => g.measureText(l).width <= h - 100)) || size <= 15) break; }
    if (lines.length > 2) lines = [lines[0], lines.slice(1).join(" ")];
    lines = lines.slice(0, 2); const lh = size * 1.22 + 4;
    lines.forEach((l, i) => g.fillText(l, 0, (i - (lines.length - 1) / 2) * lh, h - 96)); g.restore();
  });
}
function coverTex(book, color) {
  return canvasTex(384, 560, (g, w, h) => {
    leatherFill(g, w, h, color, hash(book.title)); g.strokeStyle = "rgba(217,185,114,.6)"; g.lineWidth = 3; g.strokeRect(26, 26, w - 52, h - 52);
    g.fillStyle = "#f0e4c6"; g.textBaseline = "top"; let size = 50, lines;
    do { g.font = `700 ${size}px ${SANS}`; lines = wrapWords(g, book.title, w - 100); size -= 4; } while (lines.length > 5 && size > 26);
    lines.forEach((l, i) => g.fillText(l, 50, 60 + i * (size * 1.18 + 4), w - 100));
    g.fillStyle = "#d9b972"; g.font = `600 24px ${SANS}`; wrapWords(g, (book.author || "").toUpperCase(), w - 100).slice(0, 2).forEach((l, i) => g.fillText(l, 50, h - 110 + i * 30, w - 100));
  });
}
function titlePageTex(book) {
  return canvasTex(384, 560, (g, w, h) => {
    g.fillStyle = "#ebe1c8"; g.fillRect(0, 0, w, h); const sh = g.createLinearGradient(0, 0, 60, 0); sh.addColorStop(0, "rgba(60,40,15,.35)"); sh.addColorStop(1, "rgba(60,40,15,0)"); g.fillStyle = sh; g.fillRect(0, 0, 60, h);
    g.fillStyle = "#221b14"; g.textAlign = "center"; g.textBaseline = "top"; let size = 40, lines;
    for (;; size -= 3) { g.font = `700 ${size}px ${SANS}`; lines = wrapWords(g, book.title, w - 90); if (lines.length <= 4 || size <= 22) break; }
    lines.forEach((l, i) => g.fillText(l, w / 2 + 8, 150 + i * (size * 1.2), w - 80));
    g.fillStyle = "#62574a"; g.font = `400 22px ${SANS}`; g.fillText(book.author || "", w / 2 + 8, 150 + lines.length * size * 1.2 + 26, w - 80);
    g.fillRect(w / 2 - 22, h - 120, 60, 2);
  });
}
function labelTex(text) {
  return canvasTex(256, 40, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = "#e3c47c"; g.font = `600 26px ${SANS}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, w / 2, h / 2 + 1); });
}

// ───────────── La scène ─────────────
export function createScene(canvas, cb = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color("#060403"); scene.fog = new THREE.Fog("#060403", 12, 24);
  const camera = new THREE.PerspectiveCamera(80, 1, .05, 40);

  const wood = new THREE.MeshStandardMaterial({ map: woodTex("#2a180e", "#0e0704", "#4a2c18"), roughness: .55, metalness: .05 });
  const woodDark = new THREE.MeshStandardMaterial({ map: woodTex("#1a0f08", "#070403", "#2e1a0f"), roughness: .7 });
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex(), roughness: .38, metalness: .05 });
  const iron = new THREE.MeshStandardMaterial({ color: "#2a1d10", roughness: .4, metalness: .7 });
  const brass = new THREE.MeshStandardMaterial({ color: "#b08a3e", roughness: .35, metalness: .85 });
  const paper = new THREE.MeshStandardMaterial({ color: "#d8cba8", roughness: .9 });
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const box = (w, h, d, mat, x, y, z, shadow = true) => { const m = new THREE.Mesh(unit, mat); m.scale.set(w, h, d); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; scene.add(m); return m; };

  // Sol, tapis, murs, plafond
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W + 2, ZF - ZB + 4), floorMat); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, (ZF + ZB) / 2 + 1); floor.receiveShadow = true; scene.add(floor);
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 5.6), new THREE.MeshStandardMaterial({ map: rugTex(), roughness: .95 })); rug.rotation.x = -Math.PI / 2; rug.position.set(0, .006, 1.1); rug.receiveShadow = true; scene.add(rug);
  box(W + .4, H, .1, woodDark, 0, H / 2, ZB - .05, false);
  for (const s of [-1, 1]) box(.1, H, ZF - ZB + 2, woodDark, s * (W / 2 + .05), H / 2, (ZF + ZB) / 2 + 1, false);
  box(W + .4, .12, ZF - ZB + 2, woodDark, 0, H + .06, (ZF + ZB) / 2 + 1, false);
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 5.4), new THREE.MeshStandardMaterial({ map: skyTex(), emissiveMap: null, emissive: "#ffffff", emissiveIntensity: 0, roughness: 1 }));
  sky.material.emissiveMap = sky.material.map; sky.material.emissiveIntensity = .55; sky.rotation.x = Math.PI / 2; sky.position.set(0, H - .005, .2); scene.add(sky);
  for (const s of [-1, 1]) { box(.22, .3, 5.9, wood, s * 1.62, H - .15, .2, false); box(.9, .16, 5.9, woodDark, s * 2.0, H - .08, .2, false); }
  for (const z of [-2.62, 3.02]) box(3.5, .3, .22, wood, 0, H - .15, z, false);

  // Livres du décor : un seul maillage instancié
  const generic = [];
  const fillRow = (a0, a1, y, fixed, side, rowH, r) => {       // side = 0 : mur du fond (face +z) ; ±1 : murs latéraux
    let a = a0 + .02;
    while (a < a1 - .05) {
      if (r() < .06) { a += .08 + r() * .2; continue; }
      const t = .035 + r() * .05, h = Math.min(rowH - .07, .26 + r() * .13), d = .2 + r() * .04, lean = 0;
      if (a + t > a1) break;
      generic.push(side === 0 ? { x: a + t / 2, y: y + h / 2, z: fixed + CASE_D - .04 - d / 2, sx: t, sy: h, sz: d, c: GENERIC[(r() * GENERIC.length) | 0] }
                              : { x: fixed - side * (CASE_D - .04 - d / 2), y: y + h / 2, z: a + t / 2, sx: d, sy: h, sz: t, c: GENERIC[(r() * GENERIC.length) | 0] });
      a += t + .003;
    }
  };
  function caseBack(x0, x1, y0, rows, rowH, r, filled = true) {
    const w = x1 - x0, h = rows * rowH + .06; box(w, h, .03, woodDark, (x0 + x1) / 2, y0 + h / 2, ZB + .015, false);
    for (let k = 0; k <= rows; k++) box(w, .04, CASE_D, wood, (x0 + x1) / 2, y0 + k * rowH, ZB + CASE_D / 2, false);
    if (filled) for (let k = 0; k < rows; k++) fillRow(x0 + .03, x1 - .03, y0 + k * rowH + .02, ZB, 0, rowH, r);
  }
  function caseSide(s, z0, z1, y0, rows, rowH, r) {
    const x = s * W / 2, l = z1 - z0, h = rows * rowH + .06; box(.03, h, l, woodDark, x - s * .015, y0 + h / 2, (z0 + z1) / 2, false);
    for (let k = 0; k <= rows; k++) box(CASE_D, .04, l, wood, x - s * CASE_D / 2, y0 + k * rowH, (z0 + z1) / 2, false);
    for (let z = z0; z <= z1 + .01; z += 1.1) box(CASE_D + .02, h, .07, wood, x - s * (CASE_D + .02) / 2, y0 + h / 2, z, false);
    for (let k = 0; k < rows; k++) for (let z = z0; z < z1 - .2; z += 1.1) fillRow(z + .05, Math.min(z + 1.05, z1), y0 + k * rowH + .02, x, s, rowH, r);
  }
  const R = rnd(11);
  // niveau bas : travée centrale (tes livres) entre deux travées étroites
  caseBack(BAY.x0, BAY.x1, BAY.y0, BAY.rows, BAY.rowH, R, false);
  for (const s of [-1, 1]) { const a = s < 0 ? -W / 2 + CASE_D : BAY.x1 + .08, b = s < 0 ? BAY.x0 - .08 : W / 2 - CASE_D; caseBack(a, b, .35, 6, .465, R); }
  for (const x of [BAY.x0 - .04, BAY.x1 + .04]) box(.1, H1 - .3, CASE_D + .06, wood, x, (H1 - .3) / 2 + .1, ZB + (CASE_D + .06) / 2, false);
  box(W, .35, CASE_D + .08, wood, 0, .175, ZB + (CASE_D + .08) / 2, false);
  box(BAY.x1 - BAY.x0 + .3, .16, CASE_D + .1, wood, 0, BAY.y0 + BAY.rows * BAY.rowH + .1, ZB + (CASE_D + .1) / 2, false);
  for (const s of [-1, 1]) { caseSide(s, ZB + CASE_D, 1.4, .35, 6, .465, R); box(CASE_D + .08, .35, 1.4 - ZB, wood, s * (W / 2 - (CASE_D + .08) / 2), .175, (1.4 + ZB) / 2, false); }
  // mezzanine
  const y2 = H1 + SLAB;
  box(W, SLAB, BAL_B, wood, 0, H1 + SLAB / 2, ZB + BAL_B / 2); box(W - 2 * BAL_S, .08, .06, brass, 0, H1 + .02, ZB + BAL_B + .03, false);
  for (const s of [-1, 1]) { box(BAL_S, SLAB, 1.6 - (ZB + BAL_B), wood, s * (W / 2 - BAL_S / 2), H1 + SLAB / 2, (1.6 + ZB + BAL_B) / 2); box(.06, .08, 1.6 - (ZB + BAL_B), brass, s * (W / 2 - BAL_S - .03), H1 + .02, (1.6 + ZB + BAL_B) / 2, false); }
  caseBack(-W / 2 + CASE_D, -.55, y2, 6, .47, R); caseBack(.55, W / 2 - CASE_D, y2, 6, .47, R);
  for (const s of [-1, 1]) caseSide(s, ZB + CASE_D, 1.4, y2, 6, .47, R);
  // porte éclairée à l'étage
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.3), new THREE.MeshBasicMaterial({ color: "#e9a45a" })); door.position.set(0, y2 + 1.15, ZB + .04); scene.add(door);
  box(1.2, .14, .12, wood, 0, y2 + 2.4, ZB + .07, false); for (const s of [-1, 1]) box(.1, 2.4, .12, wood, s * .55, y2 + 1.2, ZB + .07, false);
  // rambardes (avec une ouverture pour l'échelle)
  const rail = (x0, z0, x1, z1) => { const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(2, Math.round(len / .16)), rot = Math.atan2(x1 - x0, z1 - z0);
    const top = box(.06, .05, len, wood, (x0 + x1) / 2, y2 + .95, (z0 + z1) / 2); top.rotation.y = rot; const low = box(.03, .03, len, iron, (x0 + x1) / 2, y2 + .12, (z0 + z1) / 2, false); low.rotation.y = rot;
    for (let i = 0; i <= n; i++) { const t = i / n; box(i % 5 === 0 ? .045 : .02, .93, i % 5 === 0 ? .045 : .02, i % 5 === 0 ? wood : iron, x0 + (x1 - x0) * t, y2 + .48, z0 + (z1 - z0) * t, false); } };
  const zr = ZB + BAL_B - .05, xr = W / 2 - BAL_S + .05;
  rail(-xr, zr, -1.74, zr); rail(-1.16, zr, xr, zr); rail(-xr, zr, -xr, 1.55); rail(xr, zr, xr, 1.55);
  // échelle
  { const g = new THREE.Group(), foot = new THREE.Vector3(-1.45, 0, ZB + BAL_B + 1.15), head = new THREE.Vector3(-1.45, y2 + .75, ZB + BAL_B + .03), len = foot.distanceTo(head);
    for (const s of [-1, 1]) { const m = new THREE.Mesh(unit, wood); m.scale.set(.05, len, .08); m.position.set(s * .23, len / 2, 0); m.castShadow = true; g.add(m); }
    for (let i = 1; i < 15; i++) { const m = new THREE.Mesh(unit, wood); m.scale.set(.46, .035, .07); m.position.set(0, i * len / 15, 0); m.castShadow = true; g.add(m); }
    g.position.copy(foot); g.rotation.x = -Math.atan2(foot.z - head.z, head.y); scene.add(g); }
  // tableaux
  const painting = (x, y, z, w, h, seed, ry = 0) => { const g = new THREE.Group(); const f = new THREE.Mesh(unit, brass); f.scale.set(w + .1, h + .1, .05); g.add(f);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: paintingTex(seed), roughness: .8 })); p.position.z = .028; g.add(p); g.position.set(x, y, z); g.rotation.y = ry; scene.add(g); };
  painting(-1.75, 2.1, ZB + CASE_D + .03, .55, .42, 4); painting(-1.75, 1.45, ZB + CASE_D + .03, .55, .42, 9); painting(1.75, 1.85, ZB + CASE_D + .03, .6, .78, 14);
  // mobilier
  const leather = new THREE.MeshStandardMaterial({ color: "#9a683a", roughness: .55 }), linen = new THREE.MeshStandardMaterial({ color: "#b9ab8c", roughness: .9 });
  const cyl = (rt, rb, h, mat, x, y, z, open) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 28, 1, !!open), mat); m.position.set(x, y, z); m.castShadow = !open; m.receiveShadow = true; scene.add(m); return m; };
  const tx = 1.25, tz = .9; cyl(.42, .42, .04, wood, tx, .74, tz); cyl(.05, .07, .7, wood, tx, .37, tz); cyl(.26, .3, .04, wood, tx, .02, tz);
  const shadeMat = new THREE.MeshStandardMaterial({ color: "#f3d9a4", emissive: "#ffb765", emissiveIntensity: 1.6, side: THREE.DoubleSide, roughness: .9 });
  const lamp = (x, y, z, k = 1) => { cyl(.07 * k, .09 * k, .04, brass, x, y + .02, z); cyl(.015, .015, .34 * k, brass, x, y + .19 * k, z); cyl(.11 * k, .2 * k, .2 * k, shadeMat, x, y + .44 * k, z, true);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); s.scale.set(1.5 * k, 1.5 * k, 1); s.position.set(x, y + .44 * k, z); scene.add(s); };
  const glow = glowTex(); lamp(tx, .76, tz); lamp(-1.35, y2, ZB + .75, .9);
  const chair = (x, z, ry) => { const g = new THREE.Group(); const p = (w, h, d, px, py, pz, mat = leather) => { const m = new THREE.Mesh(unit, mat); m.scale.set(w, h, d); m.position.set(px, py, pz); m.castShadow = m.receiveShadow = true; g.add(m); };
    p(.72, .2, .7, 0, .4, 0); p(.72, .7, .16, 0, .82, -.28); p(.13, .3, .62, -.33, .62, .02); p(.13, .3, .62, .33, .62, .02); for (const a of [-1, 1]) for (const b of [-1, 1]) p(.06, .3, .06, a * .3, .15, b * .28, wood);
    g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g); };
  chair(1.75, 1.75, -2.2); chair(-1.7, 2.4, 1.0);
  { const g = new THREE.Group(); const top = new THREE.Mesh(unit, linen); top.scale.set(.62, .2, .46); top.position.y = .42; top.castShadow = true; g.add(top);
    for (const a of [-1, 1]) for (const b of [-1, 1]) { const l = new THREE.Mesh(unit, wood); l.scale.set(.05, .32, .05); l.position.set(a * .25, .16, b * .17); l.castShadow = true; g.add(l); } g.position.set(-1.05, 0, 1.2); g.rotation.y = .5; g.scale.setScalar(.85); scene.add(g); }

  { const geo = new THREE.BoxGeometry(1, 1, 1), mat = new THREE.MeshStandardMaterial({ roughness: .75 }), inst = new THREE.InstancedMesh(geo, mat, generic.length), m4 = new THREE.Matrix4(), col = new THREE.Color();
    generic.forEach((b, i) => { m4.makeScale(b.sx, b.sy, b.sz).setPosition(b.x, b.y, b.z); inst.setMatrixAt(i, m4); inst.setColorAt(i, col.set(b.c).multiplyScalar(.85)); });
    inst.receiveShadow = true; scene.add(inst); }

  // Lumières
  scene.add(new THREE.HemisphereLight("#6b5240", "#2a1a10", .6));
  const pl = (x, y, z, i, d = 9) => { const l = new THREE.PointLight("#ffb46c", i, d, 1.8); l.position.set(x, y, z); scene.add(l); return l; };
  pl(tx, 1.25, tz, 9); pl(-1.35, y2 + .5, ZB + .8, 5, 7); pl(0, y2 + 1.3, ZB + .5, 5, 6);
  const key = new THREE.SpotLight("#ffd9a8", 46, 16, .95, .7, 1.4); key.position.set(.6, H - .3, 2.6); key.target.position.set(-.2, 0, -.6); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -.0006; scene.add(key, key.target);
  const pic = new THREE.SpotLight("#ffcf94", 7, 7, 1.05, .8, 1.2); pic.position.set(0, H1 - .15, ZB + 1.55); pic.target.position.set(0, 1.5, ZB); scene.add(pic, pic.target);
  box(1.4, .05, .1, brass, 0, H1 - .1, ZB + BAL_B - .1, false);
  const fill = new THREE.PointLight("#ffd2a0", 0, 4.5, 1.6); fill.position.set(0, -.95, .1); camera.add(fill); scene.add(camera);

  // ───────────── Tes livres ─────────────
  const user = new THREE.Group(); scene.add(user); let pickables = [], texLoader = new THREE.TextureLoader(); texLoader.setCrossOrigin("anonymous");
  const bayHit = new THREE.Mesh(new THREE.PlaneGeometry(BAY.x1 - BAY.x0, BAY.rows * BAY.rowH), new THREE.MeshBasicMaterial({ visible: false })); bayHit.position.set(0, BAY.y0 + BAY.rows * BAY.rowH / 2, ZB + CASE_D + .01); scene.add(bayHit);
  const rowY = k => BAY.y0 + k * BAY.rowH + .02, zFront = ZB + CASE_D - .03;
  function disposeUser() { user.traverse(o => { if (o.isMesh) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map && m.userData.own) m.map.dispose(); if (m.userData.own) m.dispose(); }); } }); user.clear(); pickables = []; }
  function bookMesh(w, h, d, faceTex, color) {
    const side = new THREE.MeshStandardMaterial({ color, roughness: .85 }); side.userData.own = true;
    const face = new THREE.MeshStandardMaterial({ map: faceTex, roughness: .85, emissive: "#ffffff", emissiveMap: faceTex, emissiveIntensity: .28 }); face.userData.own = true;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, paper, side, face, side]); m.castShadow = m.receiveShadow = true; return m;
  }
  function setBooks(books) {
    disposeUser();
    const inner0 = BAY.x0 + .06, inner1 = BAY.x1 - .06, cur = books.filter(b => b.status === "en_cours"), done = books.filter(b => b.status === "fini"), dropped = books.filter(b => b.status === "abandonne");
    const color = b => LEATHERS[hash(b.title) % LEATHERS.length];
    // en cours : de face, à hauteur d'yeux (rangée 2)
    let x = inner0 + .04;
    cur.slice(0, 6).forEach(b => {
      const w = .3, h = .44, m = bookMesh(w, h, .05, coverTex(b, color(b)), color(b)); m.position.set(x + w / 2, rowY(2) + h / 2 + .005, zFront - .1); m.rotation.x = -.1; m.userData = { id: b.id, home: m.position.clone(), rx: -.1, kind: "face", w, h, d: .05, book: b, color: color(b) }; user.add(m); pickables.push(m);
      if (b.cover_url) texLoader.load(b.cover_url, t => { t.colorSpace = THREE.SRGBColorSpace; m.material[4].map.dispose(); m.material[4].map = m.material[4].emissiveMap = t; m.material[4].needsUpdate = true; invalidate(); }, undefined, () => {});
      const lab = new THREE.Mesh(new THREE.PlaneGeometry(.3, .047), new THREE.MeshBasicMaterial({ map: labelTex(`p. ${b.current_page}${b.total_pages ? " / " + b.total_pages : ""}`), transparent: true })); lab.material.userData.own = true;
      lab.position.set(x + w / 2, rowY(2) - .02, ZB + CASE_D + .002); user.add(lab); x += w + .09;
    });
    // abandonnés : couchés en pile au bout de la même rangée
    let py = rowY(2); const px = inner1 - .24;
    if (x < px - .24) dropped.slice(0, 8).forEach(b => { const t = Math.max(.05, Math.min(.11, (b.total_pages || 260) * .00013)), m = bookMesh(.42, t, .27, spineTex(b, color(b), true, t / .42), color(b));
      m.position.set(px + ((hash(b.title) % 5) - 2) * .008, py + t / 2, zFront - .14); m.userData = { id: b.id, home: m.position.clone(), rx: 0, kind: "flat" }; user.add(m); pickables.push(m); py += t + .002; });
    // finis : sur la tranche, rangées 3, 1, 4, 0
    const order = [3, 1, 4, 0]; let ri = 0; x = inner0;
    done.forEach(b => { const t = Math.max(.055, Math.min(.12, (b.total_pages || 260) * .00014)), h = .37 + (hash(b.title) % 9) * .011;
      if (x + t > inner1) { ri++; x = inner0; } if (ri >= order.length) return;
      const m = bookMesh(t, h, .27, spineTex(b, color(b), false, t / h), color(b)); m.position.set(x + t / 2, rowY(order[ri]) + h / 2, zFront - .135); m.userData = { id: b.id, home: m.position.clone(), rx: 0, kind: "spine", w: t, h, d: .27, book: b, color: color(b) }; user.add(m); pickables.push(m); x += t + .004; });
    focusX = BAY.x0 + .7; invalidate();
  }

  // ───────────── Caméra ─────────────
  const VIEWS = { room: { p: [0, 2.05, 5.7], t: [0, 2.9, ZB] }, ceiling: { p: [0, H - 1.25, .55], t: [0, H, .2] } };
  let state = "room", shelf = { x: 0, y: 1.75 }, yaw = 0, pull = 0, focusX = BAY.x0 + .6;
  const cam = { p: new THREE.Vector3(...VIEWS.room.p), t: new THREE.Vector3(...VIEWS.room.t) }, from = { p: cam.p.clone(), t: cam.t.clone() }, goal = { p: cam.p.clone(), t: cam.t.clone() };
  let tw = null; const tweens = new Set();
  const SHELF_DIST = 1.55, shelfView = () => ({ p: [shelf.x, shelf.y, ZB + CASE_D + SHELF_DIST], t: [shelf.x, shelf.y - .02, ZB] });
  function goTo(v, ms = 1100) { from.p.copy(cam.p); from.t.copy(cam.t); goal.p.set(...v.p); goal.t.set(...v.t); tw = { t0: performance.now(), ms }; invalidate(); }
  function setState(s, opt = {}) {
    if (s === "shelf") { shelf.x = THREE.MathUtils.clamp(opt.x ?? focusX, BAY.x0 + .6, BAY.x1 - .6); shelf.y = 1.75; }
    state = s; yaw = 0; pull = 0; goTo(s === "shelf" ? shelfView() : VIEWS[s], s === "shelf" ? 1300 : s === "ceiling" ? 1500 : 1200); cb.onState?.(s);
  }
  function applyCamera() {
    camera.position.copy(cam.p); const t = cam.t.clone();
    if (state === "room") { const e = ease(Math.min(1, pull)) * .5; camera.position.lerp(new THREE.Vector3(0, 3.2, 3.2), e); t.lerp(new THREE.Vector3(0, H, .2), e); t.x += yaw * 7; camera.position.x += yaw * 1.2; }
    camera.lookAt(t); fill.intensity = state === "shelf" ? 2.0 : 0;
  }
  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.fov = THREE.MathUtils.clamp(2 * THREE.MathUtils.radToDeg(Math.atan(.43 / camera.aspect)), 42, 84); camera.updateProjectionMatrix(); invalidate();
  }

  // ───────────── Boucle à la demande ─────────────
  let raf = 0, dragging = false, alive = true;
  function invalidate() { if (!raf && alive) raf = requestAnimationFrame(frame); }
  function frame(now) {
    raf = 0; let busy = dragging;
    if (tw) { const k = Math.min(1, (now - tw.t0) / tw.ms), e = ease(k); cam.p.lerpVectors(from.p, goal.p, e); cam.t.lerpVectors(from.t, goal.t, e); if (k >= 1) tw = null; else busy = true; }
    for (const a of tweens) { const k = Math.min(1, (now - a.t0) / a.ms); a.step(ease(k)); if (k >= 1) { tweens.delete(a); a.done?.(); } else busy = true; }
    if (!dragging && state === "room" && (Math.abs(yaw) > .001 || pull > .001)) { yaw *= .86; pull *= .82; cb.onPull?.(pull); busy = true; }
    applyCamera(); renderer.render(scene, camera); if (busy) invalidate();
  }

  // ───────────── Gestes ─────────────
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let down = null, armed = false, held = null;
  const pick = (e, list) => { const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.intersectObjects(list, false)[0]; };
  canvas.addEventListener("pointerdown", e => { if (state === "ceiling" || held) return; down = { x: e.clientX, y: e.clientY, t: performance.now(), sx: shelf.x, sy: shelf.y, moved: false, axis: null }; armed = false; canvas.setPointerCapture?.(e.pointerId); });
  canvas.addEventListener("pointermove", e => {
    if (!down) return; const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (!down.moved && Math.hypot(dx, dy) < 8) return; down.moved = true; dragging = true; tw = state === "shelf" ? null : tw;
    if (state === "room") {
      down.axis ??= Math.abs(dy) > Math.abs(dx) ? "pull" : "look";
      if (down.axis === "pull") { pull = Math.abs(dy) / 300; const a = pull > .42; if (a !== armed) { armed = a; cb.haptic?.(); } cb.onPull?.(pull); }
      else yaw = THREE.MathUtils.clamp(-dx / 900, -.22, .22);
    } else if (state === "shelf") {
      const k = (2 * SHELF_DIST * .43) / (canvas.clientWidth || innerWidth); shelf.x = THREE.MathUtils.clamp(down.sx - dx * k, BAY.x0 + .6, BAY.x1 - .6); shelf.y = THREE.MathUtils.clamp(down.sy + dy * k, 1.2, 2.3);
      const v = shelfView(); cam.p.set(...v.p); cam.t.set(...v.t);
    }
    invalidate();
  });
  const up = e => {
    if (!down) return; const d = down; down = null; dragging = false;
    if (!d.moved && performance.now() - d.t < 500) {
      const hit = pick(e, pickables);
      if (state === "room") { const h = hit || pick(e, [bayHit]); if (h) { cb.haptic?.(); setState("shelf"); } }
      else if (state === "shelf" && hit) pullOut(hit.object);
    } else if (state === "room" && d.axis === "pull" && armed) { cb.onCeiling?.(); }
    invalidate();
  };
  canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", () => { down = null; dragging = false; invalidate(); });
  // Prendre un livre : il sort du rayon, vient se présenter de face devant la caméra, puis sa couverture s'ouvre sur la première page.
  const tween = (ms, step, done) => { tweens.add({ t0: performance.now(), ms, step, done }); invalidate(); };
  function pullOut(m) {
    held = m; cb.haptic?.(); const u = m.userData, p0 = m.position.clone();
    tween(380, e => { m.position.z = p0.z + .3 * e; m.position.y = p0.y + .03 * e; m.rotation.x = u.rx * (1 - e); }, () => {
      if (u.kind === "flat") return cb.onOpenBook?.(u.id);
      const p1 = m.position.clone(), coverW = u.kind === "spine" ? u.d : u.w, ry1 = u.kind === "spine" ? -Math.PI / 2 : 0;
      const dir = new THREE.Vector3(); camera.getWorldDirection(dir); const p2 = camera.position.clone().addScaledVector(dir, .98); p2.x += coverW * .5;
      tween(620, e => { m.position.lerpVectors(p1, p2, e); m.rotation.y = ry1 * e; }, () => {
        // la couverture : une plaque fine articulée sur le dos, extérieur en cuir titré, intérieur papier
        const outer = new THREE.MeshStandardMaterial({ map: u.kind === "spine" ? coverTex(u.book, u.color) : m.material[4].map, roughness: .85, emissive: "#ffffff", emissiveIntensity: .25 }); outer.emissiveMap = outer.map;
        const inner = new THREE.MeshStandardMaterial({ color: "#e9dfc4", roughness: .95, emissive: "#e9dfc4", emissiveIntensity: .35 });
        const hinge = new THREE.Group(), spine = u.kind === "spine";
        const lid = new THREE.Mesh(spine ? new THREE.BoxGeometry(.006, u.h, u.d) : new THREE.BoxGeometry(u.w, u.h, .006), spine ? [outer, inner, inner, inner, inner, inner] : [inner, inner, inner, inner, outer, inner]);
        if (spine) { hinge.position.set(u.w / 2 + .004, 0, u.d / 2); lid.position.set(0, 0, -u.d / 2); } else { hinge.position.set(-u.w / 2, 0, u.d / 2 + .004); lid.position.set(u.w / 2, 0, 0); }
        hinge.add(lid); m.add(hinge); u.hinge = hinge; u.faceMat = m.material[spine ? 0 : 4];
        const first = new THREE.MeshStandardMaterial({ map: titlePageTex(u.book), roughness: .95, emissive: "#ffffff", emissiveIntensity: .3 }); first.emissiveMap = first.map; u.firstMat = first;
        const mats = m.material.slice(); mats[spine ? 0 : 4] = first; m.material = mats;
        const p3 = p2.clone().addScaledVector(dir, -.12);
        cb.haptic?.();
        tween(760, e => { hinge.rotation.y = -2.75 * e; m.position.lerpVectors(p2, p3, e); }, () => cb.onOpenBook?.(u.id));
      });
    });
  }
  function releaseBook() {
    if (!held) return; const m = held, u = m.userData, p0 = m.position.clone(), ry0 = m.rotation.y, h0 = u.hinge ? u.hinge.rotation.y : 0; held = null;
    tween(650, e => { if (u.hinge) u.hinge.rotation.y = h0 * (1 - Math.min(1, e * 1.6)); m.position.lerpVectors(p0, u.home, e); m.rotation.y = ry0 * (1 - e); m.rotation.x = u.rx * e; }, () => {
      if (!u.hinge) return; m.remove(u.hinge); u.hinge.children[0].geometry.dispose(); const spine = u.kind === "spine", mats = m.material.slice(); mats[spine ? 0 : 4] = u.faceMat; m.material = mats; u.hinge = null; u.firstMat?.map.dispose(); u.firstMat?.dispose(); invalidate();
    });
  }

  addEventListener("resize", resize); resize();
  return { setBooks, setState, releaseBook, invalidate, get state() { return state; }, dispose() { alive = false; cancelAnimationFrame(raf); removeEventListener("resize", resize); renderer.dispose(); } };
}
