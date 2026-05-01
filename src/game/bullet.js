/**
 * bullet.js — 子弹模块
 * 玩家子弹（支持穿透）、散弹射击、敌人子弹
 */

import { Entity } from './entities.js';

class BulletBase extends Entity {
  constructor(x, y, vx, vy, damage = 1, lifetime = 2) {
    super(x, y);
    this.vx = vx;
    this.vy = vy;
    this.damage = damage;
    this.lifetime = lifetime;
    this.radius = 4;

    // ── 鸡蛋碎裂效果 ──
    this._shatterParticles = [];
  }

  update(dt) {
    super.update(dt);
    this.lifetime -= dt;
    if (this.lifetime <= 0) this.alive = false;

    // 碎裂粒子更新
    if (this._shatterParticles.length > 0) {
      for (const p of this._shatterParticles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        p.vx *= 0.92;
        p.vy *= 0.92;
      }
      this._shatterParticles = this._shatterParticles.filter(p => p.life > 0);
    }
  }

  /** 触发碎裂效果 */
  _triggerShatter() {
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 30 + Math.random() * 60;
      this._shatterParticles.push({
        x: this.x, y: this.y,
        vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
        life: 0.2 + Math.random() * 0.2,
        radius: 1.5 + Math.random() * 2,
      });
    }
  }

  /** 绘制鸡蛋主体 — 椭圆，白色带淡黄阴影 */
  _drawEgg(ctx) {
    const rx = this.radius * 1.2;
    const ry = this.radius * 0.9;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.atan2(this.vy, this.vx));
    // 白色椭圆蛋体
    ctx.fillStyle = '#f5f0e8';
    ctx.shadowColor = '#d4c9a8';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // 高光
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.ellipse(-rx * 0.25, -ry * 0.25, rx * 0.35, ry * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** 绘制碎裂粒子 */
  _drawShatter(ctx) {
    for (const p of this._shatterParticles) {
      const alpha = p.life / 0.3;
      ctx.fillStyle = `rgba(245,240,232,${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** 普通玩家子弹 */
export class Bullet extends BulletBase {
  constructor(x, y, angle, speed = 500, damage = 1) {
    super(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, damage, 2);
    this.radius = 4;
    this.type = 'bullet';
    this.pierceLeft = 0; // 穿透次数剩余
    this.isCrit = false;
  }

  render(ctx) {
    if (this._shatterParticles.length > 0) {
      this._drawShatter(ctx);
    } else {
      this._drawEgg(ctx);
    }
  }
}

/** 穿透子弹 (pierceLeft 控制可穿透次数) */
export class PierceBullet extends BulletBase {
  constructor(x, y, angle, speed = 500, damage = 1, pierceLeft = 1) {
    super(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, damage, 3);
    this.radius = 5;
    this.type = 'bullet';
    this.pierceLeft = pierceLeft;
    this.isCrit = false;
  }

  render(ctx) {
    if (this._shatterParticles.length > 0) {
      this._drawShatter(ctx);
    } else {
      this._drawEgg(ctx);
    }
  }
}

/** 散弹（普通子弹的多发版本，由 BulletManager 批量创建） */
class ShotgunBullet extends BulletBase {
  constructor(x, y, vx, vy, damage = 1, lifetime = 1.5) {
    super(x, y, vx, vy, damage, lifetime);
    this.radius = 3;
    this.type = 'bullet';
    this.pierceLeft = 0;
    this.isCrit = false;
  }

  render(ctx) {
    if (this._shatterParticles.length > 0) {
      this._drawShatter(ctx);
    } else {
      this._drawEgg(ctx);
    }
  }
}

/** 敌人子弹 */
export class EnemyBullet extends BulletBase {
  constructor(x, y, angle, speed = 200, damage = 5) {
    super(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, damage, 3);
    this.radius = 5;
    this.type = 'enemy_bullet';
  }

  render(ctx) {
    ctx.fillStyle = '#ff4466';
    ctx.shadowColor = '#ff4466';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffaacc';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

export class BulletManager {
  constructor() {
    this.bullets = [];
    this.enemyBullets = [];
  }

  /** 单发普通子弹 */
  fire(x, y, angle, speed, damage) {
    const b = new Bullet(x, y, angle, speed, damage);
    this.bullets.push(b);
    return b;
  }

  /** 穿透子弹 */
  firePierce(x, y, angle, speed, damage, pierceLeft, critChance = 0, critMul = 2) {
    const dmg = Math.random() < critChance ? damage * critMul : damage;
    const b = new PierceBullet(x, y, angle, speed, dmg, pierceLeft);
    b.isCrit = dmg > damage;
    this.bullets.push(b);
    return b;
  }

  /** 散弹：多方向发射 */
  fireShotgun(x, y, angle, speed, damage, count, spread, critChance = 0, critMul = 2) {
    const bullets = [];
    for (let i = 0; i < count; i++) {
      const offset = (i / (count - 1 || 1) - 0.5) * spread * 2;
      const a = angle + offset;
      const dmg = Math.random() < critChance ? damage * critMul : damage;
      const vx = Math.cos(a) * speed;
      const vy = Math.sin(a) * speed;
      const b = new ShotgunBullet(x, y, vx, vy, dmg, 1.5);
      b.isCrit = dmg > damage;
      this.bullets.push(b);
      bullets.push(b);
    }
    return bullets;
  }

  fireEnemyBullet(x, y, angle, speed, damage, maxBullets = 150) {
    if (this.enemyBullets.length >= maxBullets) return null;
    const b = new EnemyBullet(x, y, angle, speed, damage);
    this.enemyBullets.push(b);
    return b;
  }

  update(dt) {
    for (const b of this.bullets) { b.update(dt); }
    // 保留有碎裂粒子的子弹（即使 alive = false）
    this.bullets = this.bullets.filter((b) => b.alive || b._shatterParticles.length > 0);
    for (const b of this.enemyBullets) { b.update(dt); }
    this.enemyBullets = this.enemyBullets.filter((b) => b.alive);
  }

  render(ctx) {
    for (const b of this.bullets) { b.render(ctx); }
    for (const b of this.enemyBullets) { b.render(ctx); }
  }
}
