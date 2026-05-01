import { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from './game/engine.js';
import './App.css';

function App() {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const [gameOver, setGameOver] = useState(false);
  const [result, setResult] = useState(null);

  // 初始化引擎
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 设置 canvas 尺寸为窗口大小
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      if (engineRef.current) {
        engineRef.current.resize(canvas.width, canvas.height);
      }
    };
    resize();
    window.addEventListener('resize', resize);

    const engine = new GameEngine(canvas);
    engineRef.current = engine;

    // 点击升级卡片（鼠标）
    const handleCanvasClick = (e) => {
      engine.handleClick(e.clientX, e.clientY);
    };
    canvas.addEventListener('click', handleCanvasClick);

    // 触摸点击升级卡片（touchstart）
    const handleTouchForCard = (e) => {
      if (!engine.showingChoice) return;
      // 只处理单指点击卡片的情况
      for (const touch of e.changedTouches) {
        engine.handleClick(touch.clientX, touch.clientY);
      }
    };
    canvas.addEventListener('touchstart', handleTouchForCard, { passive: true });

    // 全局禁止双指缩放（touchmove preventDefault 由 input.js 负责）
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
