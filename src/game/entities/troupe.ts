// 龙队：阿零（龙头手）+ 小满 + 三名低细节队员 + 龙头与四段龙身。
// 龙头由动作曲线驱动；龙身用“跟随者”弹簧链模拟——龙头的选择会沿杆件传给所有人。

import Phaser from "phaser";
import { PALETTE } from "../config";
import { strokeQuad } from "../render/curve";
import { DRAGON_HEAD_ORIGIN } from "../render/dragonArt";
import type { MoveId } from "../../../shared/types";

const GROUND_Y = 790;

interface ChainNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface TroupeState {
  /** 0–9 的连续拍位（含小数） */
  beatFloat: number;
  currentMove: MoveId | null;
  /** 当前动作内进度 0–1 */
  moveT: number;
  amplitude: number;
  /** 迟疑(+) / 抢拍(−) 毫秒 */
  lagMs: number;
  lookBack: boolean;
  teamStrained: boolean;
  incident: boolean;
}

/** 每拍水平推进基准 */
const ADVANCE_PER_BEAT = 128;
const TROUPE_START_X = 430;

export class TroupeRenderer {
  private g: Phaser.GameObjects.Graphics;
  private head: Phaser.GameObjects.Image;
  private segments: Phaser.GameObjects.Image[] = [];
  private scan: Phaser.GameObjects.Image;
  private headNode: ChainNode = { x: TROUPE_START_X, y: GROUND_Y - 96, vx: 0, vy: 0 };
  private chain: ChainNode[] = [];
  private history: Array<{ x: number; y: number; a: number }> = [];
  private scanPulse = 0;
  private breath = 0;
  private headTurnVis = 0;
  private lookBackFlag = false;
  private incidentFlag = false;
  private teamStrainedFlag = false;

  setLookBack(v: boolean): void {
    this.lookBackFlag = v;
  }

  isLookBack(): boolean {
    return this.lookBackFlag;
  }

  setIncidentFlag(v: boolean): void {
    this.incidentFlag = v;
  }

  isIncident(): boolean {
    return this.incidentFlag;
  }

  setTeamStrained(v: boolean): void {
    this.teamStrainedFlag = v;
  }

  getTeamStrained(): boolean {
    return this.teamStrainedFlag;
  }

  constructor(private scene: Phaser.Scene) {
    this.g = scene.add.graphics();
    this.head = scene.add.image(0, 0, "tex-dragonhead")
      .setOrigin(DRAGON_HEAD_ORIGIN.x, DRAGON_HEAD_ORIGIN.y)
      .setScale(0.46);
    this.scan = scene.add.image(0, 0, "tex-scan").setVisible(false);
    for (let i = 0; i < 4; i++) {
      const seg = scene.add.image(0, 0, "tex-segment");
      this.segments.push(seg);
      this.chain.push({ x: TROUPE_START_X - 90 * (i + 1), y: GROUND_Y - 88, vx: 0, vy: 0 });
    }
  }

  reset(): void {
    this.headNode = { x: TROUPE_START_X, y: GROUND_Y - 96, vx: 0, vy: 0 };
    this.chain = this.chain.map((_, i) => ({ x: TROUPE_START_X - 90 * (i + 1), y: GROUND_Y - 88, vx: 0, vy: 0 }));
    this.history = [];
    this.headTurnVis = 0;
  }

  get headPos(): { x: number; y: number } {
    return { x: this.headNode.x, y: this.headNode.y };
  }

  get trail(): Array<{ x: number; y: number; a: number }> {
    return this.history;
  }

