// 曲线采样工具：Phaser Graphics 无 quadraticCurveTo，统一用点列 + strokePoints。

import type Phaser from "phaser";

export interface Pt {
  x: number;
  y: number;
}

/** 二次贝塞尔采样 */
export function quadPoints(p0: Pt, c: Pt, p1: Pt, steps = 16): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    pts.push({
      x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x,
      y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y,
    });
  }
  return pts;
}

export function strokeQuad(g: Phaser.GameObjects.Graphics, p0: Pt, c: Pt, p1: Pt, steps = 16): void {
  g.strokePoints(quadPoints(p0, c, p1, steps), false, false);
}

export function fillQuad(g: Phaser.GameObjects.Graphics, p0: Pt, c: Pt, p1: Pt, steps = 16): void {
  g.fillPoints(quadPoints(p0, c, p1, steps), true);
}

/** 多点平滑连线（Catmull-Rom 近似：中点二次贝塞尔） */
export function smoothThrough(points: Pt[], stepsPer = 10): Pt[] {
  if (points.length < 3) return points;
  const out: Pt[] = [points[0]];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    for (let s = 1; s <= stepsPer; s++) {
      const t = s / stepsPer;
      const u = 1 - t;
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t * t + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t * t * t),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t * t + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t * t * t),
      });
    }
  }
  return out;
}
