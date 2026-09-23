import * as THREE from "three";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeNoise(seed: number) {
  const rnd = mulberry32(seed);
  const grid = new Float32Array(256);
  for (let i = 0; i < 256; i++) grid[i] = rnd();
  const hash = (ix: number, iy: number) => grid[(ix * 17 + iy * 47) & 255]!;
  return (x: number, y: number) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const tx = x - x0;
    const ty = y - y0;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const a = hash(x0, y0);
    const b = hash(x0 + 1, y0);
    const c = hash(x0, y0 + 1);
    const d = hash(x0 + 1, y0 + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

function fbm(n: (x: number, y: number) => number, x: number, y: number) {
  let f = 0;
  let a = 0.55;
  let s = 1;
  for (let i = 0; i < 4; i++) {
    f += a * n(x * s, y * s);
    a *= 0.5;
    s *= 2.05;
  }
  return f;
}

function canvasTex(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void, repeat = true) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("no 2d");
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.anisotropy = 4;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function fillNoise(
  ctx: CanvasRenderingContext2D,
  size: number,
  paint: (x: number, y: number, n: number) => [number, number, number],
  seed: number,
) {
  const noise = makeNoise(seed);
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm(noise, x / 32, y / 32);
      const [r, g, b] = paint(x, y, n);
      const i = (y * size + x) * 4;
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function shade(hex: string, n: number, amt: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const k = (n - 0.5) * amt;
  return [
    Math.max(0, Math.min(255, r + k)),
    Math.max(0, Math.min(255, g + k)),
    Math.max(0, Math.min(255, b + k)),
  ] as [number, number, number];
}

function concrete(seed: number, base: string, grout: string) {
  return canvasTex(256, (ctx, s) => {
    fillNoise(ctx, s, (x, y, n) => {
      const gx = x % 64 < 3 || y % 64 < 3;
      if (gx) return shade(grout, n, 30);
      const crack = Math.abs((x * 0.37 + y * 0.15) % 47 - 2) < 0.7 && n > 0.55;
      if (crack) return shade("#3a342c", n, 20);
      return shade(base, n, 46);
    }, seed);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#2a241c";
    ctx.beginPath();
    ctx.ellipse(180, 200, 36, 18, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });
}

function cafeTiles() {
  return canvasTex(256, (ctx, s) => {
    fillNoise(ctx, s, (x, y, n) => {
      const gx = x % 32 < 2 || y % 32 < 2;
      if (gx) return shade("#7a6a58", n, 20);
      const chip = (x % 32 > 26 && y % 32 > 26 && n > 0.62);
      if (chip) return shade("#8d7b68", n, 20);
      return shade("#e4d8c8", n, 28);
    }, 9);
  });
}

function asphalt() {
  const size = 512;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("no 2d");
  ctx.fillStyle = "#3e4246";
  ctx.fillRect(0, 0, size, size);
  const rnd = mulberry32(4);
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < size * size; i++) {
    const n = (rnd() - 0.5) * 18;
    d[i * 4] = Math.max(0, Math.min(255, 62 + n));
    d[i * 4 + 1] = Math.max(0, Math.min(255, 64 + n));
    d[i * 4 + 2] = Math.max(0, Math.min(255, 66 + n * 0.8));
  }
  ctx.putImageData(img, 0, 0);
  for (let i = 0; i < 4200; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = rnd();
    const g = r > 0.82 ? 150 + rnd() * 40 : r < 0.18 ? 28 + rnd() * 16 : 78 + rnd() * 36;
    ctx.fillStyle = `rgba(${g},${g},${g - 4},${0.35 + rnd() * 0.5})`;
    ctx.fillRect(x, y, 1 + rnd() * 2.4, 1 + rnd() * 1.6);
  }
  ctx.strokeStyle = "rgba(18,18,18,0.55)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(40, 180);
  ctx.bezierCurveTo(140, 200, 220, 120, 340, 210);
  ctx.bezierCurveTo(420, 260, 470, 190, 510, 230);
  ctx.moveTo(80, 420);
  ctx.bezierCurveTo(180, 390, 260, 460, 400, 410);
  ctx.stroke();
  ctx.strokeStyle = "rgba(24,24,24,0.35)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 256);
  ctx.lineTo(512, 258);
  ctx.stroke();
  const oil = ctx.createRadialGradient(360, 120, 4, 360, 120, 70);
  oil.addColorStop(0, "rgba(20,22,24,0.45)");
  oil.addColorStop(1, "rgba(20,22,24,0)");
  ctx.fillStyle = oil;
  ctx.fillRect(280, 40, 160, 160);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function irishBrick(seed: number, soot: number) {
  const size = 512;
  const brickW = 64;
  const brickH = 32;
  const mortar = 4;
  return canvasTex(size, (ctx, s) => {
    const noise = makeNoise(seed + 9);
    const img = ctx.createImageData(s, s);
    const d = img.data;
    const clamp = (n: number) => Math.max(0, Math.min(255, n));
    for (let y = 0; y < s; y++) {
      const row = Math.floor(y / brickH);
      const ly = y % brickH;
      const off = (row % 2) * (brickW / 2);
      for (let x = 0; x < s; x++) {
        const xx = (x + off) % brickW;
        const col = Math.floor((x + off) / brickW) + row * 3;
        const h = mulberry32((seed * 131 + row * 97 + col * 17) >>> 0)();
        const n = noise(x / 48, y / 48);
        const i = (y * s + x) * 4;
        const joint = xx < mortar || ly < mortar;
        if (joint) {
          const moss = n > 0.88 && row % 6 === 2;
          const grit = (n - 0.5) * 10;
          d[i] = moss ? 78 : clamp(150 + grit);
          d[i + 1] = moss ? 88 : clamp(136 + grit);
          d[i + 2] = moss ? 62 : clamp(118 + grit);
        } else {
          let r = 158 + h * 42;
          let g = 54 + h * 24;
          let b = 42 + h * 14;
          if (h > 0.92) {
            r = 92;
            g = 40;
            b = 32;
          } else if (h < 0.07) {
            r = 196;
            g = 112;
            b = 90;
          } else if (h > 0.8 && h < 0.86) {
            r = 124;
            g = 52;
            b = 42;
          }
          r += (n - 0.5) * 12;
          g += (n - 0.5) * 8;
          b += (n - 0.5) * 6;
          const chip = xx - mortar < 4 && ly - mortar < 4 && h > 0.7;
          if (chip) {
            r = 176;
            g = 148;
            b = 128;
          }
          if (n > 0.84) {
            const k = soot * (n - 0.84) * 2.2;
            r *= 1 - k;
            g *= 1 - k * 0.85;
            b *= 1 - k * 0.7;
          }
          d[i] = clamp(r);
          d[i + 1] = clamp(g);
          d[i + 2] = clamp(b);
        }
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = "#2a1612";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, 210);
    ctx.bezierCurveTo(140, 230, 280, 160, 512, 198);
    ctx.moveTo(20, 400);
    ctx.bezierCurveTo(180, 370, 320, 440, 500, 410);
    ctx.stroke();
    ctx.globalAlpha = 1;
  });
}

function prisonFloor(seed: number) {
  const size = 512;
  const tile = 64;
  const grout = 4;
  return canvasTex(size, (ctx, s) => {
    const noise = makeNoise(seed + 4);
    const img = ctx.createImageData(s, s);
    const d = img.data;
    const clamp = (n: number) => Math.max(0, Math.min(255, n));
    const faces = [
      [186, 178, 164],
      [168, 160, 146],
      [198, 190, 174],
      [154, 146, 132],
      [176, 166, 148],
      [142, 134, 122],
    ];
    for (let y = 0; y < s; y++) {
      const row = Math.floor(y / tile);
      const ly = y % tile;
      for (let x = 0; x < s; x++) {
        const col = Math.floor(x / tile);
        const lx = x % tile;
        const h = mulberry32((seed * 91 + row * 53 + col * 29) >>> 0)();
        const n = noise(x / 36, y / 36);
        const i = (y * s + x) * 4;
        const joint = lx < grout || ly < grout;
        if (joint) {
          const g = 78 + (n - 0.5) * 18;
          d[i] = clamp(g + 8);
          d[i + 1] = clamp(g + 4);
          d[i + 2] = clamp(g);
        } else {
          const face = faces[Math.floor(h * faces.length) % faces.length]!;
          let r = face[0] + (n - 0.5) * 22 + (h - 0.5) * 10;
          let g = face[1] + (n - 0.5) * 18 + (h - 0.5) * 8;
          let b = face[2] + (n - 0.5) * 14;
          const cx = lx - tile / 2;
          const cy = ly - tile / 2;
          if (h > 0.86 && cx * cx + cy * cy < 180) {
            r *= 0.72;
            g *= 0.7;
            b *= 0.62;
          } else if (h > 0.72 && Math.abs(cy - 6) < 2 && lx > 10 && lx < 52) {
            r *= 0.8;
            g *= 0.78;
            b *= 0.74;
          }
          if (h > 0.58 && lx > tile - 10 && ly > tile - 10) {
            r = 120;
            g = 112;
            b = 100;
          }
          if (h < 0.06) {
            r = 128;
            g = 118;
            b = 96;
          }
          d[i] = clamp(r);
          d[i + 1] = clamp(g);
          d[i + 2] = clamp(b);
        }
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
}

function cinder(seed: number, mortar: string, block: string) {
  return canvasTex(256, (ctx, s) => {
    fillNoise(ctx, s, (x, y, n) => {
      const row = Math.floor(y / 32);
      const off = row % 2 === 0 ? 0 : 24;
      const bx = (x + off) % 48 < 3;
      const by = y % 32 < 3;
      if (bx || by) return shade(mortar, n, 24);
      const peel = n > 0.78 && x % 48 > 10;
      if (peel) return shade("#8d7358", n, 30);
      return shade(block, n, 36);
    }, seed);
  });
}

function rustMetal() {
  return canvasTex(128, (ctx, s) => {
    fillNoise(ctx, s, (_x, _y, n) => {
      if (n > 0.72) return shade("#8a3e24", n, 40);
      if (n < 0.28) return shade("#3e4248", n, 20);
      return shade("#6d7278", n, 36);
    }, 12);
  });
}

function paintedMetal() {
  return canvasTex(128, (ctx, s) => {
    fillNoise(ctx, s, (x, y, n) => {
      const scratch = Math.abs((x + y * 0.2) % 19) < 0.4;
      if (scratch) return shade("#9aa0a6", n, 10);
      return shade("#c5c8cc", n, 30);
    }, 15);
  });
}

function wood() {
  return canvasTex(128, (ctx, s) => {
    fillNoise(ctx, s, (x, y, n) => {
      const grain = Math.sin(y * 0.45 + n * 3) > 0.4;
      const knot = (x - 80) ** 2 / 40 + (y - 60) ** 2 / 20 < 18;
      if (knot) return shade("#4a2e18", n, 20);
      return shade(grain ? "#7a4e2c" : "#9a6840", n, 30);
    }, 21);
  });
}

function planks() {
  return canvasTex(256, (ctx, s) => {
    fillNoise(ctx, s, (x, y, n) => {
      const seam = y % 28 < 2;
      if (seam) return shade("#3a2818", n, 10);
      const grain = Math.sin(x * 0.5 + n * 4) > 0.35;
      return shade(grain ? "#6b4428" : "#8a5d38", n, 28);
    }, 33);
  });
}

function fabric(base: string, seed: number, pocket: boolean) {
  return canvasTex(128, (ctx, s) => {
    fillNoise(ctx, s, (x, y, n) => {
      const weave = (x + y) % 4 === 0;
      const seam = Math.abs(x - 64) < 2 || y < 16;
      if (seam) return shade("#2a211c", n, 16);
      let [r, g, b] = shade(base, n, weave ? 18 : 34);
      if (pocket && x > 78 && x < 112 && y > 48 && y < 96) {
        const edge = x < 81 || x > 109 || y < 51 || y > 93;
        if (edge) return shade("#2a211c", n, 10);
        return shade(base, n * 0.8, 16);
      }
      return [r, g, b];
    }, seed);
  });
}

function skinTex(hex: string, seed: number) {
  return canvasTex(
    64,
    (ctx, s) => {
      fillNoise(ctx, s, (_x, _y, n) => shade(hex, n, 22), seed);
    },
    true,
  );
}

function porcelain() {
  return canvasTex(128, (ctx, s) => {
    fillNoise(ctx, s, (x, y, n) => {
      const crack = Math.abs(x - 40 - y * 0.3) < 1.2 && y > 30;
      if (crack) return shade("#8a8e88", n, 10);
      const stain = (x - 90) ** 2 + (y - 80) ** 2 < 500 && n > 0.4;
      if (stain) return shade("#b7ae8a", n, 24);
      return shade("#e7e2d6", n, 18);
    }, 18);
  });
}

function mattress(mine: boolean) {
  return canvasTex(128, (ctx, s) => {
    const a = mine ? "#c65a2e" : "#6e7c86";
    const b = mine ? "#8d3e22" : "#4d5962";
    fillNoise(ctx, s, (x, y, n) => {
      const stripe = Math.floor(x / 10) % 2 === 0;
      const stain = (x - 40) ** 2 + (y - 70) ** 2 < 400;
      if (stain) return shade("#6a5a3a", n, 20);
      return shade(stripe ? a : b, n, 24);
    }, mine ? 3 : 8);
  });
}

function dirt() {
  return canvasTex(128, (ctx, s) => {
    fillNoise(ctx, s, (_x, _y, n) => {
      if (n > 0.72) return shade("#6a8a3a", n, 18);
      if (n < 0.18) return shade("#8a6840", n, 16);
      return shade("#a88452", n, 22);
    }, 71);
  });
}

function grass() {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("no 2d");
  ctx.fillStyle = "#5a9a3c";
  ctx.fillRect(0, 0, size, size);
  const rnd = mulberry32(6);
  for (let i = 0; i < 1800; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const h = 5 + rnd() * 14;
    const g = 90 + rnd() * 110;
    ctx.strokeStyle = `rgb(${28 + rnd() * 30},${g},${24 + rnd() * 28})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rnd() - 0.5) * 4, y - h);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function leafTex(hex: string, seed: number) {
  return canvasTex(128, (ctx, s) => {
    fillNoise(ctx, s, (_x, _y, n) => {
      if (n > 0.62) return shade(hex, n, 36);
      return shade(hex, n * 0.85, 22);
    }, seed);
  });
}

function showerTile() {
  return canvasTex(256, (ctx, s) => {
    fillNoise(ctx, s, (x, y, n) => {
      const gx = x % 32 < 2 || y % 32 < 2;
      if (gx) return shade("#7e888a", n, 12);
      const wet = (x - 90) ** 2 + (y - 140) ** 2 < 2800 && n > 0.4;
      if (wet) return shade("#9eb0b4", n, 16);
      return shade("#d5e0e1", n, 18);
    }, 17);
  });
}

function glassTex() {
  return canvasTex(64, (ctx, s) => {
    fillNoise(ctx, s, (x, y, n) => {
      const bar = x % 16 < 2;
      if (bar) return shade("#5a6168", n, 10);
      return shade("#9bb0b8", n, 26);
    }, 40);
  });
}

function stain() {
  return canvasTex(
    64,
    (ctx) => {
      const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
      g.addColorStop(0, "rgba(42,36,28,0.85)");
      g.addColorStop(1, "rgba(42,36,28,0)");
      ctx.clearRect(0, 0, 64, 64);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
    },
    false,
  );
}

function stripe() {
  return canvasTex(64, (ctx, s) => {
    fillNoise(ctx, s, (_x, _y, n) => shade("#c6a15a", n, 30), 2);
  });
}

function graffiti() {
  return canvasTex(
    256,
    (ctx) => {
      ctx.fillStyle = "#a89880";
      ctx.fillRect(0, 0, 256, 256);
      const noise = makeNoise(99);
      const img = ctx.getImageData(0, 0, 256, 256);
      for (let i = 0; i < img.data.length; i += 4) {
        const n = noise((i / 4) % 256, Math.floor(i / 4 / 256));
        img.data[i] = Math.min(255, img.data[i]! + (n - 0.5) * 30);
        img.data[i + 1] = Math.min(255, img.data[i + 1]! + (n - 0.5) * 26);
        img.data[i + 2] = Math.min(255, img.data[i + 2]! + (n - 0.5) * 20);
      }
      ctx.putImageData(img, 0, 0);
      ctx.strokeStyle = "#2a241c";
      ctx.lineWidth = 4;
      ctx.globalAlpha = 0.75;
      ctx.font = "700 64px Verdana, sans-serif";
      ctx.fillStyle = "#3a332c";
      ctx.fillText("IVES", 28, 120);
      ctx.globalAlpha = 0.55;
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.moveTo(36 + i * 14, 170);
        ctx.lineTo(36 + i * 14, 210);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },
    false,
  );
}

export type FaceOpts = {
  skin: string;
  variant: number;
  fem: boolean;
  glasses: boolean;
  stubble: boolean;
  hair: string;
  hairColor: string;
  cloth: string;
};

function drawFeatures(ctx: CanvasRenderingContext2D, opts: FaceOpts) {
  const rnd = mulberry32(opts.variant * 997 + 13);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)]!;
  const eyeSpread = 20 + rnd() * 12;
  const eyeY = 50 + rnd() * 8;
  const eyeRx = (opts.fem ? 9 : 8) + rnd() * 4;
  const eyeRy = (opts.fem ? 6 : 4.5) + rnd() * 3.5;
  const iris = pick(["#1a120e", "#1d4e89", "#3d2914", "#245c32", "#4a2040", "#0e0e0e"]);
  const browY = 34 + rnd() * 6;
  const browTilt = (rnd() - 0.5) * 12;
  const noseW = (opts.fem ? 5 : 7) + rnd() * 6;
  const mouthW = 16 + rnd() * 16;
  const mouthY = 92 + rnd() * 8;
  const mouthKind = Math.floor(rnd() * 6);
  const mark = Math.floor(rnd() * 8);
  const lazy = rnd() > 0.82;

  if (opts.hair !== "bald") {
    ctx.fillStyle = opts.hairColor;
    const hairH = opts.hair === "buzz" ? 16 : opts.hair === "afro" ? 36 : 24;
    ctx.fillRect(8, 0, 112, hairH);
    if (opts.hair === "afro" || opts.hair === "bun" || opts.hair === "beanie") {
      ctx.beginPath();
      ctx.ellipse(64, 18, 52, opts.hair === "afro" ? 34 : 22, 0, Math.PI, 0);
      ctx.fill();
    }
    if (opts.hair === "cap") {
      ctx.fillStyle = opts.hairColor;
      ctx.fillRect(18, 6, 92, 16);
      ctx.fillRect(18, 18, 70, 8);
    }
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.beginPath();
    ctx.ellipse(70, 22, 16, 7, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "rgba(160,70,60,0.16)";
  ctx.beginPath();
  ctx.ellipse(34, 78, 12, 8, 0, 0, Math.PI * 2);
  ctx.ellipse(94, 78, 12, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  const eyes = [64 - eyeSpread, 64 + eyeSpread];
  eyes.forEach((ex, i) => {
    const ry = eyeRy * (lazy && i === 1 ? 0.45 : 1);
    const ey = eyeY + (lazy && i === 1 ? 2 : 0);
    ctx.fillStyle = "#f4f1ea";
    ctx.beginPath();
    ctx.ellipse(ex, ey, eyeRx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = iris;
    ctx.beginPath();
    ctx.arc(ex + (opts.variant % 2 === 0 ? 1.5 : -1.5), ey, Math.max(2.4, eyeRx * 0.38), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f7f3ea";
    ctx.beginPath();
    ctx.arc(ex + 2, ey - 1.4, 1.2, 0, Math.PI * 2);
    ctx.fill();
    if (opts.fem) {
      ctx.strokeStyle = "#1c1915";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(ex - eyeRx, ey);
      ctx.quadraticCurveTo(ex, ey + ry + 2, ex + eyeRx, ey);
      ctx.stroke();
    }
  });

  ctx.strokeStyle = opts.hair === "grey" || opts.hairColor === "#8a8680" || opts.hairColor === "#c8c2b8" ? "#6a645c" : "#1c1915";
  ctx.lineWidth = opts.fem ? 2.4 : 3.6 + (opts.variant % 3);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(64 - eyeSpread - eyeRx, browY + browTilt);
  ctx.quadraticCurveTo(64 - eyeSpread, browY - 6 - Math.abs(browTilt) * 0.3, 64 - eyeSpread + eyeRx, browY);
  ctx.moveTo(64 + eyeSpread - eyeRx, browY - browTilt * 0.4);
  ctx.quadraticCurveTo(64 + eyeSpread, browY - 5 + browTilt * 0.2, 64 + eyeSpread + eyeRx, browY + browTilt * 0.5);
  ctx.stroke();
  if (opts.variant % 9 === 0) {
    ctx.beginPath();
    ctx.moveTo(64 - eyeSpread + eyeRx, browY);
    ctx.lineTo(64 + eyeSpread - eyeRx, browY - 1);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(40,24,18,0.55)";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(64, eyeY + 8);
  ctx.quadraticCurveTo(64 - noseW * 0.15, mouthY - 16, 64 - noseW * 0.5, mouthY - 10);
  ctx.lineTo(64 + noseW * 0.55, mouthY - 10);
  ctx.stroke();
  if (noseW > 10) {
    ctx.fillStyle = "rgba(40,24,18,0.18)";
    ctx.beginPath();
    ctx.ellipse(64, mouthY - 12, noseW * 0.45, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = opts.fem ? "#9a3d48" : "#6e3834";
  ctx.fillStyle = opts.fem ? "#9a3d48" : "#6e3834";
  ctx.lineWidth = opts.fem ? 2.6 : 2.2;
  ctx.beginPath();
  const x0 = 64 - mouthW / 2;
  const x1 = 64 + mouthW / 2;
  if (mouthKind === 0) ctx.arc(64, mouthY - 6, mouthW * 0.42, 0.15 * Math.PI, 0.85 * Math.PI);
  else if (mouthKind === 1) {
    ctx.moveTo(x0, mouthY);
    ctx.lineTo(x1, mouthY);
  } else if (mouthKind === 2) {
    ctx.moveTo(x0, mouthY + 2);
    ctx.quadraticCurveTo(64, mouthY - 8, x1, mouthY + 1);
  } else if (mouthKind === 3) {
    ctx.moveTo(x0, mouthY - 2);
    ctx.quadraticCurveTo(64, mouthY + 8, x1, mouthY - 3);
  } else if (mouthKind === 4) {
    ctx.moveTo(x0, mouthY);
    ctx.quadraticCurveTo(64, mouthY + 3, x1, mouthY - 4);
  } else {
    ctx.moveTo(x0 + 2, mouthY + 1);
    ctx.quadraticCurveTo(64, mouthY - 2, x1 - 2, mouthY + 2);
  }
  ctx.stroke();
  if (mouthKind === 0 || mouthKind === 3) {
    ctx.fillStyle = "#f4f0e6";
    ctx.fillRect(60, mouthY - 1, 5, 4);
  }

  if (opts.stubble || mark === 3) {
    ctx.fillStyle = "rgba(30,24,20,0.4)";
    for (let i = 0; i < 48; i++) ctx.fillRect(36 + ((i * 17) % 56), 84 + ((i * 13) % 30), 2, 2);
  }
  if (mark === 3 && !opts.fem) {
    ctx.fillStyle = opts.hairColor;
    ctx.fillRect(64 - mouthW * 0.4, mouthY - 10, mouthW * 0.8, 6);
  }
  if (mark === 0) {
    ctx.strokeStyle = "rgba(90,42,42,0.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(28, 30);
    ctx.lineTo(48, 78);
    ctx.stroke();
  } else if (mark === 1) {
    ctx.fillStyle = "#3a2418";
    ctx.beginPath();
    ctx.arc(96, 76, 3.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (mark === 2) {
    ctx.fillStyle = "rgba(90,50,30,0.45)";
    for (let i = 0; i < 18; i++) ctx.fillRect(30 + ((i * 19) % 68), 64 + ((i * 11) % 22), 2, 2);
  } else if (mark === 4) {
    ctx.strokeStyle = "rgba(80,50,40,0.45)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(36, 70 + i * 5);
      ctx.quadraticCurveTo(64, 74 + i * 5, 92, 70 + i * 4);
      ctx.stroke();
    }
  } else if (mark === 5) {
    ctx.strokeStyle = "rgba(120,48,48,0.8)";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(88, 58);
    ctx.lineTo(108, 72);
    ctx.stroke();
  } else if (mark === 6) {
    ctx.fillStyle = "#1c1915";
    ctx.fillRect(78, 86, 10, 3);
  }

  if (opts.glasses) {
    ctx.strokeStyle = "#1c1915";
    ctx.lineWidth = 3;
    const gx = 64 - eyeSpread - eyeRx - 2;
    const gw = eyeRx * 2 + 8;
    ctx.strokeRect(gx, eyeY - eyeRy - 4, gw, eyeRy * 2 + 10);
    ctx.strokeRect(64 + eyeSpread - eyeRx - 4, eyeY - eyeRy - 4, gw, eyeRy * 2 + 10);
    ctx.beginPath();
    ctx.moveTo(gx + gw, eyeY);
    ctx.lineTo(64 + eyeSpread - eyeRx - 4, eyeY);
    ctx.stroke();
  }
}

export function paintFace(opts: FaceOpts) {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("no 2d");
  ctx.fillStyle = opts.skin;
  ctx.fillRect(0, 0, 128, 128);
  const noise = makeNoise(opts.variant + 5);
  const img = ctx.getImageData(0, 0, 128, 128);
  for (let p = 0; p < 128 * 128; p++) {
    const n = noise(p % 128, Math.floor(p / 128));
    const i = p * 4;
    img.data[i] = Math.max(0, Math.min(255, img.data[i]! + (n - 0.5) * 16));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1]! + (n - 0.5) * 12));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2]! + (n - 0.5) * 10));
  }
  ctx.putImageData(img, 0, 0);
  drawFeatures(ctx, opts);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.needsUpdate = true;

  const card = document.createElement("canvas");
  card.width = 160;
  card.height = 176;
  const pctx = card.getContext("2d");
  if (!pctx) throw new Error("no 2d");
  pctx.fillStyle = "#1c1915";
  pctx.fillRect(0, 0, 160, 176);
  pctx.fillStyle = opts.skin;
  pctx.fillRect(10, 8, 140, 150);
  pctx.save();
  pctx.translate(16, 6);
  pctx.scale(1, 1);
  const face = document.createElement("canvas");
  face.width = 128;
  face.height = 128;
  const fctx = face.getContext("2d");
  if (!fctx) throw new Error("no 2d");
  fctx.drawImage(c, 0, 0);
  pctx.drawImage(face, 0, 0);
  pctx.restore();
  pctx.fillStyle = opts.cloth;
  pctx.beginPath();
  pctx.moveTo(0, 150);
  pctx.quadraticCurveTo(80, 112, 160, 150);
  pctx.lineTo(160, 176);
  pctx.lineTo(0, 176);
  pctx.fill();
  pctx.strokeStyle = "#e6b15a";
  pctx.lineWidth = 6;
  pctx.strokeRect(3, 3, 154, 170);

  return { tex, portrait: card.toDataURL("image/png") };
}

export function paintLabel(text: string, sub?: string) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("no 2d");
  ctx.clearRect(0, 0, 256, 64);
  ctx.fillStyle = "rgba(28,25,21,0.82)";
  ctx.beginPath();
  ctx.roundRect(8, 8, 240, 48, 10);
  ctx.fill();
  ctx.fillStyle = "#f3eadc";
  ctx.font = "600 26px Verdana, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 128, sub ? 26 : 32);
  if (sub) {
    ctx.fillStyle = "#e6b15a";
    ctx.font = "600 14px Verdana, sans-serif";
    ctx.fillText(sub, 128, 46);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function paintNumber(num: string) {
  return canvasTex(
    128,
    (ctx) => {
      ctx.clearRect(0, 0, 128, 128);
      ctx.fillStyle = "#2a211c";
      ctx.fillRect(8, 36, 112, 56);
      ctx.fillStyle = "#f3eadc";
      ctx.font = "700 36px Verdana, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(num, 64, 64);
    },
    false,
  );
}

function std(map: THREE.Texture, opts?: { roughness?: number; metalness?: number; transparent?: boolean; opacity?: number }) {
  const m = new THREE.MeshStandardMaterial({
    map,
    roughness: opts?.roughness ?? 0.92,
    metalness: opts?.metalness ?? 0.02,
    transparent: opts?.transparent ?? false,
    opacity: opts?.opacity ?? 1,
  });
  if (opts?.transparent) m.depthWrite = false;
  return m;
}

export type Library = ReturnType<typeof createLibrary>;

export function createLibrary() {
  const maps = {
    hall: prisonFloor(2),
    cell: prisonFloor(7),
    cafe: prisonFloor(19),
    yard: asphalt(),
    dirt: dirt(),
    wall: irishBrick(5, 0.55),
    wallCell: irishBrick(11, 0.85),
    wallCafe: irishBrick(14, 0.35),
    rust: rustMetal(),
    metal: paintedMetal(),
    wood: wood(),
    planks: planks(),
    porcelain: porcelain(),
    mattress: mattress(false),
    mattressMine: mattress(true),
    grass: grass(),
    leaf: leafTex("#8fbe45", 61),
    tile: showerTile(),
    glass: glassTex(),
    stain: stain(),
    stripe: stripe(),
    jumpsuit: fabric("#e07a32", 22, true),
    jumpsuitDirty: fabric("#c4622a", 27, true),
    guard: fabric("#243044", 31, false),
    suit: fabric("#3a342e", 36, false),
    apron: fabric("#efe6d6", 41, true),
    skin0: skinTex("#e0b394", 50),
    skin1: skinTex("#c68642", 51),
    skin2: skinTex("#8d5524", 52),
    skin3: skinTex("#f1d2b6", 53),
    skin4: skinTex("#5c3317", 54),
    graffiti: graffiti(),
  };

  const mats = {
    hall: std(maps.hall, { roughness: 0.96 }),
    cell: std(maps.cell, { roughness: 0.98 }),
    cafe: std(maps.cafe, { roughness: 0.84 }),
    yard: std(maps.yard, { roughness: 0.98 }),
    dirt: std(maps.dirt, { roughness: 0.98 }),
    wall: std(maps.wall, { roughness: 0.94 }),
    wallCell: std(maps.wallCell, { roughness: 0.96 }),
    wallCafe: std(maps.wallCafe, { roughness: 0.9 }),
    rust: std(maps.rust, { roughness: 0.62, metalness: 0.42 }),
    metal: std(maps.metal, { roughness: 0.48, metalness: 0.35 }),
    wood: std(maps.wood, { roughness: 0.86 }),
    planks: std(maps.planks, { roughness: 0.84 }),
    porcelain: std(maps.porcelain, { roughness: 0.55, metalness: 0.04 }),
    mattress: std(maps.mattress, { roughness: 0.95 }),
    mattressMine: std(maps.mattressMine, { roughness: 0.95 }),
    grass: std(maps.grass, { roughness: 0.96 }),
    leaf: std(maps.leaf, { roughness: 0.9 }),
    tile: std(maps.tile, { roughness: 0.42, metalness: 0.04 }),
    glass: std(maps.glass, { roughness: 0.22, metalness: 0.08, transparent: true, opacity: 0.55 }),
    stain: std(maps.stain, { transparent: true, opacity: 0.9, roughness: 1 }),
    stripe: std(maps.stripe, { roughness: 0.9 }),
    jumpsuit: std(maps.jumpsuit, { roughness: 0.9 }),
    jumpsuitDirty: std(maps.jumpsuitDirty, { roughness: 0.94 }),
    guard: std(maps.guard, { roughness: 0.88 }),
    suit: std(maps.suit, { roughness: 0.86 }),
    apron: std(maps.apron, { roughness: 0.9 }),
    skin0: std(maps.skin0, { roughness: 0.78 }),
    skin1: std(maps.skin1, { roughness: 0.78 }),
    skin2: std(maps.skin2, { roughness: 0.78 }),
    skin3: std(maps.skin3, { roughness: 0.78 }),
    skin4: std(maps.skin4, { roughness: 0.78 }),
    graffiti: std(maps.graffiti, { roughness: 0.95 }),
    blob: new THREE.MeshBasicMaterial({ color: 0x1c1915, transparent: true, opacity: 0.28, depthWrite: false }),
  };

  const geo = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 8),
    sphere: new THREE.SphereGeometry(1, 10, 8),
    plane: new THREE.PlaneGeometry(1, 1),
    ring: new THREE.RingGeometry(0.42, 0.62, 20),
    torus: new THREE.TorusGeometry(1, 0.16, 5, 8),
  };

  const textures: THREE.Texture[] = Object.values(maps);
  const materials: THREE.Material[] = Object.values(mats);

  return {
    maps,
    mats,
    geo,
    track(m: THREE.Material) {
      materials.push(m);
      return m;
    },
    trackTex(t: THREE.Texture) {
      textures.push(t);
      return t;
    },
    dispose() {
      for (const t of textures) t.dispose();
      for (const m of materials) m.dispose();
      for (const g of Object.values(geo)) g.dispose();
    },
  };
}
