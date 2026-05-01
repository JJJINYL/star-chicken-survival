/**
 * collision.js — 碰撞检测
 * 分离碰撞逻辑，方便后续上 spatial hash / 网络同步
 */

export class CollisionSystem {
  /**
   * 检测子弹与敌人的碰撞
   * @returns {{ bullet, enemy }[]} 碰撞对
   */
  checkBulletEnemy(bullets, enemies) {
    const hits = [];
    for (const b of bullets) {
      if (!b.alive) continue;
      for (const e of enemies) {
        if (!e.alive) continue;
        if (b.distanceTo(e) < b.radius + e.radius) {
          hits.push({ bullet: b, enemy: e });
        }
      }
    }
    return hits;
  }

  /**
   * 检测玩家与敌人的碰撞
   * @returns {enemy[]} 碰到的敌人列表
   */
  checkPlayerEnemy(player, enemies) {
    const hits = [];
    for (const e of enemies) {
      if (!e.alive) continue;
      if (player.distanceTo(e) < player.radius + e.radius) {
        hits.push(e);
      }
    }
    return hits;
  }

  /**
   * 检测敌人子弹与玩家的碰撞
   * @returns {EnemyBullet[]} 击中的子弹
   */
  checkEnemyBulletPlayer(player, enemyBullets) {
    const hits = [];
    for (const b of enemyBullets) {
      if (!b.alive) continue;
      if (player.distanceTo(b) < player.radius + b.radius) {
        hits.push(b);
      }
    }
    return hits;
  }

  /**
   * 检测环绕飞剑与敌人的碰撞
   * @returns {{ blade, enemy }[]} 碰撞对
   */
  checkBladeEnemy(blades, enemies) {
    const hits = [];
    for (const blade of blades) {
      if (!blade.alive) continue;
      for (const e of enemies) {
        if (!e.alive) continue;
        if (blade.distanceTo(e) < blade.radius + e.radius) {
          hits.push({ blade, enemy: e });
        }
      }
    }
    return hits;
  }
}
