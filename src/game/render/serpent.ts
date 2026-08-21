// 整龙：锥形竹青龙身 + 鱼鳞节 + 金脊 + 鹰爪 + 南派舞龙头。
// 静态用于结局定格；Serpent 供标题游动。

import Phaser from "phaser";
import { PALETTE } from "../config";
import { smoothThrough, type Pt } from "./curve";
import { DRAGON_HEAD_ORIGIN } from "./dragonArt";

export interface SerpentOptions {
  /** 控制点，从尾到头（默认左→右，龙头在最后一点） */
  points: Pt[];
  /** 龙头缩放（贴图 512×384） */
  headScale?: number;
  /** 龙身最粗处半径 */
  maxRadius?: number;
  /** 鳞节间距（像素） */
  segmentEvery?: number;
  /** 整体透明度 */
  alpha?: number;
  bodyColor?: number;
  flipHead?: boolean;
  ornaments?: boolean;
  /** 额外抬头/低头（弧度，负值抬头） */
  headTilt?: number;
}

interface BuiltParts {
  container: Phaser.GameObjects.Container;
  g: Phaser.GameObjects.Graphics;
  segs: Phaser.GameObjects.Image[];
  head: Phaser.GameObjects.Image;
  glow?: Phaser.GameObjects.Image;
}

function defaults(optsIn: SerpentOptions): Required<SerpentOptions> {
  return {
    points: optsIn.points,
    headScale: optsIn.headScale ?? 0.58,
    maxRadius: optsIn.maxRadius ?? 34,
    segmentEvery: optsIn.segmentEvery ?? 72,
    alpha: optsIn.alpha ?? 0.95,
    bodyColor: optsIn.bodyColor ?? PALETTE.bamboo,
    flipHead: optsIn.flipHead ?? false,
    ornaments: optsIn.ornaments ?? true,
    headTilt: optsIn.headTilt ?? 0,
  };
}

function tangentAt(smooth: Pt[], i: number): number {
  const prev = smooth[Math.max(0, i - 1)];
  const next = smooth[Math.min(smooth.length - 1, i + 1)];
  return Math.atan2(next.y - prev.y, next.x - prev.x);
}

function buildParts(scene: Phaser.Scene, opts: Required<SerpentOptions>, dynamic: boolean): BuiltParts {
  const container = scene.add.container(0, 0);
  const g = scene.add.graphics();
  container.add(g);
  const segs: Phaser.GameObjects.Image[] = [];
  const segCount = 24;
  for (let i = 0; i < segCount; i++) {
    const seg = scene.add.image(0, 0, "tex-segment").setAlpha(opts.alpha).setVisible(false);
    segs.push(seg);
    container.add(seg);
  }
  const head = scene.add
    .image(0, 0, "tex-dragonhead")
    .setOrigin(DRAGON_HEAD_ORIGIN.x, DRAGON_HEAD_ORIGIN.y)
    .setScale(opts.headScale)
    .setAlpha(Math.min(1, opts.alpha + 0.04));
  if (opts.flipHead) head.setFlipX(true);
  container.add(head);
  let glow: Phaser.GameObjects.Image | undefined;
  if (dynamic) {
    glow = scene.add.image(0, 0, "tex-glow").setScale(4.4, 3.2).setAlpha(0.24).setTint(0xf0c27a);
    container.add(glow);
    container.sendToBack(glow);
  }
  return { container, g, segs, head, glow };
}

function radiusAt(opts: Required<SerpentOptions>, t: number): number {
  const u = Math.max(0, Math.min(1, t));
  // 尾细，腰身尽快到最粗，并一直保持到颈根，好从后面压住脖子
  const rise = 1 - Math.pow(1 - u, 2.05);
  return opts.maxRadius * (0.26 + 0.74 * rise);
}

