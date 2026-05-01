/**
 * player.js — 玩家模块
 * WASD 移动、自动射击（朝向最近敌人或鼠标）
 * 流派系统：飞剑/散弹/穿透
 */

import { Entity, OrbitalBlade } from './entities.js';

/** 流派定义 */
export const BUILDS = {
  blade:   { id: 'blade',   name: '飞剑流',   icon: '🗡️', desc: '初始1把环绕飞剑，持续切割敌人' },
  shotgun: { id: 'shotgun', name: '散弹流',   icon: '💥', desc: '多方向扇形子弹，大范围覆盖' },
  pierce:  { id: 'pierce',  name: '穿透流',   icon: '🔱', desc: '子弹穿透敌人，直线扫射' },
};

export class Player extends Entity {
  constructor(x, y) {
    super(x, y);
    this.radius = 18;
    this.type = 'player';
    this.speed = 200;
    this.hp = 100;
    this.maxHp = 100;
    this.invincible = 0;
    this.shootCooldown = 0;
    this.shootInterval = 0.18;
    this.bulletSpeed = 500;
    this.bulletDamage = 1;

    // ── 经验／等级 ──
    this.xp = 0;
    this.level = 1;
    this.xpToNext = this._xpNeeded(1);

    // ── 环绕飞剑 ──
    this.orbitalBlades = [];

    // ── 流派 ──
    this.buildType = null; // 'blade' | 'shotgun' | 'pierce'

    // ── 散弹属性 ──
    this.shotgunCount = 3;     // 初始子弹数
    this.shotgunSpread = 0.15; // 初始散射弧度（单侧）

    // ── 穿透属性（穿透弹最多可穿透的敌人数量，0=不穿透） ──
    this.pierceCount = 0;

    // ── 暴击（散弹专属） ──
    this.critChance = 0;
    this.critMultiplier = 2;
  }

  _xpNeeded(level) { return Math.floor(30 * Math.pow(level, 1.5)); }

  addXp(amount) {
    this.xp += amount;
    if (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level += 1;
      this.xpToNext = this._xpNeeded(this.level);
      return true;
    }
    return false;
  }

  takeDamage(amount = 10) {
    if (this.invincible > 0) return;
    this.hp -= amount;
    this.invincible = 0.5;
    if (this.hp <= 0) { this.hp = 0; this.alive = false; }
  }

  /** 选择流派 */
  setBuild(buildId) {
    this.buildType = buildId;
    switch (buildId) {
      case 'blade':
        this.addOrbitalBlade(); // 初始1把飞剑
        this.shootInterval = 0.25;
        break;
      case 'shotgun':
        this.shotgunCount = 3;
        this.shotgunSpread = 0.15;
        this.shootInterval = 0.3;
        break;
      case 'pierce':
        this.pierceCount = 1;
        this.bulletDamage = 2;
        this.shootInterval = 0.2;
        break;
    }
  }

