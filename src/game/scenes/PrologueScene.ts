import Phaser from "phaser";
import { PALETTE } from "../config";
import { clearUI, playDialogue } from "../../ui/dom";
import { PROLOGUE, SPEAKER_NAMES } from "../content/dialogue";
import { getRun, setRun } from "../../main";
import { audioBus } from "../systems/audio";
import { saveStoreSpeed } from "../systems/saveHelpers";

/** 序章：阿零的机械试演——只追路线，不看队友，扯乱龙身。 */
export class PrologueScene extends Phaser.Scene {
  private azeroX = 500;
  private timelineDone = false;

  constructor() {
    super("Prologue");
  }

  create(): void {
    clearUI();
    const run = getRun();
    run.phase = "prologue";
    setRun(run);

    // 简化舞台：训练场黄昏
    this.cameras.main.setBackgroundColor(0x1c2733);
    const g = this.add.graphics();
    g.fillGradientStyle(0x2c3b47, 0x2c3b47, 0x8f8570, 0xc9b68c, 1);
    g.fillRect(0, 0, 1920, 640);
    this.add.image(0, 300, "tex-hill").setOrigin(0, 0).setAlpha(0.45).setTint(0x77786a);
    this.add.image(0, 790, "ground-yard").setOrigin(0, 0).setDisplaySize(1920, 290).setAlpha(0.9);

    // 预设路线（蓝图折线）
    const line = this.add.graphics();
    line.lineStyle(4, PALETTE.blueprint, 0.85);
    line.beginPath();
    line.moveTo(320, 690);
    line.lineTo(700, 690);
    line.lineTo(700, 560);
    line.lineTo(1120, 560);
    line.lineTo(1120, 690);
    line.lineTo(1520, 690);
    line.strokePath();

    // 阿零与其后的队伍（演出失败的表演）
    const azero = this.add.graphics();
    const drawAzeroAt = (x: number, t: number) => {
      azero.clear();
      const y = t < 0.3 ? 690 : t < 0.55 ? 560 : t < 0.75 ? 690 : 620;
      const stride = Math.sin(t * 22) * 9;
      // 腿（走动摆幅）
      azero.lineStyle(6, 0x5c6a74, 1);
      azero.beginPath();
      azero.moveTo(x, y - 50);
      azero.lineTo(x - 13 + stride, y + 52);
      azero.strokePath();
      azero.beginPath();
      azero.moveTo(x, y - 50);
      azero.lineTo(x + 13 - stride, y + 52);
      azero.strokePath();
      // 躯干 + 竹节环 + 朱砂关节
      azero.lineStyle(10, 0x9aa7b0, 1);
      azero.beginPath();
      azero.moveTo(x, y - 48);
      azero.lineTo(x + 8, y - 104);
      azero.strokePath();
      azero.lineStyle(2, PALETTE.bamboo, 0.95);
      for (let i = 1; i <= 3; i++) {
        const yy = y - 48 - 56 * (i / 3.6);
        azero.beginPath();
        azero.moveTo(x + 1 + (8 * i) / 3.6 - 7, yy);
        azero.lineTo(x + 1 + (8 * i) / 3.6 + 7, yy);
        azero.strokePath();
      }
      azero.fillStyle(PALETTE.cinnabar, 1);
      azero.fillCircle(x + 8, y - 48, 3.4);
      azero.fillCircle(x + 8, y - 104, 3.4);
      // 持杆臂
      azero.lineStyle(5, 0x9aa7b0, 1);
      azero.beginPath();
      azero.moveTo(x + 6, y - 96);
      azero.lineTo(x - 8, y - 66);
      azero.lineTo(x + 4, y - 58);
      azero.strokePath();
      // 头 + 扫描缝（随动作扫动）
      azero.fillStyle(0xb9c4cc, 1);
      azero.fillRoundedRect(x, y - 126, 22, 24, 5);
      azero.fillStyle(PALETTE.blueprint, 1);
      azero.fillRect(x + 4 + Math.sin(t * 12) * 3, y - 118, 14, 3.2);
    };

    // 龙身绞乱：鳞节贴图错位乱转（真实绞龙，不是圆点）
    const bodySegs: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < 3; i++) {
      bodySegs.push(this.add.image(0, 0, "tex-segment").setScale(0.52 - i * 0.06).setAlpha(0.92));
    }
    const tangle = this.add.graphics();
    const drawBodyAt = (x: number, t: number) => {
      tangle.clear();
      for (let i = 0; i < 3; i++) {
        const chaos = t > 0.5 ? Math.sin(t * 18 + i * 2.4) * 52 * (t - 0.5) * 2 : 0;
        const bx = x - 40 - i * 88 - t * 60;
        const by = 664 + chaos;
        const seg = bodySegs[i];
        seg.setPosition(bx, by);
        // 绞乱：角度随混乱度偏离正常
        seg.setRotation(Math.sin(t * 14 + i * 3) * 1.5 * Math.max(0, t - 0.45) * 2.2);
        if (i === 1 && t > 0.6) seg.setTint(0xd98a7a);
        else seg.clearTint();
      }
      if (t > 0.62) {
        tangle.lineStyle(3, PALETTE.cinnabar, 0.9);
        tangle.beginPath();
        tangle.moveTo(x - 340, 640);
        tangle.lineTo(x - 300, 700);
        tangle.lineTo(x - 320, 660);
        tangle.lineTo(x - 260, 720);
        tangle.strokePath();
      }
    };

    // 演出动画
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 6400,
      ease: "Sine.easeInOut",
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0;
        this.azeroX = 500 + t * 900;
        drawAzeroAt(this.azeroX, t);
        drawBodyAt(this.azeroX, t);
      },
    });

    // 灯柱倒下
    this.time.delayedCall(4300, () => {
      const lamp = this.add.image(1120, 604, "tex-lantern").setScale(0.72);
      this.tweens.add({
        targets: lamp,
        angle: 82,
        x: 1180,
        y: 742,
        duration: 700,
        ease: "Bounce.easeOut",
      });
      if (audioBus.sfxOn) {
        audioBus.crowd(0.5, 1.2);
        audioBus.beep(false);
      }
    });

    // 对白
    const dlg = playDialogue(PROLOGUE, SPEAKER_NAMES, {
      speedMs: saveStoreSpeed(),
      onDone: () => this.finish(),
    });

    // 跳过按钮
    const skip = document.createElement("button");
    skip.className = "btn";
    skip.textContent = "跳过序章 ▸";
    skip.style.cssText = "position:absolute;top:14px;right:calc(16px + var(--safe-r));pointer-events:auto;font-size:14px;padding:6px 14px;min-height:36px";
    skip.addEventListener("click", () => {
      dlg.skip();
    });
    document.getElementById("ui-root")!.append(skip);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      dlg.destroy();
      skip.remove();
    });
  }

  private finish(): void {
    if (this.timelineDone) return;
    this.timelineDone = true;
    clearUI();
    // 检查点恢复时直接进入对应段；新游戏从第一轮开始
    const run = getRun();
    this.scene.start("Training", { trialIndex: run.trialIndex });
  }
}
