/**
 * hud.js — HUD 渲染
 * 极简设计，只保留关键信息：
 * 左上：血量条 + 等级/经验
 * 右上：击杀数（大字号）
 * 桌面/竖屏模式居中显示
 *
 * 删除了：分数、生存时间、流派文字（避免信息过载）
 */

export class HUD {
  constructor() {
    this.score = 0;
    this.kills = 0;
    this.survivalTime = 0;
  }

  addScore(pts) { this.score += pts; }
  addKill() { this.kills += 1; }
  reset() { this.score = 0; this.kills = 0; this.survivalTime = 0; }

  /** 判断是否为横屏手机 */
  _isMobileLandscape(w, h) {
    return w > h * 1.1 && w <= 1024;
  }

  render(ctx, player, canvasW, canvasH) {
    const isLand = this._isMobileLandscape(canvasW, canvasH);

    if (isLand) {
      this._renderLandscape(ctx, player, canvasW, canvasH);
    } else {
      this._renderDesktop(ctx, player, canvasW, canvasH);
    }
    this._renderCrosshair(ctx, canvasW, canvasH);
  }

  // ── 桌面/竖屏 ──
  _renderDesktop(ctx, player, canvasW, canvasH) {
    // 血条：顶部居中
    this._drawHP(ctx, player, canvasW, (canvasW - 200) / 2, 20, 200, 16);
    // 等级+经验：血条下方
    this._drawLevel(ctx, player, (canvasW - 200) / 2, 42);
    // XP条
    this._drawXP(ctx, player, (canvasW - 200) / 2, 46, 200, 7);
    // 击杀：右上角
    this._drawKills(ctx, canvasW - 20, 28);
  }

  // ── 横屏手机 ──
  _renderLandscape(ctx, player, canvasW, canvasH) {
    // iOS Safari 顶部安全区预设
    const top = 16;
    const left = 14;
    const barW = Math.min(170, canvasW * 0.3);

    // 左上：血条
    this._drawHP(ctx, player, canvasW, left, top, barW, 14);
    // 等级+经验
    this._drawLevel(ctx, player, left, top + 17);
    this._drawXP(ctx, player, left, top + 21, barW, 6);

    // 右上：击杀（大字号）
    this._drawKills(ctx, canvasW - 16, top + 18);
  }

  // ── 绘制原语 ──

  _drawHP(ctx, player, canvasW, x, y, w, h) {
    // 背景
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    // 血量
    const ratio = player.hp / player.maxHp;
    const color = ratio > 0.5 ? '#2ecc71' : ratio > 0.25 ? '#f39c12' : '#e74c3c';
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * ratio, h);
    // 数值
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.ceil(player.hp)} / ${player.maxHp}`, x + w / 2, y + h - 3);
  }

  _drawLevel(ctx, player, x, y) {
    ctx.fillStyle = '#aaffcc';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Lv ${player.level}`, x, y);
  }

  _drawXP(ctx, player, x, y, w, h) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    const ratio = player.xpToNext > 0 ? player.xp / player.xpToNext : 0;
    ctx.fillStyle = '#00ff88';
    ctx.fillRect(x, y, w * ratio, h);
  }

  _drawKills(ctx, rightX, y) {
    // 击杀图标+数字，大字号
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px monospace';
    ctx.fillText(`💀${this.kills}`, rightX, y);
  }

  _renderCrosshair(ctx, canvasW, canvasH) {
    const cx = canvasW / 2, cy = canvasH / 2, size = 6;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - size, cy); ctx.lineTo(cx - size / 2, cy);
    ctx.moveTo(cx + size / 2, cy); ctx.lineTo(cx + size, cy);
    ctx.moveTo(cx, cy - size); ctx.lineTo(cx, cy - size / 2);
    ctx.moveTo(cx, cy + size / 2); ctx.lineTo(cx, cy + size);
    ctx.stroke();
  }
}
