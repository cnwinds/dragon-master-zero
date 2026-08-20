// 全局视觉与布局配置（GDD §14.2 固定色彩与语义）。

export const PALETTE = {
  paper: 0xe9e0c8, // 宣纸米白：文本与留白
  night: 0x121d2c, // 夜靛青：夜景与界面底色
  nightDeep: 0x0b141f,
  cinnabar: 0xb64036, // 朱砂红：错误、纠偏与印章
  gold: 0xc79a45, // 旧铜金：灯光与完成反馈
  bamboo: 0x5f8060, // 竹青：实际动作、龙身与生命感
  bambooLight: 0x7fa381,
  blueprint: 0x72a9c2, // 蓝图青：预测、参数与机械感知
  blueprintDim: 0x3d5a6b,
  ink: 0x1a222b,
  mist: 0x8b95a3,
} as const;

export const CSS = {
  paper: "#E9E0C8",
  night: "#121D2C",
  cinnabar: "#B64036",
  gold: "#C79A45",
  bamboo: "#5F8060",
  bambooLight: "#7FA381",
  blueprint: "#72A9C2",
  mist: "#8B95A3",
} as const;

export const VIEW_W = 1920;
export const VIEW_H = 1080;

export const FONT = '"Noto Serif SC","Source Han Serif SC","STSong","SimSun",serif';

/** 关键 UI 区域（逻辑坐标） */
export const LAYOUT = {
  timeline: { x: 160, y: 926, w: 1600, h: 118 },
  tray: { x: 44, y: 148, w: 300 },
  commandPanel: { x: 1690, y: 148, w: 196 },
};

export const BEAT_MS: Record<string, number> = {};

/** 文本速度（毫秒/字） */
export const TEXT_SPEED: Record<"slow" | "normal" | "fast", number> = {
  slow: 110,
  normal: 65,
  fast: 30,
};
