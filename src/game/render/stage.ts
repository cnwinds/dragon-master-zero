// 三个舞台场景：竹棚训练场 / 老街灯阵 / 河岸主舞台。
// 静态部分一次性绘制进 RenderTexture；灯笼光晕等动态元素返回给场景做呼吸动画。

import Phaser from "phaser";
import { PALETTE } from "../config";
import { strokeQuad } from "./curve";

export type SceneKind = "yard" | "street" | "river";

interface PulsingLight {
  sprite: Phaser.GameObjects.Image;
  base: number;
  phase: number;
}

export class StageRenderer {
  private container: Phaser.GameObjects.Container;
  private lights: PulsingLight[] = [];
  private water: Phaser.GameObjects.Graphics | null = null;
  private waterPhase = 0;

  constructor(private scene: Phaser.Scene) {
    this.container = scene.add.container(0, 0);
  }

  build(kind: SceneKind): void {
    this.container.removeAll(true);
    this.lights = [];
    this.water = null;

    const g = this.scene.add.graphics();
    const W = 1920;
    const H = 1080;

    // —— 天空基底 ——
    const skies: Record<SceneKind, [number, number, number]> = {
      yard: [0x30414f, 0x5d6a6a, 0xc9b68c], // 日暮：青灰→暖米
      street: [0x0d1622, 0x15243a, 0x27405c], // 入夜：靛青
      river: [0x070d17, 0x0c1828, 0x14304a], // 深夜
    };
    const [c0, c1, c2] = skies[kind];
    g.fillGradientStyle(c0, c0, c1, c2, 1);
    g.fillRect(0, 0, W, 640);

    // 远山（水墨）
    if (this.scene.textures.exists("tex-hill")) {
      const hill = this.scene.add.image(0, 300, "tex-hill").setOrigin(0, 0).setAlpha(kind === "yard" ? 0.55 : 0.4);
      if (kind === "river") hill.setTint(0x2a4a66);
      this.container.add(hill);
    }

    // 场景地台：程序化纹理（夯土/石板/木台）
    const groundY = kind === "street" ? 800 : 790;
    const groundKey = kind === "yard" ? "ground-yard" : kind === "street" ? "ground-street" : "ground-river";
    const ground = this.scene.add.image(0, groundY, groundKey).setOrigin(0, 0).setDisplaySize(W, H - groundY).setAlpha(0.96);
    this.container.add(ground);
    // 地台前缘高光
    g.fillStyle(PALETTE.gold, kind === "yard" ? 0.16 : 0.28);
    g.fillRect(0, groundY, W, 3);
    g.fillStyle(0x000000, 0.35);
    g.fillRect(0, groundY + 3, W, 5);

    if (kind === "yard") this.buildYard(g, groundY);
    if (kind === "street") this.buildStreet(g, groundY);
    if (kind === "river") this.buildRiver(g, groundY);

    // 宣纸整体噪点覆盖（低透明度）
    const paper = this.scene.add.image(0, 0, "tex-paper").setOrigin(0, 0).setDisplaySize(W, H).setAlpha(0.05);
    this.container.add(g);
    this.container.add(paper);
    this.container.bringToTop(paper);
  }

