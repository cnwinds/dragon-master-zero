// 全部叙事文本：序章、复盘、终局与结局。
// 对白短而具体——阿零不说废话，师傅不念稿。

export interface DialogueLine {
  speaker: "narration" | "master" | "azero" | "xiaoman" | "steward" | "crowd";
  text: string;
  /** 自动推进秒数；不填则等玩家点击 */
  hold?: number;
}

export const PROLOGUE: DialogueLine[] = [
  { speaker: "narration", text: "竹泾镇，百工灯会前夜。", hold: 2.6 },
  { speaker: "narration", text: "镇上的机器人实验室送来一台机器——零号。它要学的，是舞龙。", hold: 3.2 },
  { speaker: "master", text: "它平衡好，眼力好，就是不认人。" },
  { speaker: "narration", text: "试演开始。零号沿着预设路线冲刺，龙头划出完美的折线。", hold: 3.0 },
  { speaker: "narration", text: "——但队伍跟不上它。龙身绞在一起，灯柱倒了两根。", hold: 3.0 },
  { speaker: "xiaoman", text: "它跑得真准……可它根本没回头看过我们一眼。" },
  { speaker: "master", text: "动作全对，队伍全乱。这不算舞龙。" },
  { speaker: "azero", text: "任务完成度：百分之九十二。是否继续？" },
  { speaker: "master", text: "停。今天不练动作，练一件事——看见身后的人。" },
  { speaker: "master", text: "（对你说）它是你的学生。教它，别替它跳。" },
  { speaker: "narration", text: "教学开始：竹简是动作，鼓谱是时间，口令是它的心。", hold: 3.2 },
];

export const SPEAKER_NAMES: Record<DialogueLine["speaker"], string> = {
  narration: "",
  master: "周师傅",
  azero: "阿零",
  xiaoman: "小满",
  steward: "灯会执事",
  crowd: "观众",
};

/** 复盘：动作归因 + 训练归因（必须引用因果词典） */
export function reviewAttribution(result: {
  mistakes: Array<{ reason: string; type: string }>;
  memoryTriggers: Array<{ text: string }>;
  corrections: Array<{ grade: string }>;
  scores: { stability: number; rhythm: number; coordination: number; expression: number };
  intentSummary: string;
}): { moveLine: string; trainLine: string } {
  const moveLine = result.mistakes.length
    ? result.mistakes[0].reason
    : "每一拍都落在鼓点上，龙身始终连成一条线。";
  let trainLine = result.intentSummary;
  if (result.memoryTriggers.length) trainLine = `${result.memoryTriggers[0].text}`;
  const perfect = result.corrections.filter((c) => c.grade === "perfect").length;
  if (perfect > 0) trainLine += ` 你${perfect}次正拍纠偏，实际轨迹立刻收回了预测线。`;
  return { moveLine, trainLine };
}

export const REVIEW_INTRO: Record<0 | 1 | 2, DialogueLine[]> = {
  0: [
    { speaker: "master", text: "八拍鼓谱，它第一次听懂了节奏。看看它刚才做了什么。" },
  ],
  1: [
    { speaker: "xiaoman", text: "这一轮……它好像开始等我了。" },
    { speaker: "master", text: "老街窄，观众多。稳住的人才有资格快。" },
  ],
  2: [
    { speaker: "master", text: "今晚的河岸，就是它的考场。" },
  ],
};

export const MEMORY_CHOICE_INTRO: string =
  "把一条经验刻在它的记忆签上——它会带着这条经验走上最终的舞台。";

export const ENDING_TEXT: Record<
  "trueApprentice" | "championMachine" | "lightsFade",
  { title: string; lines: DialogueLine[]; tableau: string }
> = {
  trueApprentice: {
    title: "真正出师",
    tableau: "回头之龙",
    lines: [
      { speaker: "narration", text: "灯绳绊住小满的那一拍，阿零停了半拍。", hold: 2.6 },
      { speaker: "narration", text: "然后，它的头、肩、龙头，依次转向身后。", hold: 2.6 },
      { speaker: "xiaoman", text: "……我在这儿！它真的在等我！" },
      { speaker: "azero", text: "记录：同伴位置已确认。重新计算路线——带着他们。" },
      { speaker: "narration", text: "龙身在灯海之上重新连成一道弧线，像一次呼吸。", hold: 2.8 },
      { speaker: "master", text: "动作可以编，分寸教不出来——但今晚，是你教会的。" },
      { speaker: "master", text: "这节旧竹，是上一代龙师传给我的龙头。现在归你。" },
      { speaker: "azero", text: "收到。这不是奖牌，是责任。我会记得回头。" },
      { speaker: "narration", text: "灯会散场。河面上，一行竹青色的轨迹缓缓收势。", hold: 3.0 },
    ],
  },
  championMachine: {
    title: "冠军机器",
    tableau: "孤高之龙",
    lines: [
      { speaker: "narration", text: "灯绳绊住小满的那一拍，阿零没有停。", hold: 2.6 },
      { speaker: "narration", text: "预测蓝线指向最高点。它执行了。完美执行。", hold: 2.6 },
      { speaker: "narration", text: "龙头在灯海之上划出全场最高的弧线，欢呼声浪掀过河岸。", hold: 2.8 },
      { speaker: "xiaoman", text: "喂……等等我们——" },
      { speaker: "narration", text: "龙身拖在后面，被拉成一条直线。", hold: 2.4 },
      { speaker: "azero", text: "任务完成度：百分之百。掌声分贝：历史新高。" },
      { speaker: "steward", text: "冠军是那台机器人！多精彩啊！" },
      { speaker: "master", text: "观众记住了机器，没记住队伍。这不是我要教它的东西。" },
      { speaker: "narration", text: "奖台灯光下，阿零的扫描缝亮着，照不见身后的任何人。", hold: 3.0 },
    ],
  },
  lightsFade: {
    title: "灯散之后",
    tableau: "未完之龙",
    lines: [
      { speaker: "narration", text: "演出结束了。掌声不大，也不算冷。", hold: 2.4 },
      { speaker: "narration", text: "但阿零还有一样东西没有学会。", hold: 2.4 },
      { speaker: "xiaoman", text: "下次……我们再试一次吧，阿零。" },
      { speaker: "azero", text: "下次。已记录。练习不会终止。" },
      { speaker: "master", text: "出师不是一场灯会的事。留下，明天继续。" },
      { speaker: "narration", text: "灯一盏一盏熄了。训练场上，鼓又响了一声。", hold: 3.0 },
    ],
  },
};

/** 灯散之后的三种尾声（按最低状态切换，不得与玩家行为相反） */
export const LIGHTSFADE_EPILOGUE: Record<"formation" | "completion" | "balance", string> = {
  formation: "它还没学会保护队形——龙头的每一步，都该是身后所有人的下一步。",
  completion: "它还没学会完成动作——会回头了，动作却还没跟上鼓点。",
  balance: "它还没学会在精彩与协作之间取舍——两头都想要，就两头都差一口气。",
};

export const TITLE_TAGLINES: string[] = [
  "动作可以编排，分寸需要人来教。",
];
