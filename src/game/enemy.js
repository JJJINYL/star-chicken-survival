/**
 * enemy.js — 敌人模块
 * 敌人从屏幕边缘生成，追踪玩家，有不同种类和行为
 * 第六轮优化：波动式难度、爆发倍率降低、围剿改两方向+逃生缺口、喘息阶段
 */

import { Entity, ExperienceOrb } from './entities.js';

const ENEMY_TYPES = {
  basic:   { radius: 14, speed: 80,  hp: 1, color: '#e74c3c', score: 10, xp: 8,  behavior: 'chase' },
  fast:    { radius: 10, speed: 150, hp: 1, color: '#e67e22', score: 15, xp: 12, behavior: 'chase' },
  tank:    { radius: 22, speed: 50,  hp: 3, color: '#8e44ad', score: 30, xp: 25, behavior: 'chase' },
  splitter:{ radius: 16, speed: 90,  hp: 2, color: '#1abc9c', score: 20, xp: 18, behavior: 'splitter' },
  rusher:  { radius: 13, speed: 100, hp: 1, color: '#e84393', score: 18, xp: 14, behavior: 'rusher' },
  ranged:  { radius: 15, speed: 60,  hp: 2, color: '#6c5ce7', score: 22, xp: 20, behavior: 'ranged' },
};

/** 精英怪属性倍率 */
const ELITE_HP_MULT = 3;
const ELITE_RADIUS_MULT = 1.4;
const ELITE_SPEED_MULT = 1.25;

export class Enemy extends Entity {
  constructor(x, y, type = 'basic', elite = false) {
    super(x, y);
    const def = ENEMY_TYPES[type];
    this.radius = def.radius;
    this.baseSpeed = def.speed;
    this.speed = def.speed;
    this.maxHp = def.hp;
    this.hp = def.hp;
    this.color = def.color;
    this.score = def.score;
    this.xpValue = def.xp;
    this.type = 'enemy';
    this.subType = type;
    this.behavior = def.behavior;
    this.hitFlash = 0;

    // 精英标记
    this.elite = elite;
    if (elite) {
      this.radius = def.radius * ELITE_RADIUS_MULT;
      this.baseSpeed = def.speed * ELITE_SPEED_MULT;
      this.speed = def.speed * ELITE_SPEED_MULT;
      this.maxHp = def.hp * ELITE_HP_MULT;
      this.hp = def.hp * ELITE_HP_MULT;
      this.score = Math.round(def.score * 2.5);
      this.xpValue = Math.round(def.xp * 3);
    }

    // ── 行为状态 ──
    this._rushTimer = 0;
    this._rushActive = 0;
    this._rangedTimer = 0;
    this._rangedStopTimer = 0;
    this._isStopped = false;

    // ── 视觉效果 ──
    this._trailPositions = [];
    this._chargeWarning = 0;
    this._splitBurst = false;
    this._burstParticles = [];

    // 精英额外粒子
    this._eliteParticleTimer = 0;

    // ── 击杀缩放动画 ──
    this._deathScale = 0;   // 1.0 → 1.2 → 0 的动画
  }

