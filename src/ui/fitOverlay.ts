// 把 DOM 界面钉在 Phaser 画布的可见矩形上。
// Scale.FIT 会在宽屏两侧留黑边；若 #ui-root 仍铺满窗口，靠右的按钮会落到画面外。

import Phaser from "phaser";

export function bindUiToCanvas(game: Phaser.Game): void {
  const ui = document.getElementById("ui-root");
  const app = document.getElementById("app");
  if (!ui || !app) return;

  const sync = () => {
    const canvas = game.canvas;
    if (!canvas) return;
    const c = canvas.getBoundingClientRect();
    const a = app.getBoundingClientRect();
    ui.style.left = `${Math.round(c.left - a.left)}px`;
    ui.style.top = `${Math.round(c.top - a.top)}px`;
    ui.style.width = `${Math.round(c.width)}px`;
    ui.style.height = `${Math.round(c.height)}px`;
    ui.style.right = "auto";
    ui.style.bottom = "auto";
  };

  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    sync();
    game.scale.on(Phaser.Scale.Events.RESIZE, sync);
    if (typeof ResizeObserver !== "undefined" && game.canvas) {
      new ResizeObserver(sync).observe(game.canvas);
    }
  };

  if (game.isBooted) start();
  else {
    game.events.once(Phaser.Core.Events.BOOT, start);
    game.events.once(Phaser.Core.Events.READY, start);
  }

  window.addEventListener("resize", sync);
  window.visualViewport?.addEventListener("resize", sync);
}