  /** 动作驱动的龙头目标位置 */
  private targetFor(state: TroupeState): { x: number; y: number; turn: number } {
    const beat = state.beatFloat;
    const baseX = TROUPE_START_X + (beat - 1) * ADVANCE_PER_BEAT;
    const t = state.moveT;
    const a = state.amplitude;
    let y = GROUND_Y - 96;
    let x = baseX;
    let turn = 0;

    switch (state.currentMove) {
      case "probe": {
        y += 10 * Math.sin(t * Math.PI);
        x += 26 * Math.sin(t * Math.PI);
        this.scanPulse = 1;
        break;
      }
      case "thread": {
        y += 16 * Math.sin(t * Math.PI) - 8;
        x += 30 * Math.sin(t * Math.PI);
        break;
      }
      case "rise": {
        y -= 92 * a * Math.sin(t * Math.PI);
        break;
      }
      case "coil": {
        // 两拍画一个圆
        const ang = t * Math.PI * 2 - Math.PI / 2;
        x += Math.cos(ang) * 52 - 20;
        y += Math.sin(ang) * 46 - 6;
        break;
      }
      case "leap": {
        if (t < 0.32) {
          y += 26 * Math.sin((t / 0.32) * Math.PI * 0.5); // 压低蓄力
        } else {
          const p = (t - 0.32) / 0.68;
          y -= 232 * a * Math.sin(p * Math.PI);
        }
        break;
      }
      case "lookBack": {
        turn = Math.sin(t * Math.PI);
        x -= 22 * Math.sin(t * Math.PI);
        y += 6 * Math.sin(t * Math.PI);
        break;
      }
      default: {
        // 待机微呼吸
        y += Math.sin(this.breath) * 2;
      }
    }
    return { x, y, turn };
  }

  update(dtMs: number, stateIn: TroupeState): void {
    const dt = Math.min(dtMs, 50) / 1000;
    this.breath += dt * 1.6;
    const state: TroupeState = {
      ...stateIn,
      lookBack: stateIn.lookBack || this.lookBackFlag,
      teamStrained: stateIn.teamStrained || this.teamStrainedFlag,
      incident: stateIn.incident || this.incidentFlag,
    };

    const target = this.targetFor(state);

    // 龙头弹簧跟随（迟疑/抢拍调制响应速度）
    const lagFactor = Phaser.Math.Clamp(1 - state.lagMs / 900, 0.35, 1.6);
    const stiffness = 62 * lagFactor;
    const damping = 11;
    this.headNode.vx += (target.x - this.headNode.x) * stiffness * dt;
    this.headNode.vy += (target.y - this.headNode.y) * stiffness * dt;
    this.headNode.vx *= Math.exp(-damping * dt);
    this.headNode.vy *= Math.exp(-damping * dt);
    this.headNode.x += this.headNode.vx * dt;
    this.headNode.y += this.headNode.vy * dt;

    // 链式龙身：每节跟随前一节，距离约束 + 弹簧
    let prev: ChainNode = this.headNode;
    for (const node of this.chain) {
      const dx = node.x - prev.x;
      const dy = node.y - prev.y;
      const dist = Math.hypot(dx, dy) || 1;
      const rest = 96;
      const strain = state.teamStrained ? 1.28 : 1.0;
      const f = ((dist - rest * strain) / dist) * 160;
      node.vx -= dx * f * dt;
      node.vy -= dy * f * dt;
      node.vx *= Math.exp(-9 * dt);
      node.vy *= Math.exp(-9 * dt);
      node.x += node.vx * dt;
      node.y += node.vy * dt;
      node.y = Math.min(node.y, GROUND_Y - 30);
      prev = node;
    }

    // 轨迹采样
    this.history.push({ x: this.headNode.x, y: this.headNode.y, a: state.amplitude });
    if (this.history.length > 260) this.history.shift();

    // 回望视觉量
    const wantTurn = state.lookBack ? 1 : target.turn;
    this.headTurnVis += (wantTurn - this.headTurnVis) * Math.min(1, dt * 7);

    this.render(state);
  }

