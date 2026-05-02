/**
 * engine.js — 游戏主引擎
 * 流派系统 + 绑定升级池 + 敌人视觉强化
 */

import { Player, BUILDS } from './player.js';
import { BulletManager } from './bullet.js';
import { EnemySpawner } from './enemy.js';
import { CollisionSystem } from './collision.js';
import { InputManager } from './input.js';
import { Camera } from './camera.js';
import { HUD } from './hud.js';
import { ExperienceOrb } from './entities.js';
import { playShoot, playHit, playPickup, playLevelUp, playGameOver, playSplit, playClearing } from './audio.js';

// ── 对象数量上限 ──
const MAX_ENEMIES = 80;
const MAX_XP_ORBS = 120;
const MAX_ENEMY_BULLETS = 150;

// ── 流派升级池定义 ──
// 每个升级是 { id, name, icon, desc, applies: (build) => bool, apply: (p) => void }
const UPGRADES = {
  /** 通用（所有流派可见） */
  common: [
    { id: 'move_speed',   name: '疾跑',      icon: '🏃', desc: '移动速度 +30%',    apply: (p) => { p.speed *= 1.3; } },
    { id: 'max_hp',       name: '血上限',    icon: '❤️', desc: '最大生命 +40',      apply: (p) => { p.maxHp += 40; p.hp = Math.min(p.hp + 20, p.maxHp); } },
    { id: 'heal',         name: '回血',      icon: '💚', desc: '回复 50 生命值',    apply: (p) => { p.hp = Math.min(p.hp + 50, p.maxHp); } },
    { id: 'bullet_speed', name: '弹速',      icon: '🚀', desc: '子弹速度 +30%',    apply: (p) => { p.bulletSpeed *= 1.3; } },
    { id: 'shield',       name: '护盾',      icon: '🛡️', desc: '最大生命+20，无敌2秒', apply: (p) => { p.maxHp += 20; p.hp += 20; p.invincible = 2; } },
  ],

  /** 飞剑流专属 */
  blade: [
    { id: 'blade_add1',   name: '飞剑+1',    icon: '🗡️', desc: '增加一把环绕飞剑',     apply: (p) => { p.addOrbitalBlade(); } },
    { id: 'blade_dmg',    name: '剑刃风暴',  icon: '⚔️', desc: '飞剑伤害 +5',         apply: (p) => { for (const b of p.orbitalBlades) b.damage += 5; } },
    { id: 'blade_speed',  name: '剑舞',      icon: '🌀', desc: '飞剑转速 +50%',       apply: (p) => { for (const b of p.orbitalBlades) b.speed *= 1.5; } },
    { id: 'blade_range',  name: '剑域',      icon: '🌐', desc: '飞剑轨道半径 +40',    apply: (p) => { for (const b of p.orbitalBlades) b.orbitRadius += 40; } },
    { id: 'blade_firerate',name: '剑意',     icon: '⚡', desc: '基础射击间隔减半',    apply: (p) => { p.shootInterval *= 0.5; } },
    { id: 'blade_add2',   name: '飞剑再+1',  icon: '🗡️', desc: '再增加一把飞剑',       apply: (p) => { p.addOrbitalBlade(); } },
  ],

  /** 散弹流专属 */
  shotgun: [
    { id: 'sg_count',     name: '弹幕+1',    icon: '🔫', desc: '子弹数 +1',          apply: (p) => { p.shotgunCount += 1; } },
    { id: 'sg_spread',    name: '扩散',      icon: '🌊', desc: '散射范围 +40%',      apply: (p) => { p.shotgunSpread *= 1.4; } },
    { id: 'sg_firerate',  name: '速射',      icon: '⚡', desc: '射击间隔减半',        apply: (p) => { p.shootInterval *= 0.5; } },
    { id: 'sg_crit',      name: '暴击',      icon: '💢', desc: '20%概率造成2倍伤害', apply: (p) => { p.critChance = Math.min(0.8, p.critChance + 0.2); } },
    { id: 'sg_dmg',       name: '火力',      icon: '💥', desc: '子弹伤害 +2',        apply: (p) => { p.bulletDamage += 2; } },
    { id: 'sg_count2',    name: '弹幕再+1',  icon: '🔫', desc: '子弹数再 +1',        apply: (p) => { p.shotgunCount += 1; } },
  ],

  /** 穿透流专属 */
  pierce: [
    { id: 'pc_count',     name: '穿透+1',    icon: '🔱', desc: '穿透次数 +1',        apply: (p) => { p.pierceCount += 1; } },
    { id: 'pc_dmg',       name: '重击',      icon: '💥', desc: '子弹伤害 +3',        apply: (p) => { p.bulletDamage += 3; } },
    { id: 'pc_firerate',  name: '连射',      icon: '⚡', desc: '射击间隔减半',        apply: (p) => { p.shootInterval *= 0.5; } },
    { id: 'pc_range',     name: '穿甲弹',    icon: '🎯', desc: '子弹射程 +50%',      apply: (p) => { p.bulletSpeed *= 1.5; } },
    { id: 'pc_crit',      name: '精准打击',  icon: '💢', desc: '20%概率暴击2倍',     apply: (p) => { p.critChance = Math.min(0.8, p.critChance + 0.2); p.critMultiplier += 0.5; } },
    { id: 'pc_count2',    name: '穿透再+1',  icon: '🔱', desc: '穿透次数再 +1',      apply: (p) => { p.pierceCount += 1; } },
  ],
};

