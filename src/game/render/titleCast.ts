// 首页主体：阿零、托杆、舞龙队剪影与蓝图辅助。阿零始终朝向主舞台，不完整回望。

import Phaser from "phaser";
import { PALETTE } from "../config";
import { Serpent } from "./serpent";
import { TITLE_DRAGON_POINTS, TITLE_POSE, TITLE_TEAM_X } from "./titleLayout";
import { DRAGON_HEAD_W } from "./dragonArt";

const SILVER = 0xb7c2c8;
const STEEL = 0x8a97a0;
const CAVITY = 0x3e4a52;
const BAMBOO = 0x5f8060;
const INDIGO = 0x1a2a38;
const XIAOMAN = 0x3d604c;

export class TitleCast {
  readonly root: Phaser.GameObjects.Container;
  readonly fx: Phaser.GameObjects.Container;
  private serpent: Serpent;
  private azeroG: Phaser.GameObjects.Graphics;
  private peopleG: Phaser.GameObjects.Graphics;
  private poleG: Phaser.GameObjects.Graphics;
  private ringG: Phaser.GameObjects.Graphics;
  private predictG: Phaser.GameObjects.Graphics;
  private scanAmt = 0;
  private jointAmt = 0;
  private predictAmt = 0;
  private predictPhase = 0;
  private xiaomanGrip = 0;
  private nextScanAt = 0;
  private scanning = false;
  private scanT = 0;
  private nextGripAt = 0;
  private gripping = false;
  private gripT = 0;
  private age = 0;
  private hands = { x: 1412, y: 548 };
  private high = { x: 1818, y: 277 };

  constructor(private scene: Phaser.Scene) {
    this.root = scene.add.container(0, 0).setDepth(175);
    this.fx = scene.add.container(0, 0).setDepth(230);

    this.peopleG = scene.add.graphics();
    this.azeroG = scene.add.graphics();
    this.poleG = scene.add.graphics();
    this.serpent = new Serpent(scene, {
      points: TITLE_DRAGON_POINTS,
      headScale: TITLE_POSE.head.w / DRAGON_HEAD_W,
      maxRadius: 29,
      segmentEvery: 64,
      alpha: 0.96,
      headTilt: -0.12,
    });
    this.root.add([this.peopleG, this.serpent.container, this.azeroG, this.poleG]);

    this.ringG = scene.add.graphics();
    this.predictG = scene.add.graphics();
    this.fx.add([this.ringG, this.predictG]);

    this.nextScanAt = 9000 + Math.random() * 5000;
    this.nextGripAt = 12000 + Math.random() * 6000;
  }

  setShiftX(dx: number): void {
    this.root.x = dx;
    this.fx.x = dx;
  }

  setIntroPose(opts: { dragonX?: number; dragonA?: number; joint?: number; predict?: number; scan?: number }): void {
    if (opts.dragonX != null) this.serpent.container.x = opts.dragonX;
    if (opts.dragonA != null) this.serpent.container.setAlpha(opts.dragonA);
    if (opts.joint != null) this.jointAmt = opts.joint;
    if (opts.predict != null) this.predictAmt = opts.predict;
    if (opts.scan != null) this.scanAmt = opts.scan;
  }

  settleIntro(): void {
    this.serpent.container.x = 0;
    this.serpent.container.setAlpha(1);
    this.serpent.settle();
    this.jointAmt = 1;
    this.predictAmt = 1;
    this.scanAmt = 0;
    this.redraw();
  }

  update(delta: number, introLocked: boolean): void {
    this.age += delta;
    this.serpent.update(delta);
    if (!introLocked) {
      this.tickIdle(delta);
    }
    this.predictPhase += delta / 6000;
    this.redraw();
  }

  private tickIdle(delta: number): void {
    if (!this.scanning && this.age >= this.nextScanAt) {
      this.scanning = true;
      this.scanT = 0;
    }
    if (this.scanning) {
      this.scanT += delta;
      const u = Math.min(1, this.scanT / 900);
      this.scanAmt = Math.sin(u * Math.PI);
      if (u >= 1) {
        this.scanning = false;
        this.scanAmt = 0;
        this.nextScanAt = this.age + 9000 + Math.random() * 5000;
      }
    }

    if (!this.gripping && this.age >= this.nextGripAt) {
      this.gripping = true;
      this.gripT = 0;
    }
    if (this.gripping) {
      this.gripT += delta;
      const u = Math.min(1, this.gripT / 700);
      this.xiaomanGrip = Math.sin(u * Math.PI);
      if (u >= 1) {
        this.gripping = false;
        this.xiaomanGrip = 0;
        this.nextGripAt = this.age + 12000 + Math.random() * 6000;
      }
    }
  }

