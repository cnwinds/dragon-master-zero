// 首页世界：六层水墨夜景 + 左静右动构图 + 2.8 秒开场。

import Phaser from "phaser";
import { PALETTE } from "../config";
import { addVignette } from "./atmosphere";
import { TitleCast } from "./titleCast";
import { TITLE_BEATS, TITLE_INTRO_MS, TITLE_POSE } from "./titleLayout";
import { audioBus } from "../systems/audio";

interface LitSprite {
  sprite: Phaser.GameObjects.Image;
  base: number;
  phase: number;
}

export class TitleWorld {
  private cast: TitleCast | null = null;
  private water: Phaser.GameObjects.Graphics | null = null;
  private townWindows: Phaser.GameObjects.Graphics | null = null;
  private waterPhase = 0;
  private lights: LitSprite[] = [];
  private fade!: Phaser.GameObjects.Rectangle;
  private introMs = 0;
  private introDone = false;
  private onReady: (() => void) | null = null;
  private skipIntro: (() => void) | null = null;
  private fog: Phaser.GameObjects.Image[] = [];
  private reduced = false;

  constructor(private scene: Phaser.Scene) {}

  build(phoneShift: boolean): void {
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.paintSky();
    this.paintClouds();
    this.paintTown();
    this.paintCrowd();
    this.paintRiverAndStage();
    this.paintLanterns();
    this.cast = new TitleCast(this.scene);
    this.cast.setShiftX(phoneShift ? TITLE_POSE.mobileAzeroShift : 0);
    this.cast.setIntroPose({ dragonX: 86, dragonA: 0, joint: 0, predict: 0, scan: 0 });
    addVignette(this.scene, 0.3, 248);
    this.scene.add.image(0, 0, "tex-paper").setOrigin(0, 0).setDisplaySize(1920, 1080).setAlpha(0.04).setDepth(249);
    this.paintLeftWash();
    this.fade = this.scene.add.rectangle(960, 540, 1920, 1080, 0x0a1018, 1).setDepth(560);
  }

  setPhoneShift(on: boolean): void {
    this.cast?.setShiftX(on ? TITLE_POSE.mobileAzeroShift : 0);
  }

  requestSkip(): void {
    this.finishIntro(true);
  }

  playIntro(onReady: () => void): void {
    this.onReady = onReady;
    this.skipIntro = () => this.finishIntro(true);
    this.scene.input.keyboard?.once("keydown", this.skipIntro);
    this.scene.input.once("pointerdown", this.skipIntro);

    if (this.reduced) {
      audioBus.startTitleBed();
      this.finishIntro(true);
      return;
    }

    audioBus.startTitleBed();
    this.scene.time.delayedCall(180, () => audioBus.farDrum());

    this.scene.tweens.add({
      targets: this.fade,
      alpha: 0,
      duration: TITLE_BEATS.fadeEnd,
      ease: "Sine.easeInOut",
    });

    this.lights.forEach((l, i) => {
      l.sprite.setAlpha(0);
      this.scene.tweens.add({
        targets: l.sprite,
        alpha: l.base,
        duration: 520,
        delay: 40 + i * 28,
        ease: "Sine.easeOut",
      });
    });

    this.scene.tweens.add({
      targets: this.scene.cameras.main,
      zoom: 1.018,
      scrollX: 18,
      scrollY: 8,
      duration: TITLE_BEATS.dragonEnd - TITLE_BEATS.fadeEnd,
      delay: TITLE_BEATS.fadeEnd,
      ease: "Sine.easeInOut",
    });

    this.scene.time.delayedCall(TITLE_INTRO_MS, () => this.finishIntro(false));
  }

  update(time: number, delta: number): void {
    if (!this.introDone) {
      this.introMs += delta;
      this.driveIntro(this.introMs);
    }
    this.cast?.update(delta, !this.introDone);
    this.waterPhase += delta / 1000;
    this.drawWater();
    this.pulseWindows(time);
    if (!this.introDone) return;
    for (const l of this.lights) {
      l.sprite.alpha = l.base * (0.8 + 0.2 * Math.sin(time * 0.0016 + l.phase));
    }
  }

