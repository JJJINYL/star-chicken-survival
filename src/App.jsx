import { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from './game/engine.js';
import './App.css';

function App() {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const [gameOver, setGameOver] = useState(false);
  const [result, setResult] = useState(null);
  const [isLandscape, setIsLandscape] = useState(true);

  // ── 横竖屏检测 ──
  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      // 桌面端（宽 > 768px）永远显示游戏；手机端才判断横竖屏
      const mobile = w <= 768 || ('ontouchstart' in window);
      if (!mobile) {
        setIsLandscape(true);
      } else {
        setIsLandscape(w > h);
      }
    };
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', () => setTimeout(check, 200));
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  // ── 初始化引擎 ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // devicePixelRatio 高清适配
    const dpr = window.devicePixelRatio || 1;
    const logicalW = window.innerWidth;
    const logicalH = window.innerHeight;

    // canvas 物理像素尺寸
    canvas.width = logicalW * dpr;
    canvas.height = logicalH * dpr;
    // canvas CSS 尺寸 = 逻辑尺寸（填满屏幕）
    canvas.style.width = logicalW + 'px';
    canvas.style.height = logicalH + 'px';

    // scale 上下文，让所有绘图操作以逻辑坐标进行
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const engine = new GameEngine(canvas, logicalW, logicalH);
    engineRef.current = engine;

    // resize handler
    const resize = () => {
      const newW = window.innerWidth;
      const newH = window.innerHeight;
      const newDpr = window.devicePixelRatio || 1;

      canvas.width = newW * newDpr;
      canvas.height = newH * newDpr;
      canvas.style.width = newW + 'px';
      canvas.style.height = newH + 'px';

      // 重置 scale（因为 canvas.width 变化会重置变换矩阵）
      const c = canvas.getContext('2d');
      c.setTransform(newDpr, 0, 0, newDpr, 0, 0);

      if (engineRef.current) {
        engineRef.current.resize(newW, newH);
      }
    };
    window.addEventListener('resize', resize);

    // 点击升级卡片（鼠标）
    const handleCanvasClick = (e) => {
      engine.handleClick(e.clientX, e.clientY);
    };
    canvas.addEventListener('click', handleCanvasClick);

    // 触摸点击升级卡片
    const handleTouchForCard = (e) => {
      if (!engine.showingChoice) return;
      for (const touch of e.changedTouches) {
        engine.handleClick(touch.clientX, touch.clientY);
      }
    };
    canvas.addEventListener('touchstart', handleTouchForCard, { passive: true });

    // 全局禁止双指缩放
    document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
    document.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
    document.addEventListener('gestureend', (e) => e.preventDefault(), { passive: false });

    engine.start();

    return () => {
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('click', handleCanvasClick);
      canvas.removeEventListener('touchstart', handleTouchForCard);
      engine.stop();
    };
  }, []);

  // 轮询引擎状态
  useEffect(() => {
    const interval = setInterval(() => {
      const engine = engineRef.current;
      if (!engine) return;
      if (!engine.player.alive && !gameOver) {
        setResult(engine.getGameOverState());
        setGameOver(true);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [gameOver]);

  const handleRestart = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.reset();
    setGameOver(false);
    setResult(null);
  }, []);

  return (
    <div className="game-container">
      <canvas ref={canvasRef} className="game-canvas" />
      {!isLandscape && (
        <div className="rotate-hint">
          <div className="rotate-icon">📱</div>
          <div className="rotate-text">请横屏游玩</div>
          <div className="rotate-sub">Rotate your device</div>
        </div>
      )}
      {gameOver && (
        <div className="game-overlay">
          <button className="restart-btn" onClick={handleRestart}>
            重新开始
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
