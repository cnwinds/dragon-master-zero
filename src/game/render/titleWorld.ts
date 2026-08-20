// 标题开场：河岸灯会夜色 · 分层水墨 · 龙脊朝月 · 朱砂落印。
// 色彩与媒介分工遵守 GDD §14（水墨环境、竹刻龙身、朱砂印章）。

import Phaser from "phaser";
import { FONT, PALETTE } from "../config";
import { Serpent } from "./serpent";
import { addFireflies, addVignette } from "./atmosphere";
import { titleSealOffset } from "./textures";
import { audioBus } from "../systems/audio";

interface LitSprite {
  sprite: Phaser.GameObjects.Image;
  base: number;
  phase: number;
}

export class TitleWorld {
  private serpent: Serpent | null = null;
  private water: Phaser.GameObjects.Graphics | null = null;
  private waterPhase = 0;
  private lights: LitSprite[] = [];
  private fade!: Phaser.GameObjects.Rectangle;
  private title!: Phaser.GameObjects.Image;
  private seal!: Phaser.GameObjects.Image;
  private tagline!: Phaser.GameObjects.Text;
  private ornaments!: Phaser.GameObjects.Graphics;
  private introDone = false;
  private onReady: (() => void) | null = null;
  private skipIntro: (() => void) | null = null;
  private titleY = 134;
  private titleX = 690;
  private sealScale = 1;

  constructor(private scene: Phaser.Scene) {}

  build(): void {
    this.paintSky();
    this.paintMoon();
    this.paintHills();
    this.paintShoreAndRiver();
    this.paintLanterns();
    this.paintDragon();
    this.paintForeground();
    this.paintTitle();
    addVignette(this.scene, 0.34, 98);
    this.scene.add.image(0, 0, "tex-paper").setOrigin(0, 0).setDisplaySize(1920, 1080).setAlpha(0.055).setDepth(99);
    addFireflies(this.scene, 6, { x0: 260, x1: 1720, y0: 500, y1: 860 }, 46);
    this.fade = this.scene.add.rectangle(960, 540, 1920, 1080, 0x05080d, 1).setDepth(200);
  }

  playIntro(onReady: () => void): void {
    this.onReady = onReady;
    this.skipIntro = () => this.finishIntro(true);
    this.scene.input.once("pointerdown", this.skipIntro);

    this.scene.tweens.add({
      targets: this.fade,
      alpha: 0,
      duration: 1600,
      ease: "Sine.easeInOut",
    });

    this.lights.forEach((l, i) => {
      l.sprite.setAlpha(0);
      this.scene.tweens.add({
        targets: l.sprite,
        alpha: l.base,
        duration: 720,
        delay: 280 + i * 55,
        ease: "Sine.easeOut",
      });
    });

    if (this.serpent) {
      this.serpent.container.setAlpha(0);
      this.serpent.container.x = -70;
      this.scene.tweens.add({
        targets: this.serpent.container,
        alpha: 1,
        x: 0,
        duration: 2200,
        delay: 380,
        ease: "Sine.easeOut",
      });
    }

    this.title.setAlpha(0).setY(this.titleY + 18);
    this.scene.tweens.add({
      targets: this.title,
      alpha: 1,
      y: this.titleY,
      duration: 980,
      delay: 820,
      ease: "Cubic.easeOut",
    });

    this.sealScale = this.seal.scaleX;
    this.seal.setAlpha(0).setScale(this.sealScale * 1.55);
    this.scene.tweens.add({
      targets: this.seal,
      alpha: 1,
      scale: this.sealScale,
      duration: 420,
      delay: 1480,
      ease: "Back.easeOut",
      onStart: () => audioBus.seal(),
    });

    this.scene.time.delayedCall(1480, () => {
      if (audioBus.musicOn) audioBus.gong(0.52);
    });

    this.scene.tweens.add({
      targets: [this.tagline, this.ornaments],
      alpha: 1,
      duration: 700,
      delay: 1780,
    });

    this.scene.time.delayedCall(2100, () => this.finishIntro(false));
  }

  update(time: number, delta: number): void {
    this.serpent?.update(delta);
    this.waterPhase += delta / 1000;
    this.drawWater();
    if (!this.introDone) return;
    for (const l of this.lights) {
      l.sprite.alpha = l.base * (0.78 + 0.22 * Math.sin(time * 0.0017 + l.phase));
    }
  }