  playExitToPrologue(onDone: () => void): void {
    audioBus.confirm();
    this.fade.setFillStyle(PALETTE.blueprint, 1);
    this.fade.setAlpha(0);
    this.scene.tweens.add({
      targets: this.scene.cameras.main,
      zoom: 1.12,
      scrollX: 210,
      scrollY: 36,
      duration: 860,
      ease: "Cubic.easeIn",
    });
    this.scene.tweens.add({
      targets: this.fade,
      alpha: 1,
      duration: 900,
      ease: "Sine.easeIn",
      onComplete: onDone,
    });
    audioBus.stopTitleBed();
  }

  playExitContinue(trialIndex: 0 | 1 | 2, onDone: () => void): void {
    audioBus.confirm();
    const colors = [0x5d6a6a, 0x121d2c, 0xc79a45];
    this.fade.setFillStyle(colors[trialIndex], 1);
    this.fade.setAlpha(0);
    this.scene.tweens.add({
      targets: this.fade,
      alpha: 1,
      duration: 1100,
      ease: "Sine.easeInOut",
      onComplete: onDone,
    });
    audioBus.stopTitleBed();
  }

  shutdown(): void {
    audioBus.stopTitleBed();
    if (this.skipIntro) {
      this.scene.input.keyboard?.off("keydown", this.skipIntro);
      this.scene.input.off("pointerdown", this.skipIntro);
    }
  }

  private driveIntro(ms: number): void {
    if (!this.cast) return;
    if (ms >= TITLE_BEATS.fadeEnd && ms < TITLE_BEATS.dragonEnd) {
      const u = (ms - TITLE_BEATS.fadeEnd) / (TITLE_BEATS.dragonEnd - TITLE_BEATS.fadeEnd);
      const k = 1 - Math.pow(1 - u, 3);
      this.cast.setIntroPose({
        dragonX: 86 * (1 - k),
        dragonA: k,
        joint: k,
      });
    }
    if (ms >= TITLE_BEATS.dragonEnd && ms < TITLE_BEATS.blueprintEnd) {
      const u = (ms - TITLE_BEATS.dragonEnd) / (TITLE_BEATS.blueprintEnd - TITLE_BEATS.dragonEnd);
      this.cast.setIntroPose({
        dragonX: 0,
        dragonA: 1,
        joint: 1,
        predict: u,
        scan: Math.sin(u * Math.PI),
      });
    }
    if (ms >= TITLE_BEATS.blueprintEnd) {
      this.cast.setIntroPose({ dragonX: 0, dragonA: 1, joint: 1, predict: 1, scan: 0 });
    }
  }

  private finishIntro(skipped: boolean): void {
    if (this.introDone) return;
    this.introDone = true;
    if (this.skipIntro) {
      this.scene.input.keyboard?.off("keydown", this.skipIntro);
      this.scene.input.off("pointerdown", this.skipIntro);
      this.skipIntro = null;
    }
    this.scene.tweens.killTweensOf(this.fade);
    this.scene.tweens.killTweensOf(this.scene.cameras.main);
    this.scene.tweens.killTweensOf(this.lights.map((l) => l.sprite));
    this.fade.setAlpha(0);
    this.scene.cameras.main.setZoom(1.018);
    this.scene.cameras.main.setScroll(18, 8);
    this.cast?.settleIntro();
    for (const l of this.lights) l.sprite.setAlpha(l.base);
    this.onReady?.();
  }

  private paintSky(): void {
    const g = this.scene.add.graphics().setDepth(0);
    g.fillGradientStyle(0x0a1018, 0x0a1018, 0x121d2c, 0x121d2c, 1);
    g.fillRect(0, 0, 1920, 1080);
    const wash = this.scene.add.graphics().setDepth(1);
    wash.fillGradientStyle(0x0a1018, 0x121d2c, 0x0c1824, 0x1a3044, 1);
    wash.fillRect(0, 0, 1920, 560);
  }

