// 程序化纹理：启动时一次性生成并缓存（GDD §20 视觉资产全部程序化，零外部素材）。

import Phaser from "phaser";
import { PALETTE } from "../config";
import { paintDragonHead, paintDragonSegment, DRAGON_HEAD_W, DRAGON_HEAD_H, DRAGON_SEG_W, DRAGON_SEG_H } from "./dragonArt";

/** 复盘印章背景 dataURL（DOM 界面用） */
export let sealBgUrl = "";

/** 宣纸面板背景 dataURL（结算/结局等浮层用） */
export let paperPanelUrl = "";

/** 墨迹飞溅 dataURL（结局标题底纹） */
export let inkSplashUrl = "";

function canvasTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): void {
  if (scene.textures.exists(key)) return;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  draw(ctx);
  scene.textures.addCanvas(key, canvas);
  if (key === "tex-sealbg") sealBgUrl = canvas.toDataURL("image/png");
}

function hex(c: number, a = 1): string {
  const r = (c >> 16) & 0xff;
  const g = (c >> 8) & 0xff;
  const b = c & 0xff;
  return `rgba(${r},${g},${b},${a})`;
}

/** 标题贴图与「零」印的对齐数据（逻辑像素） */
export const TITLE_ART = {
  w: 1120,
  h: 320,
  cx: 560,
  cy: 150,
  step: 214,
  sealIndex: 2,
} as const;