  private finishIntro(skipped: boolean): void {
    if (this.introDone) return;
    this.introDone = true;
    if (this.skipIntro) {
      this.scene.input.off("pointerdown", this.skipIntro);
      this.skipIntro = null;
    }
    if (skipped) {
      const kill: Phaser.GameObjects.GameObject[] = [
        this.fade, this.title, this.seal, this.tagline, this.ornaments,
        ...this.lights.map((l) => l.sprite),
      ];
      if (this.serpent) kill.push(this.serpent.container);
      this.scene.tweens.killTweensOf(kill);
      this.fade.setAlpha(0);
      this.title.setAlpha(1).setY(this.titleY);
      this.seal.setAlpha(1).setScale(this.sealScale);
      this.tagline.setAlpha(0.92);
      this.ornaments.setAlpha(1);
      if (this.serpent) {
        this.serpent.container.setAlpha(1);
        this.serpent.container.x = 0;
      }
      for (const l of this.lights) l.sprite.setAlpha(l.base);
    }
    this.idleSeal();
    this.onReady?.();
  }

  private paintSky(): void {
    const g = this.scene.add.graphics().setDepth(0);
    g.fillGradientStyle(0x05080e, 0x05080e, 0x0f2238, 0x1a3a52, 1);
    g.fillRect(0, 0, 1920, 1080);

    const stars = this.scene.add.graphics().setDepth(1);
    for (let i = 0; i < 18; i++) {
      const x = 60 + Math.random() * 1780;
      const y = 30 + Math.random() * 360;
      stars.fillStyle(0xe9e0c8, 0.16 + Math.random() * 0.32);
      stars.fillCircle(x, y, Math.random() < 0.18 ? 1.4 : 0.7);
    }
    for (let i = 0; i < 3; i++) {
      const x = 120 + Math.random() * 1600;
      const y = 50 + Math.random() * 260;
      const spark = this.scene.add.image(x, y, "tex-spark").setScale(0.5).setAlpha(0.18).setTint(0xe9e0c8).setDepth(1);
      this.scene.tweens.add({
        targets: spark,
        alpha: { from: 0.06, to: 0.28 },
        duration: 1800 + Math.random() * 1600,
        yoyo: true,
        repeat: -1,
        delay: Math.random() * 1200,
      });
    }
  }