function drawFrame(parts: BuiltParts, opts: Required<SerpentOptions>, pts: Pt[]): void {
  const { g, segs, head, glow } = parts;
  const smooth = smoothThrough(pts, 14);
  const cum: number[] = [0];
  for (let i = 1; i < smooth.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(smooth[i].x - smooth[i - 1].x, smooth[i].y - smooth[i - 1].y));
  }
  const total = cum[cum.length - 1] || 1;
  const rAt = (t: number) => radiusAt(opts, t);

  const lastI = smooth.length - 1;
  const last = smooth[lastI];
  const neckAng = Math.atan2(last.y - smooth[Math.max(0, lastI - 5)].y, last.x - smooth[Math.max(0, lastI - 5)].x);
  const neckR = rAt(1);
  const intoHead = neckR * 1.8;
  const capX = last.x + Math.cos(neckAng) * intoHead;
  const capY = last.y + Math.sin(neckAng) * intoHead;

  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < smooth.length; i++) {
    const t = cum[i] / total;
    const r = rAt(t);
    const ang = tangentAt(smooth, i);
    const nx = Math.cos(ang - Math.PI / 2);
    const ny = Math.sin(ang - Math.PI / 2);
    left.push({ x: smooth[i].x + nx * r, y: smooth[i].y + ny * r });
    right.push({ x: smooth[i].x - nx * r, y: smooth[i].y - ny * r });
  }
  {
    const nx = Math.cos(neckAng - Math.PI / 2);
    const ny = Math.sin(neckAng - Math.PI / 2);
    left.push({ x: capX + nx * neckR, y: capY + ny * neckR });
    right.push({ x: capX - nx * neckR, y: capY - ny * neckR });
  }

  g.clear();

  // 投影
  g.fillStyle(0x05080d, 0.28 * opts.alpha);
  g.beginPath();
  g.moveTo(left[0].x + 6, left[0].y + 10);
  for (const p of left) g.lineTo(p.x + 6, p.y + 10);
  for (let i = right.length - 1; i >= 0; i--) g.lineTo(right[i].x + 6, right[i].y + 10);
  g.closePath();
  g.fillPath();

  // 龙身主体
  g.fillStyle(opts.bodyColor, opts.alpha);
  g.beginPath();
  g.moveTo(left[0].x, left[0].y);
  for (const p of left) g.lineTo(p.x, p.y);
  for (let i = right.length - 1; i >= 0; i--) g.lineTo(right[i].x, right[i].y);
  g.closePath();
  g.fillPath();
  g.lineStyle(2.2, 0x2a4032, 0.45 * opts.alpha);
  g.strokePath();

  // 背脊亮带
  g.fillStyle(0x9fc9a2, 0.38 * opts.alpha);
  for (let i = 1; i < smooth.length - 1; i += 1) {
    const t = cum[i] / total;
    const r = rAt(t);
    const ang = tangentAt(smooth, i);
    const nx = Math.cos(ang - Math.PI / 2);
    const ny = Math.sin(ang - Math.PI / 2);
    g.fillCircle(smooth[i].x + nx * r * 0.58, smooth[i].y + ny * r * 0.58, r * 0.28);
  }

  // 腹甲
  g.fillStyle(PALETTE.gold, 0.32 * opts.alpha);
  for (let i = 0; i < smooth.length; i += 2) {
    const t = cum[i] / total;
    const r = rAt(t);
    const ang = tangentAt(smooth, i);
    const nx = Math.cos(ang + Math.PI / 2);
    const ny = Math.sin(ang + Math.PI / 2);
    g.fillCircle(smooth[i].x + nx * r * 0.48, smooth[i].y + ny * r * 0.48, r * 0.22);
  }

  if (opts.ornaments) {
    // 背鳍：竹叶形，金边竹青心
    for (let at = 0.05; at < 0.9; at += 0.042) {
      const idx = smooth.findIndex((_, i) => cum[i] / total >= at);
      if (idx <= 0 || idx >= smooth.length - 1) continue;
      const p = smooth[idx];
      const t = cum[idx] / total;
      const r = rAt(t);
      const ang = tangentAt(smooth, idx);
      const nx = Math.cos(ang - Math.PI / 2);
      const ny = Math.sin(ang - Math.PI / 2);
      const tip = r + 10 + Math.sin(t * Math.PI) * 11;
      const bx = p.x + nx * r * 0.78;
      const by = p.y + ny * r * 0.78;
      const tx = Math.cos(ang) * r * 0.28;
      const ty = Math.sin(ang) * r * 0.28;
      g.fillStyle(0x4a7057, opts.alpha * 0.95);
      g.fillTriangle(bx + nx * tip, by + ny * tip, bx + tx, by + ty, bx - tx, by - ty);
      g.fillStyle(PALETTE.gold, opts.alpha * 0.7);
      g.fillTriangle(
        bx + nx * tip * 0.62, by + ny * tip * 0.62,
        bx + tx * 0.45, by + ty * 0.45,
        bx - tx * 0.45, by - ty * 0.45,
      );
    }

    // 近头颈鬃，与龙头鬃焰相接
    for (let at = 0.86; at < 0.98; at += 0.025) {
      const idx = smooth.findIndex((_, i) => cum[i] / total >= at);
      if (idx <= 0 || idx >= smooth.length - 1) continue;
      const p = smooth[idx];
      const r = rAt(cum[idx] / total);
      const ang = tangentAt(smooth, idx);
      const nx = Math.cos(ang - Math.PI / 2);
      const ny = Math.sin(ang - Math.PI / 2);
      const len = r + 16;
      const bx = p.x + nx * r * 0.7;
      const by = p.y + ny * r * 0.7;
      const tx = Math.cos(ang) * r * 0.4;
      const ty = Math.sin(ang) * r * 0.4;
      g.fillStyle(0x314a38, opts.alpha);
      g.fillTriangle(bx + nx * len, by + ny * len, bx + tx, by + ty, bx - tx, by - ty);
    }

    // 尾鳍三叶
    const tail = smooth[0];
    const tAng = Math.atan2(smooth[1].y - tail.y, smooth[1].x - tail.x);
    const lobes: Array<[number, number, number]> = [
      [-0.72, 42, 26], [0, 58, 32], [0.72, 42, 26],
    ];
    for (const [spread, long, wide] of lobes) {
      const a = tAng + Math.PI + spread;
      g.fillStyle(0x3d5c46, opts.alpha);
      g.fillTriangle(
        tail.x, tail.y,
        tail.x + Math.cos(a) * long, tail.y + Math.sin(a) * long,
        tail.x + Math.cos(a + 0.32) * wide, tail.y + Math.sin(a + 0.32) * wide,
      );
      g.fillStyle(PALETTE.gold, opts.alpha * 0.5);
      g.fillTriangle(
        tail.x, tail.y,
        tail.x + Math.cos(a) * long * 0.55, tail.y + Math.sin(a) * long * 0.55,
        tail.x + Math.cos(a + 0.2) * wide * 0.5, tail.y + Math.sin(a + 0.2) * wide * 0.5,
      );
    }

    // 鹰爪两处，四趾
    for (const at of [0.38, 0.68]) {
      const idx = smooth.findIndex((_, i) => cum[i] / total >= at);
      if (idx <= 0) continue;
      const p = smooth[idx];
      const t = cum[idx] / total;
      const r = rAt(t);
      const ang = tangentAt(smooth, idx);
      const nx = Math.cos(ang + Math.PI / 2);
      const ny = Math.sin(ang + Math.PI / 2);
      const cx = p.x + nx * (r + 7);
      const cy = p.y + ny * (r + 7);
      g.fillStyle(0x3a5440, opts.alpha);
      g.fillCircle(cx, cy, 5);
      for (const curl of [-0.72, -0.24, 0.24, 0.72]) {
        const ca = ang + Math.PI * 0.5 + curl;
        const tipx = cx + Math.cos(ca) * 24;
        const tipy = cy + Math.sin(ca) * 24;
        const ox = Math.cos(ca + Math.PI / 2) * 3.2;
        const oy = Math.sin(ca + Math.PI / 2) * 3.2;
        g.fillStyle(PALETTE.gold, opts.alpha * 0.95);
        g.fillTriangle(cx, cy, tipx + ox, tipy + oy, tipx - ox, tipy - oy);
        g.fillStyle(0xe9e0c8, opts.alpha);
        g.fillCircle(tipx, tipy, 2.1);
      }
    }
  }

  // 鳞节
  let nextAt = opts.segmentEvery * 0.45;
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
      const r = rAt(t);
      const seg = segs[segIdx++];
      seg.setPosition(x, y);
      seg.setRotation(Math.atan2(seg1.y - seg0.y, seg1.x - seg0.x));
      const s = (r / 34) * 0.82;
      seg.setScale(s, s * 0.78);
      seg.setVisible(true);
      nextAt += opts.segmentEvery;
    }
  }
  for (; segIdx < segs.length; segIdx++) segs[segIdx].setVisible(false);

  g.fillStyle(opts.bodyColor, opts.alpha);
  g.fillCircle(last.x, last.y, neckR * 1.08);
  g.fillCircle(capX, capY, neckR * 0.9);

  head.setPosition(last.x, last.y);
  head.setRotation(neckAng + opts.headTilt);
  if (glow) {
    glow.setPosition(last.x + Math.cos(neckAng) * 48, last.y + Math.sin(neckAng) * 48);
  }
}