  private redraw(): void {
    this.drawPeople();
    this.drawAzero();
    this.drawPole();
    this.drawFx();
  }

  private drawPeople(): void {
    const g = this.peopleG;
    g.clear();
    this.drawZhou(g);
    const feetY = [812, 828, 836, 822];
    const heights = [0.92, 1, 0.96, 1.06];
    TITLE_TEAM_X.forEach((x, i) => {
      if (i === 0) this.drawXiaoman(g, x, feetY[i]);
      else this.drawMember(g, x, feetY[i], heights[i], i);
    });
  }

  private drawZhou(g: Phaser.GameObjects.Graphics): void {
    const cx = TITLE_POSE.zhou.x;
    const cy = TITLE_POSE.zhou.y;
    const footY = cy + 148;
    g.fillStyle(0x05080d, 0.28);
    g.fillEllipse(cx, footY + 4, 52, 12);
    // 鼓
    const dx = TITLE_POSE.drum.x;
    const dy = TITLE_POSE.drum.y;
    g.fillStyle(0x4a3424, 1);
    g.fillEllipse(dx, dy + 36, 38, 12);
    g.fillStyle(0x6a4a32, 1);
    g.fillRect(dx - 6, dy + 8, 12, 28);
    g.fillStyle(0x8a5a38, 1);
    g.fillEllipse(dx, dy, 46, 22);
    g.lineStyle(3, PALETTE.gold, 0.85);
    g.strokeEllipse(dx, dy, 46, 22);
    g.fillStyle(0xd4c4a0, 0.9);
    g.fillEllipse(dx, dy - 2, 32, 14);
    // 身：宽而低，深靛长褂
    g.fillStyle(INDIGO, 1);
    g.fillTriangle(cx - 22, footY, cx + 20, footY, cx + 4, cy - 36);
    g.fillStyle(0x24384a, 1);
    g.fillRect(cx - 16, cy - 8, 32, 46);
    g.fillStyle(0x15202c, 1);
    g.fillCircle(cx + 2, cy - 52, 13);
    // 旧铜护腕
    g.fillStyle(PALETTE.gold, 0.9);
    g.fillRect(cx - 28, cy + 10, 10, 8);
    g.fillRect(cx + 18, cy + 18, 10, 8);
    // 鼓槌
    g.lineStyle(3, 0x3a2a1c, 1);
    g.beginPath();
    g.moveTo(cx - 18, cy + 14);
    g.lineTo(dx - 8, dy - 6);
    g.strokePath();
  }

  private drawXiaoman(g: Phaser.GameObjects.Graphics, x: number, footY: number): void {
    const grip = this.xiaomanGrip * 7;
    const sway = Math.sin(this.age * 0.0011) * 1.2;
    const top = footY - 318 + grip * 0.4;
    g.fillStyle(0x05080d, 0.3);
    g.fillEllipse(x, footY + 3, 46, 11);
    g.lineStyle(8, XIAOMAN, 1);
    g.beginPath();
    g.moveTo(x - 7 + sway, footY);
    g.lineTo(x - 2, footY - 118);
    g.strokePath();
    g.beginPath();
    g.moveTo(x + 9 - sway, footY);
    g.lineTo(x + 2, footY - 118);
    g.strokePath();
    g.fillStyle(0x4a7358, 1);
    g.fillTriangle(x - 18, footY - 112, x + 20, footY - 108, x + 6, top + 86);
    g.fillStyle(0xe9e0c8, 0.85);
    g.fillRect(x - 7, top + 96, 14, 22);
    g.fillStyle(PALETTE.cinnabar, 0.95);
    g.fillRect(x - 16, footY - 168, 30, 6);
    g.fillStyle(0x3d604c, 1);
    g.fillCircle(x + 8 + sway * 0.4, top + 22, 13);
    const handY = footY - 168 - grip;
    g.lineStyle(6, XIAOMAN, 1);
    g.beginPath();
    g.moveTo(x + 8, footY - 196);
    g.lineTo(x + 4, handY);
    g.strokePath();
    g.fillStyle(0x2c4a38, 1);
    g.fillCircle(x + 4, handY, 6);
  }