const TITLE_BRUSH = '"Ma Shan Zheng","STXingkai","华文行楷","KaiTi","STKaiti",serif';
const TITLE_KAISHU = '"KaiTi","STKaiti","KaiTi_GB2312","Noto Serif SC","Source Han Serif SC",serif';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = a + 0x6d2b79f5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function titleSealOffset(dispW: number, dispH: number): { x: number; y: number } {
  const lx = TITLE_ART.cx + (TITLE_ART.sealIndex - 1.5) * TITLE_ART.step;
  const ly = TITLE_ART.cy + 4;
  return {
    x: (lx - TITLE_ART.w / 2) * (dispW / TITLE_ART.w),
    y: (ly - TITLE_ART.h / 2) * (dispH / TITLE_ART.h),
  };
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function paintCinnabarSeal(ctx: CanvasRenderingContext2D, size: number, glyph: string): void {
  const pad = size * 0.04;
  const box = size - pad * 2;
  roundRectPath(ctx, pad, pad, box, box, size * 0.07);
  ctx.fillStyle = hex(PALETTE.cinnabar, 0.96);
  ctx.fill();
  ctx.strokeStyle = "rgba(246,241,222,0.9)";
  ctx.lineWidth = size * 0.033;
  roundRectPath(ctx, pad + size * 0.06, pad + size * 0.06, box - size * 0.12, box - size * 0.12, size * 0.032);
  ctx.stroke();
  ctx.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 20; i++) {
    ctx.beginPath();
    ctx.arc(pad + Math.random() * box, pad + Math.random() * box, size * 0.008 + Math.random() * size * 0.022, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.font = `${Math.round(size * 0.58)}px ${TITLE_KAISHU}`;
  ctx.fillStyle = "#F6F1DE";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(glyph, size / 2, size / 2 + size * 0.018);
}

/** 标题三字：龙行楷放、师号楷书收，飞白与墨晕按字分寸。 */
function paintTitleCalligraphy(ctx: CanvasRenderingContext2D): void {
  const rng = mulberry32(0x51d2e9a7);
  const specs = [
    { ch: "龙", i: 0, size: 198, rot: -4.4, dy: -12, dx: -10, brush: true, energy: 1 },
    { ch: "师", i: 1, size: 156, rot: 1.3, dy: 10, dx: -2, brush: false, energy: 0.38 },
    { ch: "号", i: 3, size: 148, rot: 2.6, dy: 8, dx: 8, brush: false, energy: 0.34 },
  ] as const;

  const charX = (i: number) => TITLE_ART.cx + (i - 1.5) * TITLE_ART.step;

  for (const s of specs) {
    const x = charX(s.i) + s.dx;
    const y = TITLE_ART.cy + s.dy;
    const halo = ctx.createRadialGradient(x, y, 8, x, y, s.brush ? 128 : 100);
    halo.addColorStop(0, s.brush ? "rgba(233,224,200,0.2)" : "rgba(233,224,200,0.13)");
    halo.addColorStop(1, "rgba(233,224,200,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, s.brush ? 128 : 100, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const s of specs) {
    const ts = 340;
    const tile = document.createElement("canvas");
    tile.width = ts;
    tile.height = ts;
    const tctx = tile.getContext("2d")!;
    tctx.textAlign = "center";
    tctx.textBaseline = "middle";
    tctx.font = `400 ${s.size}px ${s.brush ? TITLE_BRUSH : TITLE_KAISHU}`;
    const cx = ts / 2;
    const cy = ts / 2;

    tctx.fillStyle = "rgba(8,12,18,0.2)";
    for (let i = 0; i < 7; i++) {
      tctx.fillText(s.ch, cx + 5 + (rng() - 0.5) * 8, cy + 8 + (rng() - 0.5) * 7);
    }

    const grad = tctx.createLinearGradient(0, 48, 0, 292);
    grad.addColorStop(0, "#F8F3E4");
    grad.addColorStop(0.42, "#E9E0C8");
    grad.addColorStop(1, "#B7A57A");
    tctx.fillStyle = grad;
    tctx.fillText(s.ch, cx, cy);

    tctx.strokeStyle = "rgba(16,22,28,0.42)";
    tctx.lineWidth = s.brush ? 2.4 : 1.8;
    tctx.strokeText(s.ch, cx, cy);

    tctx.globalCompositeOperation = "destination-out";
    const cuts = 28 + Math.floor(s.energy * 90);
    for (let i = 0; i < cuts; i++) {
      const x = ts * (0.2 + rng() * 0.6);
      const y = ts * (0.2 + rng() * 0.6);
      const ang = -0.42 + rng() * 0.28;
      const len = 7 + rng() * (12 + s.energy * 26);
      tctx.strokeStyle = `rgba(0,0,0,${0.07 + rng() * 0.2 * (0.4 + s.energy)})`;
      tctx.lineWidth = 0.55 + rng() * (0.9 + s.energy * 1.4);
      tctx.beginPath();
      tctx.moveTo(x, y);
      tctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      tctx.stroke();
    }
    if (s.brush) {
      for (let i = 0; i < 16; i++) {
        tctx.fillStyle = `rgba(0,0,0,${0.12 + rng() * 0.32})`;
        tctx.beginPath();
        tctx.ellipse(
          ts * (0.28 + rng() * 0.44),
          ts * (0.26 + rng() * 0.48),
          0.7 + rng() * 2.6,
          0.4 + rng() * 1.4,
          rng() * Math.PI,
          0, Math.PI * 2,
        );
        tctx.fill();
      }
    }
    tctx.globalCompositeOperation = "source-over";

    const x = charX(s.i) + s.dx;
    const y = TITLE_ART.cy + s.dy;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((s.rot * Math.PI) / 180);
    ctx.drawImage(tile, -ts / 2, -ts / 2);
    ctx.restore();

    if (s.brush) {
      for (let i = 0; i < 11; i++) {
        const a = rng() * Math.PI * 2;
        const d = 62 + rng() * 58;
        const ink = rng() > 0.45;
        ctx.fillStyle = ink ? `rgba(18,24,30,${0.28 + rng() * 0.28})` : `rgba(233,224,200,${0.35 + rng() * 0.3})`;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 0.7 + rng() * 2.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

export function generateTextures(scene: Phaser.Scene): void {
  // 宣纸颗粒
  canvasTexture(scene, "tex-paper", 512, 512, (ctx) => {
    ctx.fillStyle = hex(PALETTE.paper);
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 5200; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const a = Math.random() * 0.05;
      ctx.fillStyle = Math.random() > 0.5 ? hex(PALETTE.ink, a) : hex(0xffffff, a);
      ctx.fillRect(x, y, 1.4, 1.4);
    }
    for (let i = 0; i < 46; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      ctx.strokeStyle = hex(PALETTE.ink, 0.028);
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - 0.5) * 60, y + (Math.random() - 0.5) * 60);
      ctx.stroke();
    }
  });

  // 柔光（灯笼/灯海通用）
  canvasTexture(scene, "tex-glow", 128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    g.addColorStop(0, "rgba(255,244,214,0.95)");
    g.addColorStop(0.35, "rgba(231,185,105,0.5)");
    g.addColorStop(1, "rgba(231,185,105,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });

  // 蓝图扫描光
  canvasTexture(scene, "tex-scan", 64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, "rgba(114,169,194,0.9)");
    g.addColorStop(1, "rgba(114,169,194,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });

  // 墨点（失误标记）
  canvasTexture(scene, "tex-inkdrop", 24, 24, (ctx) => {
    const g = ctx.createRadialGradient(12, 12, 1, 12, 12, 11);
    g.addColorStop(0, "rgba(26,34,43,0.9)");
    g.addColorStop(0.7, "rgba(26,34,43,0.4)");
    g.addColorStop(1, "rgba(26,34,43,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(12, 12, 11, 0, Math.PI * 2);
    ctx.fill();
  });

  // 火星粒子
  canvasTexture(scene, "tex-spark", 16, 16, (ctx) => {
    const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    g.addColorStop(0, "rgba(255,240,200,1)");
    g.addColorStop(1, "rgba(255,200,120,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 16);
  });

  // 水墨远山（一段，平铺用）
  canvasTexture(scene, "tex-hill", 1920, 340, (ctx) => {
    ctx.clearRect(0, 0, 1920, 340);
    const W = 1920;
    const layers = [
      { y: 170, amp: 74, alpha: 0.32, freq: 2.1 },
      { y: 214, amp: 56, alpha: 0.5, freq: 3.4 },
      { y: 252, amp: 40, alpha: 0.68, freq: 4.6 },
    ];
    for (const L of layers) {
      ctx.beginPath();
      ctx.moveTo(0, 340);
      for (let x = 0; x <= W; x += 10) {
        const t = x / W;
        const y =
          L.y -
          Math.sin(t * Math.PI * L.freq) * L.amp -
          Math.sin(t * Math.PI * L.freq * 2.7 + 1.3) * L.amp * 0.35 -
          Math.sin(t * Math.PI * L.freq * 5.3 + 4.1) * L.amp * 0.16;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, 340);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, L.y - L.amp, 0, 340);
      grad.addColorStop(0, hex(PALETTE.nightDeep, L.alpha));
      grad.addColorStop(1, hex(PALETTE.nightDeep, L.alpha * 0.25));
      ctx.fillStyle = grad;
      ctx.fill();
    }
    // 山脚雾带
    const mist = ctx.createLinearGradient(0, 260, 0, 340);
    mist.addColorStop(0, "rgba(139,149,163,0)");
    mist.addColorStop(1, "rgba(139,149,163,0.18)");
    ctx.fillStyle = mist;
    ctx.fillRect(0, 260, W, 80);
  });

  // 夜雾带（标题与河岸多层叠用）
  canvasTexture(scene, "tex-mist", 1024, 280, (ctx) => {
    ctx.clearRect(0, 0, 1024, 280);
    for (let i = 0; i < 22; i++) {
      const x = Math.random() * 1024;
      const y = 70 + Math.random() * 140;
      const rx = 110 + Math.random() * 240;
      const ry = 24 + Math.random() * 56;
      const g = ctx.createRadialGradient(x, y, 6, x, y, rx);
      g.addColorStop(0, `rgba(196,210,222,${0.16 + Math.random() * 0.14})`);
      g.addColorStop(1, "rgba(196,210,222,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // 掠月墨云
  canvasTexture(scene, "tex-inkcloud", 640, 240, (ctx) => {
    ctx.clearRect(0, 0, 640, 240);
    for (const [cx, cy, rx, ry, a] of [
      [220, 120, 210, 70, 0.22],
      [400, 100, 170, 54, 0.18],
      [520, 140, 120, 42, 0.14],
    ] as const) {
      const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, rx);
      g.addColorStop(0, `rgba(18,28,40,${a})`);
      g.addColorStop(1, "rgba(18,28,40,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, -0.18, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // 近景竹影（左右压边）
  canvasTexture(scene, "tex-bamboo-fg", 420, 1080, (ctx) => {
    ctx.clearRect(0, 0, 420, 1080);
    const stalks = [
      { x: 62, h: 1000, w: 15 },
      { x: 118, h: 860, w: 10 },
      { x: 176, h: 1048, w: 18 },
      { x: 248, h: 910, w: 12 },
      { x: 312, h: 780, w: 9 },
      { x: 358, h: 940, w: 13 },
    ];
    for (const s of stalks) {
      const y0 = 1080 - s.h;
      const body = ctx.createLinearGradient(s.x, 0, s.x + s.w, 0);
      body.addColorStop(0, "rgba(6,10,14,0.96)");
      body.addColorStop(0.45, "rgba(14,24,22,0.94)");
      body.addColorStop(1, "rgba(5,9,12,0.97)");
      ctx.fillStyle = body;
      ctx.fillRect(s.x, y0, s.w, s.h);
      for (let y = y0 + 36; y < 1080; y += 48 + (s.x % 19)) {
        ctx.fillStyle = "rgba(22,36,32,0.9)";
        ctx.fillRect(s.x - 2, y, s.w + 4, 6);
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillRect(s.x - 2, y + 5, s.w + 4, 2);
      }
      ctx.strokeStyle = "rgba(8,16,14,0.88)";
      ctx.lineWidth = 3.2;
      ctx.lineCap = "round";
      for (let i = 0; i < 9; i++) {
        const y = y0 + 70 + i * 78;
        const dir = i % 2 === 0 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(s.x + s.w / 2, y);
        ctx.quadraticCurveTo(s.x + dir * 48, y - 14, s.x + dir * 96, y + 10);
        ctx.stroke();
      }
    }
  });

  // 月亮：宣纸色盘面 + 边缘减光 + 偏侧极淡环形坑
  canvasTexture(scene, "tex-moon", 160, 160, (ctx) => {
    ctx.clearRect(0, 0, 160, 160);
    const disc = ctx.createRadialGradient(74, 74, 26, 80, 80, 80);
    disc.addColorStop(0, "#F4EFDC");
    disc.addColorStop(0.72, "#EDE5CC");
    disc.addColorStop(0.94, "#D8CFAE");
    disc.addColorStop(1, "#B9AE8C");
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(80, 80, 79, 0, Math.PI * 2);
    ctx.fill();
    // 环形坑：偏侧分布、中心留白
    for (const [cx, cy, r, a] of [
      [50, 98, 12, 0.1], [97, 58, 9, 0.09], [113, 104, 13, 0.08],
      [62, 46, 7, 0.08], [88, 118, 6, 0.07], [122, 76, 5, 0.06],
    ] as const) {
      const cg = ctx.createRadialGradient(cx, cy, 1, cx, cy, r);
      cg.addColorStop(0, `rgba(118,108,84,${a})`);
      cg.addColorStop(1, "rgba(118,108,84,0)");
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // —— 三套场景地面 ——
  // 训练场：夯土 + 竹叶
  canvasTexture(scene, "ground-yard", 640, 300, (ctx) => {
    ctx.fillStyle = "#1d2519";
    ctx.fillRect(0, 0, 640, 300);
    for (let i = 0; i < 2600; i++) {
      const x = Math.random() * 640, y = Math.random() * 300;
      ctx.fillStyle = Math.random() > 0.5 ? "rgba(233,224,200,0.03)" : "rgba(0,0,0,0.16)";
      ctx.fillRect(x, y, 1.6, 1.6);
    }
    // 拖痕
    ctx.strokeStyle = "rgba(0,0,0,0.2)";
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 26; i++) {
      const y = Math.random() * 300;
      ctx.beginPath();
      ctx.moveTo(Math.random() * 640, y);
      ctx.lineTo(Math.random() * 640, y + (Math.random() - 0.5) * 8);
      ctx.stroke();
    }
    // 散落竹叶
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * 640, y = Math.random() * 300;
      ctx.strokeStyle = `rgba(95,128,96,${0.25 + Math.random() * 0.3})`;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 5, y - 2, x + 11, y + 1);
      ctx.stroke();
    }
  });
  // 老街：石板路（原生1920宽，无拉伸；错缝+磨面+裂纹+街心走亮）
  canvasTexture(scene, "ground-street", 1920, 300, (ctx) => {
    ctx.fillStyle = "#141c27";
    ctx.fillRect(0, 0, 1920, 300);
    const rows = 7;
    const rowH = 300 / rows;
    for (let r = 0; r < rows; r++) {
      const y = r * rowH;
      let x = -(r % 2) * 90 - Math.random() * 60;
      while (x < 1920) {
        const w = 150 + Math.random() * 130;
        // 石板底色（微差）
        const l = 8 + Math.random() * 7;
        ctx.fillStyle = `rgba(${30 + l}, ${40 + l}, ${54 + l}, 1)`;
        ctx.fillRect(x + 2, y + 2, w - 4, rowH - 4);
        // 顶棱受光
        ctx.fillStyle = "rgba(233,224,200,0.07)";
        ctx.fillRect(x + 3, y + 3, w - 6, 2);
        // 缝
        ctx.strokeStyle = "rgba(0,0,0,0.55)";
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, w - 4, rowH - 4);
        // 裂纹（部分石板）
        if (Math.random() < 0.4) {
          ctx.strokeStyle = "rgba(0,0,0,0.35)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          const cx = x + w * 0.3 + Math.random() * w * 0.4;
          const cy = y + rowH * 0.3 + Math.random() * rowH * 0.3;
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + (Math.random() - 0.5) * 34, cy + (Math.random() - 0.5) * 12);
          ctx.stroke();
        }
        x += w;
      }
    }
    // 街心走亮（行人磨出的浅带）
    const wear = ctx.createLinearGradient(0, 40, 0, 280);
    wear.addColorStop(0, "rgba(233,224,200,0.07)");
    wear.addColorStop(0.5, "rgba(233,224,200,0.035)");
    wear.addColorStop(1, "rgba(233,224,200,0)");
    ctx.fillStyle = wear;
    ctx.fillRect(0, 0, 1920, 300);
    // 湿痕（几道反光）
    for (let i = 0; i < 7; i++) {
      const x = 150 + Math.random() * 1620;
      const y = 30 + Math.random() * 220;
      const g2 = ctx.createRadialGradient(x, y, 2, x, y, 26 + Math.random() * 30);
      g2.addColorStop(0, "rgba(159,196,222,0.06)");
      g2.addColorStop(1, "rgba(159,196,222,0)");
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.ellipse(x, y, 34, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // 河岸：木质台板
  canvasTexture(scene, "ground-river", 640, 300, (ctx) => {
    ctx.fillStyle = "#231a12";
    ctx.fillRect(0, 0, 640, 300);
    for (let c = 0; c < 10; c++) {
      const x = c * 64;
      const tint = 0.03 + Math.random() * 0.05;
      ctx.fillStyle = `rgba(199,154,69,${tint})`;
      ctx.fillRect(x + 1, 0, 62, 300);
      // 木纹
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 1.2;
      for (let g2 = 0; g2 < 4; g2++) {
        const gy = Math.random() * 300;
        ctx.beginPath();
        ctx.moveTo(x + 4, gy);
        ctx.bezierCurveTo(x + 20, gy + 6, x + 44, gy - 6, x + 60, gy + 2);
        ctx.stroke();
      }
      // 板缝
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(x, 0, 2, 300);
      // 钉
      ctx.fillStyle = "rgba(199,154,69,0.4)";
      ctx.fillRect(x + 30, 12, 3, 3);
      ctx.fillRect(x + 30, 285, 3, 3);
    }
  });

  // 标题书法：龙行楷放、师号楷书收；「零」印单独贴图
  canvasTexture(scene, "tex-title", TITLE_ART.w, TITLE_ART.h, (ctx) => {
    ctx.clearRect(0, 0, TITLE_ART.w, TITLE_ART.h);
    paintTitleCalligraphy(ctx);
  });

  canvasTexture(scene, "tex-zeroseal", 192, 192, (ctx) => {
    ctx.clearRect(0, 0, 192, 192);
    paintCinnabarSeal(ctx, 192, "零");
  });

  // 竹竿节
  canvasTexture(scene, "tex-pole", 16, 128, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 16, 0);
    g.addColorStop(0, hex(0x4a6b4c));
    g.addColorStop(0.5, hex(0x6f9570));
    g.addColorStop(1, hex(0x405c42));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 128);
    ctx.fillStyle = hex(0x35503a, 0.8);
    for (let y = 10; y < 128; y += 36) ctx.fillRect(0, y, 16, 3);
  });

  // 灯笼身体
  canvasTexture(scene, "tex-lantern", 72, 96, (ctx) => {
    ctx.clearRect(0, 0, 72, 96);
    const body = ctx.createLinearGradient(0, 18, 0, 84);
    body.addColorStop(0, hex(0xd8846b));
    body.addColorStop(0.5, hex(PALETTE.cinnabar));
    body.addColorStop(1, hex(0x8f2f27));
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(36, 51, 26, 34, 0, 0, Math.PI * 2);
    ctx.fill();
    // 竹骨
    ctx.strokeStyle = hex(PALETTE.gold, 0.55);
    ctx.lineWidth = 1.2;
    for (const dy of [-20, -8, 4, 16, 26]) {
      ctx.beginPath();
      ctx.ellipse(36, 51 + dy, 26 * Math.sqrt(Math.max(0, 1 - (dy / 34) ** 2)), 4, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // 上下盖
    ctx.fillStyle = hex(PALETTE.gold);
    ctx.fillRect(24, 12, 24, 8);
    ctx.fillRect(26, 84, 20, 7);
    // 顶环与穗
    ctx.strokeStyle = hex(PALETTE.gold, 0.9);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(36, 12);
    ctx.lineTo(36, 4);
    ctx.stroke();
    ctx.strokeStyle = hex(PALETTE.cinnabar, 0.85);
    ctx.beginPath();
    ctx.moveTo(36, 91);
    ctx.bezierCurveTo(30, 96, 34, 99, 36, 96);
    ctx.stroke();
    // 字
    ctx.fillStyle = hex(PALETTE.paper, 0.9);
    ctx.font = "700 20px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("福", 36, 52);
  });

  // 龙头：南派舞龙彩扎（见 dragonArt.ts）
  canvasTexture(scene, "tex-dragonhead", DRAGON_HEAD_W, DRAGON_HEAD_H, paintDragonHead);

  // 龙身鳞节
  canvasTexture(scene, "tex-segment", DRAGON_SEG_W, DRAGON_SEG_H, paintDragonSegment);

  // 印章底
  canvasTexture(scene, "tex-sealbg", 128, 128, (ctx) => {
    ctx.clearRect(0, 0, 128, 128);
    ctx.fillStyle = hex(PALETTE.cinnabar, 0.92);
    ctx.beginPath();
    const r = 14;
    const w = 100;
    ctx.moveTo(14 + r, 14);
    ctx.arcTo(14 + w, 14, 14 + w, 14 + w, r);
    ctx.arcTo(14 + w, 14 + w, 14, 14 + w, r);
    ctx.arcTo(14, 14 + w, 14, 14, r);
    ctx.arcTo(14, 14, 14 + w, 14, r);
    ctx.closePath();
    ctx.fill();
    // 边缘残缺
    ctx.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 20; i++) {
      const edge = Math.floor(Math.random() * 4);
      const x = edge < 2 ? 14 + Math.random() * 100 : (edge === 2 ? 14 : 114);
      const y = edge >= 2 ? 14 + Math.random() * 100 : (edge === 0 ? 14 : 114);
      ctx.beginPath();
      ctx.arc(x, y, 2 + Math.random() * 4, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** 结算面板专用宣纸（独立生成并导出 dataURL，不进纹理管理器） */
function paperPanelTexture(): string {
  const canvas = document.createElement("canvas");
  canvas.width = 560;
  canvas.height = 720;
  const ctx = canvas.getContext("2d")!;
  // 宣纸底
  ctx.fillStyle = "#E9E0C8";
  ctx.fillRect(0, 0, 560, 720);
  // 颗粒
  for (let i = 0; i < 4200; i++) {
    const x = Math.random() * 560;
    const y = Math.random() * 720;
    ctx.fillStyle = Math.random() > 0.5 ? "rgba(26,34,43,0.045)" : "rgba(255,255,255,0.05)";
    ctx.fillRect(x, y, 1.3, 1.3);
  }
  // 纤维丝
  ctx.strokeStyle = "rgba(26,34,43,0.03)";
  ctx.lineWidth = 0.7;
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * 560;
    const y = Math.random() * 720;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 46, y + (Math.random() - 0.5) * 46);
    ctx.stroke();
  }
  // 竹简竖缝（每 88px 一道，像裱在竹简上）
  for (let x = 88; x < 560; x += 88) {
    const seam = ctx.createLinearGradient(x - 5, 0, x + 5, 0);
    seam.addColorStop(0, "rgba(26,34,43,0)");
    seam.addColorStop(0.5, "rgba(26,34,43,0.10)");
    seam.addColorStop(1, "rgba(26,34,43,0)");
    ctx.fillStyle = seam;
    ctx.fillRect(x - 5, 0, 10, 720);
  }
  // 四角淡墨晕
  const corners: Array<[number, number]> = [[0, 0], [560, 0], [0, 720], [560, 720]];
  for (const [cx, cy] of corners) {
    const g = ctx.createRadialGradient(cx, cy, 8, cx, cy, 190);
    g.addColorStop(0, "rgba(26,34,43,0.14)");
    g.addColorStop(1, "rgba(26,34,43,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 560, 720);
  }
  // 边缘做旧
  ctx.strokeStyle = "rgba(26,34,43,0.22)";
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, 557, 717);
  ctx.strokeStyle = "rgba(182,64,54,0.35)";
  ctx.lineWidth = 1.4;
  ctx.strokeRect(7, 7, 546, 706);
  // 一处淡墨渍（左下）
  const stain = ctx.createRadialGradient(90, 640, 4, 90, 640, 90);
  stain.addColorStop(0, "rgba(26,34,43,0.10)");
  stain.addColorStop(1, "rgba(26,34,43,0)");
  ctx.fillStyle = stain;
  ctx.fillRect(0, 550, 200, 170);
  return canvas.toDataURL("image/png");
}

/** 墨迹飞溅（结局标题底纹） */
function inkSplashTexture(): string {
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 380;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 900, 380);
  // 主墨团
  for (const [cx, cy, r, a] of [
    [450, 190, 150, 0.9], [300, 170, 90, 0.75], [600, 210, 100, 0.7], [200, 220, 55, 0.5], [720, 160, 60, 0.45],
  ] as const) {
    const g = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
    g.addColorStop(0, `rgba(16,20,26,${a})`);
    g.addColorStop(0.75, `rgba(16,20,26,${a * 0.75})`);
    g.addColorStop(1, "rgba(16,20,26,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    // 不规则边缘
    ctx.moveTo(cx + r, cy);
    for (let ang = 0; ang < Math.PI * 2; ang += 0.35) {
      const rr = r * (0.82 + Math.random() * 0.3);
      ctx.lineTo(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr * 0.62);
    }
    ctx.closePath();
    ctx.fill();
  }
  // 飞溅小点
  for (let i = 0; i < 46; i++) {
    const x = 60 + Math.random() * 780;
    const y = 40 + Math.random() * 300;
    const rr = 1.5 + Math.random() * 5;
    ctx.fillStyle = `rgba(16,20,26,${0.3 + Math.random() * 0.5})`;
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas.toDataURL("image/png");
}

export function generateDomTextures(): void {
  paperPanelUrl = paperPanelTexture();
  inkSplashUrl = inkSplashTexture();
}
