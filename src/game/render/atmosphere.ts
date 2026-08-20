// 氛围层：全屏暗角、夜灯流萤、统一加在每个场景上提升质感。

import Phaser from "phaser";

/** 四边渐变暗角——画面立刻变"电影" */
export function addVignette(scene: Phaser.Scene, strength = 0.3, depth = 90): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(depth);
  const paint = () => {
    g.clear();
    const edge = 190;
    // 上下
    const top = scene.add.graphics();
    void top;
    const mk = (x: number, y: number, w: number, h: number, vertical: boolean, flip: boolean) => {
      // 用逐条渐变近似：每 16px 一层，透明度线性上升
      const steps = Math.ceil(h / 16);
      for (let i = 0; i < steps; i++) {
        const k = (i + 1) / steps;
        const a = strength * Math.pow(flip ? 1 - k : k, 1.5);
        g.fillStyle(0x05080d, a);
        g.fillRect(x, vertical ? y + i * 16 : y, vertical ? w : 16, vertical ? 16 : h);
        if (!vertical) {
          // 水平边：横向步进
        }
      }
    };
    // 顶
    let steps = Math.ceil(edge / 16);
    for (let i = 0; i < steps; i++) {
      const a = strength * Math.pow(1 - i / steps, 1.6);
      g.fillStyle(0x05080d, a);
      g.fillRect(0, i * 16, 1920, 16);
    }
    // 底
    for (let i = 0; i < steps; i++) {
      const a = strength * Math.pow(1 - i / steps, 1.6);
      g.fillStyle(0x05080d, a);
      g.fillRect(0, 1080 - (i + 1) * 16, 1920, 16);
    }
    // 左右
    steps = Math.ceil(150 / 16);
    for (let i = 0; i < steps; i++) {
      const a = strength * 0.8 * Math.pow(1 - i / steps, 1.6);
      g.fillStyle(0x05080d, a);
      g.fillRect(i * 16, 0, 16, 1080);
      g.fillStyle(0x05080d, a);
      g.fillRect(1920 - (i + 1) * 16, 0, 16, 1080);
    }
    void mk;
    void edge;
  };
  paint();
  return g;
}

/** 夜灯流萤：金色微光缓慢漂移呼吸 */
export function addFireflies(
  scene: Phaser.Scene,
  count = 14,
  area = { x0: 60, x1: 1860, y0: 380, y1: 850 },
  depth = 85,
): void {
  for (let i = 0; i < count; i++) {
    const x = area.x0 + Math.random() * (area.x1 - area.x0);
    const y = area.y0 + Math.random() * (area.y1 - area.y0);
    const scale = 0.14 + Math.random() * 0.16;
    const dot = scene.add
      .image(x, y, "tex-glow")
      .setScale(scale)
      .setAlpha(0.1 + Math.random() * 0.25)
      .setTint(0xf0c27a)
      .setDepth(depth);
    const drift = () => {
      const nx = Phaser.Math.Clamp(dot.x + (Math.random() - 0.5) * 180, area.x0, area.x1);
      const ny = Phaser.Math.Clamp(dot.y + (Math.random() - 0.5) * 110, area.y0, area.y1);
      scene.tweens.add({
        targets: dot,
        x: nx,
        y: ny,
        duration: 3600 + Math.random() * 3600,
        ease: "Sine.easeInOut",
        onComplete: drift,
      });
    };
    drift();
    scene.tweens.add({
      targets: dot,
      alpha: { from: 0.06, to: 0.32 },
      duration: 900 + Math.random() * 1300,
      yoyo: true,
      repeat: -1,
      delay: Math.random() * 1200,
    });
  }
}