  private render(state: TroupeState): void {
    const g = this.g;
    g.clear();

    const members = [
      { x: this.headNode.x - 96, y: GROUND_Y, lead: false, detail: true }, // 小满（紧随龙头）
      { x: this.chain[0].x - 74, y: GROUND_Y, lead: false, detail: false },
      { x: this.chain[1].x - 70, y: GROUND_Y, lead: false, detail: false },
      { x: this.chain[2].x - 66, y: GROUND_Y, lead: false, detail: false },
    ];

    // —— 阿零（龙头手）——
    const azeroX = this.headNode.x + 34;
    const azeroY = GROUND_Y;
    this.drawAzero(g, azeroX, azeroY, this.headNode.x, this.headNode.y, state);

    // —— 杆件（阿零 → 龙头 → 各节）——
    g.lineStyle(4, 0x8a7248, 0.9);
    g.beginPath();
    g.moveTo(azeroX - 4, azeroY - 58);
    g.lineTo(this.headNode.x, this.headNode.y);
    g.strokePath();
    for (let i = 0; i < this.chain.length; i++) {
      const node = this.chain[i];
      const holder = members[i];
      g.lineStyle(3.5, 0x8a7248, 0.85);
      g.beginPath();
      g.moveTo(holder.x, holder.y - 52);
      g.lineTo(node.x, node.y);
      g.strokePath();
      // 张力线（脱节时变红拉直）
      const strain = state.teamStrained;
      const prevNode = i === 0 ? this.headNode : this.chain[i - 1];
      const dx = node.x - prevNode.x;
      const dy = node.y - prevNode.y;
      const sag = strain ? 2 : 18 - Math.hypot(node.vx, node.vy) * 0.6;
      g.lineStyle(2, strain ? PALETTE.cinnabar : PALETTE.gold, strain ? 0.95 : 0.5);
      strokeQuad(
        g,
        { x: prevNode.x, y: prevNode.y + 26 },
        { x: (prevNode.x + node.x) / 2, y: (prevNode.y + node.y) / 2 + 34 + sag },
        { x: node.x, y: node.y + 26 }
      );
    }

    // —— 接地阴影（先画，垫在所有人脚下）——
    g.fillStyle(0x05080d, 0.3);
    for (const m of members) g.fillEllipse(m.x, m.y + 2, 56, 14);
    g.fillEllipse(azeroX, azeroY + 2, 52, 13);
    const headShadowScale = 1 - Math.min(1, Math.max(0, (GROUND_Y - 40 - this.headNode.y) / 260));
    g.fillEllipse(this.headNode.x, GROUND_Y + 4, 90 * headShadowScale + 26, 13);

    // —— 队员 ——
    for (const m of members) this.drawMember(g, m.x, m.y, m.detail, state.teamStrained);

    // —— 龙身节（朝向链上前一节，低速时不乱转）——
    for (let i = 0; i < this.chain.length; i++) {
      const node = this.chain[i];
      const seg = this.segments[i];
      seg.setPosition(node.x, node.y);
      const ahead = i === 0 ? this.headNode : this.chain[i - 1];
      const ang = Math.atan2(ahead.y - node.y, ahead.x - node.x);
      seg.setRotation(ang);
      seg.setScale(0.64 - i * 0.05);
      seg.setDepth(40 - i);
      if (state.teamStrained) seg.setTint(0x8fae8f);
      else seg.clearTint();
    }

    // —— 龙头 ——
    this.head.setPosition(this.headNode.x, this.headNode.y);
    const headAng = Math.atan2(this.headNode.vy, Math.max(30, this.headNode.vx));
    this.head.setRotation(headAng * 0.35 - this.headTurnVis * 2.35);
    this.head.setDepth(50);
    if (state.teamStrained) this.head.setTint(0x9dbd9d);
    else this.head.clearTint();

    // —— 探的扫描扇面 ——
    if (state.currentMove === "probe") {
      this.scanPulse = Math.max(this.scanPulse, 0.5);
    }
    this.scanPulse *= 0.9;
    if (this.scanPulse > 0.08) {
      this.scan.setVisible(true);
      this.scan.setPosition(this.headNode.x + 168, this.headNode.y - 10);
      this.scan.setScale(2.6 * this.scanPulse + 1);
      this.scan.setAlpha(Math.min(0.8, this.scanPulse));
    } else {
      this.scan.setVisible(false);
    }
  }

