// 南派舞龙头与鳞节：竹刻彩扎，非南狮、非西龙。
// 九似取神：角似鹿、头似驼、眼似虾、耳似牛、鳞似鱼、须似髯。

import { PALETTE } from "../config";

export const DRAGON_HEAD_W = 512;
export const DRAGON_HEAD_H = 384;
/** 颈根锚点：旋转与持杆都绕这里 */
export const DRAGON_HEAD_ORIGIN = { x: 0.30, y: 0.56 };

export const DRAGON_SEG_W = 168;
export const DRAGON_SEG_H = 102;

function hex(c: number, a = 1): string {
  const r = (c >> 16) & 0xff;
  const g = (c >> 8) & 0xff;
  const b = c & 0xff;
  return `rgba(${r},${g},${b},${a})`;
}

interface Pt { x: number; y: number }

function ribbon(ctx: CanvasRenderingContext2D, pts: Pt[], widthAt: (t: number) => number): void {
  if (pts.length < 2) return;
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const t = i / (pts.length - 1);
    const p = pts[i];
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    const ang = Math.atan2(next.y - prev.y, next.x - prev.x);
    const w = widthAt(t) * 0.5;
    left.push({ x: p.x + Math.cos(ang - Math.PI / 2) * w, y: p.y + Math.sin(ang - Math.PI / 2) * w });
    right.push({ x: p.x + Math.cos(ang + Math.PI / 2) * w, y: p.y + Math.sin(ang + Math.PI / 2) * w });
  }
  ctx.beginPath();
  ctx.moveTo(left[0].x, left[0].y);
  for (let i = 1; i < left.length; i++) ctx.lineTo(left[i].x, left[i].y);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
  ctx.closePath();
}

function sampleQuad(p0: Pt, c: Pt, p1: Pt, n = 10): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push({
      x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x,
      y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y,
    });
  }
  return out;
}

