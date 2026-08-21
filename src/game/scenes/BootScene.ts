import Phaser from "phaser";
import { generateTextures, generateDomTextures, paperPanelUrl, inkSplashUrl } from "../render/textures";
import { audioBus } from "../systems/audio";
import { getSave, putSave } from "../../main";

/** 启动：等字体就绪后生成程序化纹理，进入标题。 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  preload(): void {
    /* 首页分层改为程序化生成，启动阶段只等字体 */
  }

  create(): void {
    void this.boot();
  }

  private async boot(): Promise<void> {
    await this.waitFonts();
    generateTextures(this);
    generateDomTextures();
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty("--paper-url", `url(${paperPanelUrl})`);
    rootStyle.setProperty("--ink-splash-url", `url(${inkSplashUrl})`);
    const save = getSave();
    audioBus.musicOn = save.settings.musicOn;
    audioBus.sfxOn = save.settings.sfxOn;
    audioBus.ensure();
    putSave(save);
    this.scene.start("Title");
  }

  private async waitFonts(): Promise<void> {
    if (!document.fonts?.load) return;
    const load = (spec: string) => document.fonts.load(spec).catch(() => undefined);
    try {
      await Promise.race([
        Promise.all([
          load('400 198px "Ma Shan Zheng"'),
          load('400 168px "KaiTi"'),
          load('400 168px "STXingkai"'),
          load('900 124px "Noto Serif SC"'),
          load('600 38px "Noto Serif SC"'),
          load('400 24px "Noto Sans SC"'),
          load('700 90px "Noto Serif SC"'),
        ]),
        new Promise<void>((resolve) => window.setTimeout(resolve, 2000)),
      ]);
    } catch {
      /* 离线时回落到华文行楷 / 楷体 */
    }
  }
}
