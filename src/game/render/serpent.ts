// 整龙构建器：连贯锥形龙身 + 背鳍金脊 + 腹甲 + 尾鳍 + 龙爪 + 比例正确的龙头。
// 静态版用于结局定格；Serpent 类提供标题用的游动动画（蛇形起伏）。

import Phaser from "phaser";
import { PALETTE } from "../config";
import { smoothThrough, type Pt } from "./curve";

export interface SerpentOptions {
  /** 控制点，从尾到头（默认左→右，龙头在最后一点） */
  points: Pt[];
  /** 龙头缩放（贴图 200×150，0.8 = 160×120） */
  headScale?: number;
  /** 龙身最粗处半径 */
  maxRadius?: number;
  /** 鳞节间距（像素） */
  segmentEvery?: number;
  /** 整体透明度 */
  alpha?: number;
  /** 龙身颜色（默认竹青） */
  bodyColor?: number;
  /** 龙头是否水平翻转（朝左） */
  flipHead?: boolean;
  /** 装饰：背鳍/腹甲/尾鳍/龙爪 */
  ornaments?: boolean;
}

interface BuiltParts {
  g: Phaser.GameObjects.Graphics;
  segs: Phaser.GameObjects.Image[];
  head: Phaser.GameObjects.Image;
  glow?: Phaser.GameObjects.Image;
}

function buildParts(scene: Phaser.Scene, opts: Required<SerpentOptions>, dynamic: boolean): BuiltParts {
  const container = scene.add.container(0, 0);
  const g = scene.add.graphics();
  container.add(g);
  const segs: Phaser.GameObjects.Image[] = [];
  const totalLen = opts.points.reduce((acc, p, i) => (i === 0 ? 0 : acc), 0);
  void totalLen;
  const segCount = 16;
  for (let i = 0; i < segCount; i++) {
    const seg = scene.add.image(0, 0, "tex-segment").setAlpha(opts.alpha).setDepth(10).setVisible(false);
    segs.push(seg);
    container.add(seg);
  }
  const head = scene.add
    .image(0, 0, "tex-dragonhead")
    .setOrigin(0.42, 0.52)
    .setScale(opts.headScale)
    .setAlpha(Math.min(1, opts.alpha + 0.05))
    .setDepth(20);
  if (opts.flipHead) head.setFlipY(true);
  container.add(head);
  let glow: Phaser.GameObjects.Image | undefined;
  if (dynamic) {
    glow = scene.add.image(0, 0, "tex-glow").setScale(3.6, 2.6).setAlpha(0.22).setTint(0xf0c27a).setDepth(19);
    container.add(glow);
  }
  return { g, segs, head, glow };
}