function flamePetal(
  ctx: CanvasRenderingContext2D,
  root: Pt, tip: Pt, bulge: Pt,
  fill: string | CanvasGradient, stroke: string,
): void {
  ctx.beginPath();
  ctx.moveTo(root.x, root.y);
  ctx.quadraticCurveTo(bulge.x, bulge.y, tip.x, tip.y);
  const bx = root.x + (tip.x - root.x) * 0.35 + (root.y - tip.y) * 0.18;
  const by = root.y + (tip.y - root.y) * 0.35 + (tip.x - root.x) * 0.18;
  ctx.quadraticCurveTo(bx, by, root.x, root.y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(root.x, root.y);
  ctx.quadraticCurveTo((root.x + tip.x) / 2, (root.y + tip.y) / 2, tip.x, tip.y);
  ctx.strokeStyle = "rgba(199,154,69,0.35)";
  ctx.lineWidth = 1.1;
  ctx.stroke();
}

export function paintDragonHead(ctx: CanvasRenderingContext2D): void {
  const W = DRAGON_HEAD_W;
  const H = DRAGON_HEAD_H;
  ctx.clearRect(0, 0, W, H);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // ——— 1. 颈后鬃焰（压在头骨之后，衔接龙身） ———
  const maneFill = ctx.createLinearGradient(40, 40, 170, 280);
  maneFill.addColorStop(0, "#4e7354");
  maneFill.addColorStop(0.55, "#35503c");
  maneFill.addColorStop(1, "#24362a");
  const maneStroke = "rgba(199,154,69,0.45)";
  flamePetal(ctx, { x: 156, y: 168 }, { x: 28, y: 42 }, { x: 58, y: 108 }, maneFill, maneStroke);
  flamePetal(ctx, { x: 148, y: 188 }, { x: 8, y: 118 }, { x: 42, y: 168 }, "#314a38", maneStroke);
  flamePetal(ctx, { x: 150, y: 214 }, { x: 14, y: 208 }, { x: 48, y: 236 }, "#2a4032", maneStroke);
  flamePetal(ctx, { x: 158, y: 248 }, { x: 46, y: 318 }, { x: 78, y: 268 }, "#2d4434", maneStroke);
  flamePetal(ctx, { x: 172, y: 160 }, { x: 72, y: 28 }, { x: 108, y: 88 }, "#4a6b50", maneStroke);

  // ——— 2. 后角（远侧鹿角，略暗） ———
  ctx.fillStyle = "#8a6a32";
  ribbon(ctx, sampleQuad({ x: 214, y: 108 }, { x: 168, y: 36 }, { x: 148, y: 8 }, 12), (t) => 11 - t * 8);
  ctx.fill();
  ribbon(ctx, sampleQuad({ x: 176, y: 48 }, { x: 154, y: 22 }, { x: 132, y: 14 }, 8), (t) => 5.5 - t * 3.2);
  ctx.fill();
  ctx.strokeStyle = "rgba(232,201,138,0.55)";
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // ——— 3. 牛耳 ———
  ctx.beginPath();
  ctx.moveTo(176, 132);
  ctx.quadraticCurveTo(148, 118, 138, 146);
  ctx.quadraticCurveTo(152, 168, 178, 158);
  ctx.closePath();
  const earG = ctx.createLinearGradient(140, 120, 180, 168);
  earG.addColorStop(0, "#6d8f70");
  earG.addColorStop(1, "#3d5744");
  ctx.fillStyle = earG;
  ctx.fill();
  ctx.strokeStyle = "rgba(199,154,69,0.5)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(172, 140);
  ctx.quadraticCurveTo(156, 138, 148, 150);
  ctx.strokeStyle = "rgba(26,34,32,0.35)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // ——— 4. 头骨 + 长吻（驼头，侧四分之三） ———
  ctx.beginPath();
  ctx.moveTo(150, 198);
  ctx.quadraticCurveTo(132, 148, 198, 92);     // 后脑 → 顶
  ctx.quadraticCurveTo(258, 62, 318, 96);      // 额
  ctx.quadraticCurveTo(378, 118, 438, 152);    // 鼻梁
  ctx.quadraticCurveTo(478, 168, 492, 186);    // 鼻尖上扬
  ctx.quadraticCurveTo(490, 204, 468, 216);    // 上唇
  ctx.quadraticCurveTo(420, 234, 348, 242);    // 口裂
  ctx.quadraticCurveTo(300, 248, 268, 258);    // 口角
  ctx.quadraticCurveTo(238, 292, 206, 304);    // 下颌底
  ctx.quadraticCurveTo(164, 292, 146, 254);    // 喉
  ctx.quadraticCurveTo(138, 224, 150, 198);
  ctx.closePath();
  const skull = ctx.createLinearGradient(150, 70, 480, 300);
  skull.addColorStop(0, "#8fb894");
  skull.addColorStop(0.28, "#6d9270");
  skull.addColorStop(0.62, "#5F8060");
  skull.addColorStop(1, "#3a5440");
  ctx.fillStyle = skull;
  ctx.fill();
  ctx.strokeStyle = "rgba(232,201,138,0.72)";
  ctx.lineWidth = 2.4;
  ctx.stroke();
  ctx.strokeStyle = "rgba(18,28,22,0.35)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // 额高光
  const dome = ctx.createRadialGradient(268, 118, 6, 270, 128, 58);
  dome.addColorStop(0, "rgba(233,224,200,0.32)");
  dome.addColorStop(1, "rgba(233,224,200,0)");
  ctx.fillStyle = dome;
  ctx.beginPath();
  ctx.ellipse(272, 122, 52, 34, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // 额上火焰纹 / 王字意
  ctx.strokeStyle = hex(PALETTE.gold, 0.85);
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(248, 108);
  ctx.quadraticCurveTo(268, 78, 292, 106);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(258, 118);
  ctx.quadraticCurveTo(270, 96, 284, 118);
  ctx.stroke();
  ctx.strokeStyle = hex(PALETTE.cinnabar, 0.55);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(268, 92);
  ctx.lineTo(272, 124);
  ctx.stroke();

  // 竹刻额甲两道
  ctx.strokeStyle = "rgba(30,44,32,0.4)";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(236, 128);
  ctx.quadraticCurveTo(268, 148, 248, 176);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(292, 122);
  ctx.quadraticCurveTo(318, 142, 304, 174);
  ctx.stroke();

  // ——— 5. 前角（近侧鹿角，金骨） ———
  const hornGold = ctx.createLinearGradient(250, 20, 230, 120);
  hornGold.addColorStop(0, "#E8C98A");
  hornGold.addColorStop(0.45, "#C79A45");
  hornGold.addColorStop(1, "#7a5a22");
  ctx.fillStyle = hornGold;
  ribbon(ctx, sampleQuad({ x: 248, y: 96 }, { x: 236, y: 28 }, { x: 252, y: 4 }, 14), (t) => 13 - t * 9.5);
  ctx.fill();
  ctx.strokeStyle = "rgba(18,22,16,0.35)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = "#d4b05a";
  ribbon(ctx, sampleQuad({ x: 242, y: 52 }, { x: 214, y: 18 }, { x: 196, y: 6 }, 10), (t) => 6.5 - t * 4);
  ctx.fill();
  ribbon(ctx, sampleQuad({ x: 248, y: 34 }, { x: 268, y: 10 }, { x: 286, y: 2 }, 8), (t) => 5 - t * 3);
  ctx.fill();
  // 角根结
  ctx.fillStyle = "#a87e37";
  ctx.beginPath();
  ctx.ellipse(248, 100, 10, 8, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(232,201,138,0.7)";
  ctx.lineWidth = 1.3;
  ctx.stroke();

  // 刀眉（压在眼眶之上）
  ctx.strokeStyle = "#1a261e";
  ctx.lineWidth = 7.5;
  ctx.beginPath();
  ctx.moveTo(284, 128);
  ctx.quadraticCurveTo(322, 108, 362, 134);
  ctx.stroke();
  ctx.strokeStyle = "rgba(199,154,69,0.45)";
  ctx.lineWidth = 2.1;
  ctx.beginPath();
  ctx.moveTo(288, 126);
  ctx.quadraticCurveTo(322, 107, 358, 132);
  ctx.stroke();

  // ——— 6. 虾眼（重中之重） ———
  const ex = 328, ey = 158;
  // 金眶（彩扎金属圈）
  ctx.beginPath();
  ctx.ellipse(ex, ey, 28, 24, -0.18, 0, Math.PI * 2);
  ctx.fillStyle = "#1a241c";
  ctx.fill();
  ctx.strokeStyle = "#C79A45";
  ctx.lineWidth = 4.2;
  ctx.stroke();
  ctx.strokeStyle = "#E8C98A";
  ctx.lineWidth = 1.4;
  ctx.stroke();
  // 眼白
  ctx.beginPath();
  ctx.ellipse(ex + 1, ey + 1, 21, 17.5, -0.18, 0, Math.PI * 2);
  const sclera = ctx.createRadialGradient(ex - 4, ey - 4, 2, ex, ey, 22);
  sclera.addColorStop(0, "#F6F1DE");
  sclera.addColorStop(1, "#C9B98A");
  ctx.fillStyle = sclera;
  ctx.fill();
  // 虹膜
  const iris = ctx.createRadialGradient(ex + 2, ey + 1, 1, ex + 2, ey + 2, 13);
  iris.addColorStop(0, "#FFE9AD");
  iris.addColorStop(0.45, "#C79A45");
  iris.addColorStop(1, "#5a3e10");
  ctx.fillStyle = iris;
  ctx.beginPath();
  ctx.ellipse(ex + 3, ey + 2, 13.5, 12.2, -0.18, 0, Math.PI * 2);
  ctx.fill();
  // 瞳
  ctx.fillStyle = "#0c0804";
  ctx.beginPath();
  ctx.ellipse(ex + 5, ey + 2, 5.4, 10.2, -0.18, 0, Math.PI * 2);
  ctx.fill();
  // 朱砂眼角
  ctx.fillStyle = "rgba(182,64,54,0.55)";
  ctx.beginPath();
  ctx.ellipse(ex - 16, ey + 6, 6, 4, 0.4, 0, Math.PI * 2);
  ctx.fill();
  // 高光两粒
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.beginPath();
  ctx.arc(ex - 2, ey - 5, 3.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ex + 8, ey + 6, 1.4, 0, Math.PI * 2);
  ctx.fill();
  // 上睑（雕刻感）
  ctx.strokeStyle = "#24332a";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(ex, ey - 2, 26, 22, -0.18, Math.PI * 1.05, Math.PI * 1.92);
  ctx.stroke();
  ctx.strokeStyle = hex(PALETTE.gold, 0.55);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.ellipse(ex, ey - 4, 24, 18, -0.18, Math.PI * 1.1, Math.PI * 1.85);
  ctx.stroke();

  // ——— 7. 鼻与吻 ———
  ctx.fillStyle = "#2a3c30";
  ctx.beginPath();
  ctx.ellipse(458, 176, 7, 5.2, -0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(442, 188, 5.4, 4.2, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(233,224,200,0.2)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(458, 176, 7, 5.2, -0.55, 0, Math.PI * 2);
  ctx.stroke();
  // 上唇线
  ctx.strokeStyle = "rgba(26,40,32,0.55)";
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(360, 228);
  ctx.quadraticCurveTo(430, 222, 478, 196);
  ctx.stroke();

  // ——— 8. 口：舌、牙、下颌 ———
  ctx.beginPath();
  ctx.moveTo(268, 256);
  ctx.quadraticCurveTo(360, 250, 430, 262);
  ctx.quadraticCurveTo(408, 292, 340, 298);
  ctx.quadraticCurveTo(286, 296, 250, 278);
  ctx.closePath();
  const jaw = ctx.createLinearGradient(280, 248, 400, 300);
  jaw.addColorStop(0, "#4a6750");
  jaw.addColorStop(1, "#2e4436");
  ctx.fillStyle = jaw;
  ctx.fill();
  ctx.strokeStyle = "rgba(199,154,69,0.45)";
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // 口腔
  ctx.beginPath();
  ctx.moveTo(300, 244);
  ctx.quadraticCurveTo(380, 248, 430, 258);
  ctx.quadraticCurveTo(390, 278, 320, 268);
  ctx.closePath();
  ctx.fillStyle = "#6b221c";
  ctx.fill();

  // 舌
  ctx.beginPath();
  ctx.moveTo(330, 252);
  ctx.quadraticCurveTo(400, 248, 438, 268);
  ctx.quadraticCurveTo(410, 286, 352, 270);
  ctx.closePath();
  const tongue = ctx.createLinearGradient(330, 250, 438, 280);
  tongue.addColorStop(0, "#c45a4c");
  tongue.addColorStop(1, "#B64036");
  ctx.fillStyle = tongue;
  ctx.fill();
  ctx.strokeStyle = "rgba(90,20,16,0.4)";
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(350, 258);
  ctx.quadraticCurveTo(400, 262, 428, 274);
  ctx.stroke();

  // 上牙
  ctx.fillStyle = "#F3ECD4";
  const fangs: Array<[number, number, number]> = [
    [356, 244, 11], [376, 246, 9], [396, 248, 8], [416, 250, 7],
  ];
  for (const [tx, ty, h] of fangs) {
    ctx.beginPath();
    ctx.moveTo(tx - 4.2, ty);
    ctx.lineTo(tx + 4.2, ty);
    ctx.lineTo(tx + 0.4, ty + h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(120,96,48,0.4)";
  ctx.lineWidth = 0.8;
  for (const [tx, ty, h] of fangs) {
    ctx.beginPath();
    ctx.moveTo(tx - 4.2, ty);
    ctx.lineTo(tx + 0.4, ty + h);
    ctx.lineTo(tx + 4.2, ty);
    ctx.stroke();
  }
  // 下牙
  for (const [tx, ty] of [[348, 286], [368, 288], [388, 286]] as const) {
    ctx.fillStyle = "#E9E0C8";
    ctx.beginPath();
    ctx.moveTo(tx - 3.4, ty);
    ctx.lineTo(tx + 3.4, ty);
    ctx.lineTo(tx, ty - 7);
    ctx.closePath();
    ctx.fill();
  }

  // ——— 9. 颊鳞（鱼鳞三列） ———
  ctx.strokeStyle = "rgba(30,44,32,0.42)";
  ctx.lineWidth = 1.7;
  ctx.fillStyle = "rgba(127,163,129,0.18)";
  for (const row of [
    { x0: 186, y0: 188, n: 4, dx: 18, dy: 7 },
    { x0: 178, y0: 210, n: 4, dx: 17, dy: 8 },
    { x0: 184, y0: 232, n: 3, dx: 18, dy: 6 },
  ]) {
    for (let i = 0; i < row.n; i++) {
      const x = row.x0 + i * row.dx;
      const y = row.y0 + i * 2;
      ctx.beginPath();
      ctx.arc(x, y, 9.5, 0.35, Math.PI - 0.35);
      ctx.fill();
      ctx.stroke();
    }
  }

  // ——— 10. 金须（长，后卷，龙之神） ———
  const whisker = (pts: Pt[], w0: number, color: string) => {
    ctx.fillStyle = color;
    ribbon(ctx, pts, (t) => Math.max(1.2, w0 * (1 - t * 0.82)));
    ctx.fill();
  };
  whisker(
    sampleQuad({ x: 448, y: 208 }, { x: 360, y: 268 }, { x: 248, y: 312 }, 14)
      .concat(sampleQuad({ x: 248, y: 312 }, { x: 196, y: 328 }, { x: 168, y: 318 }, 6).slice(1)),
    4.2, "#C79A45",
  );
  whisker(
    sampleQuad({ x: 456, y: 220 }, { x: 390, y: 292 }, { x: 300, y: 348 }, 12),
    3.4, "#d4b05a",
  );
  whisker(
    sampleQuad({ x: 438, y: 198 }, { x: 400, y: 168 }, { x: 348, y: 178 }, 8),
    2.4, "#b48a3c",
  );

  // ——— 11. 颌下朱砂髯 ———
  ctx.fillStyle = hex(PALETTE.cinnabar, 0.92);
  ribbon(ctx, sampleQuad({ x: 232, y: 292 }, { x: 210, y: 340 }, { x: 176, y: 362 }, 10), (t) => 4.4 - t * 3);
  ctx.fill();
  ribbon(ctx, sampleQuad({ x: 250, y: 298 }, { x: 244, y: 348 }, { x: 228, y: 370 }, 8), (t) => 3.2 - t * 2.2);
  ctx.fill();

  // ——— 12. 下睑与颊高光 ———
  const cheek = ctx.createRadialGradient(220, 200, 4, 220, 210, 40);
  cheek.addColorStop(0, "rgba(233,224,200,0.16)");
  cheek.addColorStop(1, "rgba(233,224,200,0)");
  ctx.fillStyle = cheek;
  ctx.beginPath();
  ctx.ellipse(222, 208, 36, 22, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // 鼻梁一道金线
  ctx.strokeStyle = "rgba(232,201,138,0.4)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(318, 128);
  ctx.quadraticCurveTo(390, 148, 456, 176);
  ctx.stroke();
}

export function paintDragonSegment(ctx: CanvasRenderingContext2D): void {
  const W = DRAGON_SEG_W;
  const H = DRAGON_SEG_H;
  ctx.clearRect(0, 0, W, H);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // 背鳍
  ctx.fillStyle = hex(PALETTE.gold, 0.92);
  for (let i = 0; i < 6; i++) {
    const x = 22 + i * 22;
    ctx.beginPath();
    ctx.moveTo(x, 22);
    ctx.quadraticCurveTo(x + 8, -2, x + 16, 20);
    ctx.lineTo(x + 8, 26);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(90,64,20,0.35)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  // 身
  const body = ctx.createLinearGradient(0, 18, 0, 90);
  body.addColorStop(0, "#8fb894");
  body.addColorStop(0.35, "#6d9270");
  body.addColorStop(0.7, hex(PALETTE.bamboo));
  body.addColorStop(1, "#314a38");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(8, 52);
  ctx.quadraticCurveTo(10, 18, W / 2, 16);
  ctx.quadraticCurveTo(W - 10, 18, W - 8, 52);
  ctx.quadraticCurveTo(W - 10, 88, W / 2, 90);
  ctx.quadraticCurveTo(10, 88, 8, 52);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(199,154,69,0.4)";
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // 鱼鳞
  ctx.strokeStyle = "rgba(26,40,32,0.42)";
  ctx.lineWidth = 1.35;
  ctx.fillStyle = "rgba(233,224,200,0.07)";
  for (let row = 0; row < 3; row++) {
    const y = 34 + row * 16;
    const off = row % 2 === 0 ? 0 : 10;
    for (let i = 0; i < 6; i++) {
      const x = 26 + off + i * 20;
      ctx.beginPath();
      ctx.arc(x, y, 10, 0.25, Math.PI - 0.25);
      ctx.fill();
      ctx.stroke();
    }
  }

  // 腹甲金线
  ctx.strokeStyle = hex(PALETTE.gold, 0.45);
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(22, 78);
  ctx.quadraticCurveTo(W / 2, 86, W - 22, 78);
  ctx.stroke();
}
