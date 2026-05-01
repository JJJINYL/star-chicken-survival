/**
 * input.js — 输入管理
 * 统一管理键盘、鼠标和触摸（虚拟摇杆）状态
 * 触摸：手指在屏幕左下半区拖拽 = 移动方向，自动射击已内置在 player.js 中
 * 升级面板选择通过 touchstart 事件处理
 */

export class InputManager {
  constructor(canvas) {
    this.keys = {};
    this.mouse = { x: 0, y: 0, down: false };

    // ── 触摸状态 ──
    this._touchId = null;           // 跟踪移动手指的 identifier
    this._touchStartX = 0;          // 触摸起始 x
    this._touchStartY = 0;          // 触摸起始 y
    this._touchCurrentX = 0;        // 当前 x
    this._touchCurrentY = 0;        // 当前 y
    this._touchActive = false;      // 是否有有效触摸移动
    this._touchingCard = false;     // 用于点击升级卡片

    // 摇杆显示参数
    this._joystickCenterX = 0;
    this._joystickCenterY = 0;
    this._joystickKnobX = 0;
    this._joystickKnobY = 0;
    this._joystickActive = false;
    this.JOYSTICK_RADIUS = 60;      // 摇杆基底半径

    // ── 绑定事件 ──
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onContextMenu = (e) => e.preventDefault();
    this._onTouchStart = this._onTouchStart.bind(this);
    this._onTouchMove = this._onTouchMove.bind(this);
    this._onTouchEnd = this._onTouchEnd.bind(this);
    this._onTouchCancel = this._onTouchCancel.bind(this);
    this._canvas = canvas;
  }

  attach() {
    const c = this._canvas;
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    c.addEventListener('mousemove', this._onMouseMove);
    c.addEventListener('mousedown', this._onMouseDown);
    c.addEventListener('mouseup', this._onMouseUp);
    c.addEventListener('contextmenu', this._onContextMenu);

    // 触摸事件 (passive: false 允许 preventDefault 禁止缩放滚动)
    c.addEventListener('touchstart', this._onTouchStart, { passive: false });
    c.addEventListener('touchmove', this._onTouchMove, { passive: false });
    c.addEventListener('touchend', this._onTouchEnd, { passive: false });
    c.addEventListener('touchcancel', this._onTouchCancel, { passive: false });
  }

  detach() {
    const c = this._canvas;
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    c.removeEventListener('mousemove', this._onMouseMove);
    c.removeEventListener('mousedown', this._onMouseDown);
    c.removeEventListener('mouseup', this._onMouseUp);
    c.removeEventListener('contextmenu', this._onContextMenu);
    c.removeEventListener('touchstart', this._onTouchStart);
    c.removeEventListener('touchmove', this._onTouchMove);
    c.removeEventListener('touchend', this._onTouchEnd);
    c.removeEventListener('touchcancel', this._onTouchCancel);
    this._touchActive = false;
    this._touchId = null;
    this._joystickActive = false;
  }

  _onKeyDown(e) {
    this.keys[e.code] = true;
  }

  _onKeyUp(e) {
    this.keys[e.code] = false;
  }

  _onMouseMove(e) {
    const rect = this._canvas.getBoundingClientRect();
    this.mouse.x = e.clientX - rect.left;
    this.mouse.y = e.clientY - rect.top;
  }

  _onMouseDown(e) {
    if (e.button === 0) this.mouse.down = true;
  }

  _onMouseUp(e) {
    if (e.button === 0) this.mouse.down = false;
  }

  // ── 触摸事件处理 ──