export function buildSerpent(scene: Phaser.Scene, optsIn: SerpentOptions): Phaser.GameObjects.Container {
  const opts = defaults(optsIn);
  const parts = buildParts(scene, opts, false);
  drawFrame(parts, opts, opts.points);
  return parts.container;
}

export class Serpent {
  readonly container: Phaser.GameObjects.Container;
  private parts: BuiltParts;
  private opts: Required<SerpentOptions>;
  private t = 0;

  constructor(private scene: Phaser.Scene, optsIn: SerpentOptions) {
    this.opts = defaults(optsIn);
    this.parts = buildParts(scene, this.opts, true);
    this.container = this.parts.container;
    this.draw(0);
  }

  get headPos(): { x: number; y: number } {
    return { x: this.parts.head.x, y: this.parts.head.y };
  }

  get headAngle(): number {
    return this.parts.head.rotation;
  }

  /** 冻结到稳定姿态，供开场跳过与离场使用。 */
  settle(): void {
    this.t = 0;
    this.draw(0);
  }

  update(delta: number): void {
    this.t += delta;
    this.draw(this.t);
  }

  private draw(time: number): void {
    const n = this.opts.points.length;
    const pts: Pt[] = this.opts.points.map((p, i) => {
      // 5.6 秒呼吸，幅度约 8–14 像素
      const phase = time * (Math.PI * 2 / 5600) - (n - i) * 0.62;
      const amp = 8 + 6 * Math.sin((i / n) * Math.PI * 0.92 + 0.4);
      const xWave = Math.cos(phase * 0.55) * (3 + 5 * (i / n));
      return { x: p.x + xWave, y: p.y + Math.sin(phase) * amp };
    });
    drawFrame(this.parts, this.opts, pts);
    if (this.parts.glow) {
      this.parts.glow.setAlpha(0.12 + 0.08 * Math.sin(time * 0.0011));
    }
  }
}