  /** 竹棚训练场：横向开阔、竹架边界、两根练习灯柱、旧龙头、师傅的鼓 */
  private buildYard(g: Phaser.GameObjects.Graphics, groundY: number): void {
    // 竹棚顶架
    g.lineStyle(7, 0x4a6b4c, 0.8);
    for (const x of [80, 320, 560, 800, 1040, 1280, 1520, 1760]) {
      g.beginPath();
      g.moveTo(x, groundY);
      g.lineTo(x + 40, 210);
      g.strokePath();
    }
    g.lineStyle(6, 0x557a57, 0.85);
    strokeQuad(g, { x: 40, y: 250 }, { x: 960, y: 190 }, { x: 1880, y: 250 });
    strokeQuad(g, { x: 40, y: 292 }, { x: 960, y: 232 }, { x: 1880, y: 292 });
    // 棚顶竹排
    g.lineStyle(3, 0x43613f, 0.5);
    for (let x = 60; x < 1880; x += 26) {
      g.beginPath();
      g.moveTo(x, 258 - Math.sin((x / 1920) * Math.PI) * 8);
      g.lineTo(x, 282 - Math.sin((x / 1920) * Math.PI) * 8);
      g.strokePath();
    }

    // 日暮暖光
    const sun = this.scene.add.image(1480, 420, "tex-glow").setScale(5, 3.4).setAlpha(0.32).setTint(0xe8c98a);
    this.container.add(sun);

    // 两根练习灯柱（硬目标参照物）
    for (const x of [660, 1250]) {
      g.lineStyle(8, 0x557a57, 0.95);
      g.beginPath();
      g.moveTo(x, groundY);
      g.lineTo(x, groundY - 210);
      g.strokePath();
      g.lineStyle(2, 0x39543b, 0.9);
      g.beginPath();
      g.moveTo(x - 36, groundY - 168);
      g.lineTo(x + 36, groundY - 168);
      g.strokePath();
      const lamp = this.scene.add.image(x, groundY - 186, "tex-lantern").setScale(0.72);
      this.container.add(lamp);
      const glow = this.scene.add.image(x, groundY - 182, "tex-glow").setScale(1.5).setAlpha(0.5);
      this.container.add(glow);
      this.lights.push({ sprite: glow, base: 0.5, phase: x });
    }

    // 挂起的旧龙头（师傅的传承物）
    const old = this.scene.add.image(210, 380, "tex-dragonhead").setScale(0.38).setAlpha(0.66).setTint(0x777f77);
    this.container.add(old);
    g.lineStyle(2, 0x777f77, 0.6);
    g.beginPath();
    g.moveTo(210, 330);
    g.lineTo(210, 262);
    g.strokePath();

    // 日暮光束（从棚顶斜落）
    for (const [lx, w] of [[520, 120], [1180, 150]] as const) {
      const beam = this.scene.add.graphics();
      beam.fillStyle(0xe8c98a, 0.07);
      beam.fillTriangle(lx, 292, lx + w, 292, lx + w * 2.1, groundY);
      beam.fillStyle(0xe8c98a, 0.05);
      beam.fillTriangle(lx + 40, 292, lx + w * 0.7, 292, lx + w * 1.5, groundY);
      this.container.add(beam);
    }

    // 师傅的鼓
    g.fillStyle(0x7c5a34, 1);
    g.fillEllipse(1790, groundY - 26, 86, 52);
    g.fillStyle(0xa87947, 1);
    g.fillEllipse(1790, groundY - 44, 86, 40);
    g.lineStyle(2, 0x5d4021, 1);
    g.strokeEllipse(1790, groundY - 44, 86, 40);
    // 鼓身竹箍
    g.lineStyle(3, 0x3d2c16, 0.8);
    g.beginPath();
    g.moveTo(1749, groundY - 40);
    g.lineTo(1749, groundY - 24);
    g.strokePath();
    g.beginPath();
    g.moveTo(1831, groundY - 40);
    g.lineTo(1831, groundY - 24);
    g.strokePath();
  }

