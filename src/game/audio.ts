/* -------------------------------------------------------------------------- */
/*  Procedural audio: original adventure-score music + ambience + sfx.        */
/*  Everything is synthesised with the Web Audio API (no audio files).        */
/* -------------------------------------------------------------------------- */

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const rand = (a: number, b: number) => a + Math.random() * (b - a);

const CHORDS: number[][] = [
  [38, 50, 57, 62, 65], // Dm
  [34, 46, 53, 58, 62], // Bb
  [41, 53, 57, 60, 65], // F
  [36, 48, 55, 60, 64], // C
  [38, 50, 57, 62, 65], // Dm
  [34, 46, 53, 58, 62], // Bb
  [43, 55, 58, 62, 67], // Gm
  [33, 45, 52, 57, 61], // A
];
// [midi, startBeat, durBeats] per bar (original heroic line)
const MELODY: [number, number, number][][] = [
  [[69, 0, 1.5], [74, 1.5, 0.5], [77, 2, 2]],
  [[76, 0, 1], [74, 1, 1], [70, 2, 2]],
  [[72, 0, 1.5], [77, 1.5, 0.5], [81, 2, 2]],
  [[79, 0, 1], [77, 1, 1], [76, 2, 2]],
  [[74, 0, 1], [77, 1, 1], [81, 2, 2]],
  [[82, 0, 1.5], [81, 1.5, 0.5], [77, 2, 2]],
  [[74, 0, 1], [70, 1, 1], [72, 2, 1], [74, 3, 1]],
  [[73, 0, 2], [69, 2, 2]],
];

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private ambBus!: GainNode;
  private reverb!: ConvolverNode;
  private noiseW!: AudioBuffer;
  private noiseB!: AudioBuffer;
  private windG!: GainNode;
  private waterG!: GainNode;
  private lavaG!: GainNode;
  private bugG!: GainNode;
  private night = 0;
  private rainG!: GainNode;
  private snowG!: GainNode;
  private timer = 0;
  private theme: HTMLAudioElement | null = null;
  private nextBeat = 0;
  private beat = 0;
  private birdT = 0;
  private callT = 0;
  private lastStep = 0;
  private lastErupt = -1;
  private volume = 0.7;
  private muted = false;
  musicOn = true;

  constructor() {
    try {
      this.muted = localStorage.getItem('dino-muted') === '1';
      const v = localStorage.getItem('dino-volume');
      if (v) this.volume = Number(v);
      this.musicOn = localStorage.getItem('dino-music') !== '0';
    } catch { /* ignore */ }
  }

  get isMuted() { return this.muted; }
  get vol() { return this.volume; }

  /** Must be called from a user gesture the first time. */
  resume() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    try { localStorage.setItem('dino-muted', m ? '1' : '0'); } catch { /* ignore */ }
    this.applyMaster();
  }
  setVolume(v: number) {
    this.volume = v;
    try { localStorage.setItem('dino-volume', String(v)); } catch { /* ignore */ }
    this.applyMaster();
  }
  setMusic(on: boolean) {
    this.musicOn = on;
    try { localStorage.setItem('dino-music', on ? '1' : '0'); } catch { /* ignore */ }
    if (this.ctx) this.musicBus.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.4);
    if (this.theme) { if (on) void this.theme.play().catch(() => undefined); else this.theme.pause(); }
  }
  private applyMaster() {
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.08);
  }

  /* ------------------------------------------------------------------ init */

  private init() {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.musicOn ? 0.9 : 0;
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.9;
    this.ambBus = ctx.createGain();
    this.ambBus.gain.value = 0.9;

    // reverb
    this.reverb = ctx.createConvolver();
    const len = ctx.sampleRate * 2.8;
    const imp = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = imp.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4);
    }
    this.reverb.buffer = imp;
    const wet = ctx.createGain();
    wet.gain.value = 0.38;
    this.reverb.connect(wet).connect(this.master);
    this.musicBus.connect(this.master);
    this.musicBus.connect(this.reverb);
    this.sfxBus.connect(this.master);
    const sfxSend = ctx.createGain();
    sfxSend.gain.value = 0.15;
    this.sfxBus.connect(sfxSend).connect(this.reverb);
    this.ambBus.connect(this.master);

    // noise buffers
    const n = ctx.sampleRate * 3;
    this.noiseW = ctx.createBuffer(1, n, ctx.sampleRate);
    this.noiseB = ctx.createBuffer(1, n, ctx.sampleRate);
    const w = this.noiseW.getChannelData(0), b = this.noiseB.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const r = Math.random() * 2 - 1;
      w[i] = r;
      last = (last + 0.02 * r) / 1.02;
      b[i] = last * 3.5;
    }

    this.buildAmbience();
    this.startMusic();
  }

  /** Background theme: the supplied MP3, looped. Falls back to the synthesized score if it can't load. */
  private startMusic() {
    const ctx = this.ctx!;
    const el = new Audio(`${import.meta.env.BASE_URL}theme.mp3`);
    el.loop = true;
    el.preload = 'auto';
    this.theme = el;
    try {
      ctx.createMediaElementSource(el).connect(this.musicBus);
    } catch { /* fall through to plain element output */ }
    el.addEventListener('error', () => this.startSynth(), { once: true });
    if (this.musicOn) void el.play().catch(() => this.startSynth());
  }

  private startSynth() {
    if (this.timer || !this.ctx) return;
    this.nextBeat = this.ctx.currentTime + 0.3;
    this.timer = window.setInterval(() => this.schedule(), 120);
  }

  private noiseSrc(buf: AudioBuffer) {
    const s = this.ctx!.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    s.loopStart = Math.random() * 1.5;
    s.start();
    return s;
  }

  private buildAmbience() {
    const ctx = this.ctx!;
    // wind
    const wind = this.noiseSrc(this.noiseW);
    const wf = ctx.createBiquadFilter();
    wf.type = 'bandpass'; wf.frequency.value = 480; wf.Q.value = 0.6;
    this.windG = ctx.createGain(); this.windG.gain.value = 0.05;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.12;
    const lg = ctx.createGain(); lg.gain.value = 0.03;
    lfo.connect(lg).connect(this.windG.gain); lfo.start();
    wind.connect(wf).connect(this.windG).connect(this.ambBus);
    // water
    const wat = this.noiseSrc(this.noiseW);
    const wbp = ctx.createBiquadFilter(); wbp.type = 'bandpass'; wbp.frequency.value = 1400; wbp.Q.value = 0.7;
    const wlp = ctx.createBiquadFilter(); wlp.type = 'lowpass'; wlp.frequency.value = 3200;
    this.waterG = ctx.createGain(); this.waterG.gain.value = 0;
    const wl = ctx.createOscillator(); wl.frequency.value = 0.4;
    const wlg = ctx.createGain(); wlg.gain.value = 0.02;
    wl.connect(wlg).connect(this.waterG.gain); wl.start();
    wat.connect(wbp).connect(wlp).connect(this.waterG).connect(this.ambBus);
    // volcano rumble
    const lav = this.noiseSrc(this.noiseB);
    const llp = ctx.createBiquadFilter(); llp.type = 'lowpass'; llp.frequency.value = 110;
    this.lavaG = ctx.createGain(); this.lavaG.gain.value = 0;
    const ll = ctx.createOscillator(); ll.frequency.value = 0.3;
    const llg = ctx.createGain(); llg.gain.value = 0.15;
    ll.connect(llg).connect(this.lavaG.gain); ll.start();
    lav.connect(llp).connect(this.lavaG).connect(this.ambBus);
    // insects
    const bug = this.noiseSrc(this.noiseW);
    const bbp = ctx.createBiquadFilter(); bbp.type = 'bandpass'; bbp.frequency.value = 5200; bbp.Q.value = 9;
    this.bugG = ctx.createGain(); this.bugG.gain.value = 0.0;
    const bl = ctx.createOscillator(); bl.type = 'square'; bl.frequency.value = 14;
    const blg = ctx.createGain(); blg.gain.value = 0.012;
    bl.connect(blg).connect(this.bugG.gain); bl.start();
    bug.connect(bbp).connect(this.bugG).connect(this.ambBus);
    // rain (hiss) and a soft snowy wind
    const rn = this.noiseSrc(this.noiseW);
    const rhp = ctx.createBiquadFilter(); rhp.type = 'highpass'; rhp.frequency.value = 1800;
    const rlp = ctx.createBiquadFilter(); rlp.type = 'lowpass'; rlp.frequency.value = 7500;
    this.rainG = ctx.createGain(); this.rainG.gain.value = 0;
    rn.connect(rhp).connect(rlp).connect(this.rainG).connect(this.ambBus);
    const sn = this.noiseSrc(this.noiseW);
    const sbp = ctx.createBiquadFilter(); sbp.type = 'bandpass'; sbp.frequency.value = 700; sbp.Q.value = 0.4;
    this.snowG = ctx.createGain(); this.snowG.gain.value = 0;
    sn.connect(sbp).connect(this.snowG).connect(this.ambBus);
  }

  /* ----------------------------------------------------------- music score */

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const spb = 60 / 66;
    while (this.nextBeat < ctx.currentTime + 0.6) {
      const t = this.nextBeat;
      const inBar = this.beat % 4;
      const bar = Math.floor(this.beat / 4) % 8;
      if (inBar === 0) {
        this.pad(CHORDS[bar], t, spb * 4);
        this.timp(t, bar % 4 === 0 ? 0.9 : 0.55);
        if (bar % 4 === 3) { this.timp(t + spb * 2.5, 0.35); this.timp(t + spb * 3, 0.45); }
        for (const [m, s, d] of MELODY[bar]) this.horn(m, t + s * spb, d * spb);
      }
      // harp arpeggio on each beat (eighths)
      const ch = CHORDS[bar];
      const arp = [ch[1] + 12, ch[2] + 12, ch[3] + 12, ch[4] + 12, ch[3] + 12, ch[2] + 12];
      this.pluck(arp[(this.beat * 2) % arp.length], t, 0.07);
      this.pluck(arp[(this.beat * 2 + 1) % arp.length], t + spb / 2, 0.05);
      this.beat++;
      this.nextBeat += spb;
    }
  }

  private pad(notes: number[], t: number, dur: number) {
    const ctx = this.ctx!;
    for (const m of notes) {
      for (const det of [-7, 7]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = mtof(m);
        o.detune.value = det;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = m < 45 ? 420 : 1100;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.028, t + 1.4);
        g.gain.setValueAtTime(0.028, t + dur - 0.2);
        g.gain.linearRampToValueAtTime(0, t + dur + 1.6);
        o.connect(f).connect(g).connect(this.musicBus);
        o.start(t);
        o.stop(t + dur + 1.7);
      }
    }
  }

  private horn(m: number, t: number, dur: number) {
    const ctx = this.ctx!;
    const f0 = mtof(m);
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = f0;
    const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f0 * 2;
    const vib = ctx.createOscillator(); vib.frequency.value = 5.2;
    const vg = ctx.createGain(); vg.gain.value = f0 * 0.006;
    vib.connect(vg); vg.connect(o1.frequency); vg.connect(o2.frequency);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(500, t);
    f.frequency.linearRampToValueAtTime(2200, t + 0.22);
    f.frequency.linearRampToValueAtTime(1400, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.11, t + 0.14);
    g.gain.setValueAtTime(0.1, t + Math.max(0.2, dur - 0.1));
    g.gain.linearRampToValueAtTime(0, t + dur + 0.35);
    o1.connect(f); o2.connect(f); f.connect(g).connect(this.musicBus);
    for (const o of [o1, o2, vib]) { o.start(t); o.stop(t + dur + 0.4); }
  }

  private pluck(m: number, t: number, vol: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(m);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 1.1);
    o.connect(g).connect(this.musicBus);
    o.start(t); o.stop(t + 1.2);
  }

  private timp(t: number, vol: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(52, t + 0.35);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol * 0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
    o.connect(g).connect(this.musicBus);
    o.start(t); o.stop(t + 1.6);
    this.burst(t, 0.08, 400, vol * 0.2, this.musicBus);
  }

  /* ---------------------------------------------------------------- helpers */

  private burst(t: number, dur: number, freq: number, vol: number, dest: AudioNode, type: BiquadFilterType = 'lowpass', q = 0.7, pan = 0, buf?: AudioBuffer) {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = buf ?? this.noiseW;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
    s.connect(f).connect(g).connect(p).connect(dest);
    s.start(t, Math.random() * 2, dur + 0.05);
  }

  private tone(t: number, f0: number, f1: number, dur: number, vol: number, type: OscillatorType, pan = 0, dest?: AudioNode) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + Math.min(0.05, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
    o.connect(g).connect(p).connect(dest ?? this.sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  private ready() { return !!this.ctx && this.ctx.state === 'running' && !this.muted; }

  /* ------------------------------------------------------------------ sfx */

  /** `size` in px of the dinosaur (bigger = deeper, louder). */
  step(size: number, pan: number, water: boolean, depth: number) {
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    if (now - this.lastStep < 0.018) return;
    this.lastStep = now;
    const big = Math.min(1, size / 520);
    const vol = (0.05 + big * 0.28) * (0.55 + depth * 0.45);
    if (water) {
      this.burst(now, 0.35, 1500, vol * 1.2, this.sfxBus, 'bandpass', 0.8, pan);
      return;
    }
    const f = 150 - big * 95;
    this.tone(now, f * 1.3, f * 0.45, 0.22 + big * 0.25, vol * 1.6, 'sine', pan);
    this.burst(now, 0.12 + big * 0.1, 500 - big * 250, vol * 0.8, this.sfxBus, 'lowpass', 0.7, pan);
  }

  roar(size: number, pan: number) {
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const big = Math.min(1, size / 480);
    const base = 190 - big * 110;
    const dur = 1.0 + big * 0.8;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(base * 0.7, t);
    o.frequency.linearRampToValueAtTime(base * 1.5, t + dur * 0.25);
    o.frequency.exponentialRampToValueAtTime(base * 0.5, t + dur);
    const trem = ctx.createOscillator(); trem.frequency.value = 28;
    const tg = ctx.createGain(); tg.gain.value = 0.35;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2.2;
    f.frequency.setValueAtTime(500, t);
    f.frequency.linearRampToValueAtTime(1300, t + dur * 0.3);
    f.frequency.linearRampToValueAtTime(450, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.35, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    trem.connect(tg).connect(g.gain);
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    o.connect(f).connect(g).connect(p).connect(this.sfxBus);
    o.start(t); trem.start(t); o.stop(t + dur + 0.1); trem.stop(t + dur + 0.1);
    this.burst(t, dur * 0.8, 1800, 0.12, this.sfxBus, 'bandpass', 0.8, pan);
  }

  call(size: number, pan: number, vol = 0.14) {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    const big = Math.min(1, size / 520);
    const f = 420 - big * 260;
    this.tone(t, f, f * 1.5, 0.35, vol, 'triangle', pan);
    this.tone(t + 0.3, f * 1.5, f * 0.8, 0.6, vol, 'triangle', pan);
  }

  crunch(kind: 'grass' | 'meat', pan: number) {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    const n = kind === 'grass' ? 4 : 3;
    for (let i = 0; i < n; i++) {
      this.burst(t + i * 0.07, 0.06, kind === 'grass' ? 3200 : 900, 0.18, this.sfxBus, kind === 'grass' ? 'highpass' : 'lowpass', 0.9, pan);
    }
    if (kind === 'meat') this.tone(t, 160, 70, 0.12, 0.12, 'sine', pan);
  }

  purr(pan: number) {
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 52;
    const lf = ctx.createOscillator(); lf.frequency.value = 22;
    const lg = ctx.createGain(); lg.gain.value = 0.05;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09, t + 0.15); g.gain.linearRampToValueAtTime(0, t + 0.9);
    lf.connect(lg).connect(g.gain);
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    o.connect(f).connect(g).connect(p).connect(this.sfxBus);
    o.start(t); lf.start(t); o.stop(t + 1); lf.stop(t + 1);
    this.tone(t + 0.1, 520, 820, 0.18, 0.07, 'sine', pan);
  }

  pop(grass: boolean) {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    this.tone(t, grass ? 500 : 260, grass ? 900 : 120, 0.14, 0.2, 'sine');
    this.burst(t, 0.1, grass ? 4000 : 800, 0.12, this.sfxBus, grass ? 'highpass' : 'lowpass');
  }

  snort(pan: number) {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    this.burst(t, 0.25, 900, 0.3, this.sfxBus, 'bandpass', 1.5, pan);
    this.tone(t, 130, 80, 0.2, 0.1, 'square', pan);
  }

  click() {
    if (!this.ready()) return;
    this.tone(this.ctx!.currentTime, 700, 1000, 0.07, 0.1, 'sine');
  }

  chime() {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    [76, 81, 85, 88].forEach((m, i) => this.tone(t + i * 0.09, mtof(m), mtof(m), 0.7, 0.08, 'sine'));
  }

  eruption() {
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    this.tone(t, 60, 28, 3.2, 0.5, 'sine');
    this.burst(t, 3.5, 380, 0.7, this.sfxBus, 'lowpass', 0.6, 0, this.noiseB);
    this.burst(t + 0.2, 2.2, 900, 0.18, this.sfxBus, 'bandpass', 0.7);
  }

  /** Earthquake: deep rumble, grinding rock and falling debris for `dur` seconds. */
  quake(mag: number, dur: number) {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    const ctx = this.ctx!;
    // sub-bass swell
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(34, t);
    o.frequency.linearRampToValueAtTime(24, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.55 * mag + 0.2, t + 0.6);
    g.gain.setValueAtTime(0.55 * mag + 0.2, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur + 1.2);
    o.connect(g).connect(this.sfxBus);
    o.start(t); o.stop(t + dur + 1.3);
    this.burst(t, dur + 1, 200, 0.55 + mag * 0.3, this.sfxBus, 'lowpass', 0.6, 0, this.noiseB);
    this.burst(t + 0.1, dur, 700, 0.12 + mag * 0.1, this.sfxBus, 'bandpass', 0.8);
    const n = Math.round(6 + mag * 12);
    for (let i = 0; i < n; i++) {
      const tt = t + 0.4 + Math.random() * (dur - 0.4);
      this.burst(tt, 0.12 + Math.random() * 0.2, 250 + Math.random() * 600, 0.1 + Math.random() * 0.12, this.sfxBus, 'bandpass', 1.2, rand(-0.8, 0.8));
    }
  }

  setNight(n: number) { this.night = n; }

  /** Rain / snowfall loudness (0..1). */
  setWeather(rain: number, snow: number) {
    if (!this.ctx || !this.rainG) return;
    const t = this.ctx.currentTime;
    this.rainG.gain.setTargetAtTime(0.2 * rain, t, 0.6);
    this.snowG.gain.setTargetAtTime(0.05 * snow, t, 0.8);
  }

  thunder() {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime + 0.35 + Math.random() * 0.8;
    this.burst(t, 0.15, 3000, 0.25, this.sfxBus, 'highpass');
    this.burst(t + 0.05, 3.4, 260, 0.9, this.sfxBus, 'lowpass', 0.6, 0, this.noiseB);
    this.burst(t + 0.5, 2.6, 160, 0.6, this.sfxBus, 'lowpass', 0.6, 0, this.noiseB);
    this.tone(t, 70, 32, 2.6, 0.35, 'sine');
  }

  /* ------------------------------------------------------- per-frame update */

  /** camX centre, current zone data & engine time. nearWater/nearLava in 0..1. */
  update(camCenter: number, time: number, nearWater: number, nearLava: number, volcanoDist: number, zoneIdx: number, volcSeed = 0.2) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    this.waterG.gain.setTargetAtTime(0.16 * nearWater, t, 0.5);
    this.lavaG.gain.setTargetAtTime(0.55 * Math.max(nearLava * 0.6, volcanoDist), t, 0.6);
    this.windG.gain.setTargetAtTime(zoneIdx === 1 ? 0.075 : 0.045, t, 1);
    this.bugG.gain.setTargetAtTime((zoneIdx === 1 ? 0.005 : 0.03) + 0.045 * this.night, t, 1.5);

    // eruption sync (matches the volcano drawn in scene.ts: seed 0.2, cycle 15 s)
    const cyc = (time + volcSeed * 3) % 15;
    const id = Math.floor((time + volcSeed * 3 + 0.6) / 15);
    const key = id + Math.floor(volcSeed * 1000) * 1000;
    if (cyc < 0.4 && key !== this.lastErupt) {
      this.lastErupt = key;
      if (volcanoDist > 0.05) {
        const v = this.sfxBus.gain.value;
        this.sfxBus.gain.setTargetAtTime(Math.min(1.1, 0.5 + volcanoDist), t, 0.01);
        this.eruption();
        this.sfxBus.gain.setTargetAtTime(v, t + 4, 0.5);
      }
    }
    void camCenter;

    // random birds
    if (time > this.birdT && this.night < 0.6) {
      this.birdT = time + rand(1.2, zoneIdx === 1 ? 7 : 3.8);
      this.bird(zoneIdx);
    }
    if (time > this.callT) {
      this.callT = time + rand(14, 30);
      const sz = rand(100, 500);
      this.call(sz, rand(-0.9, 0.9), 0.05);
    }
  }

  private bird(zoneIdx: number) {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    const pan = rand(-0.9, 0.9);
    const base = rand(2200, 4200);
    const n = 2 + Math.floor(Math.random() * (zoneIdx === 2 ? 5 : 3));
    const kind = Math.random();
    for (let i = 0; i < n; i++) {
      const tt = t + i * (kind > 0.5 ? 0.11 : 0.17);
      this.tone(tt, base * (kind > 0.5 ? 1 : 0.8), base * (kind > 0.5 ? 1.35 : 1.1), 0.09, 0.025 + 0.015 * Math.random(), 'sine', pan, this.ambBus);
    }
  }

  dispose() {
    window.clearInterval(this.timer);
    void this.ctx?.close();
    this.ctx = null;
  }
}

export const audio = new GameAudio();
