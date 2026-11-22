// Every sound is synthesized (design §9): the dial's ratchet, the key's clack and turn, a
// bright ting rising per position for gold, bwip-bwip for the blue arrows, a soft wooden tok
// for pewter, the lid's pop and five-note flourish, the sleepy two-note sigh and the shelf's
// plink. No music loop, nothing loaded. The context is made on the first gesture.

const FLOURISH = [523.25, 659.25, 783.99, 1046.5, 1318.51];

export class Sound {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;

  /** Call from a user gesture. Safe to call again and again. */
  unlock(): void {
    if (this.context) {
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
      return;
    }
    try {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 0.7;
      this.master.connect(this.context.destination);
    } catch {
      this.context = null;
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.context) this.master.gain.setTargetAtTime(muted ? 0 : 0.7, this.context.currentTime, 0.03);
  }

  suspend(): void {
    if (this.context?.state === 'running') void this.context.suspend().catch(() => {});
  }

  private tone(from: number, to: number, seconds: number, type: OscillatorType, volume: number, delay = 0): void {
    const context = this.context;
    if (!context || !this.master || this.muted) return;
    const start = context.currentTime + delay;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    gain.connect(this.master);
    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, start);
    if (to !== from) oscillator.frequency.exponentialRampToValueAtTime(to, start + seconds);
    oscillator.connect(gain);
    oscillator.start(start);
    oscillator.stop(start + seconds + 0.02);
  }

  ratchet(): void {
    this.tone(2400, 1400, 0.025, 'square', 0.05);
    this.tone(1800, 900, 0.03, 'square', 0.04, 0.035);
  }

  unlatch(): void {
    this.tone(700, 1100, 0.06, 'triangle', 0.12);
  }

  keyTurn(): void {
    this.tone(320, 180, 0.07, 'square', 0.08);
    this.tone(1500, 900, 0.04, 'triangle', 0.1, 0.06);
    this.tone(200, 120, 0.12, 'triangle', 0.14, 0.12);
  }

  /** A mark, `delay` seconds from now; gold rises with its position on the lock. */
  mark(kind: 'gold' | 'blue' | 'pewter', position: number, delay: number): void {
    if (kind === 'gold') {
      const pitch = 880 * 2 ** (position / 6);
      this.tone(pitch, pitch, 0.35, 'sine', 0.16, delay);
      this.tone(220, 110, 0.08, 'triangle', 0.12, delay);
    } else if (kind === 'blue') {
      this.tone(500, 900, 0.07, 'sine', 0.12, delay);
      this.tone(500, 900, 0.07, 'sine', 0.12, delay + 0.11);
    } else {
      this.tone(260, 200, 0.09, 'triangle', 0.16, delay);
    }
  }

  open(delay: number): void {
    this.tone(160, 600, 0.12, 'triangle', 0.18, delay);
    FLOURISH.forEach((frequency, index) => this.tone(frequency, frequency, 0.4, 'triangle', 0.13, delay + 0.18 + index * 0.1));
  }

  sigh(delay: number): void {
    this.tone(392, 370, 0.45, 'sine', 0.13, delay);
    this.tone(330, 294, 0.6, 'sine', 0.13, delay + 0.4);
  }

  plink(delay = 0): void {
    this.tone(1568, 1568, 0.25, 'sine', 0.1, delay);
  }
}
