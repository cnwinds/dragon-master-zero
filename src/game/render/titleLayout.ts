// 场景01首页：1920×1080 逻辑坐标（docs/scenes/01-首页.md）。

export const TITLE_VIEW = { w: 1920, h: 1080 } as const;

/** 左侧标题留白，约占画面 35% */
export const TITLE_QUIET = 0.35;

export const TITLE_POSE = {
  azeroFoot: { x: 1370, y: 890 },
  azeroH: 590,
  head: { x: 1490, y: 505, w: 300 },
  zhou: { x: 960, y: 610 },
  drum: { x: 895, y: 665 },
  teamX0: 1330,
  teamX1: 1790,
  stage: { x0: 1040, x1: 1920, y0: 510, y1: 870 },
  lanternNear: { x: 1740, y: 260 },
  eaves: { y0: 410, y1: 560 },
  predictMax: 420,
  mobileAzeroShift: 90,
} as const;

export const TITLE_HUD = {
  logo: { x: 128, y: 116, w: 660, h: 220, z: 310 },
  menu: { x: 150, y: 505, w: 420, h: 300, z: 310 },
  save: { x: 150, y: 830, w: 520, h: 86, z: 305 },
  util: { x: 1610, y: 56, w: 238, h: 54, z: 320 },
  version: { x: 128, y: 1000, w: 900, h: 32, z: 300 },
  mobile: {
    logo: { x: 190, y: 80, w: 720, h: 190 },
    menu: { x: 180, y: 760, w: 1560, h: 230 },
  },
} as const;

export const TITLE_INTRO_MS = 2800;

export const TITLE_BEATS = {
  fadeEnd: 450,
  dragonEnd: 1050,
  blueprintEnd: 1650,
  titleEnd: 2200,
  menuEnd: 2800,
} as const;

/** 龙身控制点：尾→头。上方从右上回落到画面中部，颈段交给小满。 */
export const TITLE_DRAGON_POINTS: Array<{ x: number; y: number }> = [
  { x: 1148, y: 248 },
  { x: 1344, y: 152 },
  { x: 1576, y: 128 },
  { x: 1786, y: 208 },
  { x: 1810, y: 348 },
  { x: 1692, y: 448 },
  { x: 1554, y: 538 },
  { x: 1398, y: 612 },
  { x: 1430, y: 518 },
];

export const TITLE_TEAM_X = [1330, 1483, 1636, 1790] as const;

export const PHASE_LABELS: Record<string, string> = {
  title: "首页",
  prologue: "序章 · 第一次失败",
  "training-1": "第一轮 · 竹棚编舞",
  "performance-1": "第一轮 · 基础演练",
  "review-1": "第一轮 · 训练复盘",
  "training-2": "第二轮 · 灯阵编舞",
  "performance-2": "第二轮 · 灯阵演练",
  "review-2": "第二轮 · 训练复盘",
  "final-training": "最终演出 · 准备",
  "final-performance": "最终演出 · 龙抬头",
  ending: "结局",
};

export const TRIAL_FALLBACK_LABEL = ["第一轮 · 竹棚编舞", "第二轮 · 灯阵编舞", "最终演出 · 准备"] as const;

export function isTitlePhoneLayout(ui?: HTMLElement | null): boolean {
  const h = ui?.clientHeight ?? window.innerHeight;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  return h <= 500 || (coarse && h <= 560);
}
