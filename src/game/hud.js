/**
 * hud.js — HUD 渲染
 * 血量、分数、击杀数、等级/经验、生存时间、流派显示
 *
 * 横屏手机适配：
 * - 血条/经验条缩窄放左上角
 * - 分数/击杀放右上角
 * - 生存时间放右下角
 * - 所有 HUD 使用 safeAreaInsetTop 避开浏览器安全区
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

  /** 判断是否为横屏手机 —— 宽高比 > 1.3 且 宽度 <= 1024 */
  _isMobileLandscape(w, h) {
    return w > h * 1.1 && w <= 1024;
  }

  /** 获取顶部安全区高度（iOS safe-area, 或 CSS env） */
  _safeTop() {
    // 从 document.documentElement 的 CSS env(safe-area-inset-top) 获取
    // 无法在 canvas 内读取 CSS env，用 JS 估算
    // 如果 window.navigator.standalone (iOS PWA) 为 true，顶部安全区较大
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS && !window.navigator.standalone) {
      // Safari 浏览器下约 44px
      return 44;
    }
    return 20;
  }

  render(ctx, player, canvasW, canvasH) {
    const isLand = this._isMobileLandscape(canvasW, canvasH);

    if (isLand) {
      this._renderLandscape(ctx, player, canvasW, canvasH);
    } else {
      this._renderPortrait(ctx, player, canvasW, canvasH);
    }
    // 准星通用
    this._renderCrosshair(ctx, canvasW, canvasH);
  }

  // ── 竖屏/桌面端（原有布局，安全区微调） ──
  _renderPortrait(ctx, player, canvasW, canvasH) {
    this._renderHealthBar(ctx, player, canvasW, 20);
    this._renderXpBar(ctx, player, canvasW, 42);
    this._renderStats(ctx, player, canvasW);
    this._renderBuild(ctx, player, 20, 52);
    this._renderSurvivalTime(ctx, canvasW, canvasH);
  }

  // ── 横屏手机布局 ──
  _renderLandscape(ctx, player, canvasW, canvasH) {
    const safeTop = this._safeTop();
    // 左上区域：血条 + 经验条（缩窄 160px 宽）
    const barX = 16;
    const barW = Math.min(160, canvasW * 0.28);
    const hpBarH = 12;
    const xpBarH = 6;

    // 血条
    this._renderHealthBar(ctx, player, canvasW, safeTop, barX, barW, hpBarH);

    // 经验条 - 紧贴血条下方
    const xpY = safeTop + hpBarH + 4;
    this._renderXpBarAt(ctx, player, barX, xpY, barW, xpBarH);

    // 流派 - 血条上方
    this._renderBuild(ctx, player, barX, safeTop - 4);

    // 右上：分数 + 击杀
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'right';
    const rightX = canvasW - 12;
    ctx.fillText(`分数: ${this.score}`, rightX, safeTop + 14);
    ctx.fillText(`击杀: ${this.kills}`, rightX, safeTop + 32);

    // 右下：生存时间
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '14px monospace';
    ctx.textAlign = 'right';
    const min = Math.floor(this.survivalTime / 60);
    const sec = Math.floor(this.survivalTime % 60);
    ctx.fillText(`${min}:${sec.toString().padStart(2, '0')}`, rightX, canvasH - 16);
  }

  // ── 通用渲染原语 ──

  _renderHealthBar(ctx, player, canvasW, y, x, barW, barH) {
    if (x === undefined) {
      // 桌面/竖屏模式：居中
      barW = barW || 200;
      barH = barH || 16;
      x = (canvasW - barW) / 2;
    }
    const w = barW || 200;
    const h = barH || 16;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    const ratio = player.hp / player.maxHp;
    const color = ratio > 0.5 ? '#2ecc71' : ratio > 0.25 ? '#f39c12' : '#e74c3c';
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * ratio, h);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.ceil(player.hp)} / ${player.maxHp}`, x + w / 2, y + h - 3);
  }

  _renderXpBarAt(ctx, player, x, y, w, h) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    const ratio = player.xpToNext > 0 ? player.xp / player.xpToNext : 0;
    ctx.fillStyle = '#00ff88';
    ctx.fillRect(x, y, w * ratio, h);
    ctx.fillStyle = '#aaffcc';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Lv ${player.level}`, x, y + h + 9);
  }

  _renderXpBar(ctx, player, canvasW, y) {
    y = y || 42;
    const barW = 200, barH = 8, x = (canvasW - barW) / 2;
    this._renderXpBarAt(ctx, player, x, y, barW, barH);
  }

  _renderStats(ctx, player, canvasW) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`分数: ${this.score}`, canvasW - 20, 30);
    ctx.fillText(`击杀: ${this.kills}`, canvasW - 20, 52);
  }

  _renderBuild(ctx, player, x, y) {
    if (!player.buildType) return;
    const buildNames = { blade: '🗡️飞剑', shotgun: '💥散弹', pierce: '🔱穿透' };
    const buildColors = { blade: '#ff69b4', shotgun: '#ff8c00', pierce: '#00bfff' };
    ctx.fillStyle = buildColors[player.buildType] || '#fff';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(buildNames[player.buildType] || '', x, y);
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