  /** 老街灯阵：纵深狭窄、低门洞、错位灯柱、有结构的楼房与商铺 */
  private buildStreet(g: Phaser.GameObjects.Graphics, groundY: number): void {
    // ===== 层0：街道尽头的暗拱与远灯（纵深起点） =====
    const farGlow = this.scene.add.image(960, 690, "tex-glow").setScale(4.5, 1.6).setAlpha(0.16).setTint(0xe8b46a);
    this.container.add(farGlow);
    this.lights.push({ sprite: farGlow, base: 0.16, phase: 5 });
    g.fillStyle(0x060b12, 0.9);
    g.fillRect(890, 600, 140, 200); // 尽头暗巷
    for (const [lx, ly] of [[930, 660], [1010, 640], [975, 700]] as const) {
      const fg = this.scene.add.image(lx, ly, "tex-glow").setScale(0.3).setAlpha(0.3).setTint(0xe8b46a);
      this.container.add(fg);
    }

    // ===== 层1：后排楼影（更低、更暗，一层剪影） =====
    g.fillStyle(0x0a121d, 0.96);
    for (const [x, w, h] of [[60, 260, 300], [380, 200, 240], [1450, 210, 250], [1690, 230, 310]] as const) {
      g.fillRect(x, 640 - h, w, h);
      // 后排小窗
      g.fillStyle(0x0a121d, 0.96);
      for (let wy = 640 - h + 40; wy < 560; wy += 60) {
        g.fillStyle = g.fillStyle; // keep
        g.fillStyle(0x1b2b3e, 0.5);
        g.fillRect(x + w / 2 - 12, wy, 24, 30);
      }
    }

    // ===== 层2：左右前楼（坡顶+檐+木壁+楼窗+铺面） =====
    const house = (side: "left" | "right") => {
      const x0 = side === "left" ? 0 : 1380;
      const w = side === "left" ? 340 : 540;
      const topY = 330;
      const lean = side === "left" ? 34 : -34; // 向街心微倾（透视）
      // 坡顶（两层叠瓦）
      g.fillStyle(0x0d1723, 1);
      g.fillPoints(
        [
          { x: x0 - 20, y: topY + 60 },
          { x: x0 + w * 0.16, y: topY },
          { x: x0 + w * 0.84, y: topY },
          { x: x0 + w + 20, y: topY + 60 },
          { x: x0 + w + 20, y: topY + 78 },
          { x: x0 - 20, y: topY + 78 },
        ],
        true
      );
      // 瓦线
      g.lineStyle(1.5, 0x24354a, 0.7);
      for (let i = 1; i <= 5; i++) {
        const t = i / 6;
        g.beginPath();
        g.moveTo(x0 - 20 + (w + 40) * t * 0.5, topY + 60 - 60 * t);
        g.lineTo(x0 - 20 + (w + 40) * (1 - (1 - t) * 0.5), topY + 60 - 60 * t);
        g.strokePath();
      }
      // 檐口与斗拱短枋
      g.fillStyle(0x1a2836, 1);
      g.fillRect(x0 - 20, topY + 78, w + 40, 12);
      g.lineStyle(4, 0x22323f, 0.9);
      for (let bx = x0 + 6; bx < x0 + w; bx += 64) {
        g.beginPath();
        g.moveTo(bx, topY + 90);
        g.lineTo(bx, topY + 108);
        g.strokePath();
      }
      // 楼身（木板壁，向街心微倾）
      const wallColor = 0x101b29;
      g.fillStyle(wallColor, 1);
      g.fillPoints(
        [
          { x: x0, y: topY + 92 },
          { x: x0 + w, y: topY + 92 },
          { x: x0 + w + lean, y: groundY },
          { x: x0 + lean * 0.4, y: groundY },
        ],
        true
      );
      // 板缝
      g.lineStyle(1.2, 0x1d2c3d, 0.8);
      for (let px = x0 + 30; px < x0 + w; px += 34) {
        g.beginPath();
        g.moveTo(px, topY + 96);
        g.lineTo(px + lean * 0.55, groundY);
        g.strokePath();
      }
      // 横梁
      g.lineStyle(3, 0x22323f, 0.9);
      g.beginPath();
      g.moveTo(x0 + 4, topY + 220);
      g.lineTo(x0 + w - 4 + lean * 0.3, topY + 220);
      g.strokePath();

      // 楼上格子窗（框+棂+暖光）
      const winX = x0 + w * (side === "left" ? 0.18 : 0.3);
      const winW = 150;
      const winY = topY + 120;
      const win = this.scene.add.image(winX + winW / 2, winY + 34, "tex-glow").setScale(1.5, 0.9).setAlpha(0.5).setTint(0xe8b46a);
      this.container.add(win);
      this.lights.push({ sprite: win, base: 0.5, phase: winX / 70 });
      g.lineStyle(4, 0x0a141f, 1);
      g.strokeRect(winX, winY, winW, 68);
      g.lineStyle(2, 0x0a141f, 0.95);
      for (let i = 1; i < 4; i++) {
        g.beginPath();
        g.moveTo(winX + (winW / 4) * i, winY);
        g.lineTo(winX + (winW / 4) * i, winY + 68);
        g.strokePath();
      }
      g.beginPath();
      g.moveTo(winX, winY + 34);
      g.lineTo(winX + winW, winY + 34);
      g.strokePath();

      // 楼下铺面（暗口）
      g.fillStyle(0x070d15, 1);
      g.fillRect(x0 + w * 0.14, groundY - 150, w * 0.62, 150);
      g.lineStyle(3, 0x22323f, 0.9);
      g.strokeRect(x0 + w * 0.14, groundY - 150, w * 0.62, 150);
      // 铺面灯笼一只
      const slx = x0 + w * 0.14 + 26;
      const slamp = this.scene.add.image(slx, groundY - 128, "tex-lantern").setScale(0.42);
      this.container.add(slamp);
      const slg = this.scene.add.image(slx, groundY - 126, "tex-glow").setScale(0.8).setAlpha(0.45);
      this.container.add(slg);
      this.lights.push({ sprite: slg, base: 0.45, phase: slx / 55 });

      // 幌子：挂杆+梯形布+字+穗（楼侧、铺面上方）
      const hx = x0 + w * 0.72;
      const hy = topY + 240;
      g.lineStyle(3, 0x6b5030, 0.95);
      g.beginPath();
      g.moveTo(hx - 30, hy);
      g.lineTo(hx + 30, hy);
      g.strokePath();
      g.beginPath();
      g.moveTo(hx, hy);
      g.lineTo(hx, hy + 10);
      g.strokePath();
      const banner = this.scene.add.text(hx, hy + 40, side === "left" ? "茶" : "灯", {
        fontFamily: '"Noto Serif SC","SimSun",serif',
        fontSize: "26px",
        color: "#E9E0C8",
      }).setOrigin(0.5);
      this.container.add(banner);
      // 梯形布
      g.fillStyle(0x8f2f27, 0.94);
      g.fillPoints(
        [
          { x: hx - 15, y: hy + 10 },
          { x: hx + 15, y: hy + 10 },
          { x: hx + 12, y: hy + 66 },
          { x: hx - 12, y: hy + 66 },
        ],
        true
      );
      g.lineStyle(1.5, 0x5d1f1a, 1);
      g.strokePoints([{ x: hx - 15, y: hy + 10 }, { x: hx + 15, y: hy + 10 }, { x: hx + 12, y: hy + 66 }, { x: hx - 12, y: hy + 66 }], true, false);
      // 底穗
      g.lineStyle(2, 0xc79a45, 0.9);
      for (const dx of [-8, 0, 8]) {
        g.beginPath();
        g.moveTo(hx + dx, hy + 66);
        g.lineTo(hx + dx, hy + 80);
        g.strokePath();
      }
    };
    house("left");
    house("right");

    // 竹泾牌坊（硬目标：龙队从坊下穿过，不碰两侧灯柱）
    // 结构：石柱 → 额枋 → 匾额 → 飞檐双层 → 檐角铃灯
    const pl = 850;                                  // 左柱
    const pr = 1080;                                 // 右柱
    const pTop = 430;                                // 柱顶（额枋底）
    const gcx = (pl + pr) / 2;

    // 坊内暖光（穿过时被照亮）
    const gateGlow = this.scene.add.image(gcx, 600, "tex-glow").setScale(2.4, 3.2).setAlpha(0.26).setTint(0xe8b46a);
    this.container.add(gateGlow);
    this.lights.push({ sprite: gateGlow, base: 0.26, phase: 7 });

    // —— 石柱（两侧，上细下粗，石纹）——
    for (const px of [pl, pr]) {
      g.fillStyle(0x22303f, 1);
      g.fillPoints(
        [
          { x: px - 13, y: groundY },
          { x: px - 9, y: pTop },
          { x: px + 9, y: pTop },
          { x: px + 13, y: groundY },
        ],
        true
      );
      g.lineStyle(2, 0x39506a, 0.9);
      g.strokePoints(
        [{ x: px - 13, y: groundY }, { x: px - 9, y: pTop }, { x: px + 9, y: pTop }, { x: px + 13, y: groundY }],
        true,
        false
      );
      // 柱身受光边
      g.lineStyle(2, 0x4a6a8a, 0.55);
      g.beginPath();
      g.moveTo(px - 8, groundY - 8);
      g.lineTo(px - 6, pTop + 6);
      g.strokePath();
      // 柱础
      g.fillStyle(0x1a2532, 1);
      g.fillRect(px - 18, groundY - 16, 36, 16);
    }

    // —— 额枋（横梁）——
    g.fillStyle(0x2c3e50, 1);
    g.fillRect(pl - 22, pTop - 26, pr - pl + 44, 26);
    g.lineStyle(2, 0x4a6a8a, 0.7);
    g.strokeRect(pl - 22, pTop - 26, pr - pl + 44, 26);

    // —— 匾额（坊名）——
    const plaqueW = 150, plaqueH = 46;
    g.fillStyle(0x0d141d, 1);
    g.fillRect(gcx - plaqueW / 2, pTop - 22, plaqueW, plaqueH);
    g.lineStyle(3, 0xc79a45, 0.95);
    g.strokeRect(gcx - plaqueW / 2, pTop - 22, plaqueW, plaqueH);
    g.lineStyle(1, 0x8a6420, 0.8);
    g.strokeRect(gcx - plaqueW / 2 + 5, pTop - 17, plaqueW - 10, plaqueH - 10);
    const plaque = this.scene.add.text(gcx, pTop + 1, "竹 泾 灯 市", {
      fontFamily: '"Noto Serif SC","SimSun",serif',
      fontSize: "22px",
      color: "#E9E0C8",
      fontStyle: "bold",
      letterSpacing: 4,
    }).setOrigin(0.5);
    this.container.add(plaque);

    // —— 下层飞檐（两端起翘）——
    g.fillStyle(0x14213a, 1);
    g.fillPoints(
      [
        { x: pl - 70, y: pTop - 34 },
        { x: pl - 30, y: pTop - 52 },
        { x: pr + 30, y: pTop - 52 },
        { x: pr + 70, y: pTop - 34 },
        { x: pr + 34, y: pTop - 40 },
        { x: pl - 34, y: pTop - 40 },
      ],
      true
    );
    g.lineStyle(2, 0xc79a45, 0.75);
    strokeQuad(g, { x: pl - 70, y: pTop - 34 }, { x: pl - 34, y: pTop - 58 }, { x: pl - 20, y: pTop - 60 });
    strokeQuad(g, { x: pr + 70, y: pTop - 34 }, { x: pr + 34, y: pTop - 58 }, { x: pr + 20, y: pTop - 60 });
    // 檐瓦线
    g.lineStyle(1.2, 0x3a5068, 0.8);
    for (let i = 1; i <= 6; i++) {
      const t = i / 7;
      const wx = pl - 40 + (pr - pl + 80) * t;
      g.beginPath();
      g.moveTo(wx, pTop - 42);
      g.lineTo(wx, pTop - 52);
      g.strokePath();
    }

    // —— 上层小顶 + 正脊 ——
    g.fillStyle(0x101b30, 1);
    g.fillPoints(
      [
        { x: gcx - 90, y: pTop - 56 },
        { x: gcx - 40, y: pTop - 84 },
        { x: gcx + 40, y: pTop - 84 },
        { x: gcx + 90, y: pTop - 56 },
        { x: gcx + 40, y: pTop - 62 },
        { x: gcx - 40, y: pTop - 62 },
      ],
      true
    );
    g.lineStyle(2.5, 0xc79a45, 0.85);
    g.beginPath();
    g.moveTo(gcx - 40, pTop - 86);
    g.lineTo(gcx + 40, pTop - 86);
    g.strokePath();
    // 脊上宝顶
    g.fillStyle(0xc79a45, 0.95);
    g.fillCircle(gcx, pTop - 92, 5);
    g.fillCircle(gcx, pTop - 100, 3);

    // —— 檐角风灯（四盏小灯）——
    for (const [lx, ly] of [[pl - 58, pTop - 42], [pr + 58, pTop - 42], [gcx - 80, pTop - 62], [gcx + 80, pTop - 62]] as const) {
      g.lineStyle(1.5, 0x6b5030, 0.9);
      g.beginPath();
      g.moveTo(lx, ly);
      g.lineTo(lx, ly + 10);
      g.strokePath();
      const lamp = this.scene.add.image(lx, ly + 20, "tex-lantern").setScale(0.3).setAlpha(0.95);
      this.container.add(lamp);
      const lg = this.scene.add.image(lx, ly + 20, "tex-glow").setScale(0.55).setAlpha(0.5);
      this.container.add(lg);
      this.lights.push({ sprite: lg, base: 0.5, phase: lx / 40 });
    }

    // 错位灯柱 + 灯笼串
    // 错位灯柱：高低前后交错（纵深暗示），不是整齐一排
    const posts: Array<[number, number]> = [
      [500, 250], [770, 208], [1108, 262], [1420, 216],
    ];
    for (const [i, [x, h]] of posts.entries()) {
      g.lineStyle(7, 0x3a5a48, 0.95);
      g.beginPath();
      g.moveTo(x, groundY);
      g.lineTo(x, groundY - h);
      g.strokePath();
      const lamp = this.scene.add.image(x, groundY - h - 12, "tex-lantern").setScale(0.62 + (i % 2) * 0.1);
      this.container.add(lamp);
      const glow = this.scene.add.image(x, groundY - h - 8, "tex-glow").setScale(1.3).setAlpha(0.55);
      this.container.add(glow);
      this.lights.push({ sprite: glow, base: 0.55, phase: x / 90 });
    }

    // 跨街灯笼串
    for (const [sx, sy, ex] of [[80, 350, 620], [1300, 330, 1860]] as const) {
      g.lineStyle(2, 0x6b5030, 0.7);
      strokeQuad(g, { x: sx, y: sy }, { x: (sx + ex) / 2, y: sy + 90 }, { x: ex, y: sy });
      for (let i = 1; i <= 4; i++) {
        const t = i / 5;
        const lx = sx + (ex - sx) * t;
        const ly = sy + 90 * 4 * t * (1 - t) * 0.5 + 26;
        const lamp = this.scene.add.image(lx, ly, "tex-lantern").setScale(0.34).setAlpha(0.92);
        this.container.add(lamp);
        const glow = this.scene.add.image(lx, ly, "tex-glow").setScale(0.7).setAlpha(0.4);
        this.container.add(glow);
        this.lights.push({ sprite: glow, base: 0.4, phase: lx / 60 });
      }
    }

    // 街坊剪影（后景，低细节但可读）
    g.fillStyle(0x060c14, 0.92);
    for (const x of [400, 980, 1500]) {
      g.fillEllipse(x, groundY - 6, 76, 22);
      g.fillCircle(x, groundY - 52, 16);
      g.fillRect(x - 22, groundY - 44, 44, 44);
      // 挥手
      g.lineStyle(5, 0x060c14, 0.92);
      g.beginPath();
      g.moveTo(x + 18, groundY - 38);
      g.lineTo(x + 34, groundY - 58);
      g.strokePath();
    }
  }

