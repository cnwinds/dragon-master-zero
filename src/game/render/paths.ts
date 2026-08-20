// 双轨迹渲染：蓝图青虚线（预测）× 竹青实线（实际）× 朱砂标记（失误）。
// 线型在灰度下也可区分（AC-PERF-02）。

import Phaser from "phaser";
import { PALETTE } from "../config";

export class PathRenderer {
  private g: Phaser.GameObjects.Graphics;

  constructor(private scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(30);
  }

  clear(): void {
    this.g.clear();
  }

  /** 预测轨迹：细、等宽、虚线、蓝图青 */
  drawPredicted(points: Array<{ x: number; y: number }>): void {
    if (points.length < 2) return;
    const g = this.g;
    g.lineStyle(3, PALETTE.blueprint, 0.8);
    const dash = 16;
    const gap = 12;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const dist = Phaser.Math.Distance.Between(p0.x, p0.y, p1.x, p1.y);
      if (dist < 2) continue;
      const steps = Math.max(1, Math.floor(dist / (dash + gap)));
      const dx = (p1.x - p0.x) / steps;
      const dy = (p1.y - p0.y) / steps;
      for (let s = 0; s < steps; s++) {
        const t0 = s / steps;
        const t1 = t0 + dash / (dash + gap) / steps;
        g.beginPath();
        g.moveTo(p0.x + dx * steps * t0, p0.y + dy * steps * t0);
        g.lineTo(p0.x + dx * steps * Math.min(t1, 1), p0.y + dy * steps * Math.min(t1, 1));
        g.strokePath();
      }
    }
  }

  /** 实际轨迹：粗细变化、竹青 */
  drawActual(trail: Array<{ x: number; y: number; a: number }>, upTo?: number): void {
    if (trail.length < 2) return;
    const pts = upTo == null ? trail : trail.slice(0, upTo);
    const g = this.g;
    const n = pts.length;
    for (let i = 0; i < n - 1; i++) {
      const k = i / n;
      const width = 2 + 7 * Math.sin(Math.PI * Math.min(1, k * 1.4)) * (0.7 + pts[i].a * 0.3);
      g.lineStyle(width, PALETTE.bamboo, 0.28 + 0.5 * (1 - k));
      g.beginPath();
      g.moveTo(pts[i].x, pts[i].y);
      g.lineTo(pts[i + 1].x, pts[i + 1].y);
      g.strokePath();
    }
  }

  /** 失误标记：朱砂，按类型区分形状（AC-VIS-02） */
  markMistake(
    x: number,
    y: number,
    type: "early" | "hesitate" | "overshoot" | "disconnect" | "lanternTouch"
  ): void {
    const g = this.g;
    g.lineStyle(3.5, PALETTE.cinnabar, 0.95);
    switch (type) {
      case "early": {
        // 抢拍：向左的折线箭头
        g.beginPath();
        g.moveTo(x + 14, y - 12);
        g.lineTo(x - 10, y);
        g.lineTo(x + 14, y + 12);
        g.strokePath();
        break;
      }
      case "hesitate": {
        // 迟疑：停顿墨点环
        g.strokeCircle(x, y, 11);
        g.fillStyle(PALETTE.ink, 0.75);
        g.fillCircle(x, y, 5);
        break;
      }
      case "overshoot": {
        // 过冲：越过终点的叉线
        g.beginPath();
        g.moveTo(x - 11, y - 11);
        g.lineTo(x + 11, y + 11);
        g.moveTo(x + 11, y - 11);
        g.lineTo(x - 11, y + 11);
        g.strokePath();
        break;
      }
      case "disconnect": {
        // 脱节：断开的折线（闪电）
        g.beginPath();
        g.moveTo(x - 12, y - 14);
        g.lineTo(x + 2, y - 2);
        g.lineTo(x - 4, y + 2);
        g.lineTo(x + 12, y + 14);
        g.strokePath();
        break;
      }
      case "lanternTouch": {
        // 触灯：灯笼 + 交叉线
        g.strokeCircle(x, y, 12);
        g.beginPath();
        g.moveTo(x - 7, y - 7);
        g.lineTo(x + 7, y + 7);
        g.strokePath();
        break;
      }
    }
  }

  /** 记忆触发标记：金色签纹 */
  markMemory(x: number, y: number): void {
    const g = this.g;
    g.lineStyle(2.5, PALETTE.gold, 0.95);
    g.strokeRect(x - 8, y - 12, 16, 24);
    g.lineBetween(x - 5, y - 5, x + 5, y - 5);
    g.lineBetween(x - 5, y, x + 5, y);
    g.lineBetween(x - 5, y + 5, x + 2, y + 5);
  }
}
