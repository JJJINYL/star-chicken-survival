/**
 * audio.js — 游戏音效
 * 使用 Web Audio API 生成基础音效，无需外部资源
 * 注意：所有音效函数都做了帧级节流，防止高频创建 oscillator 导致卡顿
 */
let _ctx = null;
let _lastFrame = 0;
const THROTTLE_MS = 16; // ~60fps时一帧只响一次同类音效

function getCtx() {
  if (!_ctx) {
    _ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

/** 通用节流检查 */
function _throttle() {
  const now = performance.now();
  if (now - _lastFrame < THROTTLE_MS) return false;
  _lastFrame = now;
  return true;
}

/** 射击音效 — 短促的「啪」（每帧节流） */
let _lastShoot = 0;
function _canShoot() {
  const now = performance.now();
  if (now - _lastShoot < 50) return false; // 50ms 节流，和射击间隔匹配
  _lastShoot = now;
  return true;
}

export function playShoot() {
  if (!_canShoot()) return;
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
  } catch (_) {}
}

/** 命中音效（每帧节流） */
let _lastHit = 0;
export function playHit() {
  const now = performance.now();
  if (now - _lastHit < 60) return; // 60ms 节流
  _lastHit = now;
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.04);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  } catch (_) {}
}

/** 拾取经验球音效（100ms 节流，最多一秒10次） */
let _lastPickup = 0;
export function playPickup() {
  const now = performance.now();
  if (now - _lastPickup < 100) return;
  _lastPickup = now;
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  } catch (_) {}
}

/** 升级音效 — 明亮的「叮叮」（不节流，升级频率低） */
export function playLevelUp() {
  try {
    const ctx = getCtx();
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      const t = ctx.currentTime + i * 0.12;
      osc.frequency.setValueAtTime(880 + i * 220, t);
      osc.frequency.exponentialRampToValueAtTime(1320 + i * 220, t + 0.15);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.start(t);
      osc.stop(t + 0.2);
    }
  } catch (_) {}
}

/** 游戏结束音效 — 低沉下降 */
export function playGameOver() {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.6);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.7);
  } catch (_) {}
}

/** 分裂音效 — 两个短脉冲（200ms 节流） */
let _lastSplit = 0;
export function playSplit() {
  const now = performance.now();
  if (now - _lastSplit < 200) return;
  _lastSplit = now;
  try {
    const ctx = getCtx();
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      const t = ctx.currentTime + i * 0.06;
      osc.frequency.setValueAtTime(300, t);
      osc.frequency.exponentialRampToValueAtTime(150, t + 0.08);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      osc.start(t);
      osc.stop(t + 0.1);
    }
  } catch (_) {}
}
