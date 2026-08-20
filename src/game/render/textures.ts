// 程序化纹理：启动时一次性生成并缓存（GDD §20 视觉资产全部程序化，零外部素材）。

import Phaser from "phaser";
import { PALETTE } from "../config";

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

  // 标题书法：宣纸渐变笔划 + 墨影 + 飞白侵蚀 + 朱砂落款
  canvasTexture(scene, "tex-title", 1060, 280, (ctx) => {
    ctx.clearRect(0, 0, 1060, 280);
    const chars = ["龙", "师", "零", "号"];
    const step = 205;
    const cx0 = 430;
    const cy = 122;
    const font = '700 168px "Noto Serif SC","Source Han Serif SC","STSong","SimSun",serif';
    const drawChars = (dx: number, dy: number, style: string | CanvasGradient, stroke?: string) => {
      ctx.font = font;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      chars.forEach((c, i) => {
        const x = cx0 + (i - 1.5) * step + dx;
        ctx.fillStyle = style as string;
        ctx.fillText(c, x, cy + dy + (i % 2 === 0 ? -4 : 4) * 0.4);
        if (stroke) {
          ctx.lineWidth = 3;
          ctx.strokeStyle = stroke;
          ctx.strokeText(c, x, cy + dy);
        }
      });
    };
    // 墨影
    drawChars(6, 9, "rgba(8,12,18,0.8)");
    // 主笔划：宣纸渐变
    const grad = ctx.createLinearGradient(0, 20, 0, 225);
    grad.addColorStop(0, "#F6F1DE");
    grad.addColorStop(0.55, "#E9E0C8");
    grad.addColorStop(1, "#C6BA98");
    drawChars(0, 0, grad, "rgba(26,34,43,0.5)");
    // 飞白侵蚀（笔锋干裂）
    ctx.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 1100; i++) {
      const x = 300 + Math.random() * 480;
      const y = 22 + Math.random() * 205;
      ctx.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.18})`;
      ctx.beginPath();
      ctx.ellipse(x, y, 0.8 + Math.random() * 3.2, 0.6 + Math.random() * 2, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    // 横向飞白丝
    for (let i = 0; i < 90; i++) {
      const x = 310 + Math.random() * 440;
      const y = 30 + Math.random() * 190;
      ctx.strokeStyle = `rgba(0,0,0,${0.08 + Math.random() * 0.14})`;
      ctx.lineWidth = 0.8 + Math.random();
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 14 + Math.random() * 40, y + (Math.random() - 0.5) * 4);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
    // 朱砂落款印
    const sx = 850, sy = 196, ss = 64;
    ctx.fillStyle = "rgba(182,64,54,0.92)";
    ctx.beginPath();
    const r = 7;
    ctx.moveTo(sx - ss / 2 + r, sy - ss / 2);
    ctx.arcTo(sx + ss / 2, sy - ss / 2, sx + ss / 2, sy + ss / 2, r);
    ctx.arcTo(sx + ss / 2, sy + ss / 2, sx - ss / 2, sy + ss / 2, r);
    ctx.arcTo(sx - ss / 2, sy + ss / 2, sx - ss / 2, sy - ss / 2, r);
    ctx.arcTo(sx - ss / 2, sy - ss / 2, sx + ss / 2, sy - ss / 2, r);
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 16; i++) {
      ctx.beginPath();
      ctx.arc(sx - ss / 2 + Math.random() * ss, sy - ss / 2 + Math.random() * ss, 1.5 + Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.font = '700 40px "Noto Serif SC","SimSun",serif';
    ctx.fillStyle = "#F6F1DE";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("零", sx, sy + 2);
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

  // 龙头：紧凑南狮式——圆凸额、短吻上扬、粗眉金瞳、扇形鬃冠、双角后掠
  canvasTexture(scene, "tex-dragonhead", 210, 170, (ctx) => {
    ctx.clearRect(0, 0, 210, 170);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // ========== 1. 鬃冠：一整束扇形（单一剪影，不再散乱） ==========
    ctx.beginPath();
    ctx.moveTo(74, 46);                       // 冠根（额后）
    ctx.quadraticCurveTo(30, 22, 6, 30);      // 上叶尖
    ctx.quadraticCurveTo(34, 52, 22, 78);     // 收回
    ctx.quadraticCurveTo(48, 74, 52, 88);     // 下叶根
    ctx.quadraticCurveTo(60, 66, 74, 46);
    ctx.closePath();
    let maneGrad = ctx.createLinearGradient(70, 20, 10, 90);
    maneGrad.addColorStop(0, "#3f5c43");
    maneGrad.addColorStop(1, "#2b4030");
    ctx.fillStyle = maneGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(127,163,129,0.7)";
    ctx.lineWidth = 2;
    ctx.stroke();
    // 冠上火焰缺刻（三刀）
    ctx.strokeStyle = "#0d141d";
    ctx.lineWidth = 3;
    for (const [x1, y1, x2, y2] of [[40, 34, 34, 52], [24, 42, 20, 60], [34, 58, 30, 72]] as const) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // ========== 2. 双角：每根一条干净主弧 + 一根小杈 ==========
    const horn = (bx: number, by: number, tipx: number, tipy: number, brx: number, bry: number) => {
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo((bx + tipx) / 2 - 6, (by + tipy) / 2 - 14, tipx, tipy);
      ctx.strokeStyle = "#C79A45";
      ctx.lineWidth = 7;
      ctx.stroke();
      // 小杈
      const mx = (bx + tipx) / 2, my = (by + tipy) / 2 - 8;
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.quadraticCurveTo(mx - 8, my - 12, brx, bry);
      ctx.lineWidth = 4;
      ctx.stroke();
      // 角根粗起
      ctx.beginPath();
      ctx.arc(bx, by, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#a87e37";
      ctx.fill();
    };
    horn(78, 38, 52, -6, 40, -2);       // 左角
    horn(104, 34, 108, -10, 122, -6);   // 右角

    // ========== 3. 头骨主体：紧凑、圆凸额、短吻上扬 ==========
    ctx.beginPath();
    ctx.moveTo(66, 60);                          // 后脑下
    ctx.quadraticCurveTo(58, 34, 86, 28);        // 圆凸额头（高顶）
    ctx.quadraticCurveTo(112, 24, 130, 40);      // 额到鼻根
    ctx.quadraticCurveTo(150, 52, 172, 48);      // 短吻上扬
    ctx.quadraticCurveTo(182, 46, 184, 54);      // 鼻尖圆
    ctx.quadraticCurveTo(180, 62, 166, 66);      // 吻端回
    ctx.quadraticCurveTo(156, 70, 150, 80);      // 上唇
    ctx.lineTo(128, 84);                          // 口裂角
    // 下颌（短、内收）
    ctx.quadraticCurveTo(148, 94, 140, 108);
    ctx.quadraticCurveTo(126, 122, 102, 118);
    ctx.quadraticCurveTo(74, 112, 64, 92);
    ctx.quadraticCurveTo(58, 76, 66, 60);
    ctx.closePath();
    const skullGrad = ctx.createLinearGradient(60, 20, 170, 120);
    skullGrad.addColorStop(0, "#719a74");
    skullGrad.addColorStop(0.5, "#5F8060");
    skullGrad.addColorStop(1, "#3a5440");
    ctx.fillStyle = skullGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(143,191,146,0.85)";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // —— 额甲：圆凸高光 + 竹刻纹 ——
    const domeGlow = ctx.createRadialGradient(98, 40, 4, 98, 44, 34);
    domeGlow.addColorStop(0, "rgba(233,224,200,0.28)");
    domeGlow.addColorStop(1, "rgba(233,224,200,0)");
    ctx.fillStyle = domeGlow;
    ctx.beginPath();
    ctx.ellipse(100, 44, 32, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(30,44,32,0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(96, 34);
    ctx.quadraticCurveTo(100, 48, 94, 62);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(110, 38);
    ctx.quadraticCurveTo(114, 50, 108, 64);
    ctx.stroke();

    // ========== 4. 粗眉 + 金瞳（重点视线） ==========
    ctx.strokeStyle = "#2c4230";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(110, 58);
    ctx.quadraticCurveTo(126, 48, 144, 56);
    ctx.stroke();
    // 眼窝
    ctx.fillStyle = "#1d2c22";
    ctx.beginPath();
    ctx.ellipse(130, 66, 12, 9, -0.12, 0, Math.PI * 2);
    ctx.fill();
    // 金瞳
    const eyeGrad = ctx.createRadialGradient(129, 65, 1, 130, 66, 9);
    eyeGrad.addColorStop(0, "#ffe9ad");
    eyeGrad.addColorStop(0.6, "#C79A45");
    eyeGrad.addColorStop(1, "#8a6420");
    ctx.fillStyle = eyeGrad;
    ctx.beginPath();
    ctx.ellipse(130, 66, 9.5, 8, -0.12, 0, Math.PI * 2);
    ctx.fill();
    // 瞳（竖瞳，凶）
    ctx.fillStyle = "#120b04";
    ctx.beginPath();
    ctx.ellipse(131, 66, 2.2, 5.5, -0.12, 0, Math.PI * 2);
    ctx.fill();
    // 高光
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.arc(127, 62.5, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // ========== 5. 吻部：鼻孔、上颚线、獠牙 ==========
    ctx.fillStyle = "#26382a";
    ctx.beginPath();
    ctx.ellipse(168, 56, 3.6, 2.6, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(160, 62, 2.6, 2, -0.5, 0, Math.PI * 2);
    ctx.fill();
    // 上颚唇线
    ctx.strokeStyle = "rgba(30,44,32,0.6)";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(150, 72);
    ctx.quadraticCurveTo(162, 70, 172, 58);
    ctx.stroke();
    // 双獠牙（上颚两根，短而利）
    ctx.fillStyle = "#EFE8D2";
    for (const [tx, ty] of [[146, 82], [154, 80]] as const) {
      ctx.beginPath();
      ctx.moveTo(tx - 3, ty - 2);
      ctx.lineTo(tx + 3, ty - 2);
      ctx.lineTo(tx, ty + 9);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(120,100,60,0.5)";
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    // 口内暗红
    ctx.fillStyle = "rgba(120,30,24,0.55)";
    ctx.beginPath();
    ctx.moveTo(130, 86);
    ctx.quadraticCurveTo(140, 88, 146, 94);
    ctx.quadraticCurveTo(136, 98, 128, 92);
    ctx.closePath();
    ctx.fill();

    // ========== 6. 短须两根（从吻侧后卷） ==========
    ctx.strokeStyle = "#C79A45";
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(152, 74);
    ctx.quadraticCurveTo(136, 96, 112, 102);
    ctx.quadraticCurveTo(104, 103, 98, 98);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(156, 80);
    ctx.quadraticCurveTo(148, 102, 128, 112);
    ctx.stroke();

    // ========== 7. 下颌须（一根，短） ==========
    ctx.strokeStyle = "#B64036";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(120, 112);
    ctx.quadraticCurveTo(114, 126, 102, 132);
    ctx.stroke();

    // ========== 8. 颊鳞一片（衔接龙身的暗示） ==========
    ctx.strokeStyle = "rgba(30,44,32,0.45)";
    ctx.lineWidth = 1.8;
    for (const [ax, ay] of [[80, 84], [88, 94], [78, 100]] as const) {
      ctx.beginPath();
      ctx.arc(ax, ay, 8, 0.5, 2.6);
      ctx.stroke();
    }
  });


  // 龙身鳞节
  canvasTexture(scene, "tex-segment", 120, 72, (ctx) => {
    ctx.clearRect(0, 0, 120, 72);
    const g = ctx.createLinearGradient(0, 0, 0, 72);
    g.addColorStop(0, hex(0x6d9270));
    g.addColorStop(0.5, hex(PALETTE.bamboo));
    g.addColorStop(1, hex(0x3c5540));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(6, 36);
    ctx.quadraticCurveTo(6, 6, 60, 6);
    ctx.quadraticCurveTo(114, 6, 114, 36);
    ctx.quadraticCurveTo(114, 66, 60, 66);
    ctx.quadraticCurveTo(6, 66, 6, 36);
    ctx.closePath();
    ctx.fill();
    // 背鳍
    ctx.fillStyle = hex(PALETTE.gold, 0.85);
    for (let i = 0; i < 5; i++) {
      const x = 24 + i * 18;
      ctx.beginPath();
      ctx.moveTo(x, 8);
      ctx.quadraticCurveTo(x + 4, -6, x + 9, 6);
      ctx.lineTo(x + 4, 9);
      ctx.closePath();
      ctx.fill();
    }
    // 鳞线
    ctx.strokeStyle = hex(0x2f4433, 0.55);
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(30 + i * 20, 14);
      ctx.quadraticCurveTo(22 + i * 20, 36, 30 + i * 20, 58);
      ctx.stroke();
    }
  });

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