  private paintClouds(): void {
    const a = this.scene.add.image(1480, 160, "tex-inkcloud").setAlpha(0.46).setDepth(8);
    const b = this.scene.add.image(1780, 110, "tex-inkcloud").setFlipX(true).setAlpha(0.34).setDepth(8);
    const c = this.scene.add.image(1180, 210, "tex-inkcloud").setAlpha(0.22).setScale(0.85).setDepth(8);
    this.fog.push(a, b, c);
    this.scene.tweens.add({
      targets: a,
      x: 1320,
      duration: 11000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    this.scene.tweens.add({
      targets: b,
      x: 1680,
      duration: 11000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
      delay: 900,
    });
    this.scene.tweens.add({
      targets: c,
      x: 1080,
      duration: 11000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
      delay: 1600,
    });
  }

  private paintTown(): void {
    const g = this.scene.add.graphics().setDepth(18);
    const y0 = TITLE_POSE.eaves.y0;
    const y1 = TITLE_POSE.eaves.y1;
    g.fillStyle(0x0c141c, 0.92);
    // 屋脊剪影
    const roofs = [
      [640, 96, 38], [760, 80, 44], [880, 110, 36], [1020, 90, 50],
      [1180, 76, 40], [1320, 100, 34], [1460, 84, 46], [1620, 92, 38],
      [1760, 70, 42],
    ] as const;
    for (const [x, w, h] of roofs) {
      g.fillTriangle(x, y0 + 8, x + w, y0 + 8, x + w * 0.5, y0 - h * 0.45);
      g.fillRect(x + 6, y0 + 8, w - 12, y1 - y0 - 18);
    }
    // 拱桥
    g.fillStyle(0x0a1218, 0.95);
    g.beginPath();
    g.moveTo(980, y1);
    g.lineTo(1180, y1 - 86);
    g.lineTo(1380, y1);
    g.lineTo(1368, y1 + 12);
    g.lineTo(1180, y1 - 70);
    g.lineTo(992, y1 + 12);
    g.closePath();
    g.fillPath();
    g.fillStyle(0x070c12, 1);
    g.fillEllipse(1180, y1 + 8, 86, 36);

    this.townWindows = this.scene.add.graphics().setDepth(19);
  }

  private pulseWindows(time: number): void {
    const g = this.townWindows;
    if (!g) return;
    g.clear();
    const spots = [
      [772, 448], [894, 456], [1044, 444], [1208, 438],
      [1340, 452], [1488, 446], [1636, 440], [1772, 434],
    ];
    for (const [x, y] of spots) {
      const a = 0.28 + 0.22 * Math.sin(time * 0.0013 + x * 0.01);
      g.fillStyle(0xf0c27a, a);
      g.fillRect(x, y, 7, 9);
    }
  }

  private paintCrowd(): void {
    const g = this.scene.add.graphics().setDepth(22);
    for (let i = 0; i < 42; i++) {
      const x = 860 + (i * 97) % 980 + (i % 5) * 6;
      const y = 498 + (i % 4) * 8;
      g.fillStyle(0x070c12, 0.7 + (i % 3) * 0.08);
      g.fillCircle(x, y, 2.4 + (i % 3) * 0.8);
      g.fillRect(x - 2.2, y, 4.4, 7);
    }
  }

  private paintRiverAndStage(): void {
    const stage = this.scene.add.graphics().setDepth(55);
    const { x0, x1, y0, y1 } = TITLE_POSE.stage;
    stage.fillStyle(0x1a140e, 1);
    stage.beginPath();
    stage.moveTo(x0, y1);
    stage.lineTo(x0 + 40, y0 + 36);
    stage.lineTo(x1, y0 + 20);
    stage.lineTo(x1, y1);
    stage.closePath();
    stage.fillPath();
    stage.fillStyle(PALETTE.gold, 0.18);
    stage.fillRect(x0 + 48, y0 + 34, x1 - x0 - 48, 3);
    const planks = this.scene.add.image(x0, y0 + 40, "ground-river")
      .setOrigin(0, 0)
      .setDisplaySize(x1 - x0, y1 - y0 - 40)
      .setAlpha(0.88)
      .setDepth(56);

    this.water = this.scene.add.graphics().setDepth(60);
    this.drawWater();

    const moonlessGlow = this.scene.add.image(1680, 980, "tex-glow")
      .setScale(5.2, 2.4)
      .setAlpha(0.12)
      .setTint(0xd9a75c)
      .setDepth(61);
    this.lights.push({ sprite: moonlessGlow, base: 0.12, phase: 1.2 });
    void planks;
  }

  private drawWater(): void {
    const wg = this.water;
    if (!wg) return;
    wg.clear();
    const t = (this.waterPhase / 6.4) * Math.PI * 2;
    wg.fillStyle(0x071018, 1);
    wg.fillRect(0, 868, 1920, 212);
    wg.fillStyle(0x102436, 0.4);
    wg.fillRect(0, 868, 1920, 14);
    // 左侧留白区倒影极弱
    wg.lineStyle(1.4, 0x3d5a6b, 0.08);
    for (let i = 0; i < 8; i++) {
      const y = 892 + i * 18;
      const off = Math.sin(t + i * 0.9) * 28;
      wg.beginPath();
      wg.moveTo(off + 20, y);
      wg.lineTo(off + 520, y);
      wg.strokePath();
    }
    wg.lineStyle(1.6, 0x3d5a6b, 0.16);
    for (let i = 0; i < 10; i++) {
      const y = 888 + i * 16;
      const off = Math.sin(t * 0.85 + i * 1.1) * 36;
      wg.beginPath();
      wg.moveTo(900 + off + ((i * 131) % 200), y);
      wg.lineTo(900 + off + ((i * 131) % 200) + 280, y);
      wg.strokePath();
    }
  }

  private paintLanterns(): void {
    // 远
    for (let i = 0; i < 5; i++) {
      const x = 1080 + i * 150;
      const y = 430 + (i % 2) * 10;
      const glow = this.scene.add.image(x, y, "tex-glow").setScale(0.32).setAlpha(0.22).setTint(0xf0c27a).setDepth(28);
      this.lights.push({ sprite: glow, base: 0.22, phase: i });
    }
    // 中
    const mids = [1180, 1410, 1588];
    mids.forEach((x, i) => this.placeLantern(x, 332 + i * 18, 0.42, 70 + i, 4.8 + i * 0.6));
    // 近：规格最近点
    this.placeLantern(TITLE_POSE.lanternNear.x, TITLE_POSE.lanternNear.y, 0.78, 92, 6.4);
    this.placeLantern(1860, 310, 0.52, 88, 7.0);
  }

  private placeLantern(x: number, y: number, scale: number, depth: number, period: number): void {
    const lantern = this.scene.add.image(x, y, "tex-lantern").setScale(scale).setOrigin(0.5, 0).setDepth(depth);
    const swing = 2.4 + Math.random() * 0.6;
    this.scene.tweens.add({
      targets: lantern,
      angle: { from: -swing, to: swing },
      duration: (period * 1000) / 2,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    const glow = this.scene.add.image(x, y + 40 * scale, "tex-glow")
      .setScale(1.1 * scale + 0.4)
      .setAlpha(0.42)
      .setTint(0xf0c27a)
      .setDepth(depth - 1);
    this.lights.push({ sprite: glow, base: 0.42, phase: x * 0.01 });
    if (x > 900) {
      const refl = this.scene.add.image(x, 940, "tex-glow").setScale(1.2 * scale, 0.35).setAlpha(0.16).setTint(0xd9a75c).setDepth(62);
      this.lights.push({ sprite: refl, base: 0.16, phase: x * 0.02 });
    }
  }

  private paintLeftWash(): void {
    const g = this.scene.add.graphics().setDepth(250);
    g.fillGradientStyle(0x0a1018, 0x0a1018, 0x0a1018, 0x0a1018, 0.55, 0, 0.55, 0);
    g.fillRect(0, 0, 720, 1080);
  }
}
