/**
 * hud.js — HUD 渲染
 * 血量、分数、击杀数、等级/经验、生存时间、流派显示
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

  render(ctx, player, canvasW, canvasH) {
    this._renderHealthBar(ctx, player, canvasW);
    this._renderXpBar(ctx, player, canvasW);
    this._renderStats(ctx, player, canvasW);
    this._renderBuild(ctx, player, canvasW);
    this._renderSurvivalTime(ctx, canvasW, canvasH);
    this._renderCrosshair(ctx, canvasW, canvasH);
  }

  /** 设置爆发波和围剿状态供HUD显示 */

  _renderHealthBar(ctx, player, canvasW) {
    const barW = 200, barH = 16, x = (canvasW - barW) / 2, y = 20;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x - 2, y - 2, barW + 4, barH + 4);
    const ratio = player.hp / player.maxHp;
    const color = ratio > 0.5 ? '#2ecc71' : ratio > 0.25 ? '#f39c12' : '#e74c3c';
    ctx.fillStyle = color;
    ctx.fillRect(x, y, barW * ratio, barH);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.ceil(player.hp)} / ${player.maxHp}`, canvasW / 2, y + 13);
  }

  _renderXpBar(ctx, player, canvasW) {
    const barW = 200, barH = 8, x = (canvasW - barW) / 2, y = 42;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x - 1, y - 1, barW + 2, barH + 2);
    const ratio = player.xpToNext > 0 ? player.xp / player.xpToNext : 0;
    ctx.fillStyle = '#00ff88';
    ctx.fillRect(x, y, barW * ratio, barH);
    ctx.fillStyle = '#aaffcc';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Lv ${player.level}`, x - 10, y + barH);
  }

  _renderStats(ctx, player, canvasW) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`分数: ${this.score}`, canvasW - 20, 30);
    ctx.fillText(`击杀: ${this.kills}`, canvasW - 20, 52);
  }

  _renderBuild(ctx, player, canvasW) {
    if (!player.buildType) return;
    const buildNames = { blade: '🗡️飞剑', shotgun: '💥散弹', pierce: '🔱穿透' };
    const buildColors = { blade: '#ff69b4', shotgun: '#ff8c00', pierce: '#00bfff' };
    ctx.fillStyle = buildColors[player.buildType] || '#fff';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(buildNames[player.buildType] || '', 20, 52);
  }

  _renderSurvivalTime(ctx, canvasW, canvasH) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    const min = Math.floor(this.survivalTime / 60);
    const sec = Math.floor(this.survivalTime % 60);
    ctx.fillText(`${min}:${sec.toString().padStart(2, '0')}`, canvasW / 2, canvasH - 20);
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
