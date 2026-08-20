// 三段流程的关卡配置。环境惩罚、纠偏窗口与目标全部数据化。

import type { MoveId, TrialId } from "../../../shared/types";

export interface TrialGoal {
  hard: string;
  soft: string;
}

export interface TrialConfig {
  id: TrialId;
  index: 0 | 1 | 2; // 0、1 为训练轮，2 为最终演出
  title: string;
  subtitle: string;
  scene: "yard" | "street" | "river";
  unlockedMoves: MoveId[];
  bpm: number; // 八拍鼓谱速度
  goals: TrialGoal;
  masterTip: string;
  /** 建议口令（第一轮教学用，其他轮给懒得打字的玩家） */
  suggestedCommands: string[];
  /** 环境难度：beat → 对大半径动作（盘/跃）的额外风险 */
  narrowBeats: number[];
  narrowPenalty: number;
  /** 剧情事件拍位（最终演出：小满被灯绳绊住） */
  incidentBeat?: number;
  /** 演出开场前的固定台词 */
  intro: string[];
}

export const TRIALS: TrialConfig[] = [
  {
    id: "bamboo-yard",
    index: 0,
    title: "第一轮 · 听见鼓点",
    subtitle: "竹棚训练场 · 日暮前",
    scene: "yard",
    unlockedMoves: ["probe", "thread", "coil", "lookBack"],
    bpm: 52,
    goals: { hard: "不碰倒两侧练习灯柱", soft: "龙身保持连贯，至少完成一次完整盘旋" },
    masterTip: "先用「探」看清路，再「穿」过去。看不见身后的人，动作再准也没用。",
    suggestedCommands: ["先稳住龙头，看清灯柱再穿。", "多回头看看小满，跟队伍走在一起。", "跟着鼓点来，动作要连贯。"],
    narrowBeats: [],
    narrowPenalty: 0,
    intro: [
      "周师傅：鼓响之前，谁都不许动。",
      "周师傅：八拍。把你知道的都放进去。",
    ],
  },
  {
    id: "lantern-street",
    index: 1,
    title: "第二轮 · 穿过灯阵",
    subtitle: "老街灯阵 · 刚入夜",
    scene: "street",
    unlockedMoves: ["probe", "thread", "rise", "coil", "leap", "lookBack"],
    bpm: 60,
    goals: { hard: "不触碰错位灯柱，安全穿过低门洞", soft: "让观众看到至少一次高点动作" },
    masterTip: "街窄，灯密。「盘」要留出空间，「跃」之前先看一眼小满。",
    suggestedCommands: ["这一轮大胆点，最后两拍全力跃起。", "先看清灯阵，多照顾后面的队友。", "稳一点，穿门洞的时候别碰灯。"],
    narrowBeats: [3, 4, 5, 6],
    narrowPenalty: 12,
    intro: [
      "小满：阿零，稳一点就好，我会跟着你。",
      "灯会执事：观众等着看大的！来一次「跃」吧！",
    ],
  },
  {
    id: "river-stage",
    index: 2,
    title: "最终演出 · 龙抬头",
    subtitle: "河岸主舞台 · 深夜",
    scene: "river",
    unlockedMoves: ["probe", "thread", "rise", "coil", "leap", "lookBack"],
    bpm: 64,
    goals: { hard: "完成整场演出，不留下散乱的队形", soft: "在灯海之上完成一次真正的高点" },
    masterTip: "今晚没有正确答案。你教过它什么，它就带着什么上台。",
    suggestedCommands: ["先看队伍，再完成高点。", "放开手脚，让全场记住这一晚。", "稳住节奏，我们一起收势。"],
    narrowBeats: [],
    narrowPenalty: 0,
    incidentBeat: 5,
    intro: [
      "周师傅：上台吧。记住，龙头不是领舞，是托住整条龙的人。",
    ],
  },
];

export function trialById(id: TrialId): TrialConfig {
  const t = TRIALS.find((x) => x.id === id);
  if (!t) throw new Error(`unknown trial ${id}`);
  return t;
}
