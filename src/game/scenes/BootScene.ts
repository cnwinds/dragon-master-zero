import Phaser from "phaser";
import { generateTextures, generateDomTextures, paperPanelUrl, inkSplashUrl } from "../render/textures";
import { audioBus } from "../systems/audio";
import { getSave, putSave } from "../../main";

/** 启动：生成全部程序化纹理，恢复音频设置，进入标题。 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create(): void {
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
}
