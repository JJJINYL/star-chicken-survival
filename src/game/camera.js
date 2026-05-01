/**
 * camera.js — 相机（预留）
 * 目前是固定俯视视角，预留坐标变换接口
 * 未来可用 Camera.follow(player) 实现屏幕跟随
 */

export class Camera {
  constructor(width, height) {
    this.x = 0;
    this.y = 0;
    this.width = width;
    this.height = height;
  }

  /** 世界坐标 → 屏幕坐标 */
  worldToScreen(worldX, worldY) {
    return {
      x: worldX - this.x,
      y: worldY - this.y,
    };
  }

  /** 屏幕坐标 → 世界坐标 */
  screenToWorld(screenX, screenY) {
    return {
      x: screenX + this.x,
      y: screenY + this.y,
    };
  }

  /** 设置视口大小（resize 时调用） */
  setSize(width, height) {
    this.width = width;
    this.height = height;
  }

  /** 跟随目标（预留） */
  follow(target) {
    this.x = target.x - this.width / 2;
    this.y = target.y - this.height / 2;
  }
}