  private drawMember(g: Phaser.GameObjects.Graphics, x: number, footY: number, scale: number, idx: number): void {
    const h = 268 * scale;
    const sway = Math.sin(this.age * 0.0009 + idx * 1.7) * 1.6;
    const top = footY - h;
    const c = 0x24333f;
    g.fillStyle(0x05080d, 0.26);
    g.fillEllipse(x, footY + 3, 40 * scale, 10);
    g.fillStyle(c, 0.96);
    g.fillTriangle(x - 14 * scale, footY, x + 13 * scale, footY, x + sway, top + 70);
    g.fillRect(x - 11 * scale + sway * 0.2, top + 66, 22 * scale, h * 0.38);
    g.fillCircle(x + 4 + sway, top + 22, 9 * scale);
    g.lineStyle(5 * scale, c, 0.95);
    const holdY = top + 90 - idx * 18;
    g.beginPath();
    g.moveTo(x, top + 78);
    g.lineTo(x - 2, holdY);
    g.strokePath();
  }

  private drawAzero(): void {
    const g = this.azeroG;
    g.clear();
    const x = TITLE_POSE.azeroFoot.x;
    const footY = TITLE_POSE.azeroFoot.y;
    const H = TITLE_POSE.azeroH;
    const headH = H / 8;
    const scan = this.scanAmt;
    // 躯干不回转；扫描只带动头部与缝
    const headYaw = -scan * 18;
    const lean = 10;

    g.fillStyle(0x05080d, 0.38);
    g.fillEllipse(x + 8, footY + 6, 78, 16);

    const ankleY = footY - 18;
    const kneeY = footY - 118;
    const hipY = footY - 214;
    const waistY = footY - 292;
    const chestY = footY - 400;
    const shoulderY = footY - 458;
    const neckY = footY - 498;
    const headTop = footY - H;

    const torsoX = x + lean;
    // 腿
    this.plate(g, torsoX - 22, hipY, torsoX - 28, ankleY, 16, CAVITY);
    this.plate(g, torsoX + 18, hipY, torsoX + 26, ankleY, 16, CAVITY);
    g.fillStyle(STEEL, 1);
    g.fillRoundedRect(torsoX - 36, ankleY - 8, 22, 16, 4);
    g.fillRoundedRect(torsoX + 16, ankleY - 8, 24, 16, 4);
    // 竹节护胫
    g.fillStyle(BAMBOO, 0.92);
    g.fillRoundedRect(torsoX - 34, kneeY + 24, 18, 52, 4);
    g.fillRoundedRect(torsoX + 18, kneeY + 24, 18, 52, 4);
    g.lineStyle(2, 0x3d5644, 0.8);
    for (const yy of [kneeY + 36, kneeY + 52, kneeY + 68]) {
      g.beginPath();
      g.moveTo(torsoX - 34, yy);
      g.lineTo(torsoX - 16, yy);
      g.strokePath();
      g.beginPath();
      g.moveTo(torsoX + 18, yy);
      g.lineTo(torsoX + 36, yy);
      g.strokePath();
    }

    // 髋与腰
    g.fillStyle(STEEL, 1);
    g.fillRoundedRect(torsoX - 28, hipY - 18, 56, 36, 8);
    g.fillStyle(CAVITY, 1);
    g.fillRoundedRect(torsoX - 18, waistY, 38, hipY - waistY, 6);

    // 胸甲 + 竹节环
    g.fillStyle(SILVER, 1);
    g.fillRoundedRect(torsoX - 26, chestY, 54, waistY - chestY + 8, 8);
    g.fillStyle(BAMBOO, 0.9);
    g.fillRoundedRect(torsoX - 30, chestY + 12, 16, 64, 4);
    g.fillRoundedRect(torsoX + 16, chestY + 12, 16, 64, 4);
    g.lineStyle(3, BAMBOO, 0.95);
    for (let i = 0; i < 3; i++) {
      const yy = chestY + 28 + i * 28;
      g.beginPath();
      g.moveTo(torsoX - 22, yy);
      g.lineTo(torsoX + 28, yy);
      g.strokePath();
    }

    // 肩甲
    g.fillStyle(BAMBOO, 1);
    g.fillRoundedRect(torsoX - 42, shoulderY - 8, 28, 26, 6);
    g.fillRoundedRect(torsoX + 18, shoulderY - 10, 32, 28, 6);
    g.fillStyle(SILVER, 1);
    g.fillRoundedRect(torsoX - 14, shoulderY - 6, 30, 20, 5);

    // 后臂（左，更细）
    g.lineStyle(11, STEEL, 1);
    g.beginPath();
    g.moveTo(torsoX - 24, shoulderY + 10);
    g.lineTo(torsoX - 48, shoulderY + 64);
    g.lineTo(torsoX - 22, chestY + 86);
    g.strokePath();

    // 持杆前臂
    const handX = x + 42;
    const handY = shoulderY + 86;
    this.hands = { x: handX, y: handY };
    g.lineStyle(13, SILVER, 1);
    g.beginPath();
    g.moveTo(torsoX + 28, shoulderY + 8);
    g.lineTo(torsoX + 46, shoulderY + 48);
    g.lineTo(handX, handY);
    g.strokePath();
    g.fillStyle(BAMBOO, 1);
    g.fillRoundedRect(torsoX + 36, shoulderY + 36, 20, 28, 4);
    g.fillStyle(STEEL, 1);
    g.fillCircle(handX, handY, 9);

    // 颈与头：无五官，扫描缝可后扫 45°
    const hx = torsoX + 10 + headYaw;
    const hy = neckY - headH * 0.35;
    g.lineStyle(10, SILVER, 1);
    g.beginPath();
    g.moveTo(torsoX + 4, shoulderY);
    g.lineTo(hx, hy + 18);
    g.strokePath();
    g.fillStyle(0xc5ced4, 1);
    g.fillRoundedRect(hx - 22, headTop + 8, 48, headH + 6, 10);
    g.fillStyle(CAVITY, 1);
    g.fillRoundedRect(hx - 16, headTop + 16, 36, headH - 14, 6);
    const seamRot = -0.15 - scan * (Math.PI / 4);
    const seamLen = 34;
    const sx = hx + 2;
    const sy = hy + 2;
    const c = Math.cos(seamRot);
    const s = Math.sin(seamRot);
    g.fillStyle(PALETTE.blueprint, 0.95);
    g.beginPath();
    const hw = seamLen / 2;
    const hh = 3.2;
    const corners = [
      { x: -hw, y: -hh },
      { x: hw, y: -hh },
      { x: hw, y: hh },
      { x: -hw, y: hh },
    ].map((p) => ({ x: sx + p.x * c - p.y * s, y: sy + p.x * s + p.y * c }));
    g.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 4; i++) g.lineTo(corners[i].x, corners[i].y);
    g.closePath();
    g.fillPath();