/** 重绘一帧龙（静态与动画共用） */
function drawFrame(
  parts: BuiltParts,
  opts: Required<SerpentOptions>,
  pts: Pt[]
): void {
  const { g, segs, head, glow } = parts;
  const smooth = smoothThrough(pts, 12);
  const cum: number[] = [0];
  for (let i = 1; i < smooth.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(smooth[i].x - smooth[i - 1].x, smooth[i].y - smooth[i - 1].y));
  }
  const total = cum[cum.length - 1] || 1;

  const radiusAt = (t: number) => opts.maxRadius * (0.2 + 0.8 * Math.pow(t, 1.35));

  g.clear();

  // —— 投影层（轻微下移的暗色底，制造体积感）——
  g.fillStyle(0x05080d, 0.22 * opts.alpha);
  for (let i = 0; i < smooth.length; i += 2) {
    const t = cum[i] / total;
    g.fillCircle(smooth[i].x + 5, smooth[i].y + 7, radiusAt(t) * 1.02);
  }

  // —— 龙身主体：尾深头浅的渐层 ——
  for (let i = 0; i < smooth.length; i++) {
    const t = cum[i] / total;
    const r = radiusAt(t);
    const shade = Phaser.Display.Color.IntegerToColor(opts.bodyColor);
    const dark = Phaser.Display.Color.IntegerToColor(0x39503c);
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(dark, shade, 90, Math.round(t * 90));
    g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), opts.alpha);
    g.fillCircle(smooth[i].x, smooth[i].y, r);
  }

  // —— 背脊高光（上缘亮线）——
  for (let i = 1; i < smooth.length - 1; i++) {
    const t = cum[i] / total;
    const r = radiusAt(t);
    const ang = Math.atan2(smooth[i + 1].y - smooth[i - 1].y, smooth[i + 1].x - smooth[i - 1].x);
    const nx = Math.sin(ang);
    const ny = -Math.cos(ang);
    g.fillStyle(0x8fbf92, opts.alpha * 0.5);
    g.fillCircle(smooth[i].x + nx * r * 0.62, smooth[i].y + ny * r * 0.62, r * 0.3);
  }

  // —— 腹甲金线 ——
  for (let i = 0; i < smooth.length; i += 2) {
    const t = cum[i] / total;
    const r = radiusAt(t);
    const ang = i + 1 < smooth.length
      ? Math.atan2(smooth[i + 1].y - smooth[i].y, smooth[i + 1].x - smooth[i].x)
      : 0;
    const nx = -Math.sin(ang);
    const ny = Math.cos(ang);
    g.fillStyle(PALETTE.gold, opts.alpha * 0.4);
    g.fillCircle(smooth[i].x + nx * r * 0.5, smooth[i].y + ny * r * 0.5, r * 0.24);
  }

  if (opts.ornaments) {
    // —— 背鳍金脊（沿背缘的三角鳍）——
    for (let at = 0.06; at < 0.94; at += 0.055) {
      const idx = smooth.findIndex((_, i) => cum[i] / total >= at);
      if (idx <= 0 || idx >= smooth.length - 1) continue;
      const p = smooth[idx];
      const t = cum[idx] / total;
      const r = radiusAt(t);
      const ang = Math.atan2(smooth[idx + 1].y - smooth[idx - 1].y, smooth[idx + 1].x - smooth[idx - 1].x);
      const nx = Math.sin(ang);
      const ny = -Math.cos(ang);
      const tipLen = r + 7 + Math.sin(t * Math.PI) * 9;
      const bx = p.x + nx * r * 0.72;
      const by = p.y + ny * r * 0.72;
      const tx = Math.cos(ang) * r * 0.34;
      const ty = Math.sin(ang) * r * 0.34;
      g.fillStyle(PALETTE.gold, opts.alpha * 0.85);
      g.fillTriangle(bx + nx * tipLen, by + ny * tipLen, bx + tx, by + ty, bx - tx, by - ty);
    }

    // —— 尾鳍（尾端扇形三叉）——
    const tail = smooth[0];
    const tAng = Math.atan2(smooth[1].y - tail.y, smooth[1].x - tail.x);
    for (const spread of [-0.65, 0, 0.65]) {
      const a = tAng + Math.PI + spread;
      g.fillStyle(0x4a7057, opts.alpha * 0.95);
      g.fillTriangle(
        tail.x, tail.y,
        tail.x + Math.cos(a) * 46, tail.y + Math.sin(a) * 46,
        tail.x + Math.cos(a + 0.35) * 30, tail.y + Math.sin(a + 0.35) * 30
      );
    }

    // —— 龙爪（两处，三趾金色）——
    for (const at of [0.42, 0.72]) {
      const idx = smooth.findIndex((_, i) => cum[i] / total >= at);
      if (idx <= 0) continue;
      const p = smooth[idx];
      const t = cum[idx] / total;
      const r = radiusAt(t);
      const ang = Math.atan2(smooth[idx + 1].y - smooth[idx - 1].y, smooth[idx + 1].x - smooth[idx - 1].x);
      const nx = -Math.sin(ang);
      const ny = Math.cos(ang);
      const cx = p.x + nx * (r + 8);
      const cy = p.y + ny * (r + 8);
      g.lineStyle(3.4, PALETTE.gold, opts.alpha * 0.95);
      for (const curl of [-0.5, 0, 0.5]) {
        const ca = ang + Math.PI * 0.5 + curl;
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(cx + Math.cos(ca) * 22, cy + Math.sin(ca) * 22);
        g.strokePath();
      }
    }
  }

  // —— 鳞节沿切线排布 ——
  let nextAt = opts.segmentEvery * 0.6;
  let segIdx = 0;
  for (let i = 1; i < smooth.length && segIdx < segs.length; i++) {
    while (nextAt <= cum[i] && segIdx < segs.length) {
      const seg0 = smooth[i - 1];
      const seg1 = smooth[i];
      const span = cum[i] - cum[i - 1] || 1;
      const k = (nextAt - cum[i - 1]) / span;
      const x = seg0.x + (seg1.x - seg0.x) * k;
      const y = seg0.y + (seg1.y - seg0.y) * k;
      const t = nextAt / total;
      const r = radiusAt(t);
      const seg = segs[segIdx++];
      seg.setPosition(x, y);
      seg.setRotation(Math.atan2(seg1.y - seg0.y, seg1.x - seg0.x));
      seg.setScale((r / 30) * 0.74, (r / 30) * 0.6);
      seg.setVisible(true);
      nextAt += opts.segmentEvery;
    }
  }
  for (; segIdx < segs.length; segIdx++) segs[segIdx].setVisible(false);

  // —— 龙头（与末段切线对齐）——
  const last = smooth[smooth.length - 1];
  const prev = smooth[Math.max(0, smooth.length - 4)];
  const ang = Math.atan2(last.y - prev.y, last.x - prev.x);
  head.setPosition(last.x, last.y);
  head.setRotation(ang);
  if (glow) {
    glow.setPosition(last.x + Math.cos(ang) * 30, last.y + Math.sin(ang) * 30);
  }
}