/** 根据玩家流派，从对应池中抽取 */
function pickUpgradesForBuild(buildType, count = 3) {
  if (!buildType || !UPGRADES[buildType]) return [];
  const pool = [...UPGRADES.common, ...UPGRADES[buildType]];
  const shuffled = pool.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

const STORAGE_KEY = 'survival_shooter_best_record';

function loadBestRecord() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveBestRecord(score, kills, time, level, upgrades) {
  try {
    const current = { score, kills, time, level, upgrades };
    const existing = loadBestRecord();
    if (!existing || score > existing.score || (score === existing.score && time > existing.time)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
      return true;
    }
    return false;
  } catch { return false; }
}

let _logTimer = 0;

export class GameEngine {
  constructor(canvas, logicalW, logicalH) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    // 逻辑尺寸（与渲染坐标一致，不受 devicePixelRatio 影响）
    this.logicalW = logicalW || canvas.width;
    this.logicalH = logicalH || canvas.height;

    this.input = new InputManager(canvas);
    this.camera = new Camera(this.logicalW, this.logicalH);
    this.bullets = new BulletManager();
    this.spawner = new EnemySpawner();
    this.collision = new CollisionSystem();
    this.hud = new HUD();

    this.player = new Player(this.logicalW / 2, this.logicalH / 2);
    this.running = false;
    this.lastTime = 0;
    this._rafId = null;

    this.xpOrbs = [];

    // ── 选择面板 ──
    this.showingChoice = false;    // true = 面板显示中
    this.choiceType = 'none';      // 'build' | 'upgrade'
    this.choiceData = [];          // 选项内容

    this.chosenUpgrades = [];

    this.xpMultiplier = 1.0;

    this.bestRecord = loadBestRecord();
    this.newBest = false;

    // ── 事件状态跟踪 ──
    this._burstActive = false;
    this._flankActive = false;
    this._burstTimer = 0;

    // ── 打击手感 ──
    this._hitStop = 0;        // 命中停顿剩余秒数
    this._shakeX = 0;          // 屏幕震动偏移 x
    this._shakeY = 0;          // 屏幕震动偏移 y
    this._shakeTimer = 0;      // 震动剩余时间

    // ── 清屏爆发 ──
    this._clearingActive = false;   // 是否正在爆发
    this._clearingTimer = 0;        // 爆发剩余显示时间
    this._clearingKillThreshold = 10; // 下次触发所需击杀数
    this._clearingTimeThreshold = 0;  // 时间触发计时
  }

  start() {
    this.running = true;
    this.lastTime = performance.now();
    this.input.attach();
    this._gameLoop(this.lastTime);
    // 开局选流派
    this._showBuildChoice();
  }

  _showBuildChoice() {
    this.showingChoice = true;
    this.choiceType = 'build';
    this.choiceData = [BUILDS.blade, BUILDS.shotgun, BUILDS.pierce];
  }

  stop() {
    this.running = false;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this.input.detach();
  }

  reset() {
    this.player.reset(this.canvas.width / 2, this.canvas.height / 2);
    this.spawner.reset();
    this.bullets.bullets = [];
    this.bullets.enemyBullets = [];
    this.xpOrbs = [];
    this.hud.reset();
    this.showingChoice = false;
    this.choiceType = 'none';
    this.choiceData = [];
    this.chosenUpgrades = [];
    this.xpMultiplier = 1.0;
    this.newBest = false;
    this._burstActive = false;
    this._flankActive = false;
    this._burstTimer = 0;
    this._hitStop = 0;
    this._shakeX = 0;
    this._shakeY = 0;
    this._shakeTimer = 0;
    this._clearingActive = false;
    this._clearingTimer = 0;
    this._clearingKillThreshold = 10;
    this._clearingTimeThreshold = 0;
    _logTimer = 0;
  }

  getGameOverState() {
    return {
      score: this.hud.score,
      kills: this.hud.kills,
      time: this.spawner.difficultyTimer,
      level: this.player.level,
      upgrades: [...this.chosenUpgrades],
    };
  }

  // ── 游戏主循环 ──

  _gameLoop = (timestamp) => {
    if (!this.running) return;
    let dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
    this.lastTime = timestamp;

    // Hit Stop：命中暂停
    if (this._hitStop > 0) {
      this._hitStop -= dt;
      dt = 0; // 游戏逻辑暂停，但渲染继续（让玩家看到停顿帧）
    }

    this._update(dt);
    this._render();
    this._rafId = requestAnimationFrame(this._gameLoop);
  };

  _update(dt) {
    if (!this.player.alive) return;
    if (this.showingChoice) return; // 面板暂停

    const W = this.logicalW, H = this.logicalH;
    const player = this.player;

    _logTimer += dt;
    if (_logTimer >= 1.0) {
      _logTimer -= 1.0;
      console.log(`[DEBUG] enemies:${this.spawner.enemies.length} bullets:${this.bullets.bullets.length} enemyBullets:${this.bullets.enemyBullets.length} xpOrbs:${this.xpOrbs.length}`);
    }

    const t = this.spawner.difficultyTimer;
    // 前30秒经验倍率2.5，确保前1分钟能升4~6级
    this.xpMultiplier = t < 30 ? 2.5 : t < 60 ? 2.5 - ((t - 30) / 30) * 1.0 : 1.5;

    player.update(dt, this.input, this.bullets, this.spawner.enemies);

    player.x = Math.max(player.radius, Math.min(W - player.radius, player.x));
    player.y = Math.max(player.radius, Math.min(H - player.radius, player.y));

    this.bullets.update(dt);
    this.spawner.update(dt, W, H, player.x, player.y, this.bullets, MAX_ENEMIES);

    // ── 碰撞检测 ──

    // 子弹 vs 敌人
    const bulletHits = this.collision.checkBulletEnemy(this.bullets.bullets, this.spawner.enemies);
    for (const { bullet, enemy } of bulletHits) {
      if (!enemy.alive) continue;
      // 击退方向：子弹飞行方向
      const knockAngle = Math.atan2(bullet.vy, bullet.vx);
      enemy.takeDamage(bullet.damage, knockAngle, 8);
      // Hit Stop：命中停顿 0.04 秒
      this._hitStop = 0.04;
      // 穿透逻辑：不减 alive 而是减 pierceLeft
      if (bullet.pierceLeft > 0) {
        bullet.pierceLeft--;
        if (bullet.pierceLeft <= 0) { bullet._triggerShatter(); bullet.alive = false; }
      } else {
        bullet._triggerShatter();
        bullet.alive = false;
      }
      if (!enemy.alive) {
        this._onEnemyDied(enemy);
      }
    }

    // 玩家 vs 敌人
    const playerHits = this.collision.checkPlayerEnemy(player, this.spawner.enemies);
    for (const enemy of playerHits) {
      if (!enemy.alive) continue;
      player.takeDamage(8);
      const angle = Math.atan2(enemy.y - player.y, enemy.x - player.x);
      enemy.x += Math.cos(angle) * 30;
      enemy.y += Math.sin(angle) * 30;
      // 玩家受伤：轻微屏幕震动
      this._shakeTimer = 0.1;
      this._shakeX = (Math.random() - 0.5) * 4;
      this._shakeY = (Math.random() - 0.5) * 4;
    }

    // 敌人子弹 vs 玩家
    const enemyBulletHits = this.collision.checkEnemyBulletPlayer(player, this.bullets.enemyBullets);
    for (const b of enemyBulletHits) {
      b.alive = false;
      player.takeDamage(6);
    }

    // 环绕飞剑 vs 敌人
    if (player.orbitalBlades.length > 0) {
      const bladeHits = this.collision.checkBladeEnemy(player.orbitalBlades, this.spawner.enemies);
      for (const { blade, enemy } of bladeHits) {
        if (blade._hitEnemiesThisFrame.has(enemy.id)) continue;
        blade._hitEnemiesThisFrame.add(enemy.id);
        if (!enemy.alive) continue;
        enemy.takeDamage(blade.damage);
        // 飞剑也触发短暂 hitStop（比子弹略短）
        this._hitStop = 0.03;
        if (!enemy.alive) {
          this._onEnemyDied(enemy);
        }
      }
      for (const blade of player.orbitalBlades) {
        blade._hitEnemiesThisFrame.clear();
      }
    }

    // 游戏结束
    if (player.hp <= 0) {
      player.alive = false;
      playGameOver();
      this.newBest = saveBestRecord(this.hud.score, this.hud.kills, this.spawner.difficultyTimer, player.level, this.chosenUpgrades);
      this.bestRecord = loadBestRecord();
    }

    // ── 经验球 ──
    for (const orb of this.xpOrbs) { orb.update(dt); }
    this.xpOrbs = this.xpOrbs.filter((o) => o.alive);

    const pickupRange = 40 + player.radius;
    for (const orb of this.xpOrbs) {
      if (!orb.alive) continue;
      const dx = orb.x - player.x, dy = orb.y - player.y;
      if (Math.sqrt(dx * dx + dy * dy) < pickupRange) {
        orb.alive = false;
        playPickup();
        if (player.addXp(orb.value)) {
          playLevelUp();
          this._triggerUpgrade();
          break;
        }
      }
    }
    this.xpOrbs = this.xpOrbs.filter((o) => o.alive);
    this.hud.survivalTime = this.spawner.difficultyTimer;

    // ── 跟踪事件状态供 HUD 渲染 ──
    this._burstActive = this.spawner._burstActive;
    this._flankActive = this.spawner._flankActive;
    this._burstTimer = this.spawner._burstTimer;

    // ── 屏幕震动衰减 ──
    if (this._shakeTimer > 0) {
      this._shakeTimer -= dt;
      if (this._shakeTimer <= 0) {
        this._shakeTimer = 0;
        this._shakeX = 0;
        this._shakeY = 0;
      } else {
        // 震动逐渐减弱
        this._shakeX *= 0.85;
        this._shakeY *= 0.85;
      }
    }

    // ── 清屏爆发计时 ──
    if (this._clearingActive) {
      this._clearingTimer -= dt;
      if (this._clearingTimer <= 0) {
        this._clearingActive = false;
        this._clearingTimer = 0;
      }
    }

    // ── 时间触发清屏 ──
    if (!this._clearingActive && this._clearingTimeThreshold > 0 && this.spawner.difficultyTimer >= this._clearingTimeThreshold) {
      this._triggerClearingBurst();
    }
  }

  _onEnemyDied(enemy) {
    this.hud.addScore(enemy.score);
    this.hud.addKill();
    playHit();
    // 清屏爆发：击杀里程碑检查
    const kills = this.hud.kills;
    if (kills >= this._clearingKillThreshold && !this._clearingActive) {
      this._triggerClearingBurst();
    }
    // 精英死亡：屏幕震动（稍强）
    if (enemy.elite) {
      this._shakeTimer = 0.15;
      this._shakeX = (Math.random() - 0.5) * 8;
      this._shakeY = (Math.random() - 0.5) * 8;
    }
    if (this.xpOrbs.length < MAX_XP_ORBS) {
      this.xpOrbs.push(new ExperienceOrb(enemy.x, enemy.y, Math.round(enemy.xpValue * this.xpMultiplier)));
    }
    if (enemy.behavior === 'splitter') {
      playSplit();
      this.spawner.spawnSplitMini(enemy.x, enemy.y, 2, MAX_ENEMIES);
    }
  }

  _triggerUpgrade() {
    this.showingChoice = true;
    this.choiceType = 'upgrade';
    this.choiceData = pickUpgradesForBuild(this.player.buildType, 3);
  }

  /** 清屏爆发：清除场上大部分敌人 + 强视觉 */
  _triggerClearingBurst() {
    if (this._clearingActive) return;
    this._clearingActive = true;
    this._clearingTimer = 1.5;

    // 清除场上所有非精英敌人
    const enemies = this.spawner.enemies;
    for (const e of enemies) {
      if (!e.alive || e.elite) continue;
      // 直接标记死亡，不走碰撞流程（避免重复触发 events）
      e.alive = false;
      // 添加击杀缩放动画
      e._deathScale = 1.0;
      // 小粒子爆发
      for (let i = 0; i < 6; i++) {
        const a = Math.random() * Math.PI * 2;
        const spd = 40 + Math.random() * 80;
        e._burstParticles.push({
          x: e.x, y: e.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
          life: 0.3 + Math.random() * 0.3, maxLife: 0.6, radius: 2 + Math.random() * 3,
        });
      }
    }
    // 给玩家少量经验
    for (let i = 0; i < 5; i++) {
      if (this.xpOrbs.length >= MAX_XP_ORBS) break;
      this.xpOrbs.push(new ExperienceOrb(
        this.player.x + (Math.random() - 0.5) * 100,
        this.player.y + (Math.random() - 0.5) * 100,
        Math.round(12 * this.xpMultiplier)
      ));
    }

    // 强屏幕震动
    this._shakeTimer = 0.3;
    this._shakeX = (Math.random() - 0.5) * 12;
    this._shakeY = (Math.random() - 0.5) * 12;
    // Hit stop 短暂停顿让玩家感受到爆发
    this._hitStop = 0.08;

    playClearing();

    // 设定下次里程碑（阶梯递增：10, 25, 50, 80, ...）
    this._clearingKillThreshold = this.hud.kills + Math.min(15 + Math.floor(this.hud.kills / 20) * 10, 60);
    this._clearingTimeThreshold = this.spawner.difficultyTimer + 45; // 45秒后时间触发
  }

  /** 选择一个选项（流派或升级） */
  selectChoice(index) {
    if (!this.showingChoice) return;
    const item = this.choiceData[index];
    if (!item) return;

    if (this.choiceType === 'build') {
      // 选择流派
      this.player.setBuild(item.id);
      this.chosenUpgrades.push(item.name);
    } else {
      // 选择升级
      item.apply(this.player);
      this.chosenUpgrades.push(item.name);
    }

    this.showingChoice = false;
    this.choiceType = 'none';
    this.choiceData = [];
  }

  // ═══════════════════════════════════════════
  //  渲染
  // ═══════════════════════════════════════════

  _render() {
    const { ctx } = this;
    const W = this.logicalW, H = this.logicalH;

    // ── 屏幕震动：在渲染前应用偏移 ──
    if (this._shakeTimer > 0) {
      ctx.save();
      ctx.translate(this._shakeX, this._shakeY);
    }

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, W, H);

    // 网格
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    const gs = 50;
    for (let x = 0; x <= W; x += gs) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y = 0; y <= H; y += gs) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

    for (const orb of this.xpOrbs) { orb.render(ctx); }
    this.bullets.render(ctx);
    this.spawner.render(ctx);
    if (this.player.alive || this.player.hp > 0) { this.player.render(ctx); }

    this.hud.render(ctx, this.player, W, H);

    // ── 虚拟摇杆（触摸设备） ──
    this.input.renderJoystick(ctx);

    // ── 爆发波 & 围剿 事件通知 ──
    if (this.player.alive) {
      if (this._burstActive) {
        const pulse = 0.5 + Math.sin(performance.now() * 0.01) * 0.5;
        ctx.fillStyle = `rgba(255,69,0,${pulse * 0.3})`;
        ctx.fillRect(0, 0, W, H);
        ctx.textAlign = 'center';
        ctx.fillStyle = `rgba(255,69,0,${pulse * 0.8})`;
        ctx.font = 'bold 28px monospace';
        ctx.fillText('⚡ 爆发波 ⚡', W / 2, H * 0.18);
      }
      if (this._flankActive) {
        const pulse = 0.5 + Math.sin(performance.now() * 0.015) * 0.5;
        ctx.textAlign = 'center';
        ctx.fillStyle = `rgba(255,0,100,${pulse * 0.8})`;
        ctx.font = 'bold 24px monospace';
        ctx.fillText('⚠ 四方向围剿 ⚠', W / 2, H * 0.25);
        // 四边红色闪光指示
        ctx.fillStyle = `rgba(255,0,50,${pulse * 0.15})`;
        ctx.fillRect(0, 0, W, 4);          // 上
        ctx.fillRect(0, H - 4, W, 4);       // 下
        ctx.fillRect(0, 0, 4, H);           // 左
        ctx.fillRect(W - 4, 0, 4, H);       // 右
      }
    }

    // ── 清屏爆发 ──
    if (this._clearingActive && this.player.alive) {
      const pulse = 0.5 + Math.sin(performance.now() * 0.02) * 0.5;
      // 全屏白色闪光
      ctx.fillStyle = `rgba(255,255,255,${pulse * 0.15})`;
      ctx.fillRect(0, 0, W, H);
      // 中央大字
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(255,255,100,${pulse * 0.9})`;
      ctx.font = 'bold 48px monospace';
      ctx.shadowColor = '#ffdd57';
      ctx.shadowBlur = 30;
      ctx.fillText('💥 清屏爆发 💥', W / 2, H * 0.4);
      ctx.shadowBlur = 0;

      // 四角光芒线
      ctx.strokeStyle = `rgba(255,255,200,${pulse * 0.6})`;
      ctx.lineWidth = 4;
      const len = 40;
      const gap = 15;
      // 左上
      ctx.beginPath(); ctx.moveTo(gap, gap + len); ctx.lineTo(gap, gap); ctx.lineTo(gap + len, gap); ctx.stroke();
      // 右上
      ctx.beginPath(); ctx.moveTo(W - gap - len, gap); ctx.lineTo(W - gap, gap); ctx.lineTo(W - gap, gap + len); ctx.stroke();
      // 左下
      ctx.beginPath(); ctx.moveTo(gap, H - gap - len); ctx.lineTo(gap, H - gap); ctx.lineTo(gap + len, H - gap); ctx.stroke();
      // 右下
      ctx.beginPath(); ctx.moveTo(W - gap - len, H - gap); ctx.lineTo(W - gap, H - gap); ctx.lineTo(W - gap, H - gap - len); ctx.stroke();
    }

    if (this.xpMultiplier > 1.0 && this.player.alive) {
      ctx.fillStyle = 'rgba(0,255,136,0.3)';
      ctx.font = '12px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`xp ×${this.xpMultiplier.toFixed(1)}`, 20, 80);
    }

    // 选择面板
    if (this.showingChoice) {
      if (this.choiceType === 'build') this._renderBuildChoice(ctx, W, H);
      else this._renderUpgradePanel(ctx, W, H);
    }

    if (!this.player.alive) {
      this._renderGameOver(ctx, W, H);
    }

    // ── 屏幕震动 restore ──
    if (this._shakeTimer > 0) {
      ctx.restore();
    }
  }

  /** 开局流派选择 */
  _renderBuildChoice(ctx, W, H) {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffdd57';
    ctx.font = 'bold 36px monospace';
    ctx.fillText('选择你的流派', W / 2, H * 0.22);

    const cardW = 220, cardH = 230, gap = 40;
    const totalW = 3 * cardW + 2 * gap;
    const startX = (W - totalW) / 2;
    const cardY = H * 0.30;

    this._upgradeCardRects = [];

    const icons = { blade: '🗡️', shotgun: '💥', pierce: '🔱' };
    const colors = { blade: '#ff69b4', shotgun: '#ff8c00', pierce: '#00bfff' };

    for (let i = 0; i < this.choiceData.length; i++) {
      const b = this.choiceData[i];
      const cx = startX + i * (cardW + gap);
      const cy = cardY;

      this._upgradeCardRects.push({ x: cx, y: cy, w: cardW, h: cardH, index: i });

      // 卡片
      ctx.fillStyle = 'rgba(20,20,40,0.95)';
      ctx.shadowColor = colors[b.id];
      ctx.shadowBlur = 15;
      ctx.fillRect(cx, cy, cardW, cardH);
      ctx.shadowBlur = 0;

      ctx.strokeStyle = colors[b.id];
      ctx.lineWidth = 2;
      ctx.strokeRect(cx, cy, cardW, cardH);

      // 图标
      ctx.textAlign = 'center';
      ctx.font = '48px monospace';
      ctx.fillStyle = colors[b.id];
      ctx.fillText(icons[b.id], cx + cardW / 2, cy + 70);

      // 名称
      ctx.font = 'bold 22px monospace';
      ctx.fillStyle = '#fff';
      ctx.fillText(b.name, cx + cardW / 2, cy + 110);

      // 描述
      ctx.font = '14px monospace';
      ctx.fillStyle = '#aaa';
      const lines = b.desc.split('，');
      lines.forEach((line, li) => {
        ctx.fillText(line, cx + cardW / 2, cy + 140 + li * 22);
      });

      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '12px monospace';
      ctx.fillText('点击选择', cx + cardW / 2, cy + cardH - 15);
    }
  }

  /** 升级面板 */
  _renderUpgradePanel(ctx, W, H) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffdd57';
    ctx.font = 'bold 32px monospace';
    ctx.fillText('选择一个强化', W / 2, H * 0.28);

    const cardW = 200, cardH = 160, gap = 30;
    const totalW = this.choiceData.length * cardW + (this.choiceData.length - 1) * gap;
    const startX = (W - totalW) / 2;
    const cardY = H * 0.35;

    this._upgradeCardRects = [];

    for (let i = 0; i < this.choiceData.length; i++) {
      const choice = this.choiceData[i];
      const cx = startX + i * (cardW + gap), cy = cardY;

      this._upgradeCardRects.push({ x: cx, y: cy, w: cardW, h: cardH, index: i });

      ctx.fillStyle = 'rgba(30,30,50,0.9)';
      ctx.shadowColor = '#ffdd57';
      ctx.shadowBlur = 10;
      ctx.fillRect(cx, cy, cardW, cardH);
      ctx.shadowBlur = 0;

      ctx.strokeStyle = '#ffdd57';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx, cy, cardW, cardH);

      ctx.textAlign = 'center';
      ctx.font = '36px monospace';
      ctx.fillStyle = '#ffdd57';
      ctx.fillText(choice.icon, cx + cardW / 2, cy + 50);

      ctx.font = 'bold 16px monospace';
      ctx.fillStyle = '#fff';
      ctx.fillText(choice.name, cx + cardW / 2, cy + 85);

      ctx.font = '13px monospace';
      ctx.fillStyle = '#aaa';
      ctx.fillText(choice.desc, cx + cardW / 2, cy + 115);

      ctx.fillStyle = 'rgba(255,221,87,0.5)';
      ctx.font = '11px monospace';
      ctx.fillText('点击选择', cx + cardW / 2, cy + cardH - 12);
    }
  }

  _renderGameOver(ctx, W, H) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#e74c3c';
    ctx.font = 'bold 42px monospace';
    ctx.fillText('GAME OVER', W / 2, H / 2 - 140);

    ctx.fillStyle = '#fff';
    ctx.font = '18px monospace';
    const statsY = H / 2 - 85;
    const buildName = this.player.buildType ? BUILDS[this.player.buildType].name : '—';
    ctx.fillText(`流派: ${buildName}    等级: ${this.player.level}`, W / 2, statsY);
    ctx.fillText(`击杀: ${this.hud.kills}    分数: ${this.hud.score}`, W / 2, statsY + 28);
    ctx.fillText(`存活: ${Math.floor(this.spawner.difficultyTimer)}秒`, W / 2, statsY + 56);

    if (this.chosenUpgrades.length > 0) {
      ctx.fillStyle = '#ffdd57';
      ctx.font = '14px monospace';
      ctx.fillText('本局升级:', W / 2, statsY + 90);
      ctx.fillStyle = '#aaa';
      ctx.font = '13px monospace';
      ctx.fillText(this.chosenUpgrades.slice(-6).join('  ·  '), W / 2, statsY + 112);
    }

    const best = this.bestRecord;
    if (best) {
      const compY = statsY + 145;
      ctx.fillStyle = this.newBest ? '#ffdd57' : '#888';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(this.newBest ? '★ 新纪录！' : '历史最佳', W / 2, compY);
      ctx.font = '13px monospace';
      ctx.fillStyle = '#666';
      ctx.fillText(`最佳分数: ${best.score}  (差 ${Math.max(0, best.score - this.hud.score)})`, W / 2, compY + 22);
      ctx.fillText(`最佳存活: ${Math.floor(best.time)}秒  (差 ${Math.max(0, Math.floor(best.time - this.spawner.difficultyTimer))}秒)`, W / 2, compY + 42);
      if (best.upgrades && best.upgrades.length > 0) {
        ctx.fillStyle = '#555';
        ctx.font = '12px monospace';
        ctx.fillText('最佳局升级: ' + best.upgrades.slice(-5).join('  ·  '), W / 2, compY + 65);
      }
    }

    ctx.fillStyle = '#f1c40f';
    ctx.font = '18px monospace';
    ctx.fillText('点击下方按钮重新开始', W / 2, H / 2 + 160);
  }

  resize(width, height) {
    this.logicalW = width;
    this.logicalH = height;
    this.camera.setSize(width, height);
  }

  handleClick(clientX, clientY) {
    if (!this.showingChoice) return;
    const rect = this.canvas.getBoundingClientRect();
    const mx = clientX - rect.left, my = clientY - rect.top;
    if (!this._upgradeCardRects) return;
    for (const r of this._upgradeCardRects) {
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
        this.selectChoice(r.index);
        return;
      }
    }
  }
}
