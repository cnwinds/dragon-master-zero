import Phaser from "phaser";
import "./styles.css";
import { VIEW_W, VIEW_H, PALETTE } from "./game/config";
import { BootScene } from "./game/scenes/BootScene";
import { TitleScene } from "./game/scenes/TitleScene";
import { PrologueScene } from "./game/scenes/PrologueScene";
import { TrainingScene } from "./game/scenes/TrainingScene";
import { PerformanceScene } from "./game/scenes/PerformanceScene";
import { ReviewScene } from "./game/scenes/ReviewScene";
import { EndingScene } from "./game/scenes/EndingScene";
import { freshRun, type RunState } from "./game/GameState";
import { loadSave, persistSave, type SaveData } from "./game/systems/saveStore";

declare global {
  interface Window {
    __game?: Phaser.Game;
  }
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game-root",
  width: VIEW_W,
  height: VIEW_H,
  backgroundColor: PALETTE.nightDeep,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: true,
    roundPixels: false,
  },
  scene: [BootScene, TitleScene, PrologueScene, TrainingScene, PerformanceScene, ReviewScene, EndingScene],
});

window.__game = game;

// 全局运行状态（跨场景共享；存档用）
const registry = game.registry;
registry.set("run", freshRun());

// 开发诊断：捕获运行时异常，供外部读取
declare global {
  interface Window {
    __gameErrors?: string[];
  }
}
window.__gameErrors = [];
window.addEventListener("error", (e) => {
  window.__gameErrors!.push(`${e.message} @ ${e.filename}:${e.lineno}`);
});

export function getRun(): RunState {
  return registry.get("run") as RunState;
}

export function setRun(run: RunState): void {
  registry.set("run", run);
}

export function getSave(): SaveData {
  return loadSave();
}

export function putSave(data: SaveData): void {
  persistSave(data);
}

// 竖屏提示
function checkOrientation(): void {
  const hint = document.getElementById("rotate-hint");
  if (!hint) return;
  const portrait = window.innerHeight > window.innerWidth && window.innerWidth < 820;
  hint.classList.toggle("hidden", !portrait);
}
window.addEventListener("resize", checkOrientation);
window.addEventListener("orientationchange", () => setTimeout(checkOrientation, 120));
checkOrientation();

// 音频解锁：首次交互
function unlockAudio(): void {
  void game.sound;
  window.removeEventListener("pointerdown", unlockAudio);
  window.removeEventListener("keydown", unlockAudio);
}
window.addEventListener("pointerdown", unlockAudio);
window.addEventListener("keydown", unlockAudio);

export { game };