/** 静态整龙（结局定格） */
export function buildSerpent(scene: Phaser.Scene, optsIn: SerpentOptions): Phaser.GameObjects.Container {
  const opts: Required<SerpentOptions> = {
    points: optsIn.points,
    headScale: optsIn.headScale ?? 0.8,
    maxRadius: optsIn.maxRadius ?? 30,
    segmentEvery: optsIn.segmentEvery ?? 88,
    alpha: optsIn.alpha ?? 0.95,
    bodyColor: optsIn.bodyColor ?? PALETTE.bamboo,
    flipHead: optsIn.flipHead ?? false,
    ornaments: optsIn.ornaments ?? true,
  };
  const parts = buildParts(scene, opts, false);
  drawFrame(parts, opts, opts.points);
  return scene.add.container(0, 0, [parts.g, ...parts.segs, parts.head]);
}

/** 游动的整龙（标题用）：每帧蛇形起伏 + 头颈随波 */
export class Serpent {
  private parts: BuiltParts;
  private opts: Required<SerpentOptions>;
  private t = 0;

  constructor(private scene: Phaser.Scene, optsIn: SerpentOptions) {
    this.opts = {
      points: optsIn.points,
      headScale: optsIn.headScale ?? 0.8,
      maxRadius: optsIn.maxRadius ?? 30,
      segmentEvery: optsIn.segmentEvery ?? 88,
      alpha: optsIn.alpha ?? 0.95,
      bodyColor: optsIn.bodyColor ?? PALETTE.bamboo,
      flipHead: optsIn.flipHead ?? false,
      ornaments: optsIn.ornaments ?? true,
    };
    this.parts = buildParts(scene, this.opts, true);
    this.draw(0);
  }

  /** delta 毫秒 */
  update(delta: number): void {
    this.t += delta;
    this.draw(this.t);
  }

  private draw(time: number): void {
    // 各控制点按相位错开的正弦起伏：波从头侧往尾侧传播
    const n = this.opts.points.length;
    const pts: Pt[] = this.opts.points.map((p, i) => {
      const phase = time * 0.0012 - (n - i) * 0.75;
      const amp = 10 + 14 * Math.sin((i / n) * Math.PI * 0.9 + 0.6);
      return { x: p.x, y: p.y + Math.sin(phase) * amp };
    });
    drawFrame(this.parts, this.opts, pts);
    // 龙头辉光呼吸
    if (this.parts.glow) {
      this.parts.glow.setAlpha(0.16 + 0.12 * Math.sin(time * 0.0018));
    }
  }
}