    // 朱砂关节
    const joints = [
      [torsoX - 28, ankleY],
      [torsoX + 26, ankleY],
      [torsoX - 24, kneeY],
      [torsoX + 22, kneeY],
      [torsoX, hipY],
      [torsoX + 28, shoulderY + 8],
      [handX, handY],
      [torsoX + 4, shoulderY],
    ] as const;
    g.lineStyle(2, 0x2a3238, 0.9);
    g.strokeRoundedRect(torsoX - 26, chestY, 54, waistY - chestY + 8, 8);
    g.strokeRoundedRect(hx - 22, headTop + 8, 48, headH + 6, 10);
    g.fillStyle(PALETTE.cinnabar, 1);
    for (const [jx, jy] of joints) g.fillCircle(jx, jy, 4.2);
  }

  private plate(
    g: Phaser.GameObjects.Graphics,
    x0: number, y0: number, x1: number, y1: number, w: number, color: number,
  ): void {
    g.lineStyle(w, color, 1);
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.strokePath();
  }

  private drawPole(): void {
    const g = this.poleG;
    g.clear();
    const neck = this.serpent.headPos;
    const h = this.hands;
    const mx = (h.x + neck.x) / 2 + 10;
    const my = (h.y + neck.y) / 2 + 18; // 承重下垂
    g.lineStyle(7, 0x6f5a38, 1);
    g.beginPath();
    g.moveTo(h.x, h.y);
    g.lineTo(mx, my);
    g.lineTo(neck.x, neck.y + 8);
    g.strokePath();
    g.lineStyle(2.5, PALETTE.gold, 0.55);
    g.beginPath();
    g.moveTo(h.x, h.y);
    g.lineTo(mx, my);
    g.lineTo(neck.x, neck.y + 8);
    g.strokePath();
  }

  private drawFx(): void {
    const rg = this.ringG;
    const pg = this.predictG;
    rg.clear();
    pg.clear();
    const a = 0.38 * this.jointAmt;
    if (a > 0.02) {
      const groups = [
        { x: TITLE_POSE.azeroFoot.x + 4, y: TITLE_POSE.azeroFoot.y - 20, r: 28 },
        { x: this.hands.x - 8, y: this.hands.y - 8, r: 36 },
        { x: TITLE_POSE.azeroFoot.x + 16, y: TITLE_POSE.azeroFoot.y - 458, r: 42 },
      ];
      groups.forEach((c, i) => {
        rg.lineStyle(1.5, PALETTE.blueprint, a * (0.7 + 0.3 * ((i + 1) / 3)));
        rg.strokeCircle(c.x, c.y, c.r);
        rg.lineStyle(1, PALETTE.blueprint, a * 0.45);
        rg.strokeCircle(c.x, c.y, c.r * 0.72);
        rg.fillStyle(PALETTE.blueprint, a * 0.5);
        rg.fillCircle(c.x + c.r, c.y, 2);
      });
    }

    if (this.predictAmt < 0.02) return;
    const neck = this.serpent.headPos;
    const h = this.hands;
    const vx = this.high.x - neck.x;
    const vy = this.high.y - neck.y;
    const d = Math.hypot(vx, vy) || 1;
    const cap = Math.min(d, TITLE_POSE.predictMax) * this.predictAmt;
    const hx = neck.x + (vx / d) * cap;
    const hy = neck.y + (vy / d) * cap;
    const pts = [
      { x: h.x, y: h.y },
      { x: (h.x + neck.x) / 2 + 10, y: (h.y + neck.y) / 2 + 18 },
      { x: neck.x, y: neck.y },
      { x: hx, y: hy },
    ];
    this.dashPolyline(pg, pts, 18, 12, this.predictPhase * 30, 0.52 * this.predictAmt);
    if (this.predictAmt > 0.85) {
      pg.lineStyle(1, PALETTE.blueprint, 0.7);
      pg.strokeCircle(h.x - 16, h.y - 18, 9);
      pg.fillStyle(PALETTE.blueprint, 0.8);
      pg.fillRect(h.x - 22, h.y - 24, 2, 8);
      pg.fillRect(h.x - 26, h.y - 20, 8, 2);
    }
  }

  private dashPolyline(
    g: Phaser.GameObjects.Graphics,
    pts: Array<{ x: number; y: number }>,
    on: number, off: number, phase: number, alpha: number,
  ): void {
    const period = on + off;
    let dist = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const x0 = pts[i].x;
      const y0 = pts[i].y;
      const x1 = pts[i + 1].x;
      const y1 = pts[i + 1].y;
      const len = Math.hypot(x1 - x0, y1 - y0) || 1;
      const ux = (x1 - x0) / len;
      const uy = (y1 - y0) / len;
      let local = 0;
      while (local < len) {
        const world = dist + local;
        const m = ((world + phase) % period + period) % period;
        const draw = m < on;
        const remain = draw ? on - m : period - m;
        const step = Math.min(remain, len - local);
        if (draw) {
          g.lineStyle(3, PALETTE.blueprint, alpha);
          g.beginPath();
          g.moveTo(x0 + ux * local, y0 + uy * local);
          g.lineTo(x0 + ux * (local + step), y0 + uy * (local + step));
          g.strokePath();
        }
        if (step <= 0.001) break;
        local += step;
      }
      dist += len;
    }
  }
}
