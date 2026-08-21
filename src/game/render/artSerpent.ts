// 确认稿扣出的龙：用竖向切片沿最初 Serpent 公式游动（不用 3D Mesh，避免倒置）。

import Phaser from "phaser";

interface Band {
  img: Phaser.GameObjects.Image;
  t: number;
}

export class ArtSerpent {
  readonly container: Phaser.GameObjects.Container;
  private bands: Band[] = [];
  private originX = 0;
  private originY = 0;
  private t = 0;

  constructor(private scene: Phaser.Scene, textureKey: string) {
    this.container = scene.add.container(0, 0);
    if (!scene.textures.exists(textureKey)) return;

    const frame = scene.textures.get(textureKey).get();
    const tw = frame.width;
    const th = frame.height;
    const sx = 1920 / 1672;
    const sy = 1080 / 941;
    const meta = scene.cache.json.get("title-dragon-meta") as { crop?: number[] } | undefined;
    const crop = meta?.crop ?? [0, 0, tw, th];
    this.originX = (crop[0] + crop[2]) * 0.5 * sx;
    this.originY = (crop[1] + crop[3]) * 0.5 * sy;

    const slices = 40;
    const overlap = 6;
    const bandW = tw / slices;
    for (let i = 0; i < slices; i++) {
      const img = scene.add.image(this.originX, this.originY, textureKey).setScale(sx, sy);
      const x0 = Math.max(0, i * bandW - overlap);
      const w = Math.min(tw - x0, bandW + overlap * 2);
      img.setCrop(x0, 0, w, th);
      this.container.add(img);
      this.bands.push({ img, t: i / (slices - 1) });
    }
  }

  update(delta: number): void {
    if (this.bands.length === 0) return;
    this.t += delta;
    for (const band of this.bands) {
      const phase = this.t * 0.00115 - (1 - band.t) * 8.6;
      const amp = 10 + 18 * Math.sin(band.t * Math.PI * 0.92 + 0.4);
      const xWave = Math.cos(phase * 0.55) * (5 + 7 * band.t);
      band.img.setPosition(this.originX + xWave, this.originY + Math.sin(phase) * amp);
    }
  }
}
