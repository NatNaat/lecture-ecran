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
let ANISO = 4;   // relevé au niveau réel de la carte à la création du rendu
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO;
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
    g.fillStyle = "#23100f"; g.fillRect(0, 0, w, h); const r = rnd(5);
    const frame = (m, c, lw, a = 1) => { g.globalAlpha = a; g.strokeStyle = c; g.lineWidth = lw; g.strokeRect(m, m, w - 2 * m, h - 2 * m); g.globalAlpha = 1; };
    g.fillStyle = "#10182a"; g.fillRect(18, 18, w - 36, h - 36); g.fillStyle = "#2a1312"; g.fillRect(64, 64, w - 128, h - 128);
    frame(18, "#7d6438", 3, .7); frame(62, "#7d6438", 2, .6); frame(74, "#7d6438", 1, .4);
    const rosette = (x, y, s, c, a) => { g.globalAlpha = a; g.fillStyle = c; for (let k = 0; k < 4; k++) { g.save(); g.translate(x, y); g.rotate(k * Math.PI / 2); g.beginPath(); g.ellipse(0, -s * .55, s * .22, s * .5, 0, 0, 7); g.fill(); g.restore(); } g.beginPath(); g.arc(x, y, s * .16, 0, 7); g.fill(); g.globalAlpha = 1; };
    for (let x = 41; x < w - 30; x += 36) { rosette(x, 41, 11, "#8a6f40", .55); rosette(x, h - 41, 11, "#8a6f40", .55); }
    for (let y = 77; y < h - 60; y += 36) { rosette(41, y, 11, "#8a6f40", .55); rosette(w - 41, y, 11, "#8a6f40", .55); }
    for (let j = 0, y = 110; y < h - 100; y += 46, j++) for (let x = 104 + (j % 2) * 23; x < w - 96; x += 46) rosette(x, y, 13, j % 2 ? "#4a201c" : "#3c2a3a", .8);
    const loz = (rx, ry, c, a = 1) => { g.globalAlpha = a; g.fillStyle = c; g.beginPath(); g.moveTo(w / 2, h / 2 - ry); g.quadraticCurveTo(w / 2 + rx * .55, h / 2 - ry * .45, w / 2 + rx, h / 2); g.quadraticCurveTo(w / 2 + rx * .55, h / 2 + ry * .45, w / 2, h / 2 + ry); g.quadraticCurveTo(w / 2 - rx * .55, h / 2 + ry * .45, w / 2 - rx, h / 2); g.quadraticCurveTo(w / 2 - rx * .55, h / 2 - ry * .45, w / 2, h / 2 - ry); g.fill(); g.globalAlpha = 1; };
    loz(150, 250, "#7d6438", .55); loz(144, 242, "#10182a"); loz(112, 196, "#3a1615"); loz(60, 108, "#7d6438", .5); loz(54, 100, "#10182a"); rosette(w / 2, h / 2, 40, "#8a6f40", .6);
    for (let i = 0; i < 5000; i++) { g.fillStyle = r() > .5 ? "#000" : "#a08060"; g.globalAlpha = .05; g.fillRect(r() * w, r() * h, 1.5, 1.5); } g.globalAlpha = 1;
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
function glimpseTex() {
  return canvasTex(256, 512, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, "#5a3316"); bg.addColorStop(.5, "#d48a3e"); bg.addColorStop(1, "#3a1f0c"); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const lampe = g.createRadialGradient(w * .66, h * .52, 4, w * .66, h * .52, w * .75); lampe.addColorStop(0, "rgba(255,226,170,.95)"); lampe.addColorStop(.35, "rgba(240,160,80,.45)"); lampe.addColorStop(1, "rgba(240,160,80,0)"); g.fillStyle = lampe; g.fillRect(0, 0, w, h);
    const r = rnd(31); g.fillStyle = "rgba(30,15,6,.85)"; g.fillRect(0, 0, w * .4, h * .78);
    for (let k = 0; k < 6; k++) { const y = 20 + k * 62; g.fillStyle = "rgba(15,8,3,.9)"; g.fillRect(0, y + 50, w * .4, 6); for (let x = 4; x < w * .4 - 8;) { const bw = 5 + r() * 8, bh = 30 + r() * 16; g.fillStyle = ["#6a3d20", "#8a5a30", "#4a2416", "#a07a48", "#3a2a20"][(r() * 5) | 0]; g.globalAlpha = .8; g.fillRect(x, y + 50 - bh, bw, bh); g.globalAlpha = 1; x += bw + 1; } }
    g.fillStyle = "rgba(20,10,4,.9)"; g.fillRect(w * .5, h * .7, w * .5, h * .08); g.fillRect(w * .56, h * .78, 8, h * .22); g.fillRect(w * .9, h * .78, 8, h * .22);   // le bureau, à contre-jour
    g.fillStyle = "rgba(25,12,5,.95)"; g.fillRect(0, h * .9, w, h * .1);
  });
}
function glowTex() {
  return canvasTex(128, 128, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, "rgba(255,214,150,.95)"); gr.addColorStop(.3, "rgba(255,180,100,.35)"); gr.addColorStop(1, "rgba(255,160,80,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
}
// Ambiance réfléchie par les matériaux (laiton, fer, cuir) : une pièce sombre aux halos chauds, en équirectangulaire
function envTex() {
  const c = document.createElement("canvas"); c.width = 256; c.height = 128; const g = c.getContext("2d");
  const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, "#0b0704"); gr.addColorStop(.42, "#382312"); gr.addColorStop(.6, "#1f1208"); gr.addColorStop(1, "#080402");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
  const blob = (x, y, s, col) => { const rg = g.createRadialGradient(x, y, 0, x, y, s); rg.addColorStop(0, col); rg.addColorStop(1, "rgba(255,170,90,0)"); g.fillStyle = rg; g.fillRect(x - s, y - s, 2 * s, 2 * s); };
  blob(58, 60, 26, "rgba(255,199,124,.95)"); blob(196, 68, 20, "rgba(255,178,98,.8)"); blob(120, 88, 34, "rgba(255,160,80,.35)"); blob(128, 22, 30, "rgba(110,130,190,.22)");
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.mapping = THREE.EquirectangularReflectionMapping; return t;
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
function spineTex(book, color, horizontal, ratio = .25, ink = "#f0e4c6", accent = "#d9b972") {
  const style = hash(book.title + "s") % 4;   // quatre façons de relier : filets, nerfs, étiquette, auteur en pied
  const h = 512, w = Math.max(64, Math.round(h * ratio));
  return canvasTex(horizontal ? h : w, horizontal ? w : h, g => {
    if (horizontal) { g.translate(h, 0); g.rotate(Math.PI / 2); }
    leatherFill(g, w, h, color, hash(book.title));
    // dos bombé : ombres marquées sur les bords, reflet doux au tiers
    const sh = g.createLinearGradient(0, 0, w, 0); sh.addColorStop(0, "rgba(0,0,0,.7)"); sh.addColorStop(.12, "rgba(0,0,0,.25)"); sh.addColorStop(.32, "rgba(255,255,255,.13)"); sh.addColorStop(.6, "rgba(0,0,0,.05)"); sh.addColorStop(.88, "rgba(0,0,0,.35)"); sh.addColorStop(1, "rgba(0,0,0,.75)"); g.fillStyle = sh; g.fillRect(0, 0, w, h);
    const rule = (y, t = 3) => { g.fillStyle = accent; g.fillRect(0, y, w, t); }, nerf = y => { g.fillStyle = "rgba(255,255,255,.16)"; g.fillRect(0, y - 5, w, 4); g.fillStyle = "rgba(0,0,0,.45)"; g.fillRect(0, y + 3, w, 5); g.fillStyle = accent; g.globalAlpha = .7; g.fillRect(0, y - 1, w, 2); g.globalAlpha = 1; };
    if (style === 1) [52, 112, h - 118, h - 58].forEach(nerf); else if (style === 3) { rule(30); rule(h - 96, 2); rule(h - 33); } else { rule(34); rule(h - 37); if (style === 0) { rule(42, 1); rule(h - 44, 1); } }
    if (style === 2) { g.fillStyle = "rgba(0,0,0,.38)"; g.fillRect(w * .1, 70, w * .8, h - 140); g.strokeStyle = accent; g.lineWidth = 2; g.globalAlpha = .8; g.strokeRect(w * .1, 70, w * .8, h - 140); g.globalAlpha = 1; }
    if ((style === 1 || style === 3) && book.author && w >= 72) { const last = String(book.author).split(",")[0].trim().split(" ").pop().toUpperCase(); g.fillStyle = accent; g.textAlign = "center"; g.textBaseline = "middle"; g.font = `600 ${Math.min(17, w * .17)}px ${SANS}`; g.fillText(last, w / 2, style === 1 ? h - 88 : h - 64, w - 12); }
    const maxSize = Math.min(38, w * .42), padTop = style === 1 ? 128 : 60, padBot = style === 1 ? 134 : style === 3 ? 110 : 60;
    g.save(); g.translate(w / 2, (padTop + h - padBot) / 2); g.rotate(-Math.PI / 2); g.fillStyle = ink; g.textAlign = "center"; g.textBaseline = "middle";
    let size = maxSize, lines; const title = book.title.toUpperCase();
    for (;; size -= 3) { g.font = `600 ${size}px ${SANS}`; lines = wrapWords(g, title, h - padTop - padBot); if ((lines.length <= (w > 90 ? 2 : 1) && lines.every(l => g.measureText(l).width <= h - padTop - padBot + 8)) || size <= 14) break; }
    if (lines.length > 2) lines = [lines[0], lines.slice(1).join(" ")];
    lines = lines.slice(0, 2); const lh = size * 1.22 + 4;
    lines.forEach((l, i) => g.fillText(l, 0, (i - (lines.length - 1) / 2) * lh, h - padTop - padBot + 8)); g.restore();
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
// Les couvertures d'Open Library n'autorisent pas la lecture de leurs pixels (pas d'en-tête CORS sur l'image finale) :
// on passe par le relais d'images wsrv.nl, qui les sert avec l'autorisation. Seule l'adresse de la couverture lui est transmise.
const proxied = url => "https://wsrv.nl/?w=512&output=jpg&q=88&url=" + encodeURIComponent(url.replace(/^https?:\/\//, ""));
const hiRes = u => u.replace(/(covers\.openlibrary\.org\/b\/(?:id|isbn)\/[^-/]+)-M\.jpg/, (m, a) => a + "-L.jpg").replace(/([?&]zoom=)1(?!\d)/, (m, a) => a + "3");
const covers = new Map();
function loadCover(url) {
  if (!covers.has(url)) covers.set(url, new Promise(res => {
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => { try {
      if (img.naturalWidth < 60) { if (!triedLo && hiRes(url) !== url) { triedLo = true; img.src = proxied(url); return; } return res(null); }
      const c = document.createElement("canvas"), W = c.width = 40, H = c.height = 60, g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0, W, H);
      const d = g.getImageData(0, 0, W, H).data, bins = new Map();
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4, k = (d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | d[i + 2] >> 4, edge = x < 5 || y < 5 || x >= W - 5 || y >= H - 5 ? 3 : 1;
        const b = bins.get(k) || bins.set(k, [0, 0, 0, 0]).get(k); b[0] += edge; b[1] += d[i] * edge; b[2] += d[i + 1] * edge; b[3] += d[i + 2] * edge; }
      const ranked = [...bins.values()].sort((a, b) => b[0] - a[0]), rgb = b => [b[1] / b[0], b[2] / b[0], b[3] / b[0]], main = rgb(ranked[0]);
      const far = ranked.slice(1).find(b => b[0] > ranked[0][0] * .04 && rgb(b).reduce((s, v, i) => s + Math.abs(v - main[i]), 0) > 150);
      const hex = v => "#" + v.map(n => Math.round(n).toString(16).padStart(2, "0")).join(""), lum = (.2126 * main[0] + .7152 * main[1] + .0722 * main[2]) / 255;
      const tex = new THREE.Texture(img); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; tex.needsUpdate = true;
      res({ tex, color: hex(main), ink: lum > .55 ? "#221b14" : "#f0e4c6", accent: far ? hex(rgb(far)) : lum > .55 ? "#221b14" : "#d9b972" });
    } catch { res(null); } };
    let triedLo = false; img.onerror = () => { if (triedLo || hiRes(url) === url) return res(null); triedLo = true; img.src = proxied(url); };   // grande image d'abord, puis l'image d'origine
    img.src = proxied(hiRes(url));
  }));
  return covers.get(url);
}
function progressTex(ratio) {
  return canvasTex(256, 40, (g, w, h) => { g.clearRect(0, 0, w, h); const x0 = 18, x1 = w - 18, y = h / 2, r = 5;
    const bar = (a, b, c) => { g.fillStyle = c; g.beginPath(); g.roundRect(a, y - r, Math.max(2 * r, b - a), 2 * r, r); g.fill(); };
    bar(x0, x1, "rgba(0,0,0,.55)"); bar(x0, x0 + (x1 - x0) * Math.max(.03, Math.min(1, ratio)), "#e3c47c"); });
}
function paperTex() {
  return canvasTex(512, 934, (g, w, h) => { g.fillStyle = "#efe6d0"; g.fillRect(0, 0, w, h); const r = rnd(8);
    for (let i = 0; i < 1400; i++) { g.fillStyle = r() > .5 ? "#fff" : "#8a7a55"; g.globalAlpha = .05; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); } g.globalAlpha = 1;
    const v = g.createRadialGradient(w / 2, h / 2, h * .25, w / 2, h / 2, h * .7); v.addColorStop(0, "rgba(120,90,40,0)"); v.addColorStop(1, "rgba(120,90,40,.16)"); g.fillStyle = v; g.fillRect(0, 0, w, h); });
}
function labelTex(text) {
  return canvasTex(256, 40, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = "#e3c47c"; g.font = `600 26px ${SANS}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, w / 2, h / 2 + 1); });
}

// ───────────── La scène ─────────────
export function createScene(canvas, cb = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const scene = new THREE.Scene(); scene.background = new THREE.Color("#060403"); scene.fog = new THREE.Fog("#060403", 12, 24);
  { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromEquirectangular(envTex()).texture; scene.environmentIntensity = .3; pm.dispose(); }
  const camera = new THREE.PerspectiveCamera(80, 1, .05, 40);

  const wood = new THREE.MeshStandardMaterial({ map: woodTex("#2a180e", "#0e0704", "#4a2c18"), roughness: .55, metalness: .05 });
  const woodDark = new THREE.MeshStandardMaterial({ map: woodTex("#1a0f08", "#070403", "#2e1a0f"), roughness: .7 });
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex(), roughness: .38, metalness: .05 });
  const iron = new THREE.MeshStandardMaterial({ color: "#2a1d10", roughness: .4, metalness: .7 });
  const brass = new THREE.MeshStandardMaterial({ color: "#b08a3e", roughness: .35, metalness: .85 });
  const paper = new THREE.MeshStandardMaterial({ color: "#d8cba8", roughness: .9 });
  // Relief léger : la texture sert aussi de carte de relief, le grain accroche la lumière rasante
  wood.bumpMap = wood.map; wood.bumpScale = .2; woodDark.bumpMap = woodDark.map; woodDark.bumpScale = .16; floorMat.bumpMap = floorMat.map; floorMat.bumpScale = .3;
  const unit = new THREE.BoxGeometry(1, 1, 1);
  let into = scene;   // parent courant des éléments construits (la grande salle, puis le cabinet)
  const box = (w, h, d, mat, x, y, z, shadow = true) => { const m = new THREE.Mesh(unit, mat); m.scale.set(w, h, d); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; into.add(m); return m; };

  // Sol, tapis, murs, plafond
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W + 2, ZF - ZB + 4), floorMat); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, (ZF + ZB) / 2 + 1); floor.receiveShadow = true; scene.add(floor);
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 5.6), new THREE.MeshStandardMaterial({ map: rugTex(), roughness: .95 })); rug.rotation.x = -Math.PI / 2; rug.position.set(0, .006, 1.1); rug.receiveShadow = true; scene.add(rug);
  { const d0 = H1 + SLAB, d1 = d0 + 2.3, hw = .5, full = W + .4;   // mur du fond, percé d'une porte à l'étage
    box(full, d0, .1, woodDark, 0, d0 / 2, ZB - .05, false); box(full, H - d1, .1, woodDark, 0, (H + d1) / 2, ZB - .05, false);
    for (const sd of [-1, 1]) box(full / 2 - hw, d1 - d0, .1, woodDark, sd * (hw + (full / 2 - hw) / 2), (d0 + d1) / 2, ZB - .05, false); }
  for (const s of [-1, 1]) box(.1, H, ZF - ZB + 2, woodDark, s * (W / 2 + .05), H / 2, (ZF + ZB) / 2 + 1, false);
  box(W + .4, .12, ZF - ZB + 2, woodDark, 0, H + .06, (ZF + ZB) / 2 + 1, false);
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 5.6), new THREE.MeshStandardMaterial({ map: skyTex(), emissiveMap: null, emissive: "#ffffff", emissiveIntensity: 0, roughness: 1 }));
  sky.material.emissiveMap = sky.material.map; sky.material.emissiveIntensity = .55; sky.rotation.x = Math.PI / 2; sky.position.set(0, H - .005, .2); scene.add(sky);
  for (const s of [-1, 1]) { box(.2, .3, 6.1, wood, s * 2.1, H - .15, .2, false); box(.24, .16, 6.1, woodDark, s * 2.3, H - .08, .2, false); }
  for (const z of [-2.72, 3.12]) box(4.4, .3, .22, wood, 0, H - .15, z, false);

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
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 3.1), new THREE.MeshBasicMaterial({ map: glimpseTex(), color: "#e9a45a", transparent: true })); door.position.set(.1, y2 + 1.35, ZB - .9); scene.add(door);
  for (const sd of [-1, 1]) box(.07, 2.3, .42, woodDark, sd * .5, y2 + 1.15, ZB - .16, false); box(1.07, .07, .42, woodDark, 0, y2 + 2.3, ZB - .16, false);   // embrasure profonde
  { const leaf = box(.045, 2.22, .86, wood, .45, y2 + 1.11, ZB - .8, false); leaf.rotation.y = .12; const knob = new THREE.Mesh(new THREE.SphereGeometry(.03, 12, 10), brass); knob.position.set(.41, y2 + 1.05, ZB - 1.12); scene.add(knob); }
  const doorGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: "#ffb35a", opacity: .55 })); doorGlow.scale.set(2.2, 3.2, 1); doorGlow.position.set(0, y2 + 1.15, ZB + .3); scene.add(doorGlow);
  for (const sd of [-1, 1]) box(.035, 2.36, .03, brass, sd * .56, y2 + 1.18, ZB + .135, false); box(1.155, .035, .03, brass, 0, y2 + 2.36, ZB + .135, false);
  { const lantern = new THREE.Mesh(new THREE.SphereGeometry(.07, 16, 12), new THREE.MeshBasicMaterial({ color: "#ffe2b0" })); lantern.position.set(0, y2 + 2.62, ZB + .2); scene.add(lantern); box(.02, .14, .02, brass, 0, y2 + 2.75, ZB + .2, false);
    const lg = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .9 })); lg.scale.set(1.1, 1.1, 1); lg.position.copy(lantern.position); scene.add(lg);
    const spill = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.25), new THREE.MeshBasicMaterial({ map: canvasTex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(w / 2, 0, 4, w / 2, 0, h); gr.addColorStop(0, "rgba(255,190,110,.85)"); gr.addColorStop(1, "rgba(255,160,80,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, h); }), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    spill.rotation.x = -Math.PI / 2; spill.position.set(0, y2 + .006, ZB + .66); scene.add(spill); }
  const doorHit = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 3.0), new THREE.MeshBasicMaterial({ visible: false })); doorHit.position.set(0, y2 + 1.3, ZB + .06); scene.add(doorHit);
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
  const grain = canvasTex(128, 128, (g, w, h) => { g.fillStyle = "#808080"; g.fillRect(0, 0, w, h); const r = rnd(23); for (let i = 0; i < 2600; i++) { const v = 96 + r() * 64; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); } }, [3, 3]);
  const leather = new THREE.MeshStandardMaterial({ color: "#6e4326", roughness: .46, bumpMap: grain, bumpScale: .5 }), linen = new THREE.MeshStandardMaterial({ color: "#b9ab8c", roughness: .9 });
  const cyl = (rt, rb, h, mat, x, y, z, open) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 28, 1, !!open), mat); m.position.set(x, y, z); m.castShadow = !open; m.receiveShadow = true; into.add(m); return m; };
  const tx = 1.25, tz = .9; cyl(.5, .5, .035, wood, tx, .745, tz); cyl(.48, .44, .03, wood, tx, .715, tz); cyl(.035, .06, .42, wood, tx, .5, tz); cyl(.07, .035, .1, wood, tx, .26, tz); cyl(.06, .09, .2, wood, tx, .12, tz); cyl(.24, .28, .035, wood, tx, .018, tz);
  const shadeMat = new THREE.MeshStandardMaterial({ color: "#f3d9a4", emissive: "#ffb765", emissiveIntensity: 1.6, side: THREE.DoubleSide, roughness: .9 });
  const lamp = (x, y, z, k = 1) => { cyl(.07 * k, .09 * k, .04, brass, x, y + .02, z); cyl(.015, .015, .34 * k, brass, x, y + .19 * k, z); cyl(.11 * k, .2 * k, .2 * k, shadeMat, x, y + .44 * k, z, true);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); s.scale.set(1.5 * k, 1.5 * k, 1); s.position.set(x, y + .44 * k, z); scene.add(s); };
  const glow = glowTex(); lamp(tx + .3, .76, tz - .28, .85); lamp(1.55, y2, ZB + .75, .9);
  // Le journal de lecture, ouvert sur la table ronde : reliure en cuir, tranches des pages, ruban, page de gauche déjà écrite
  const journal = new THREE.Group(); journal.position.set(tx - .1, .762, tz + .08); journal.rotation.y = .55; scene.add(journal);
  const JP = { w: .27, h: .40 }, journalUp = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), journal.rotation.y);
  const writtenTex = canvasTex(512, 758, (g, w, h) => { g.fillStyle = "#efe6d0"; g.fillRect(0, 0, w, h); const r = rnd(17);
    for (let i = 0; i < 1200; i++) { g.fillStyle = r() > .5 ? "#fff" : "#8a7a55"; g.globalAlpha = .05; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); } g.globalAlpha = 1;
    g.strokeStyle = "rgba(34,27,20,.12)"; g.lineWidth = 1; for (let y = 90; y < h - 40; y += 34) { g.beginPath(); g.moveTo(50, y); g.lineTo(w - 40, y); g.stroke(); }
    g.fillStyle = "#2b2118"; g.font = "600 22px " + SANS; g.fillText("Carnet de lecture", 50, 56); g.fillRect(50, 66, 180, 2);
    g.strokeStyle = "#2b2118"; g.lineWidth = 1.6; g.lineCap = "round";
    for (let y = 108; y < h - 40; y += 34) { if (r() < .12) continue; let x = 50 + (r() < .3 ? 60 : 0); const end = w - 60 - r() * 120;
      while (x < end) { const len = 14 + r() * 40; g.beginPath(); g.moveTo(x, y - 6); for (let k = 0; k < len; k += 4) g.lineTo(x + k, y - 4 - Math.sin(k * .9 + r() * 3) * (3 + r() * 3)); g.stroke(); x += len + 9; } }
    g.globalAlpha = .55; g.strokeStyle = "#6a1f1f"; g.lineWidth = 2; g.beginPath(); g.moveTo(60, 380); g.quadraticCurveTo(220, 366, w - 90, 386); g.stroke(); g.globalAlpha = 1; });
  { const J = journal, cover = new THREE.MeshStandardMaterial({ color: "#3a2415", roughness: .62 }), edge = new THREE.MeshStandardMaterial({ color: "#e4d9bf", roughness: .95 }), pageTop = new THREE.MeshStandardMaterial({ map: paperTex(), roughness: .95, emissive: "#efe6d0", emissiveIntensity: .12 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(2 * JP.w + .08, .018, JP.h + .05), cover); m.position.y = .009; m.castShadow = m.receiveShadow = true; J.add(m);
    for (const sd of [-1, 1]) { const blk = new THREE.Mesh(new THREE.BoxGeometry(JP.w, .022, JP.h), [edge, edge, sd < 0 ? new THREE.MeshStandardMaterial({ map: writtenTex, roughness: .95, emissive: "#efe6d0", emissiveIntensity: .12 }) : pageTop, edge, edge, edge]); blk.position.set(sd * (JP.w / 2 + .006), .029, 0); blk.receiveShadow = true; J.add(blk);
      for (let k = 0; k < 4; k++) { const leaf = new THREE.Mesh(new THREE.BoxGeometry(JP.w - .004 - k * .003, .0015, JP.h - .006 - k * .004), edge); leaf.position.set(sd * (JP.w / 2 + .006), .0405 + k * .0016, 0); J.add(leaf); } }
    const spine = new THREE.Mesh(new THREE.BoxGeometry(.012, .026, JP.h), cover); spine.position.y = .031; J.add(spine);
    const ribbon = new THREE.Mesh(new THREE.BoxGeometry(.012, .002, .22), new THREE.MeshStandardMaterial({ color: "#7a1f1f", roughness: .8 })); ribbon.position.set(.05, .042, JP.h / 2 + .02); ribbon.rotation.y = .12; J.add(ribbon);
    const pen = new THREE.Mesh(new THREE.CylinderGeometry(.005, .0035, .15, 8), new THREE.MeshStandardMaterial({ color: "#1d1712", roughness: .35 })); pen.rotation.set(Math.PI / 2, 0, .45); pen.position.set(JP.w + .07, .01, .1); J.add(pen);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(.0055, .0055, .03, 8), brass); cap.rotation.set(Math.PI / 2, 0, .45); cap.position.set(JP.w + .07 - Math.sin(.45) * .06, .01, .1 - Math.cos(.45) * .06); J.add(cap); }
  const journalPage = new THREE.Mesh(new THREE.PlaneGeometry(JP.w, JP.h), new THREE.MeshBasicMaterial({ visible: false })); journalPage.rotation.x = -Math.PI / 2; journalPage.position.set(JP.w / 2 + .006, .047, 0); journal.add(journalPage);
  const glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: "#fff4d6", opacity: 0 })); glint.scale.set(.32, .16, 1); glint.position.set(JP.w / 2 + .006, .06, 0); journal.add(glint);
  const journalHit = new THREE.Mesh(new THREE.BoxGeometry(2 * JP.w + .2, .12, JP.h + .16), new THREE.MeshBasicMaterial({ visible: false })); journalHit.position.y = .05; journal.add(journalHit);
  // Mobilier aux arêtes adoucies : boîtes arrondies (extrusion biseautée), accoudoirs en capsule, pieds tournés
  const softGeo = (w, h, d, r) => { r = Math.min(r, w / 2 - .001, h / 2 - .001, d / 2 - .001); const a = w / 2 - r, b = h / 2 - r, c = Math.min(r * .6, a, b), sh = new THREE.Shape();
    sh.moveTo(-a + c, -b); sh.lineTo(a - c, -b); sh.quadraticCurveTo(a, -b, a, -b + c); sh.lineTo(a, b - c); sh.quadraticCurveTo(a, b, a - c, b); sh.lineTo(-a + c, b); sh.quadraticCurveTo(-a, b, -a, b - c); sh.lineTo(-a, -b + c); sh.quadraticCurveTo(-a, -b, -a + c, -b);
    const g = new THREE.ExtrudeGeometry(sh, { depth: d - 2 * r, bevelEnabled: true, bevelSize: r, bevelThickness: r, bevelSegments: 5, curveSegments: 6 }); g.translate(0, 0, -(d - 2 * r) / 2); return g; };
  const soft = (g, w, h, d, r, mat, x, y, z, rx = 0) => { const m = new THREE.Mesh(softGeo(w, h, d, r), mat); m.position.set(x, y, z); m.rotation.x = rx; m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  const leg = (g, x, z, h = .2) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(.03, .018, h, 12), wood); m.position.set(x, h / 2, z); m.castShadow = true; g.add(m); };
  // Fauteuil club : un dossier enveloppant d'un seul tenant, extrudé avec de larges arrondis, sur une assise ronde et un coussin galbé
  const horseshoe = (ro, ri, a0, a1, height, bevel) => { const sh = new THREE.Shape(); sh.absarc(0, 0, ro, a0, a1, false); sh.absarc(0, 0, ri, a1, a0, true); sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: height, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 8, curveSegments: 40 }); geo.rotateX(-Math.PI / 2); return geo; };
  const pillow = (r, t) => new THREE.LatheGeometry([[0, t], [r * .78, t], [r * .94, t * .62], [r, 0], [r * .94, -t * .62], [r * .78, -t], [0, -t]].map(([x, y]) => new THREE.Vector2(x, y)), 40);
  const RAD = Math.PI / 180, armGeo = horseshoe(.4, .3, -38 * RAD, 218 * RAD, .24, .045), backGeo = horseshoe(.395, .31, 18 * RAD, 162 * RAD, .3, .045), seatGeo = new THREE.CylinderGeometry(.385, .36, .2, 44), cushGeo = pillow(.31, .065);
  const chair = (x, z, ry, y = 0) => { const g = new THREE.Group(), put = (geo, mat, px, py, pz, rx = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.rotation.x = rx; m.castShadow = m.receiveShadow = true; g.add(m); return m; };
    put(seatGeo, leather, 0, .2, 0); put(cushGeo, leather, 0, .37, .03); put(armGeo, leather, 0, .3, 0); put(backGeo, leather, 0, .58, 0);
    for (const a of [-1, 1]) for (const b of [-1, 1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(.028, .018, .1, 14), wood); l.position.set(a * .25, .05, b * .25); l.castShadow = true; g.add(l); }
    g.position.set(x, y, z); g.rotation.y = ry; into.add(g); };
  chair(1.7, -.35, -.45); chair(-1.4, .35, .7);
  { const g = new THREE.Group(); const base = new THREE.Mesh(new THREE.CylinderGeometry(.27, .25, .2, 40), leather); base.position.y = .2; base.castShadow = base.receiveShadow = true; g.add(base);
    const top = new THREE.Mesh(pillow(.285, .07), leather); top.position.y = .35; top.castShadow = true; g.add(top);
    for (const a of [-1, 1]) for (const b of [-1, 1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(.026, .016, .1, 14), wood); l.position.set(a * .17, .05, b * .17); g.add(l); }
    g.position.set(-.85, 0, 1.15); scene.add(g); }

  // ───────────── Le cabinet de travail : on y entre par la porte de la mezzanine pour ajouter un livre ─────────────
  const study = new THREE.Group(); study.visible = false; scene.add(study); let sheet3d = null; const deskUp = new THREE.Vector3(0, 0, -1), PAPER = { w: .34, h: .62 };
  const SY = H1 + SLAB, SZ0 = ZB - .15, SZ1 = ZB - 5.4, SW = 2.6, SH = 2.9, DESK = { x: .35, z: -7.25 }, ARCH = { z0: ZB - 1.75, z1: ZB - .45, h: 2.2 };
  {
    into = study; const g0 = generic.length, R2 = rnd(29);
    const green = new THREE.MeshStandardMaterial({ color: "#13241c", roughness: .92 }), ceilMat = new THREE.MeshStandardMaterial({ color: "#2b1c10", roughness: 1 });
    const candleMat = new THREE.MeshStandardMaterial({ color: "#efe3c2", roughness: .6, emissive: "#ffb765", emissiveIntensity: .25 }), porcelain = new THREE.MeshStandardMaterial({ color: "#e8e0cf", roughness: .35 });
    const zc = (SZ0 + SZ1) / 2, len = SZ0 - SZ1;
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(2 * SW, len), floorMat); fl.rotation.x = -Math.PI / 2; fl.position.set(0, SY + .002, zc); fl.receiveShadow = true; study.add(fl);
    const rg = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 3.7), new THREE.MeshStandardMaterial({ map: rugTex(), roughness: .95, color: "#b08a8a" })); rg.rotation.x = -Math.PI / 2; rg.rotation.z = .12; rg.position.set(.3, SY + .008, DESK.z + .5); study.add(rg);
    box(2 * SW, SH, .1, green, 0, SY + SH / 2, SZ1 - .05, false); box(.1, SH, len, green, SW + .05, SY + SH / 2, zc, false);
    box(.1, SH, ARCH.z0 - SZ1, green, -SW - .05, SY + SH / 2, (ARCH.z0 + SZ1) / 2, false); box(.1, SH, SZ0 - ARCH.z1, green, -SW - .05, SY + SH / 2, (SZ0 + ARCH.z1) / 2, false);
    box(.1, SH - ARCH.h, ARCH.z1 - ARCH.z0, green, -SW - .05, SY + ARCH.h + (SH - ARCH.h) / 2, (ARCH.z0 + ARCH.z1) / 2, false);
    box(2 * SW, .08, len, ceilMat, 0, SY + SH + .04, zc, false);
    // rayonnages : mur du fond et mur de droite
    const rows = 5, rowH = .44, y0 = SY + .1, top = y0 + rows * rowH;
    box(2 * SW - .1, rows * rowH + .06, .03, woodDark, 0, y0 + (rows * rowH) / 2, SZ1 + .015, false);
    for (let k = 0; k <= rows; k++) box(2 * SW - .1, .04, CASE_D, wood, 0, y0 + k * rowH, SZ1 + CASE_D / 2, false);
    for (let x = -SW + .05; x <= SW; x += 1.02) box(.06, rows * rowH + .06, CASE_D + .02, wood, x, y0 + (rows * rowH) / 2, SZ1 + (CASE_D + .02) / 2, false);
    for (let k = 0; k < rows; k++) for (let x = -SW + .08; x < SW - .3; x += 1.02) fillRow(x + .03, Math.min(x + .97, SW - .08), y0 + k * rowH + .02, SZ1, 0, rowH, R2);
    const rz0 = SZ1 + CASE_D, rz1 = SZ1 + 3.1;
    box(.03, rows * rowH + .06, rz1 - rz0, woodDark, SW - .015, y0 + (rows * rowH) / 2, (rz0 + rz1) / 2, false);
    for (let k = 0; k <= rows; k++) box(CASE_D, .04, rz1 - rz0, wood, SW - CASE_D / 2, y0 + k * rowH, (rz0 + rz1) / 2, false);
    for (let z = rz0; z <= rz1 + .01; z += .93) box(CASE_D + .02, rows * rowH + .06, .06, wood, SW - (CASE_D + .02) / 2, y0 + (rows * rowH) / 2, z, false);
    for (let k = 0; k < rows; k++) for (let z = rz0; z < rz1 - .2; z += .93) fillRow(z + .05, Math.min(z + .88, rz1), y0 + k * rowH + .02, SW, 1, rowH, R2);
    // sur le haut des rayonnages : herbiers encadrés, bougies, piles de livres
    const flame = (x, y, z, k = 1) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); s.scale.set(.34 * k, .42 * k, 1); s.position.set(x, y, z); study.add(s); };
    const candle = (x, y, z, h = .16) => { cyl(.014, .016, h, candleMat, x, y + h / 2, z); flame(x, y + h + .035, z); };
    const herb = seed => canvasTex(128, 160, (g, w, h) => { g.fillStyle = "#e6dcc0"; g.fillRect(0, 0, w, h); const r = rnd(seed); g.strokeStyle = "#5a4a2a"; g.lineWidth = 2; g.beginPath(); g.moveTo(w / 2, h - 14); g.quadraticCurveTo(w / 2 + (r() - .5) * 30, h / 2, w / 2 + (r() - .5) * 20, 22); g.stroke();
      for (let i = 0; i < 9; i++) { const y = 30 + i * 12, d = i % 2 ? 1 : -1; g.fillStyle = ["#6b5a2e", "#7a4a2a", "#4f5a2e"][i % 3]; g.beginPath(); g.ellipse(w / 2 + d * (10 + r() * 8), y, 11, 4.5, d * .6, 0, 7); g.fill(); } });
    [[-1.9, 11], [-1.35, 17], [-.3, 23]].forEach(([x, seed], i) => { const f = new THREE.Group(), fr = new THREE.Mesh(unit, wood); fr.scale.set(.36, .44, .03); f.add(fr);
      const p = new THREE.Mesh(new THREE.PlaneGeometry(.3, .38), new THREE.MeshStandardMaterial({ map: herb(seed), roughness: .9 })); p.position.z = .017; f.add(p); f.position.set(x, top + .24, SZ1 + .16); f.rotation.x = -.14; f.rotation.y = (i - 1) * .08; study.add(f); });
    candle(-.85, top + .02, SZ1 + .18, .2); candle(-.72, top + .02, SZ1 + .2, .14); candle(1.55, top + .02, SZ1 + .18, .17);
    [[.4, 3], [.95, 4], [2.1, 3]].forEach(([x, n], j) => { for (let i = 0; i < n; i++) box(.34 - i * .02, .045, .24, new THREE.MeshStandardMaterial({ color: GENERIC[(j * 3 + i * 2) % GENERIC.length], roughness: .8 }), x + i * .01, top + .045 + i * .047, SZ1 + .17, false).rotation.y = (i - 1) * .12; });
    // le bureau
    const D = new THREE.Group(); D.position.set(DESK.x, SY, DESK.z); D.rotation.y = -.16; study.add(D); into = D;
    const topM = box(1.95, .05, .98, wood, 0, .785, 0); box(1.85, .03, .9, woodDark, 0, .75, 0, false);
    for (const s of [-1, 1]) { box(.56, .72, .86, wood, s * .64, .37, 0); for (let k = 0; k < 3; k++) { box(.46, .19, .02, woodDark, s * .64, .14 + k * .225, .44, false); const kn = new THREE.Mesh(new THREE.SphereGeometry(.016, 10, 8), brass); kn.position.set(s * .64, .14 + k * .225, .46); D.add(kn); } }
    box(.7, .12, .02, woodDark, 0, .68, .44, false); box(1.85, .5, .03, woodDark, 0, .5, -.42, false);
    // livre ouvert, piles, tasse, encrier
    const pageMat = new THREE.MeshStandardMaterial({ color: "#e9dfc4", roughness: .95, emissive: "#e9dfc4", emissiveIntensity: .12 });
    const ob = new THREE.Group(); for (const s of [-1, 1]) { const pg = new THREE.Mesh(unit, pageMat); pg.scale.set(.27, .03, .38); pg.position.set(s * .137, .02, 0); pg.rotation.z = s * -.09; pg.castShadow = true; ob.add(pg); }
    const cov = new THREE.Mesh(unit, new THREE.MeshStandardMaterial({ color: "#3a2415", roughness: .7 })); cov.scale.set(.6, .012, .41); cov.position.y = .004; ob.add(cov); ob.position.set(-.6, .81, .2); ob.rotation.y = .32; D.add(ob);
    sheet3d = new THREE.Mesh(new THREE.PlaneGeometry(PAPER.w, PAPER.h), new THREE.MeshStandardMaterial({ map: paperTex(), roughness: .95, emissive: "#efe6d0", emissiveIntensity: .14 })); sheet3d.rotation.x = -Math.PI / 2; sheet3d.position.set(.04, .8125, .07); sheet3d.receiveShadow = true; D.add(sheet3d);
    const pen = new THREE.Mesh(new THREE.CylinderGeometry(.006, .004, .17, 8), new THREE.MeshStandardMaterial({ color: "#1d1712", roughness: .4 })); pen.rotation.set(Math.PI / 2, 0, .35); pen.position.set(.27, .818, .2); D.add(pen);
    deskUp.applyAxisAngle(new THREE.Vector3(0, 1, 0), D.rotation.y);
    [["#4a1a1a", .3], ["#d8cba8", .28], ["#1b3629", .31]].forEach(([c, w], i) => { const b = box(w, .05, .22, new THREE.MeshStandardMaterial({ color: c, roughness: .8 }), -.7, .835 + i * .052, -.24); b.rotation.y = .3 - i * .22; });
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(.04, .028, .05, 18), porcelain); cup.position.set(.3, .84, .36); D.add(cup); const saucer = new THREE.Mesh(new THREE.CylinderGeometry(.07, .05, .012, 20), porcelain); saucer.position.set(.3, .817, .36); D.add(saucer);
    const tea = new THREE.Mesh(new THREE.CircleGeometry(.036, 18), new THREE.MeshStandardMaterial({ color: "#7a3d12", roughness: .2 })); tea.rotation.x = -Math.PI / 2; tea.position.set(.3, .862, .36); D.add(tea);
    // lampe de bureau en laiton, articulée
    const L = new THREE.Group(); L.position.set(.72, .81, -.18); D.add(L);
    const part = (geo, mat, x, y, z, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.z = rz; m.castShadow = true; L.add(m); return m; };
    part(new THREE.CylinderGeometry(.085, .1, .025, 24), brass, 0, .012, 0); part(new THREE.CylinderGeometry(.011, .011, .42, 10), brass, .06, .22, 0, -.3); part(new THREE.CylinderGeometry(.011, .011, .4, 10), brass, -.02, .5, 0, .85);
    const dome = part(new THREE.SphereGeometry(.12, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: "#b08a3e", roughness: .3, metalness: .9, side: THREE.DoubleSide, emissive: "#ff9d4a", emissiveIntensity: .25 }), -.2, .6, 0, .5);
    const bulb = part(new THREE.SphereGeometry(.035, 12, 10), new THREE.MeshBasicMaterial({ color: "#ffe2b0" }), -.2, .6, 0); bulb.castShadow = false;
    into = study;
    // bougies du bureau (positions dans le repère de la pièce)
    const onDesk = (dx, dz) => { const v = new THREE.Vector3(dx, 0, dz).applyAxisAngle(new THREE.Vector3(0, 1, 0), D.rotation.y); return [DESK.x + v.x, SY + .81, DESK.z + v.z]; };
    for (const [dx, dz, h] of [[-.28, -.3, .2], [-.18, -.34, .15], [.5, -.05, .22]]) { const [x, y, z] = onDesk(dx, dz); cyl(.03, .04, .02, brass, x, y + .01, z); candle(x, y + .02, z, h); }
    chair(-.95, DESK.z + 1.0, 2.55, SY);
    // lumières du cabinet : portée courte, pour ne pas déborder dans la grande salle
    const [lx, ly, lz] = onDesk(.5, -.18); const l1 = new THREE.PointLight("#ffb46c", 9, 4.4, 1.6); l1.position.set(lx, ly + .5, lz); scene.add(l1);
    const l2 = new THREE.PointLight("#ff9d55", 4, 3.8, 1.7); l2.position.set(-.6, SY + 1.5, SZ1 + .9); scene.add(l2);
    const mine = generic.splice(g0), inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: .75 }), mine.length), m4 = new THREE.Matrix4(), col = new THREE.Color();
    mine.forEach((b, i) => { m4.makeScale(b.sx, b.sy, b.sz).setPosition(b.x, b.y, b.z); inst.setMatrixAt(i, m4); inst.setColorAt(i, col.set(b.c).multiplyScalar(.7)); }); study.add(inst);
    into = scene;
  }

  { const geo = new THREE.BoxGeometry(1, 1, 1), mat = new THREE.MeshStandardMaterial({ roughness: .75 }), inst = new THREE.InstancedMesh(geo, mat, generic.length), m4 = new THREE.Matrix4(), col = new THREE.Color();
    generic.forEach((b, i) => { m4.makeScale(b.sx, b.sy, b.sz).setPosition(b.x, b.y, b.z); inst.setMatrixAt(i, m4); inst.setColorAt(i, col.set(b.c).multiplyScalar(b.y > H1 ? .36 : .56)); });
    inst.receiveShadow = true; scene.add(inst); }

  // Lumières
  scene.add(new THREE.HemisphereLight("#6b5240", "#2a1a10", .36));
  for (const sd of [-1, 1]) for (const z of [-2.95, -.75]) { const x = sd * (W / 2 - CASE_D - .06); cyl(.05, .035, .12, brass, x, 2.95, z); const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, opacity: .55 })); gl.scale.set(1.25, 1.55, 1); gl.position.set(x - sd * .08, 2.72, z); scene.add(gl); }   // appliques : flaques de lumière ; halo sans test de profondeur, pour ne pas trancher dans l'échelle
  const pl = (x, y, z, i, d = 9) => { const l = new THREE.PointLight("#ffb46c", i, d, 1.8); l.position.set(x, y, z); scene.add(l); return l; };
  pl(tx + .3, 1.28, tz - .28, 7); pl(1.55, y2 + .5, ZB + .8, 5, 7); pl(0, y2 + 1.5, ZB + .55, 11, 6);
  const key = new THREE.SpotLight("#ffd9a8", 40, 16, .8, .75, 1.4); key.position.set(.5, H - .3, 2.2); key.target.position.set(0, .4, -1.6); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -.0006; scene.add(key, key.target);
  const pic = new THREE.SpotLight("#ffd29a", 30, 7, .95, .7, 1.2); pic.position.set(0, H1 - .18, ZB + 1.75); pic.target.position.set(0, 1.55, ZB); pic.castShadow = true; pic.shadow.mapSize.set(1024, 1024); pic.shadow.bias = -.0012; pic.shadow.camera.near = .4; pic.shadow.camera.far = 6; scene.add(pic, pic.target); let picI = 30;
  box(1.4, .05, .1, brass, 0, H1 - .1, ZB + BAL_B - .1, false);
  const fill = new THREE.PointLight("#ffd2a0", 0, 4.5, 1.6); fill.position.set(0, -1.15, -.25); camera.add(fill); scene.add(camera);

  // ───────────── Tes livres ─────────────
  const user = new THREE.Group(); scene.add(user); let pickables = [], texLoader = new THREE.TextureLoader(); texLoader.setCrossOrigin("anonymous");
  const bayHit = new THREE.Mesh(new THREE.PlaneGeometry(BAY.x1 - BAY.x0, BAY.rows * BAY.rowH), new THREE.MeshBasicMaterial({ visible: false })); bayHit.position.set(0, BAY.y0 + BAY.rows * BAY.rowH / 2, ZB + CASE_D + .01); scene.add(bayHit);
  const rowY = k => BAY.y0 + k * BAY.rowH + .02, zFront = ZB + CASE_D - .03;
  function disposeUser() { user.traverse(o => { if (o.isMesh) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map && m.userData.own && !m.userData.keepMap) m.map.dispose(); if (m.userData.own) m.dispose(); }); } }); user.clear(); pickables = []; }
  const pagesMat = new THREE.MeshStandardMaterial({ map: canvasTex(64, 64, (g, w, h) => { g.fillStyle = "#e2d7ba"; g.fillRect(0, 0, w, h); g.fillStyle = "rgba(90,70,40,.35)"; for (let x = 1; x < w; x += 3) g.fillRect(x, 0, 1, h); }), roughness: .95 });
  function bookMesh(w, h, d, faceTex, color, faceOut) {
    const side = new THREE.MeshStandardMaterial({ color, roughness: .85 }); side.userData.own = true;
    const face = new THREE.MeshStandardMaterial({ map: faceTex, roughness: .85, emissive: "#ffffff", emissiveMap: faceTex, emissiveIntensity: .28 }); face.userData.own = true;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), faceOut ? [pagesMat, side, pagesMat, pagesMat, face, side] : [side, side, paper, side, face, side]); m.castShadow = m.receiveShadow = true; return m;
  }
  function dress(m, b, ratio) {
    if (!b.cover_url) return;
    loadCover(b.cover_url).then(cv => {
      if (!cv || m.parent !== user) return; const u = m.userData, mats = m.material.slice(), side = mats[1];
      side.color.set(cv.color); u.color = cv.color; u.cover = cv.tex;
      const pic = new THREE.MeshStandardMaterial({ map: cv.tex, roughness: .8, emissive: "#ffffff", emissiveMap: cv.tex, emissiveIntensity: .22 }); pic.userData = { own: true, keepMap: true };
      if (u.kind === "face") { mats[4].map.dispose(); mats[4].dispose(); mats[4] = pic; }
      else { const t = spineTex(b, cv.color, u.kind === "flat", ratio, cv.ink, cv.accent); mats[4].map.dispose(); mats[4].map = mats[4].emissiveMap = t; mats[4].needsUpdate = true; if (u.kind === "spine") mats[0] = pic; }
      m.material = mats; invalidate();
    });
  }
  function setBooks(books) {
    disposeUser();
    const inner0 = BAY.x0 + .06, inner1 = BAY.x1 - .06, cur = books.filter(b => b.status === "en_cours"), done = books.filter(b => b.status === "fini"), dropped = books.filter(b => b.status === "abandonne");
    const color = b => LEATHERS[hash(b.title) % LEATHERS.length];
    // en cours : de face, à hauteur d'yeux (rangée 2)
    let x = inner0 + .04;
    cur.slice(0, 6).forEach(b => {
      const w = .3, h = .44, dd = Math.max(.03, Math.min(.075, (b.total_pages || 260) * .00012)), m = bookMesh(w, h, dd, coverTex(b, color(b)), color(b), true); m.position.set(x + w / 2, rowY(2) + h / 2 + .012, zFront - .1); m.rotation.x = -.14; m.userData = { id: b.id, home: m.position.clone(), rx: -.14, kind: "face", w, h, d: dd, book: b, color: color(b) }; user.add(m); pickables.push(m);
      dress(m, b);
      const lab = new THREE.Mesh(new THREE.PlaneGeometry(.3, .047), new THREE.MeshBasicMaterial({ map: b.total_pages ? progressTex(b.current_page / b.total_pages) : labelTex(`p. ${b.current_page}`), transparent: true })); lab.material.userData.own = true;
      lab.position.set(x + w / 2, rowY(2) - .02, ZB + CASE_D + .002); user.add(lab); x += w + .09;
    });
    // abandonnés : couchés en pile au bout de la même rangée
    let py = rowY(2); const px = inner1 - .24;
    if (x < px - .24) dropped.slice(0, 8).forEach(b => { const t = Math.max(.05, Math.min(.11, (b.total_pages || 260) * .00013)), m = bookMesh(.42, t, .27, spineTex(b, color(b), true, t / .42), color(b));
      m.position.set(px + ((hash(b.title) % 5) - 2) * .008, py + t / 2, zFront - .14); m.userData = { id: b.id, home: m.position.clone(), rx: 0, kind: "flat" }; user.add(m); pickables.push(m); dress(m, b, t / .42); py += t + .002; });
    // finis : sur la tranche, rangées 3, 1, 4, 0
    const order = [3, 1, 4, 0]; let ri = 0; x = inner0;
    done.forEach(b => { const t = Math.max(.055, Math.min(.12, (b.total_pages || 260) * .00014)), h = .37 + (hash(b.title) % 9) * .011;
      if (x + t > inner1) { ri++; x = inner0; } if (ri >= order.length) return;
      const m = bookMesh(t, h, .27, spineTex(b, color(b), false, t / h), color(b)); m.position.set(x + t / 2, rowY(order[ri]) + h / 2, zFront - .135 - (hash(b.title + "z") % 6) * .005); m.userData = { id: b.id, home: m.position.clone(), rx: 0, kind: "spine", w: t, h, d: .27, book: b, color: color(b) }; user.add(m); pickables.push(m); dress(m, b, t / h); x += t + .004; });
    // cadrage : centré sur les rangées occupées, plus près quand il y en a peu
    const used = [...new Set([...(cur.length || dropped.length ? [2] : []), ...order.slice(0, done.length ? ri + 1 : 0)])]; if (!used.length) used.push(2);
    const lo = Math.min(...used), hi = Math.max(...used); shelfY = (rowY(lo) + rowY(hi) + BAY.rowH) / 2 - .04; SHELF_DIST = hi - lo + 1 <= 2 ? .86 : hi - lo + 1 === 3 ? 1.15 : 1.45;
    // on arrive devant les livres en cours (sinon devant le début des rangées), pas au milieu du meuble
    const xs = pickables.filter(m => m.userData.kind === (cur.length ? "face" : "spine")).map(m => m.position.x); focusX = xs.length ? THREE.MathUtils.clamp(cur.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : Math.min(...xs) + .3, BAY.x0 + .4, BAY.x1 - .4) : 0;
    if (state === "shelf") { shelf.y = shelfY; goTo(shelfView(), 900); }
    invalidate();
  }

  // ───────────── Caméra ─────────────
  const VIEWS = { room: { p: [0, 2.0, 5.0], t: [0, 2.85, ZB] }, ceiling: { p: [0, H - 1.25, .55], t: [0, H, .2] }, study: { p: [-.95, SY + 2.15, -5.45], t: [.3, SY + .7, -7.3] } };
  let lift = 0;   // 0 → 1 à l'approche de la feuille : la caméra bascule à la verticale du bureau
  let state = "room", shelf = { x: 0, y: 1.75 }, yaw = 0, pull = 0, focusX = BAY.x0 + .6;
  const cam = { p: new THREE.Vector3(...VIEWS.room.p), t: new THREE.Vector3(...VIEWS.room.t) }, from = { p: cam.p.clone(), t: cam.t.clone() }, goal = { p: cam.p.clone(), t: cam.t.clone() };
  let tw = null; const tweens = new Set();
  let SHELF_DIST = 1.2, shelfY = 1.75; const shelfView = () => ({ p: [shelf.x, shelf.y, ZB + CASE_D + SHELF_DIST], t: [shelf.x, shelf.y - .02, ZB] });
  // Les pièces annexes : on y entre par la porte de la mezzanine, la caméra finit à la verticale d'une feuille.
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const rooms = {
    study: { group: study, sheet: sheet3d, up: deskUp, ms: [3000, 2600],
      P: pw => [V3(0, SY + 1.45, -1.9), V3(0, SY + 1.35, ZB - .5), V3(pw.x * .5, SY + 1.7, pw.z + 1.25)],
      T: pw => [V3(0, SY + 1.25, ZB - 1.5), V3(pw.x * .6, SY + 1.0, pw.z + .2), pw.clone()] },
    journal: { group: journal, sheet: journalPage, up: journalUp, keep: true, alt: .43, ms: [1900, 1700],
      P: pw => [V3(pw.x * .55, 1.75, pw.z + 1.9)],
      T: pw => [pw.clone()] },
  };
  function paperWorld(name) { const r = rooms[name]; r.group.updateMatrixWorld(true); return r.sheet.getWorldPosition(new THREE.Vector3()); }
  function goRoom(name, entering) {
    const r = rooms[name], pw = paperWorld(name), above = pw.clone(); above.y += r.alt || .56;
    const P = [V3(...VIEWS.room.p), ...r.P(pw), above], T = [V3(...VIEWS.room.t), ...r.T(pw), pw.clone()];
    if (entering) { P[0] = cam.p.clone(); T[0] = cam.t.clone(); } else { P.reverse(); T.reverse(); }
    tw = { t0: performance.now(), ms: r.ms[entering ? 0 : 1], smooth: true, entering, room: name, cp: new THREE.CatmullRomCurve3(P, false, "centripetal"), ct: new THREE.CatmullRomCurve3(T, false, "centripetal") }; invalidate();
  }
  function goTo(v, ms = 1100, smooth = false) { from.p.copy(cam.p); from.t.copy(cam.t); goal.p.set(...v.p); goal.t.set(...v.t); tw = { t0: performance.now(), ms, smooth }; invalidate(); }
  function setState(s, opt = {}) {
    if (s === "shelf") { shelf.x = THREE.MathUtils.clamp(opt.x ?? focusX, BAY.x0 + .4, BAY.x1 - .4); shelf.y = shelfY; }
    const entering = !!rooms[s], roomName = entering ? s : rooms[state] ? state : null; if (entering) rooms[s].group.visible = true;
    if (s === "ceiling" && state === "room") { const p = new THREE.Vector3(), t = new THREE.Vector3(); tilted(p, t); cam.p.copy(p); cam.t.copy(t); }
    state = s; yaw = 0; pull = 0; if (roomName) goRoom(roomName, entering); else goTo(s === "shelf" ? shelfView() : VIEWS[s], s === "shelf" ? 1300 : s === "ceiling" ? 1400 : 1200, s === "ceiling" || state === "ceiling"); cb.onState?.(s);
  }
  // Pendant le geste, la caméra glisse déjà sur le chemin qui mène au ciel (pull ∈ [0, 1] → 45 % du trajet)
  const tilted = (p, t) => { const e = ease(Math.min(1, pull)) * .45; p.copy(cam.p).lerp(new THREE.Vector3(...VIEWS.ceiling.p), e); t.copy(cam.t).lerp(new THREE.Vector3(...VIEWS.ceiling.t), e); t.x += yaw * 7; p.x += yaw * 1.2; };
  function applyCamera() {
    camera.position.copy(cam.p); const t = cam.t.clone();
    if (state === "room") tilted(camera.position, t);
    const rm = rooms[state] || (tw && rooms[tw.room]); if (lift > .001 && rm) camera.up.set(0, 1, 0).lerp(rm.up, io(lift)).normalize(); else camera.up.set(0, 1, 0);   // à la verticale de la feuille, le « haut » de l'image suit le bureau
    camera.lookAt(t); fill.intensity = state === "shelf" ? 2.6 : 0; picI += ((state === "shelf" ? 10 : 30) - picI) * .08; pic.intensity = picI;
  }
  // Finitions d'image : l'image précédente est mêlée à la nouvelle quand la caméra bouge (flou de mouvement), puis un vignettage discret.
  // Si le téléphone ne sait pas dessiner dans une texture flottante, on garde le rendu direct.
  let post = null;
  try {
    const okFloat = renderer.capabilities.isWebGL2 && (renderer.extensions.has("EXT_color_buffer_half_float") || renderer.extensions.has("EXT_color_buffer_float"));
    if (okFloat && !new URLSearchParams(location.search).has("nopost")) {
      const mk = samples => new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples, depthBuffer: samples > 0 });
      const rtScene = mk(4), acc = [mk(0), mk(0)], qScene = new THREE.Scene(), qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const mat = new THREE.ShaderMaterial({ depthTest: false, depthWrite: false, uniforms: { tNew: { value: null }, tOld: { value: null }, uBlend: { value: 0 }, uVig: { value: 0 } },
        vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }",
        fragmentShader: "uniform sampler2D tNew; uniform sampler2D tOld; uniform float uBlend; uniform float uVig; varying vec2 vUv;\nvoid main() {\n  vec4 c = mix(texture2D(tNew, vUv), texture2D(tOld, vUv), uBlend);\n  float d = length((vUv - .5) * vec2(1., 1.2));\n  c.rgb *= 1. - uVig * smoothstep(.38, .98, d);\n  gl_FragColor = vec4(c.rgb, 1.);\n  #include <tonemapping_fragment>\n  #include <colorspace_fragment>\n}" });
      qScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
      let cur = 0, primed = false;
      post = { size(w, h) { rtScene.setSize(w, h); acc[0].setSize(w, h); acc[1].setSize(w, h); primed = false; },
        render(blend) {
          renderer.setRenderTarget(rtScene); renderer.render(scene, camera);
          mat.uniforms.tNew.value = rtScene.texture; mat.uniforms.tOld.value = acc[cur].texture; mat.uniforms.uBlend.value = primed ? blend : 0; mat.uniforms.uVig.value = 0;
          renderer.setRenderTarget(acc[1 - cur]); renderer.render(qScene, qCam); cur = 1 - cur; primed = true;
          mat.uniforms.tNew.value = acc[cur].texture; mat.uniforms.uBlend.value = 0; mat.uniforms.uVig.value = .42;
          renderer.setRenderTarget(null); renderer.render(qScene, qCam);
        } };
    }
  } catch (err) { console.warn("Finitions d'image indisponibles :", err); post = null; }

  const lastCam = { p: new THREE.Vector3(), q: new THREE.Quaternion(), ok: false };

  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h;
    if (post) { const b = renderer.getDrawingBufferSize(new THREE.Vector2()); post.size(b.x, b.y); }
    camera.fov = THREE.MathUtils.clamp(2 * THREE.MathUtils.radToDeg(Math.atan(.43 / camera.aspect)), 42, 84); camera.updateProjectionMatrix(); invalidate();
  }

  // ───────────── Boucle à la demande ─────────────
  let raf = 0, dragging = false, alive = true;
  function invalidate() { if (!raf && alive) raf = requestAnimationFrame(frame); }
  function frame(now) {
    raf = 0; let busy = dragging;
    if (tw) { const k = Math.min(1, (now - tw.t0) / tw.ms), e = tw.smooth ? io(k) : ease(k); if (tw.cp) { tw.cp.getPoint(e, cam.p); tw.ct.getPoint(e, cam.t); const n = tw.entering ? e : 1 - e; lift = seg(n, .72, 1); if (tw.room === "study") door.material.opacity = 1 - seg(n, .12, .4); } else { cam.p.lerpVectors(from.p, goal.p, e); cam.t.lerpVectors(from.t, goal.t, e); }
      if (state === "ceiling" && !tw.cp && !tw.said && k >= .62) { tw.said = true; cb.onArrive?.("ceiling"); }
      if (k >= 1) { const arrived = tw.cp ? tw.entering : false; tw = null; for (const [n, r] of Object.entries(rooms)) if (state !== n && !r.keep) r.group.visible = false; if (arrived) { applyCamera(); cb.onArrive?.(state); } } else busy = true; }
    for (const a of tweens) { const k = Math.min(1, (now - a.t0) / a.ms); a.step(a.linear ? k : ease(k)); if (k >= 1) { tweens.delete(a); a.done?.(); } else busy = true; }
    if (!dragging && state === "room" && (Math.abs(yaw) > .001 || pull > .001)) { yaw *= .86; pull *= .82; cb.onPull?.(pull); busy = true; }
    // Signaux discrets dans la vue d'ensemble, à cadence réduite : la porte respire, un reflet passe sur le journal
    if (state === "room" && !document.hidden) {
      const s1 = .5 + .5 * Math.sin(now / 900); door.material.color.setRGB(.82 + .18 * s1, .78 + .2 * s1, .72 + .24 * s1); doorGlow.material.opacity = .5 + .4 * s1; doorGlow.scale.set(2.1 + .6 * s1, 3.1 + .6 * s1, 1);
      const c = (now % 4200) / 4200, g = c < .3 ? Math.sin(c / .3 * Math.PI) : 0; glint.material.opacity = g * .75; glint.position.set(JP.w / 2 + .006 - .1 + .2 * (c / .3), .06, JP.h * .3 - JP.h * .6 * (c / .3));
      if (!busy) setTimeout(invalidate, 50);
    } else { doorGlow.material.opacity = 0; glint.material.opacity = 0; }
    applyCamera();
    if (post) { let blend = 0; if (lastCam.ok) { const v = camera.position.distanceTo(lastCam.p) * 3.2 + camera.quaternion.angleTo(lastCam.q) * 5.5; blend = Math.min(.4, Math.max(0, v - .015) * 2.0); if (tweens.size) blend = Math.max(blend, .14); }
      lastCam.p.copy(camera.position); lastCam.q.copy(camera.quaternion); lastCam.ok = true;
      try { post.render(blend); if (blend > .02) busy = true; } catch (err) { console.warn(err); post = null; renderer.setRenderTarget(null); renderer.render(scene, camera); } }
    else renderer.render(scene, camera);
    if (busy) invalidate();
  }

  // ───────────── Gestes ─────────────
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let down = null, armed = false, held = null;
  const pick = (e, list) => { const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.intersectObjects(list, false)[0]; };
  const tween = (ms, step, done) => { tweens.add({ t0: performance.now(), ms, step, done }); invalidate(); };
  let pressed = null; const unpress = () => { if (!pressed) return; const m = pressed, z0 = m.position.z; pressed = null; if (m !== held) tween(180, e => { m.position.z = z0 + (m.userData.home.z - z0) * e; }); };
  canvas.addEventListener("pointerdown", e => { if (state === "ceiling" || rooms[state] || held) return;
    if (state === "shelf") { const h = pick(e, pickables); if (h && h.object.userData.kind !== "flat") { pressed = h.object; const m = pressed, z0 = m.position.z; tween(140, k => { if (pressed === m) m.position.z = z0 + (m.userData.home.z + .04 - z0) * k; }); } }
    down = { x: e.clientX, y: e.clientY, t: performance.now(), sx: shelf.x, sy: shelf.y, moved: false, axis: null }; armed = false; canvas.setPointerCapture?.(e.pointerId); });
  canvas.addEventListener("pointermove", e => {
    if (!down) return; const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (!down.moved && Math.hypot(dx, dy) < 8) return; down.moved = true; dragging = true; unpress(); tw = state === "shelf" ? null : tw;
    if (state === "room") {
      down.axis ??= Math.abs(dy) > Math.abs(dx) ? "pull" : "look";
      if (down.axis === "pull") { pull = Math.abs(dy) / 300; const a = pull > .42; if (a !== armed) { armed = a; cb.haptic?.(); } cb.onPull?.(pull); }
      else yaw = THREE.MathUtils.clamp(-dx / 900, -.22, .22);
    } else if (state === "shelf") {
      const k = (2 * SHELF_DIST * .43) / (canvas.clientWidth || innerWidth); shelf.x = THREE.MathUtils.clamp(down.sx - dx * k, BAY.x0 + .45, BAY.x1 - .45); shelf.y = THREE.MathUtils.clamp(down.sy + dy * k, .9, 2.8);
      const v = shelfView(); cam.p.set(...v.p); cam.t.set(...v.t);
    }
    invalidate();
  });
  const up = e => {
    if (!down) return; const d = down; down = null; dragging = false;
    if (!d.moved && performance.now() - d.t < 500) {
      const hit = pick(e, pickables);
      if (state === "room") { const h = hit || pick(e, [doorHit, journalHit, bayHit]); if (h) { cb.haptic?.(); if (h.object === doorHit) cb.onDoor?.(); else if (h.object === journalHit) cb.onJournal?.(); else setState("shelf"); } }
      else if (state === "shelf" && hit) { pressed = null; pullOut(hit.object); }
    } else if (state === "room" && d.axis === "pull" && armed) { cb.onCeiling?.(); }
    unpress(); invalidate();
  };
  canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", () => { down = null; dragging = false; invalidate(); });
  // Prendre un livre : un seul geste continu. Il glisse hors du rayon sur une courbe, pivote pendant qu'il approche,
  // et la couverture commence à s'ouvrir avant qu'il soit arrivé, pour qu'aucune étape ne marque d'arrêt.
  const io = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2, seg = (k, a, b) => Math.min(1, Math.max(0, (k - a) / (b - a)));
  const timeline = (ms, step, done) => { tweens.add({ t0: performance.now(), ms, linear: true, step, done }); invalidate(); };
  const bez = (out, a, b, c, t) => out.set(0, 0, 0).addScaledVector(a, (1 - t) * (1 - t)).addScaledVector(b, 2 * (1 - t) * t).addScaledVector(c, t * t);
  function pullOut(m) {
    held = m; cb.haptic?.(); const u = m.userData, home = m.position.clone();   // il part de là où le doigt l'a déjà avancé
    if (u.kind === "flat") return timeline(520, k => { const e = io(k); m.position.z = home.z + .3 * e; m.position.y = home.y + .03 * e; }, () => cb.onOpenBook?.(u.id));
    const spine = u.kind === "spine", coverW = spine ? u.d : u.w, ry1 = spine ? -Math.PI / 2 : 0;
    const dir = new THREE.Vector3(); camera.getWorldDirection(dir); const end = camera.position.clone().addScaledVector(dir, .86); end.x += coverW * .5;
    const mid = home.clone(); mid.z += .55; mid.y += .06; mid.x += (end.x - home.x) * .25;
    // la couverture articulée et la page de titre sont prêtes dès le départ : aucun à-coup en cours de route
    const outerMap = u.cover || (spine ? coverTex(u.book, u.color) : m.material[4].map);
    const outer = new THREE.MeshStandardMaterial({ map: outerMap, roughness: .85, emissive: "#ffffff", emissiveMap: outerMap, emissiveIntensity: .25 });
    const inner = new THREE.MeshStandardMaterial({ color: "#e9dfc4", roughness: .95, emissive: "#e9dfc4", emissiveIntensity: .35 });
    const first = new THREE.MeshStandardMaterial({ map: titlePageTex(u.book), roughness: .95, emissive: "#ffffff", emissiveIntensity: .3 }); first.emissiveMap = first.map;
    const hinge = new THREE.Group(), lid = new THREE.Mesh(spine ? new THREE.BoxGeometry(.006, u.h, u.d) : new THREE.BoxGeometry(u.w, u.h, .006), spine ? [outer, inner, inner, inner, inner, inner] : [inner, inner, inner, inner, outer, inner]);
    if (spine) { hinge.position.set(u.w / 2 + .004, 0, u.d / 2); lid.position.set(0, 0, -u.d / 2); } else { hinge.position.set(-u.w / 2, 0, u.d / 2 + .004); lid.position.set(u.w / 2, 0, 0); }
    hinge.add(lid); hinge.visible = false; m.add(hinge); Object.assign(u, { hinge, firstMat: first, faceMat: m.material[spine ? 0 : 4], ownOuter: outerMap !== u.cover && spine ? outerMap : null });
    let opened = false;
    timeline(1650, k => {
      bez(m.position, home, mid, end, io(seg(k, 0, .78)));
      m.rotation.x = u.rx * (1 - io(seg(k, 0, .35))); m.rotation.y = ry1 * io(seg(k, .12, .72)); m.rotation.z = Math.sin(seg(k, .05, .8) * Math.PI) * -.05;
      const o = seg(k, .5, 1);
      if (o > 0 && !opened) { opened = true; hinge.visible = true; const mats = m.material.slice(); mats[spine ? 0 : 4] = first; m.material = mats; cb.haptic?.(); }
      const a = io(o); hinge.rotation.y = -2.75 * (a + .035 * Math.sin(a * Math.PI));
    }, () => cb.onOpenBook?.(u.id));
  }
  function releaseBook() {
    if (!held) return; const m = held, u = m.userData, p0 = m.position.clone(), ry0 = m.rotation.y, h0 = u.hinge ? u.hinge.rotation.y : 0, home = u.home; held = null;
    const mid = home.clone(); mid.z += .55; mid.y += .06; mid.x += (p0.x - home.x) * .25; let closed = !u.hinge;
    timeline(u.hinge ? 1150 : 520, k => {
      if (u.hinge) { u.hinge.rotation.y = h0 * (1 - io(seg(k, 0, .5)));
        if (!closed && k >= .5) { closed = true; const spine = u.kind === "spine", mats = m.material.slice(); mats[spine ? 0 : 4] = u.faceMat; m.material = mats; m.remove(u.hinge); u.hinge.children[0].geometry.dispose(); u.hinge = null; u.firstMat.map.dispose(); u.firstMat.dispose(); u.ownOuter?.dispose(); } }
      bez(m.position, p0, mid, home, io(seg(k, u.kind === "flat" ? 0 : .22, 1))); m.rotation.y = ry0 * (1 - io(seg(k, .25, .85))); m.rotation.x = u.rx * io(seg(k, .6, 1)); m.rotation.z = Math.sin(seg(k, .2, 1) * Math.PI) * .04;
    });
  }

  function paperRect(name = state) {
    const rm = rooms[name]; if (!rm) return null; const PW = rm.sheet.geometry.parameters.width, PH = rm.sheet.geometry.parameters.height; applyCamera(); camera.updateMatrixWorld(true); rm.group.updateMatrixWorld(true); const r = canvas.getBoundingClientRect(), xs = [], ys = [];
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const v = rm.sheet.localToWorld(new THREE.Vector3(a * PW / 2, b * PH / 2, 0)).project(camera); xs.push(r.left + (v.x + 1) / 2 * r.width); ys.push(r.top + (1 - v.y) / 2 * r.height); }
    return { left: Math.min(...xs), top: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
  }
  addEventListener("resize", resize); resize();
  cam.p.set(0, 2.7, 8.6); cam.t.set(0, 3.5, ZB); goTo(VIEWS.room, 2600, true);
  return { setBooks, setState, releaseBook, invalidate, paperRect, get state() { return state; }, dispose() { alive = false; cancelAnimationFrame(raf); removeEventListener("resize", resize); renderer.dispose(); } };
}