  /** 获取 canvas 上的触摸坐标（相对于 canvas） */
  _getTouchPos(touch) {
    const rect = this._canvas.getBoundingClientRect();
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    };
  }

  /**
   * 判断触摸位置是否位于屏幕左下半区的摇杆区
   * 左半屏 + 下半屏 = 左下象限
   */
  _isInJoystickArea(clientX, clientY) {
    const rect = this._canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const w = rect.width;
    const h = rect.height;
    // 左下半屏区域
    return x < w * 0.5 && y > h * 0.35;
  }

  _onTouchStart(e) {
    e.preventDefault();
    if (this._touchActive && this._touchId !== null) return; // 已经有一个主动摇杆了

    for (const touch of e.changedTouches) {
      const pos = this._getTouchPos(touch);
      const inJoystick = this._isInJoystickArea(touch.clientX, touch.clientY);

      if (inJoystick && !this._touchActive) {
        // 新的摇杆触摸
        this._touchId = touch.identifier;
        this._touchStartX = pos.x;
        this._touchStartY = pos.y;
        this._touchCurrentX = pos.x;
        this._touchCurrentY = pos.y;
        this._touchActive = true;
        this._joystickActive = true;
        this._joystickCenterX = pos.x;
        this._joystickCenterY = pos.y;
        this._joystickKnobX = pos.x;
        this._joystickKnobY = pos.y;
        return;
      }
    }
  }

  _onTouchMove(e) {
    e.preventDefault();
    for (const touch of e.changedTouches) {
      if (touch.identifier === this._touchId) {
        const pos = this._getTouchPos(touch);
        this._touchCurrentX = pos.x;
        this._touchCurrentY = pos.y;

        // 计算摇杆偏移并限制在摇杆半径内
        const dx = pos.x - this._touchStartX;
        const dy = pos.y - this._touchStartY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = this.JOYSTICK_RADIUS;
        if (dist > maxDist) {
          this._joystickKnobX = this._touchStartX + (dx / dist) * maxDist;
          this._joystickKnobY = this._touchStartY + (dy / dist) * maxDist;
        } else {
          this._joystickKnobX = pos.x;
          this._joystickKnobY = pos.y;
        }
        return;
      }
    }
  }

  _onTouchEnd(e) {
    e.preventDefault();
    for (const touch of e.changedTouches) {
      if (touch.identifier === this._touchId) {
        this._touchActive = false;
        this._touchId = null;
        this._joystickActive = false;
        return;
      }
    }
  }

  _onTouchCancel(e) {
    e.preventDefault();
    this._touchActive = false;
    this._touchId = null;
    this._joystickActive = false;
  }

  // ── 外部接口 ──

  /** WASD 方向向量（键盘优先） */
  get moveDir() {
    // 键盘方向
    let dx = 0, dy = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) dy -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) dy += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) dx -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) dx += 1;
    const keyLen = Math.sqrt(dx * dx + dy * dy);
    if (keyLen > 0) {
      return { x: dx / keyLen, y: dy / keyLen };
    }

    // 触摸方向（如果触摸激活）
    if (this._touchActive) {
      const tdx = this._touchCurrentX - this._touchStartX;
      const tdy = this._touchCurrentY - this._touchStartY;
      const dist = Math.sqrt(tdx * tdx + tdy * tdy);
      const deadZone = 8; // 死区，防止手指微动触发
      if (dist > deadZone) {
        return { x: tdx / dist, y: tdy / dist };
      }
    }

    return { x: 0, y: 0 };
  }

  /** 鼠标相对于 canvas 中心的方向向量（触摸时返回(0,0)，因为自动瞄准会用） */
  get aimDir() {
    const cx = this._canvas.width / 2;
    const cy = this._canvas.height / 2;
    let dx = this.mouse.x - cx;
    let dy = this.mouse.y - cy;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
      dx /= len;
      dy /= len;
    }
    return { x: dx, y: dy };
  }

  /** 判断这次触摸点击是否要视为升级面板点击 */
  checkTouchCardTap(touch) {
    const pos = this._getTouchPos(touch);
    // 只用于外部调用判断——实际由 engine.handleClick 处理
    return pos;
  }

  /**
   * 渲染虚拟摇杆
   * 由 engine 在 _render 中调用（仅触摸设备）
   */
  renderJoystick(ctx) {
    if (!this._joystickActive) return;

    const cx = this._joystickCenterX;
    const cy = this._joystickCenterY;
    const r = this.JOYSTICK_RADIUS;

    // 摇杆基底（半透明圆圈）
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 摇杆圆点
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(this._joystickKnobX, this._joystickKnobY, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(this._joystickKnobX, this._joystickKnobY, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