  private paintMoon(): void {
    const mx = 1636;
    const my = 188;
    this.scene.add.image(mx, my, "tex-glow").setScale(11.5).setAlpha(0.42).setTint(0xc9dce8).setDepth(4);
    this.scene.add.image(mx, my, "tex-glow").setScale(6.2).setAlpha(0.28).setTint(0xf0e6c8).setDepth(4);
    this.scene.add.image(mx, my, "tex-moon").setDisplaySize(220, 220).setDepth(5);
    const cloudA = this.scene.add.image(1420, 230, "tex-inkcloud").setAlpha(0.5).setDepth(6);
    const cloudB = this.scene.add.image(1860, 168, "tex-inkcloud").setFlipX(true).setAlpha(0.38).setDepth(6);
    this.scene.tweens.add({
      targets: cloudA,
      x: 1500,
      duration: 38000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    this.scene.tweens.add({
      targets: cloudB,
      x: 1788,
      duration: 44000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  private paintHills(): void {
    const far = this.scene.add.image(-20, 268, "tex-hill").setOrigin(0, 0).setAlpha(0.38).setTint(0x152536).setDepth(3);
    const mid = this.scene.add.image(0, 348, "tex-hill").setOrigin(0, 0).setAlpha(0.62).setTint(0x1a3348).setDepth(7);
    this.scene.tweens.add({
      targets: far,
      x: 18,
      duration: 32000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    this.scene.tweens.add({
      targets: mid,
      x: -16,
      duration: 24000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    const mistFar = this.scene.add.image(960, 560, "tex-mist").setDisplaySize(2100, 260).setAlpha(0.28).setTint(0x8aa0b4).setDepth(8);
    this.scene.tweens.add({
      targets: mistFar,
      x: 1000,
      alpha: { from: 0.2, to: 0.34 },
      duration: 9000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  private paintShoreAndRiver(): void {
    const bank = this.scene.add.graphics().setDepth(9);
    bank.fillStyle(0x0a121c, 1);
    bank.beginPath();
    bank.moveTo(0, 708);
    for (let x = 0; x <= 1920; x += 24) {
      const y = 698 + Math.sin(x * 0.008) * 14 + Math.sin(x * 0.021) * 8;
      bank.lineTo(x, y);
    }
    bank.lineTo(1920, 1080);
    bank.lineTo(0, 1080);
    bank.closePath();
    bank.fillPath();

    // 对岸观灯人影：左疏右密，压住月下河岸
    const crowd = [90, 175, 430, 710, 1100, 1320, 1450, 1548, 1640, 1730, 1820];
    crowd.forEach((x, i) => {
      const y = 686 + (i % 2) * 6;
      bank.fillStyle(0x070c12, 0.92);
      bank.fillCircle(x, y - 16, 7 + (i % 3));
      bank.fillRect(x - 6, y - 10, 12, 22);
    });

    this.water = this.scene.add.graphics().setDepth(10);
    this.drawWater();

    // 月倒影
    const moonRefl = this.scene.add.image(1636, 920, "tex-glow").setScale(4.4, 7.6).setAlpha(0.18).setTint(0xd4e0c8).setDepth(11);
    this.lights.push({ sprite: moonRefl, base: 0.16, phase: 2.1 });
  }

  private drawWater(): void {
    const wg = this.water;
    if (!wg) return;
    wg.clear();
    wg.fillStyle(0x071018, 1);
    wg.fillRect(0, 768, 1920, 312);
    wg.fillStyle(0x102436, 0.55);
    wg.fillRect(0, 768, 1920, 18);
    wg.lineStyle(1.5, 0x3d5a6b, 0.14);
    for (let i = 0; i < 14; i++) {
      const y = 792 + i * 18;
      const off = Math.sin(this.waterPhase * 0.7 + i * 1.15) * 36;
      wg.beginPath();
      wg.moveTo(off + ((i * 151) % 520), y);
      wg.lineTo(off + ((i * 151) % 520) + 260 + i * 10, y);
      wg.strokePath();
    }
  }

  private paintLanterns(): void {
    // 远灯：对岸几盏，不铺成灯海
    for (let i = 0; i < 6; i++) {
      const x = 260 + i * 270 + (i % 2) * 22;
      const y = 490 + (i % 3) * 12;
      const glow = this.scene.add.image(x, y, "tex-glow")
        .setScale(0.4 + (i % 3) * 0.07)
        .setAlpha(0.3)
        .setTint(0xf0c27a)
        .setDepth(12);
      this.lights.push({ sprite: glow, base: 0.3, phase: i * 1.3 });
    }

    // 河岸灯柱：右边一盏略大，托住月亮
    const poles = [300, 640, 1020, 1360, 1576];
    const poleG = this.scene.add.graphics().setDepth(13);
    poles.forEach((x, i) => {
      const top = 560 + (i % 3) * 12;
      poleG.lineStyle(5, 0x2c4030, 0.92);
      poleG.beginPath();
      poleG.moveTo(x, 760);
      poleG.lineTo(x, top);
      poleG.strokePath();
      poleG.lineStyle(2, 0x3d5644, 0.8);
      poleG.beginPath();
      poleG.moveTo(x - 16, top + 18);
      poleG.lineTo(x + 16, top + 18);
      poleG.strokePath();

      const lantern = this.scene.add.image(x, top + 8, "tex-lantern")
        .setScale((i === poles.length - 1 ? 0.72 : 0.56) + (i % 3) * 0.05)
        .setDepth(14);
      lantern.setOrigin(0.5, 0);
      this.scene.tweens.add({
        targets: lantern,
        angle: { from: -3.4, to: 3.4 },
        duration: 2600 + i * 180,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
      const glow = this.scene.add.image(x, top + 42, "tex-glow")
        .setScale(i === poles.length - 1 ? 1.9 : 1.5)
        .setAlpha(0.5)
        .setTint(0xf0c27a)
        .setDepth(13);
      this.lights.push({ sprite: glow, base: 0.5, phase: i * 2.1 });
      const refl = this.scene.add.image(x, 880 + (i % 3) * 16, "tex-glow").setScale(1.5, 0.45).setAlpha(0.2).setTint(0xd9a75c).setDepth(11);
      this.lights.push({ sprite: refl, base: 0.2, phase: i * 1.4 });
    });

    // 水面河灯：一盏落在月影里
    for (let i = 0; i < 3; i++) {
      const x = 380 + i * 540;
      const y = 938 + (i % 2) * 18;
      const lamp = this.scene.add.image(x, y, "tex-lantern").setScale(0.28).setAlpha(0.85).setDepth(15);
      this.scene.tweens.add({
        targets: lamp,
        y: y - 8,
        duration: 2200 + i * 200,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
      const glow = this.scene.add.image(x, y + 10, "tex-glow").setScale(0.9, 0.4).setAlpha(0.28).setTint(0xf0c27a).setDepth(14);
      this.lights.push({ sprite: glow, base: 0.28, phase: i * 1.8 });
    }
  }

  private paintDragon(): void {
    this.serpent = new Serpent(this.scene, {
      points: [
        { x: -40, y: 900 },
        { x: 210, y: 800 },
        { x: 460, y: 710 },
        { x: 700, y: 790 },
        { x: 960, y: 640 },
        { x: 1168, y: 568 },
        { x: 1296, y: 498 },
      ],
      headScale: 0.8,
      maxRadius: 36,
      segmentEvery: 64,
      alpha: 0.97,
      headTilt: -0.28,
    });
    this.serpent.container.setDepth(22);
  }

  private paintForeground(): void {
    const left = this.scene.add.image(-48, 0, "tex-bamboo-fg").setOrigin(0, 0).setAlpha(0.78).setDepth(40);
    const right = this.scene.add.image(1944, 12, "tex-bamboo-fg")
      .setOrigin(1, 0)
      .setFlipX(true)
      .setCrop(248, 0, 172, 1080)
      .setAlpha(0.72)
      .setDepth(40);
    this.scene.tweens.add({
      targets: left,
      x: -18,
      duration: 18000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    this.scene.tweens.add({
      targets: right,
      x: 1932,
      duration: 20000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    const mistNear = this.scene.add.image(960, 860, "tex-mist").setDisplaySize(2200, 300).setAlpha(0.22).setTint(0x9aaebb).setDepth(32);
    this.scene.tweens.add({
      targets: mistNear,
      x: 920,
      alpha: { from: 0.14, to: 0.26 },
      duration: 11000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  private paintTitle(): void {
    const tx = this.titleX;
    const ty = this.titleY;
    const dispW = 900;
    const dispH = 258;
    this.scene.add.image(tx, ty + 8, "tex-glow").setScale(7.6, 2.1).setAlpha(0.11).setTint(0xf0c27a).setDepth(94);
    this.title = this.scene.add.image(tx, ty, "tex-title").setDisplaySize(dispW, dispH).setDepth(95);
    const off = titleSealOffset(dispW, dispH);
    this.seal = this.scene.add
      .image(tx + off.x, ty + off.y, "tex-zeroseal")
      .setDisplaySize(132, 132)
      .setAngle(-9)
      .setDepth(96);

    this.tagline = this.scene.add
      .text(tx, 296, "动作可以编排，分寸需要人来教", {
        fontFamily: FONT,
        fontSize: "20px",
        color: "#cfc5a8",
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(97);
    this.tagline.setLetterSpacing(7);

    this.ornaments = this.scene.add.graphics().setDepth(97).setAlpha(0);
    const tw = 390;
    this.ornaments.lineStyle(1.2, PALETTE.gold, 0.42);
    this.ornaments.beginPath();
    this.ornaments.moveTo(tx - tw / 2 - 86, 296);
    this.ornaments.lineTo(tx - tw / 2 - 18, 296);
    this.ornaments.moveTo(tx + tw / 2 + 18, 296);
    this.ornaments.lineTo(tx + tw / 2 + 86, 296);
    this.ornaments.strokePath();
    this.ornaments.fillStyle(PALETTE.gold, 0.5);
    this.ornaments.fillCircle(tx - tw / 2 - 90, 296, 2);
    this.ornaments.fillCircle(tx + tw / 2 + 90, 296, 2);
  }

  private idleSeal(): void {
    this.scene.tweens.add({
      targets: this.seal,
      angle: { from: -11, to: -7 },
      duration: 7000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }
}