  /** 获取射击方向 — 优先最近敌人，否则鼠标 */
  _getAutoAim(enemies, aimDir) {
    if (enemies && enemies.length > 0) {
      let nearest = null, nearDist = Infinity;
      for (const e of enemies) {
        if (!e.alive) continue;
        const dx = e.x - this.x, dy = e.y - this.y;
        const d = dx * dx + dy * dy;
        if (d < nearDist) { nearDist = d; nearest = e; }
      }
      if (nearest) {
        const dx = nearest.x - this.x, dy = nearest.y - this.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) return { x: dx / len, y: dy / len };
      }
    }
    return aimDir;
  }

  /**
   * 每帧更新
   * @param {number} dt
   * @param {object} input
   * @param {BulletManager} bulletMgr
   * @param {Enemy[]} enemies
   */
  update(dt, input, bulletMgr, enemies) {
    const dir = input.moveDir;
    this.vx = dir.x * this.speed;
    this.vy = dir.y * this.speed;
    super.update(dt);
    if (this.invincible > 0) this.invincible -= dt;

    // ── 射击 ──
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.shootCooldown <= 0) {
      const aim = this._getAutoAim(enemies, input.aimDir);
      const angle = Math.atan2(aim.y, aim.x);
      this._aimAngle = angle;

      switch (this.buildType) {
        case 'shotgun':
          bulletMgr.fireShotgun(this.x, this.y, angle, this.bulletSpeed, this.bulletDamage, this.shotgunCount, this.shotgunSpread, this.critChance, this.critMultiplier);
          break;
        case 'pierce':
          bulletMgr.firePierce(this.x, this.y, angle, this.bulletSpeed, this.bulletDamage, this.pierceCount, this.critChance, this.critMultiplier);
          break;
        default:
          // 飞剑流也有基础射击
          bulletMgr.fire(this.x, this.y, angle, this.bulletSpeed, this.bulletDamage);
          break;
      }
      this.shootCooldown = this.shootInterval;
    }

    // ── 环绕飞剑 ──
    for (const blade of this.orbitalBlades) {
      blade.orbit(this.x, this.y, dt);
    }
  }

  render(ctx) {
    if (this.invincible > 0 && Math.floor(this.invincible * 10) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    const x = this.x, y = this.y, r = this.radius;

    // ── 小鸡身体（黄色椭圆） ──
    ctx.fillStyle = '#f5cf40';
    ctx.shadowColor = '#f5cf40';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // ── 眼睛（两个小黑点） ──
    const eyeOff = r * 0.35;
    const eyeY = y - r * 0.2;
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(x - eyeOff, eyeY, r * 0.15, 0, Math.PI * 2);
    ctx.arc(x + eyeOff, eyeY, r * 0.15, 0, Math.PI * 2);
    ctx.fill();
    // 眼睛高光小白点
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x - eyeOff - r * 0.04, eyeY - r * 0.05, r * 0.06, 0, Math.PI * 2);
    ctx.arc(x + eyeOff - r * 0.04, eyeY - r * 0.05, r * 0.06, 0, Math.PI * 2);
    ctx.fill();

    // ── 嘴巴（橙色三角形） ──
    const beakLen = r * 0.5;
    ctx.fillStyle = '#e88820';
    ctx.beginPath();
    ctx.moveTo(x, y + r * 0.15);           // 嘴巴根部
    ctx.lineTo(x - r * 0.25, y + r * 0.35); // 左嘴角
    ctx.lineTo(x + r * 0.25, y + r * 0.35); // 右嘴角
    ctx.closePath();
    ctx.fill();

    // ── 小翅膀 ──
    ctx.fillStyle = '#e8b830';
    // 左翅膀
    ctx.beginPath();
    ctx.ellipse(x - r * 0.75, y + r * 0.1, r * 0.3, r * 0.2, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // 右翅膀
    ctx.beginPath();
    ctx.ellipse(x + r * 0.75, y + r * 0.1, r * 0.3, r * 0.2, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // 瞄准线
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(this._aimAngle || 0) * 40, y + Math.sin(this._aimAngle || 0) * 40);
    ctx.stroke();

    // 渲染飞剑
    for (const blade of this.orbitalBlades) {
      blade.render(ctx);
    }

    ctx.globalAlpha = 1;
  }

  setAimAngle(angle) { this._aimAngle = angle; }

  addOrbitalBlade() {
    const angle = this.orbitalBlades.length * (Math.PI * 2 / 3) + Math.random() * 0.5;
    this.orbitalBlades.push(new OrbitalBlade(angle));
  }

  reset(x, y) {
    this.x = x; this.y = y;
    this.hp = this.maxHp; this.alive = true;
    this.invincible = 0; this.shootCooldown = 0;
    this.vx = 0; this.vy = 0; this._aimAngle = 0;
    this.xp = 0; this.level = 1;
    this.xpToNext = this._xpNeeded(1);
    this.speed = 200;
    this.shootInterval = 0.18;
    this.bulletDamage = 1;
    this.bulletSpeed = 500;
    this.maxHp = 100; this.hp = 100;
    this.orbitalBlades = [];
    this.buildType = null;
    this.shotgunCount = 3;
    this.shotgunSpread = 0.15;
    this.pierceCount = 0;
    this.critChance = 0;
    this.critMultiplier = 2;
  }
}
