// Web Audio 程序化音频：鼓点、锣、竹音与机械反馈，全部合成、完全离线。

type DrumPattern = number[]; // 每拍的力度 0–1，1 为正拍重音

export class AudioBus {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private beatTimer: number | null = null;
  private nextBeatTime = 0;
  private beatIndex = 0;
  private pattern: DrumPattern = [1, 0.55, 0.7, 0.55];
  private bpm = 60;
  private onBeat: ((index: number, time: number, strength: number) => void) | null = null;
  musicOn = true;
  sfxOn = true;

  ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.connect(this.master);
      this.applyVolumes();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  private applyVolumes(): void {
    if (!this.musicGain || !this.sfxGain || !this.ctx) return;
    this.musicGain.gain.setTargetAtTime(this.musicOn ? 0.9 : 0, this.ctx.currentTime, 0.05);
    this.sfxGain.gain.setTargetAtTime(this.sfxOn ? 0.9 : 0, this.ctx.currentTime, 0.05);
  }

  setMusic(on: boolean): void {
    this.musicOn = on;
    this.applyVolumes();
  }

  setSfx(on: boolean): void {
    this.sfxOn = on;
    this.applyVolumes();
  }

  // ———— 合成单元 ————

  private noiseBuffer(dur: number): AudioBuffer {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** 中国大鼓：膜振 + 击皮噪声 */
  drum(time: number, strength = 1, gain = 1, music = true): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const out = music ? this.musicGain! : this.sfxGain!;
    const g = ctx.createGain();
    g.connect(out);
    const peak = 0.65 * strength * gain;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(peak, time + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.42);

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(165 * (0.9 + strength * 0.2), time);
    osc.frequency.exponentialRampToValueAtTime(58, time + 0.24);
    osc.connect(g);
    osc.start(time);
    osc.stop(time + 0.45);

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer(0.06);
    const nf = ctx.createBiquadFilter();
    nf.type = "bandpass";
    nf.frequency.value = 900;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.18 * strength * gain, time);
    ng.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
    noise.connect(nf).connect(ng).connect(out);
    noise.start(time);
  }

  /** 竹片敲击 */
  bamboo(time: number, gain = 1, music = false): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const out = music ? this.musicGain! : this.sfxGain!;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(880, time);
    osc.frequency.exponentialRampToValueAtTime(320, time + 0.07);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.22 * gain, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.09);
    osc.connect(g).connect(out);
    osc.start(time);
    osc.stop(time + 0.1);

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer(0.03);
    const nf = ctx.createBiquadFilter();
    nf.type = "highpass";
    nf.frequency.value = 3200;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.12 * gain, time);
    ng.gain.exponentialRampToValueAtTime(0.0001, time + 0.03);
    noise.connect(nf).connect(ng).connect(out);
    noise.start(time);
  }

  /** 阿零的机械音 */
  beep(up = true, gain = 1): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(up ? 720 : 480, t);
    osc.frequency.setValueAtTime(up ? 1080 : 360, t + 0.07);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06 * gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    osc.connect(g).connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  /** 锣（终局与关键节点） */
  gong(gain = 1): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const partials = [146, 219, 293, 388, 523];
    for (const [i, f] of partials.entries()) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f * (1 + Math.random() * 0.01);
      const g = ctx.createGain();
      const amp = (0.22 / (i + 1)) * gain;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(amp, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6 - i * 0.3);
      osc.connect(g).connect(this.musicGain!);
      osc.start(t);
      osc.stop(t + 2.8);
    }
  }

  /** 观众人声浪 */
  crowd(intensity = 1, dur = 1.6): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer(dur);
    noise.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.setValueAtTime(420, t);
    f.frequency.linearRampToValueAtTime(900, t + dur * 0.4);
    f.frequency.linearRampToValueAtTime(500, t + dur);
    f.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16 * intensity, t + dur * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    noise.connect(f).connect(g).connect(this.musicGain!);
    noise.start(t);
    noise.stop(t + dur + 0.1);
  }

  /** 印章盖下 */
  seal(): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.drum(t, 0.6, 0.8, false);
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer(0.12);
    const nf = ctx.createBiquadFilter();
    nf.type = "lowpass";
    nf.frequency.value = 600;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    noise.connect(nf).connect(g).connect(this.sfxGain!);
    noise.start(t);
  }

  /** 纠偏命中：正拍/近拍/错拍 三种音色 */
  correction(grade: "perfect" | "near" | "wrong"): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    if (grade === "perfect") {
      this.drum(t, 1, 1, false);
      this.bamboo(t + 0.05, 0.9);
    } else if (grade === "near") {
      this.bamboo(t, 0.8);
    } else {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(180, t);
      osc.frequency.linearRampToValueAtTime(120, t + 0.2);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.connect(g).connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 0.24);
    }
  }

  /** 放置竹简 */
  place(ok: boolean): void {
    const ctx = this.ensure();
    if (!ctx) return;
    if (ok) this.bamboo(ctx.currentTime, 0.9);
    else this.beep(false, 0.8);
  }

  /** 竹音（立即播放） */
  bambooNow(gain = 0.8): void {
    const ctx = this.ensure();
    if (!ctx) return;
    this.bamboo(ctx.currentTime, gain);
  }

  // ———— 鼓点节拍器（与演出同步） ————

  startBeatClock(bpm: number, pattern: DrumPattern, onBeat: (index: number, time: number, strength: number) => void): void {
    this.stopBeatClock();
    const ctx = this.ensure();
    if (!ctx) return;
    this.bpm = bpm;
    this.pattern = pattern;
    this.onBeat = onBeat;
    this.beatIndex = 0;
    this.nextBeatTime = ctx.currentTime + 0.15;
    const tick = () => {
      if (!this.ctx || !this.onBeat) return;
      const ahead = 0.12;
      while (this.nextBeatTime < this.ctx.currentTime + ahead) {
        const strength = this.pattern[this.beatIndex % this.pattern.length];
        this.drum(this.nextBeatTime, strength, 0.85);
        this.onBeat(this.beatIndex, this.nextBeatTime, strength);
        this.beatIndex++;
        this.nextBeatTime += 60 / this.bpm;
      }
      this.beatTimer = window.setTimeout(tick, 40);
    };
    tick();
  }

  stopBeatClock(): void {
    if (this.beatTimer != null) {
      window.clearTimeout(this.beatTimer);
      this.beatTimer = null;
    }
    this.onBeat = null;
  }
}

export const audioBus = new AudioBus();