  seek(targetX, targetY) {
    const dx = targetX - this.x, dy = targetY - this.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) { this.vx = (dx / len) * this.speed; this.vy = (dy / len) * this.speed; }
  }

  takeDamage(dmg = 1, knockbackAngle = null, knockbackForce = 0) {
    this.hp -= dmg;
    this.hitFlash = 0.1;
    // 击退
    if (knockbackForce > 0 && knockbackAngle !== null) {
      this.x += Math.cos(knockbackAngle) * knockbackForce;
      this.y += Math.sin(knockbackAngle) * knockbackForce;
    }
    if (this.hp <= 0) {
      this.alive = false;
      // 击杀缩放动画（死亡后仍然渲染几个帧用于缩放效果）
      this._deathScale = 1.0;
      if (this.behavior === 'splitter') {
        this._splitBurst = true;
        for (let i = 0; i < 12; i++) {
          const a = Math.random() * Math.PI * 2;
          const spd = 40 + Math.random() * 80;
          this._burstParticles.push({
            x: this.x, y: this.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
            life: 0.4 + Math.random() * 0.3, maxLife: 0.7, radius: 2 + Math.random() * 3,
          });
        }
      }
      // 精英死亡特效：更多粒子
      if (this.elite) {
        for (let i = 0; i < 20; i++) {
          const a = Math.random() * Math.PI * 2;
          const spd = 60 + Math.random() * 120;
          this._burstParticles.push({
            x: this.x, y: this.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
            life: 0.6 + Math.random() * 0.5, maxLife: 1.1, radius: 3 + Math.random() * 4,
          });
        }
      }
    }
  }

  spawnXpOrb() { return new ExperienceOrb(this.x, this.y, this.xpValue); }

  updateBehavior(dt, px, py, bulletMgr) {
    switch (this.behavior) {
      case 'chase':
      case 'splitter':
        this.seek(px, py);
        break;

      case 'rusher':
        this._rushTimer -= dt;
        if (this._rushActive > 0) {
          this._rushActive -= dt;
          this.speed = this.baseSpeed * 3;
          this.seek(px, py);
          if (Math.random() < 0.3) {
            this._trailPositions.push({ x: this.x, y: this.y, life: 0.3 });
          }
        } else {
          this.speed = this.baseSpeed;
          this.seek(px, py);
          if (this._rushTimer <= 0) {
            this._chargeWarning = 0.3;
            this._rushActive = 0.4;
            this._rushTimer = 1.5 + Math.random() * 1.0;
          }
        }
        if (this._chargeWarning > 0) this._chargeWarning -= dt;
        break;

      case 'ranged':
        this._rangedTimer -= dt;
        if (this._isStopped) {
          this._rangedStopTimer -= dt;
          this.vx = 0; this.vy = 0;
          if (this._rangedStopTimer <= 0) {
            this._isStopped = false;
            this._rangedTimer = 1.5 + Math.random() * 1.0;
          }
        } else {
          const dx = px - this.x, dy = py - this.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 250) { this.seek(px, py); }
          else if (dist < 150) { if (dist > 0) { this.vx = -(dx / dist) * this.speed; this.vy = -(dy / dist) * this.speed; } }
          else { this.vx *= 0.9; this.vy *= 0.9; }

          if (this._rangedTimer <= 0 && bulletMgr) {
            this._isStopped = true;
            this._rangedStopTimer = 0.5;
            const dx2 = px - this.x, dy2 = py - this.y;
            const len = Math.sqrt(dx2 * dx2 + dy2 * dy2);
            if (len > 0) {
              const angle = Math.atan2(dy2, dx2);
              bulletMgr.fireEnemyBullet(this.x, this.y, angle, 180, 6, 150);
            }
          }
        }
        break;
    }
  }

  update(dt) {
    super.update(dt);
    if (this.hitFlash > 0) this.hitFlash -= dt;

    this._trailPositions = this._trailPositions.filter(t => { t.life -= dt; return t.life > 0; });

    if (this._splitBurst) {
      for (const p of this._burstParticles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        p.vx *= 0.96;
        p.vy *= 0.96;
      }
      this._burstParticles = this._burstParticles.filter(p => p.life > 0);
    }
    // 精英粒子计时
    if (this.elite) { this._eliteParticleTimer += dt; }

    // 击杀缩放动画衰减：1.0 → 1.2 → 0 共约 0.15 秒
    if (this._deathScale > 0) {
      this._deathScale += dt * 3;  // 从 1.0 涨到约 1.2
      if (this._deathScale >= 1.2) {
        this._deathScale = -1;      // 标记为消失
      }
    }
  }

  render(ctx) {
    const color = this.hitFlash > 0 ? '#ffffff' : this.color;

    // ── 冲刺怪：拖尾 ──
    if (this.behavior === 'rusher') {
      for (const t of this._trailPositions) {
        const alpha = (t.life / 0.3) * 0.3;
        ctx.fillStyle = `rgba(232,67,147,${alpha})`;
        ctx.beginPath();
        ctx.arc(t.x, t.y, this.radius * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ── 冲刺怪：预警闪烁 ──
    if (this.behavior === 'rusher' && this._chargeWarning > 0) {
      ctx.strokeStyle = `rgba(255,0,0,${0.3 + Math.sin(performance.now() * 0.03) * 0.3})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + 8, 0, Math.PI * 2);
      ctx.stroke();
    }

    // ── 精英：外层光环 ──
    if (this.elite) {
      const pulse = Math.sin(performance.now() * 0.005 + this.id) * 0.2 + 0.8;
      ctx.strokeStyle = `rgba(255,215,0,${pulse * 0.5})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + 6, 0, Math.PI * 2);
      ctx.stroke();

      const count = 4;
      for (let i = 0; i < count; i++) {
        const a = (performance.now() * 0.003 + i * (Math.PI * 2 / count));
        const ox = Math.cos(a) * (this.radius + 10);
        const oy = Math.sin(a) * (this.radius + 10);
        ctx.fillStyle = 'rgba(255,215,0,0.6)';
        ctx.beginPath();
        ctx.arc(this.x + ox, this.y + oy, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ── 主身体 ──
    // 击杀缩放动画：死亡后身体胀大 → 消失
    if (this._deathScale !== 0) {
      ctx.save();
      ctx.translate(this.x, this.y);
      const s = this._deathScale > 0 ? this._deathScale : 0.01;
      ctx.scale(s, s);
      ctx.translate(-this.x, -this.y);
    }
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = this.elite ? 20 : 10;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // ── 精英：头顶标志 ──
    if (this.elite) {
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('★', this.x, this.y - this.radius - 10);
    }

    // ── 冲刺怪加速特效 ──
    if (this.behavior === 'rusher' && this._rushActive > 0) {
      ctx.strokeStyle = 'rgba(232,67,147,0.5)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const a = Math.atan2(this.vy, this.vx);
        const off = -20 - i * 8;
        ctx.beginPath();
        ctx.moveTo(this.x + off * Math.cos(a), this.y + off * Math.sin(a));
        ctx.lineTo(this.x + (off - 15) * Math.cos(a), this.y + (off - 15) * Math.sin(a));
        ctx.stroke();
      }
    }

    // ── 远程怪：蓄力效果 ──
    if (this.behavior === 'ranged') {
      ctx.strokeStyle = 'rgba(108,92,231,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + 6, 0, Math.PI * 2);
      ctx.stroke();

      if (this._isStopped) {
        const pulse = 0.5 + Math.sin(performance.now() * 0.02) * 0.3;
        ctx.strokeStyle = `rgba(108,92,231,${pulse})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + 12 + pulse * 5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // ── 血条 ──
    if (this.maxHp > 1) {
      const barW = this.radius * 2, barH = this.elite ? 6 : 4;
      const x = this.x - barW / 2, y = this.y - this.radius - 8;
      ctx.fillStyle = '#333';
      ctx.fillRect(x, y, barW, barH);
      ctx.fillStyle = this.elite ? '#ffd700' : '#2ecc71';
      ctx.fillRect(x, y, barW * (this.hp / this.maxHp), barH);
    }

    // ── 击杀缩放 restore ──
    if (this._deathScale !== 0) {
      ctx.restore();
    }

    // ── 爆裂粒子 ──
    if (this._splitBurst) {
      for (const p of this._burstParticles) {
        const alpha = p.life / p.maxLife;
        ctx.fillStyle = `rgba(${this.elite ? '255,215,0' : '26,188,156'},${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

export class EnemySpawner {
  constructor() {
    this.enemies = [];
    this.spawnTimer = 0;
    this.spawnInterval = 0.8;
    this.difficultyTimer = 0;

    // ── 爆发波系统 ──
    this._burstTimer = 0;
    this._burstActive = false;
    this._burstRemaining = 0;

    // ── 喘息阶段 ──
    this._breatherActive = false;
    this._breatherRemaining = 0;

    // ── 围剿系统 ──
    this._flankTimer = 0;
    this._flankActive = false;
    this._flankRemaining = 0;
    this._flankSpawned = false;

    // ── 精英计数器 ──
    this._eliteCounter = 0;
    this._eliteThreshold = 20;
    this._totalSpawned = 0;

    // ── 事件快照（供 engine 读取） ──
    this._flankDir = ''; // 'left-right' 或 'top-bottom'
  }

  _randomEdgePos(canvasW, canvasH, px, py, minDist = 120, margin = 60) {
    for (let a = 0; a < 20; a++) {
      const side = Math.floor(Math.random() * 4);
      let x, y;
      switch (side) {
        case 0: x = Math.random() * canvasW; y = -margin; break;
        case 1: x = Math.random() * canvasW; y = canvasH + margin; break;
        case 2: x = -margin; y = Math.random() * canvasH; break;
        case 3: x = canvasW + margin; y = Math.random() * canvasH; break;
        default: x = 0; y = 0;
      }
      if (Math.sqrt((x - px) ** 2 + (y - py) ** 2) >= minDist) return { x, y };
    }
    const side = Math.floor(Math.random() * 4);
    switch (side) {
      case 0: return { x: Math.random() * canvasW, y: -margin };
      case 1: return { x: Math.random() * canvasW, y: canvasH + margin };
      case 2: return { x: -margin, y: Math.random() * canvasH };
      case 3: return { x: canvasW + margin, y: Math.random() * canvasH };
      default: return { x: 0, y: 0 };
    }
  }

  /** 围剿：两方向，留出逃生缺口 */
  _flankSpawn(canvasW, canvasH, px, py, maxEnemies) {
    const margin = 40;
    const t = this.difficultyTimer;
    const count = 3 + Math.min(Math.floor(t / 15), 4);

    // 交替两方向：奇数次围剿上下，偶数次围剿左右
    const flankCount = Math.floor(this.difficultyTimer / 30);
    let positions;
    if (flankCount % 2 === 0) {
      // 左右夹击，上下留逃生缺口
      positions = [
        { x: -margin, y: py },
        { x: canvasW + margin, y: py },
      ];
      this._flankDir = 'left-right';
    } else {
      // 上下夹击，左右留逃生缺口
      positions = [
        { x: px, y: -margin },
        { x: px, y: canvasH + margin },
      ];
      this._flankDir = 'top-bottom';
    }

    for (const pos of positions) {
      if (this.enemies.length >= maxEnemies) break;
      for (let i = 0; i < count; i++) {
        if (this.enemies.length >= maxEnemies) break;
        const offsetX = (Math.random() - 0.5) * 60;
        const offsetY = (Math.random() - 0.5) * 60;
        const type = this._pickType(t);
        this._spawnEnemy(pos.x + offsetX, pos.y + offsetY, type);
      }
    }
  }

  /** 统一生成入口，管理精英计数 */
  _spawnEnemy(x, y, type) {
    const isElite = this._eliteCounter >= this._eliteThreshold;
    const e = new Enemy(x, y, type, isElite);
    this.enemies.push(e);
    this._totalSpawned++;
    if (isElite) {
      this._eliteCounter = 0;
    } else {
      this._eliteCounter++;
    }
  }

  _pickType(difficultyTimer) {
    const t = difficultyTimer, r = Math.random();
    if (t < 10) return r < 0.55 ? 'basic' : 'fast';
    if (t < 20) { if (r < 0.40) return 'basic'; if (r < 0.70) return 'fast'; return 'tank'; }
    if (t < 35) { if (r < 0.30) return 'basic'; if (r < 0.50) return 'fast'; if (r < 0.65) return 'tank'; if (r < 0.80) return 'splitter'; return 'rusher'; }
    if (r < 0.20) return 'basic'; if (r < 0.35) return 'fast'; if (r < 0.50) return 'tank'; if (r < 0.62) return 'splitter'; if (r < 0.78) return 'rusher'; return 'ranged';
  }

  spawnSplitMini(x, y, count = 2, maxEnemies = 80) {
    for (let i = 0; i < count; i++) {
      if (this.enemies.length >= maxEnemies) break;
      const e = new Enemy(x + (Math.random() - 0.5) * 20, y + (Math.random() - 0.5) * 20, 'fast');
      e.radius = 7; e.maxHp = 1; e.hp = 1; e.score = 5; e.xpValue = 3; e.baseSpeed = 120;
      e.behavior = 'chase'; e.color = '#55efc4';
      this.enemies.push(e);
    }
  }

  update(dt, canvasW, canvasH, playerX, playerY, bulletMgr, maxEnemies = 80) {
    this.difficultyTimer += dt;
    const t = this.difficultyTimer;

    // ========================================
    //  波动式难度曲线
    //  baseInterval = 线性递减基底（0.8 → 0.18）
    //  waveMod = 正弦波动（±20%周期15s），让难度有起伏
    // ========================================
    const linearBase = Math.max(0.18, 0.8 - t * 0.007);
    const waveMod = 1.0 + Math.sin(t * (Math.PI * 2 / 15)) * 0.2;
    const baseInterval = linearBase * waveMod;

    // ── 爆发波：每20秒触发，持续5秒，速率×1.4（而非翻倍）──
    this._burstTimer += dt;
    if (!this._burstActive && !this._breatherActive && this._burstTimer >= 20) {
      this._burstTimer = 0;
      this._burstActive = true;
      this._burstRemaining = 5;
    }
    if (this._burstActive) {
      this._burstRemaining -= dt;
      if (this._burstRemaining <= 0) {
        this._burstActive = false;
        // 爆发结束后提供5~8秒喘息
        this._breatherActive = true;
        this._breatherRemaining = 5 + Math.random() * 3;
      }
    }

    // ── 喘息阶段：生成速率降低至一半 ──
    if (this._breatherActive) {
      this._breatherRemaining -= dt;
      if (this._breatherRemaining <= 0) {
        this._breatherActive = false;
      }
    }

    // 爆发期间 interval 乘 1/1.4（≈0.714），即速率×1.4
    // 喘息期间 interval × 2，即速率×0.5
    let effectiveInterval = baseInterval;
    if (this._burstActive) {
      effectiveInterval = baseInterval / 1.4;
    } else if (this._breatherActive) {
      effectiveInterval = baseInterval * 2.0;
    }

    // ── 围剿：每30秒触发，两方向 ──
    this._flankTimer += dt;
    if (!this._flankActive && this._flankTimer >= 30) {
      this._flankTimer = 0;
      this._flankActive = true;
      this._flankRemaining = 1.5;
      this._flankSpawned = false;
    }
    if (this._flankActive) {
      this._flankRemaining -= dt;
      if (!this._flankSpawned && this._flankRemaining > 0) {
        this._flankSpawn(canvasW, canvasH, playerX, playerY, maxEnemies);
        this._flankSpawned = true;
      }
      if (this._flankRemaining <= 0) {
        this._flankActive = false;
      }
    }

    // ── 普通生成 ──
    if (this.enemies.length < maxEnemies) {
      this.spawnTimer += dt;
      while (this.spawnTimer >= effectiveInterval) {
        this.spawnTimer -= effectiveInterval;
        if (this.enemies.length >= maxEnemies) break;
        const pos = this._randomEdgePos(canvasW, canvasH, playerX, playerY);
        this._spawnEnemy(pos.x, pos.y, this._pickType(t));
      }
    }

    // ── 更新所有敌人 ──
    for (const e of this.enemies) {
      e.updateBehavior(dt, playerX, playerY, bulletMgr);
      e.update(dt);
    }
    // 过滤时保留死亡缩放的敌人（_deathScale > 0 的还活着，-1 的彻底消失）
    this.enemies = this.enemies.filter((e) => e.alive || e._deathScale !== -1);
  }

  render(ctx) { for (const e of this.enemies) e.render(ctx); }

  reset() {
    this.enemies = [];
    this.spawnTimer = 0;
    this.spawnInterval = 0.8;
    this.difficultyTimer = 0;
    this._burstTimer = 0;
    this._burstActive = false;
    this._burstRemaining = 0;
    this._breatherActive = false;
    this._breatherRemaining = 0;
    this._flankTimer = 0;
    this._flankActive = false;
    this._flankRemaining = 0;
    this._flankSpawned = false;
    this._eliteCounter = 0;
    this._eliteThreshold = 20;
    this._totalSpawned = 0;
    this._flankDir = '';
  }
}
