/**
 * entities.js — 实体系统基类
 * 所有游戏对象的基类，便于后续扩展网络序列化
 */

export class Entity {
  constructor(x, y) {
    this.id = Entity._nextId++;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = 16;
    this.alive = true;
    this.type = 'entity';
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  distanceTo(other) {
    const dx = other.x - this.x;
    const dy = other.y - this.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** 序列化 — 方便后续联机同步 */
  serialize() {
    return {
      id: this.id,
      type: this.type,
      x: Math.round(this.x),
      y: Math.round(this.y),
      alive: this.alive,
    };
  }

  /** 子类重写 */
  render(ctx) {}
}

Entity._nextId = 0;

/**
 * ExperienceOrb — 经验球
 * 敌人死亡后掉落，玩家靠近自动拾取
 */
export class ExperienceOrb extends Entity {
  constructor(x, y, value = 10) {
    super(x, y);
    this.value = value;
    this.radius = value > 20 ? 7 : 5;
    this.type = 'xp_orb';
    this.lifetime = 12; // 秒后消失
    this.fadeStart = 8; // 最后4秒开始闪烁
  }

  update(dt) {
    super.update(dt);
    this.lifetime -= dt;
    if (this.lifetime <= 0) {
      this.alive = false;
    }
  }

  render(ctx) {
    // 快消失时闪烁
    if (this.lifetime < this.fadeStart && Math.floor(this.lifetime * 6) % 2 === 0) return;

    const pulse = 1 + Math.sin(performance.now() * 0.006) * 0.15;
    const r = this.radius * pulse;

    ctx.fillStyle = '#00ff88';
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 内部亮点
    ctx.fillStyle = '#aaffcc';
    ctx.beginPath();
    ctx.arc(this.x - r * 0.2, this.y - r * 0.2, r * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // 中间光点
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

/**
 * OrbitalBlade — 环绕飞剑
 * 围绕玩家旋转，碰到敌人造成伤害
 */
export class OrbitalBlade extends Entity {
  constructor(angle = 0) {
    super(0, 0);
    this.radius = 10;
    this.type = 'orbital_blade';
    this.angle = angle;          // 当前轨道角度
    this.orbitRadius = 80;       // 轨道半径
    this.speed = 3.5;            // 弧度/秒
    this.damage = 3;
    this._hitEnemiesThisFrame = new Set(); // 每帧命中跟踪，防止同一帧重复伤害同一敌人
    this._size = 1;              // 渲染用
  }

  /** 更新位置围绕玩家 */
  orbit(playerX, playerY, dt) {
    this.angle += this.speed * dt;
    this.x = playerX + Math.cos(this.angle) * this.orbitRadius;
    this.y = playerY + Math.sin(this.angle) * this.orbitRadius;
  }

  render(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    // 飞剑旋转
    const rot = this.angle;
    ctx.rotate(rot);

    // 剑身
    ctx.fillStyle = '#ff69b4';
    ctx.shadowColor = '#ff69b4';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-4, -5);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // 剑柄
    ctx.fillStyle = '#aaffdd';
    ctx.fillRect(-4, -2, -4, 4);

    ctx.restore();
  }
}
