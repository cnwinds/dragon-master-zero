import { describe, expect, it } from "vitest";
import { interpretOffline } from "../shared/offlineInterpreter";
import { isValidIntent, normalizeIntentQuad, sanitizeIntent } from "../shared/intent";
import type { MoveId } from "../shared/types";

const ALL: MoveId[] = ["probe", "thread", "rise", "coil", "leap", "lookBack"];

describe("训练侧重预算", () => {
  it("归一化后四项均在15–85且合计200", () => {
    const q = normalizeIntentQuad({ stability: 120, rhythm: -30, coordination: 60, expression: 60 });
    expect(Object.values(q).reduce((s, v) => s + v, 0)).toBe(200);
    for (const v of Object.values(q)) expect(v).toBeGreaterThanOrEqual(15), expect(v).toBeLessThanOrEqual(85);
  });

  it("sanitizeIntent 拒绝范围外动作引用", () => {
    const i = sanitizeIntent(
      { stability: 60, rhythm: 50, coordination: 40, expression: 50, preferredMove: "leap", avoidMove: "leap" },
      { allowedMoves: ["probe", "thread"], source: "offline" }
    );
    expect(i.preferredMove).toBeNull();
    expect(i.avoidMove).toBeNull();
    expect(isValidIntent(i)).toBe(true);
  });
});

describe("离线口令解析", () => {
  it("空白输入返回均衡侧重", () => {
    const i = interpretOffline("", ALL, "t");
    expect([i.stability, i.rhythm, i.coordination, i.expression]).toEqual([50, 50, 50, 50]);
  });

  it("稳健口令提升稳定与协作", () => {
    const i = interpretOffline("先稳住龙头，多照顾后面的队友。", ALL, "t");
    expect(i.stability).toBeGreaterThan(55);
    expect(i.coordination).toBeGreaterThan(55);
    expect(i.expression).toBeLessThanOrEqual(50);
  });

  it("表现口令提升表现", () => {
    const i = interpretOffline("动作再高再快，最后全力跃起。", ALL, "t");
    expect(i.expression).toBeGreaterThanOrEqual(65);
    expect(i.preferredMove).toBe("leap");
  });

  it("否定句反转倾向", () => {
    const i = interpretOffline("不要只追求掌声。", ALL, "t");
    expect(i.expression).toBeLessThan(50);
  });

  it("超长输入不抛异常且长度受限", () => {
    const i = interpretOffline("稳".repeat(120), ALL, "t");
    expect(isValidIntent(i)).toBe(true);
  });

  it("偏好动作用本轮已编入时间轴的动作", () => {
    const i = interpretOffline("大胆跃起", ["probe", "thread", "lookBack"], "t");
    expect(i.preferredMove).toBeNull();
  });

  it("解释文字不超过30字", () => {
    const i = interpretOffline("跟着鼓点，连贯衔接，照顾队友，稳住，再大胆一点", ALL, "t");
    expect(i.explanation.length).toBeLessThanOrEqual(30);
  });
});
