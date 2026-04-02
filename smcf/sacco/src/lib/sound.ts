let audioCtx: AudioContext | null = null;
let initialized = false;
let hasUserGesture = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return null;
  // Creating AudioContext before user gesture triggers autoplay policy warnings.
  if (!hasUserGesture) return null;
  if (!audioCtx) audioCtx = new Ctor();
  return audioCtx;
}

function ensureAudioReady() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  const unlock = () => {
    hasUserGesture = true;
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
  };

  window.addEventListener("pointerdown", unlock, { passive: true, once: true });
  window.addEventListener("keydown", unlock, { passive: true, once: true });
}

function scheduleTone(
  ctx: AudioContext,
  when: number,
  frequency: number,
  duration: number,
  type: OscillatorType,
  gainValue: number
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, when);

  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(gainValue, when + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(when);
  osc.stop(when + duration + 0.02);
}

export function playNotificationSound() {
  ensureAudioReady();
  if (!hasUserGesture) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const start = ctx.currentTime + 0.01;
  scheduleTone(ctx, start, 740, 0.11, "sine", 0.045);
  scheduleTone(ctx, start + 0.12, 988, 0.14, "sine", 0.04);
}

export function playAtmDepositSound() {
  ensureAudioReady();
  if (!hasUserGesture) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const start = ctx.currentTime + 0.01;
  // ATM-like cash-in cue: low confirmation bump followed by a bright rise.
  scheduleTone(ctx, start, 196, 0.12, "triangle", 0.05);
  scheduleTone(ctx, start + 0.13, 392, 0.12, "sine", 0.045);
  scheduleTone(ctx, start + 0.26, 523.25, 0.16, "sine", 0.04);
}