  /** 河岸主舞台：横向开阔、金色灯海、灯桥、水面倒影 */
  private buildRiver(g: Phaser.GameObjects.Graphics, groundY: number): void {
    // 月亮与水面月光倒影
    this.scene.add.image(1660, 230, "tex-glow").setScale(7, 7).setAlpha(0.4).setTint(0xbfd8e8);
    this.scene.add.image(1660, 230, "tex-moon").setDisplaySize(110, 110);
    const moonRefl = this.scene.add.image(1660, 985, "tex-glow").setScale(3, 7).setAlpha(0.1).setTint(0xd8e2d0);
    this.container.add(moonRefl);
    this.lights.push({ sprite: moonRefl, base: 0.1, phase: 3 });
    // 对岸人群提灯（远景一排小灯+剪影头）
    for (let i = 0; i < 10; i++) {
      const x = 220 + i * 165;
      g.fillStyle(0x0a121c, 0.95);
      g.fillCircle(x, 596, 10);
      const pg = this.scene.add.image(x, 604, "tex-glow").setScale(0.5).setAlpha(0.4).setTint(0xf0c27a);
      this.container.add(pg);
      this.lights.push({ sprite: pg, base: 0.4, phase: i * 1.9 });
    }
    // 灯海（远观众席）
    for (let i = 0; i < 46; i++) {
      const x = 60 + (i % 23) * 82 + (Math.floor(i / 23) === 0 ? 0 : 40);
      const y = 470 + Math.floor(i / 23) * 44;
      const glow = this.scene.add.image(x, y, "tex-glow").setScale(0.55 + (i % 3) * 0.14).setAlpha(0.5).setTint(0xf0c27a);
      this.container.add(glow);
      this.lights.push({ sprite: glow, base: 0.5, phase: i * 1.7 });
    }

    // 河岸灯桥
    g.lineStyle(6, 0x33465c, 0.95);
    strokeQuad(g, { x: 120, y: 620 }, { x: 960, y: 520 }, { x: 1800, y: 620 });
    g.lineStyle(2, 0x33465c, 0.8);
    for (const x of [220, 480, 740, 1000, 1260, 1520, 1780]) {
      const t = (x - 120) / 1680;
      const y = 620 - Math.sin(t * Math.PI) * 92;
      g.beginPath();
      g.moveTo(x, y + 30);
      g.lineTo(x, y + 78);
      g.strokePath();
      const glow = this.scene.add.image(x, y + 40, "tex-glow").setScale(0.8).setAlpha(0.6).setTint(0xf0c27a);
      this.container.add(glow);
      this.lights.push({ sprite: glow, base: 0.6, phase: x / 70 });
    }

    // 水面
    const wg = this.scene.add.graphics();
    wg.fillStyle(0x0a1522, 1);
    wg.fillRect(0, 900, 1920, 180);
    wg.fillStyle(0x11243a, 0.7);
    wg.fillRect(0, 900, 1920, 26);
    this.container.add(wg);
    this.water = wg;

    // 水面金光倒影
    for (let i = 0; i < 14; i++) {
      const x = 130 + i * 128;
      const glow = this.scene.add.image(x, 940 + (i % 3) * 22, "tex-glow").setScale(1.4, 0.5).setAlpha(0.22).setTint(0xd9a75c);
      this.container.add(glow);
      this.lights.push({ sprite: glow, base: 0.22, phase: i * 2.3 });
    }
  }

  /** 每帧：灯呼吸、水波 */
  update(dt: number, t: number): void {
    for (const l of this.lights) {
      l.sprite.alpha = l.base * (0.78 + 0.22 * Math.sin(t * 1.8 + l.phase));
    }
    if (this.water) {
      this.waterPhase += dt / 1000;
      this.water.clear();
      this.water.fillStyle(0x0a1522, 1);
      this.water.fillRect(0, 900, 1920, 180);
      this.water.fillStyle(0x11243a, 0.7);
      this.water.fillRect(0, 900, 1920, 26);
      this.water.lineStyle(1.6, 0x3d5a6b, 0.16);
      for (let i = 0; i < 12; i++) {
        const y = 916 + i * 14;
        const off = Math.sin(this.waterPhase * 0.8 + i * 1.3) * 30;
        this.water.beginPath();
        this.water.moveTo(off + ((i * 137) % 600), y);
        this.water.lineTo(off + ((i * 137) % 600) + 220 + i * 12, y);
        this.water.strokePath();
      }
    }
  }

  get root(): Phaser.GameObjects.Container {
    return this.container;
  }
}