  /** 阿零：修长人形，银灰骨架 + 竹节护片 + 蓝图扫描缝 */
  private drawAzero(
    g: Phaser.GameObjects.Graphics,
    x: number,
    footY: number,
    headX: number,
    headY: number,
    state: TroupeState
  ): void {
    const lean = Phaser.Math.Clamp((headX - x) / 90, -0.5, 0.5);
    const stride = Math.sin(state.beatFloat * Math.PI) * 8;
    const hipY = footY - 52;
    const shoulderY = footY - 104;
    const torsoX = x - 6;
    const silver = 0x9aa7b0;
    const dark = 0x5c6a74;

    // 腿
    g.lineStyle(6, dark, 1);
    g.beginPath();
    g.moveTo(torsoX, hipY);
    g.lineTo(torsoX - 12 + stride, footY);
    g.strokePath();
    g.beginPath();
    g.moveTo(torsoX, hipY);
    g.lineTo(torsoX + 12 - stride, footY);
    g.strokePath();
    // 足
    g.fillStyle(dark, 1);
    g.fillRect(torsoX - 18 + stride, footY - 5, 14, 5);
    g.fillRect(torsoX + 6 - stride, footY - 5, 14, 5);

    // 躯干（竹节护片）
    const leanX = lean * 8;
    g.lineStyle(9, silver, 1);
    g.beginPath();
    g.moveTo(torsoX, hipY);
    g.lineTo(torsoX + leanX, shoulderY);
    g.strokePath();
    // 竹节环
    g.lineStyle(2, PALETTE.bamboo, 0.95);
    for (let i = 1; i <= 3; i++) {
      const yy = hipY - (shoulderY - hipY) * (i / 3.4);
      const xx = torsoX + leanX * (i / 3.4);
      g.beginPath();
      g.moveTo(xx - 6, yy);
      g.lineTo(xx + 6, yy);
      g.strokePath();
    }
    // 朱砂关节
    g.fillStyle(PALETTE.cinnabar, 1);
    g.fillCircle(torsoX, hipY, 3.4);
    g.fillCircle(torsoX + leanX, shoulderY, 3.4);

    // 持杆手臂
    const handX = x - 4;
    const handY = footY - 58;
    g.lineStyle(5, silver, 1);
    g.beginPath();
    g.moveTo(torsoX + leanX, shoulderY + 4);
    g.lineTo(handX - 10, shoulderY + 26);
    g.lineTo(handX, handY);
    g.strokePath();

    // 头（扫描缝朝向动作方向）
    const headTilt = Phaser.Math.Clamp((headY - (footY - 120)) / 60, -1, 1);
    const facingBack = this.headTurnVis > 0.55;
    const hx = torsoX + leanX + (facingBack ? -13 : 8);
    const hy = shoulderY - 20 + headTilt * 4;
    g.lineStyle(5, silver, 1);
    g.beginPath();
    g.moveTo(torsoX + leanX, shoulderY);
    g.lineTo(hx, hy + 6);
    g.strokePath();
    g.fillStyle(0xb9c4cc, 1);
    g.fillRoundedRect(hx - 9, hy - 16, 20, 22, 5);
    // 扫描缝
    g.fillStyle(PALETTE.blueprint, 1);
    g.fillRect(facingBack ? hx - 11 : hx - 5, hy - 8, 16, 3);
    if (state.incident) {
      // 决策停顿：扫描缝闪朱砂
      g.fillStyle(PALETTE.cinnabar, 0.9);
      g.fillRect(facingBack ? hx - 11 : hx - 5, hy - 8, 16, 3);
    }
  }

  /** 队员：小满有细节，其余为低细节剪影 */
  private drawMember(g: Phaser.GameObjects.Graphics, x: number, footY: number, detail: boolean, strained: boolean): void {
    const sway = Math.sin(this.breath + x * 0.01) * (strained ? 4 : 2);
    if (detail) {
      // 小满：轻、前倾
      const c = 0x31503f;
      g.lineStyle(5.5, c, 1);
      g.beginPath();
      g.moveTo(x, footY - 48);
      g.lineTo(x - 6, footY);
      g.strokePath();
      g.beginPath();
      g.moveTo(x, footY - 48);
      g.lineTo(x + 7, footY);
      g.strokePath();
      g.lineStyle(7, c, 1);
      g.beginPath();
      g.moveTo(x, footY - 46);
      g.lineTo(x + 8 + sway * 0.4, footY - 88);
      g.strokePath();
      g.fillStyle(0x3d604c, 1);
      g.fillCircle(x + 10 + sway * 0.4, footY - 100, 7.5);
      // 手臂到杆
      g.lineStyle(4, c, 1);
      g.beginPath();
      g.moveTo(x + 6, footY - 78);
      g.lineTo(x + 2, footY - 52);
      g.strokePath();
    } else {
      const c = 0x24333f;
      g.lineStyle(5, c, 0.95);
      g.beginPath();
      g.moveTo(x, footY - 44);
      g.lineTo(x - 5, footY);
      g.strokePath();
      g.beginPath();
      g.moveTo(x, footY - 44);
      g.lineTo(x + 6, footY);
      g.strokePath();
      g.lineStyle(6.5, c, 0.95);
      g.beginPath();
      g.moveTo(x, footY - 42);
      g.lineTo(x + 6 + sway * 0.3, footY - 80);
      g.strokePath();
      g.fillStyle(c, 0.95);
      g.fillCircle(x + 7 + sway * 0.3, footY - 90, 6);
    }
  }
}
