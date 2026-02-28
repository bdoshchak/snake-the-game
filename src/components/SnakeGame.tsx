import React, { useEffect, useRef, useReducer } from 'react';
import { Undo, Redo, Play, Heart, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';

const PixelApple = () => (
  <svg width="48" height="48" viewBox="0 0 12 12" className="mb-4 opacity-80">
    <rect x="6" y="1" width="1" height="2" fill="#0f380f" />
    <rect x="7" y="1" width="2" height="1" fill="#0f380f" />
    <rect x="4" y="3" width="4" height="1" fill="#306230" />
    <rect x="3" y="4" width="6" height="1" fill="#306230" />
    <rect x="2" y="5" width="8" height="4" fill="#306230" />
    <rect x="3" y="9" width="6" height="1" fill="#306230" />
    <rect x="4" y="10" width="4" height="1" fill="#306230" />
  </svg>
);

// Sound Manager
class SoundManager {
  ctx: AudioContext | null = null;

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  play(type: 'move' | 'eat' | 'crash') {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.type = 'square';
    
    const now = this.ctx.currentTime;
    
    if (type === 'move') {
      osc.frequency.setValueAtTime(150, now);
      gain.gain.setValueAtTime(0.02, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'eat') {
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.setValueAtTime(600, now + 0.05);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'crash') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.3);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  }
}
const soundManager = new SoundManager();

type Point = { x: number; y: number };
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

const GRID_WIDTH = 20;
const GRID_HEIGHT = 20;
const INITIAL_SNAKE: Point[] = [
  { x: 10, y: 10 },
  { x: 10, y: 11 },
  { x: 10, y: 12 },
];
const INITIAL_DIRECTION: Direction = 'UP';
const INITIAL_TICK_RATE = 225;

type GameState = {
  snake: Point[];
  direction: Direction;
  nextDirection: Direction;
  food: Point;
  gameOver: boolean;
  isPaused: boolean;
  hasStarted: boolean;
  score: number;
  highScore: number;
  tickRate: number;
  countdown: number | 'Go!' | null;
  lives: number;
  foodType: 'apple' | 'heart';
  foodCount: number;
};

type GameAction =
  | { type: 'TICK' }
  | { type: 'CHANGE_DIRECTION'; payload: Direction }
  | { type: 'TURN_LEFT' }
  | { type: 'TURN_RIGHT' }
  | { type: 'TOGGLE_PLAY' }
  | { type: 'RESET' }
  | { type: 'DECREMENT_COUNTDOWN' }
  | { type: 'END_COUNTDOWN' };

const generateFood = (snake: Point[]): Point => {
  let newFoodPos;
  while (true) {
    newFoodPos = {
      x: Math.floor(Math.random() * GRID_WIDTH),
      y: Math.floor(Math.random() * GRID_HEIGHT),
    };
    if (!snake.some((s) => s.x === newFoodPos.x && s.y === newFoodPos.y)) {
      return newFoodPos;
    }
  }
};

// Reset high score in local storage explicitly
localStorage.removeItem('snakeHighScore');

const initialState: GameState = {
  snake: INITIAL_SNAKE,
  direction: INITIAL_DIRECTION,
  nextDirection: INITIAL_DIRECTION,
  food: { x: 5, y: 5 },
  gameOver: false,
  isPaused: false,
  hasStarted: false,
  score: 0,
  highScore: 0,
  tickRate: INITIAL_TICK_RATE,
  countdown: null,
  lives: 3,
  foodType: 'apple',
  foodCount: 0,
};

const gameReducer = (state: GameState, action: GameAction): GameState => {
  switch (action.type) {
    case 'DECREMENT_COUNTDOWN':
      if (typeof state.countdown === 'number') {
        return {
          ...state,
          countdown: state.countdown - 1 > 0 ? state.countdown - 1 : 'Go!',
        };
      }
      return state;
    case 'END_COUNTDOWN':
      return {
        ...state,
        countdown: null,
        hasStarted: true,
        isPaused: false,
      };
    case 'RESET':
      return {
        ...initialState,
        highScore: state.highScore,
        food: generateFood(INITIAL_SNAKE),
        hasStarted: false,
        countdown: null,
      };
    case 'TOGGLE_PLAY':
      soundManager.init();
      if (state.gameOver || !state.hasStarted) {
        if (state.countdown === null) {
          return {
            ...initialState,
            highScore: state.highScore,
            food: generateFood(INITIAL_SNAKE),
            countdown: 3,
            hasStarted: false,
          };
        }
        return state;
      } else {
        return { ...state, isPaused: !state.isPaused };
      }
    case 'CHANGE_DIRECTION': {
      const newDir = action.payload;
      const current = state.direction;
      if (
        (newDir === 'UP' && current === 'DOWN') ||
        (newDir === 'DOWN' && current === 'UP') ||
        (newDir === 'LEFT' && current === 'RIGHT') ||
        (newDir === 'RIGHT' && current === 'LEFT')
      ) {
        return state;
      }
      return { ...state, nextDirection: newDir };
    }
    case 'TURN_LEFT': {
      const current = state.nextDirection;
      let newDir: Direction = 'UP';
      if (current === 'UP') newDir = 'LEFT';
      if (current === 'LEFT') newDir = 'DOWN';
      if (current === 'DOWN') newDir = 'RIGHT';
      if (current === 'RIGHT') newDir = 'UP';
      return { ...state, nextDirection: newDir };
    }
    case 'TURN_RIGHT': {
      const current = state.nextDirection;
      let newDir: Direction = 'UP';
      if (current === 'UP') newDir = 'RIGHT';
      if (current === 'RIGHT') newDir = 'DOWN';
      if (current === 'DOWN') newDir = 'LEFT';
      if (current === 'LEFT') newDir = 'UP';
      return { ...state, nextDirection: newDir };
    }
    case 'TICK': {
      if (state.gameOver || state.isPaused || !state.hasStarted || state.countdown !== null) return state;

      const head = state.snake[0];
      const currentDir = state.nextDirection;
      const newHead = { ...head };

      if (currentDir === 'UP') newHead.y -= 1;
      if (currentDir === 'DOWN') newHead.y += 1;
      if (currentDir === 'LEFT') newHead.x -= 1;
      if (currentDir === 'RIGHT') newHead.x += 1;

      // Collisions
      if (
        newHead.x < 0 ||
        newHead.x >= GRID_WIDTH ||
        newHead.y < 0 ||
        newHead.y >= GRID_HEIGHT ||
        state.snake.some((s) => s.x === newHead.x && s.y === newHead.y)
      ) {
        soundManager.play('crash');
        const newHighScore = Math.max(state.score, state.highScore);
        localStorage.setItem('snakeHighScore', newHighScore.toString());
        
        if (state.lives > 1) {
          const newLength = Math.max(3, state.snake.length - 1);
          const resetSnake = Array.from({ length: newLength }, (_, i) => ({ x: 10, y: 10 + i }));
          const slowerTickRate = Math.min(INITIAL_TICK_RATE, state.tickRate * 1.1);
          
          return {
            ...state,
            lives: state.lives - 1,
            snake: resetSnake,
            direction: 'UP',
            nextDirection: 'UP',
            tickRate: slowerTickRate,
            countdown: 3,
            highScore: newHighScore,
          };
        }

        return {
          ...state,
          lives: 0,
          gameOver: true,
          highScore: newHighScore,
          direction: currentDir,
        };
      }

      const newSnake = [newHead, ...state.snake];
      let newScore = state.score;
      let newFood = state.food;
      let newLives = state.lives;
      let newFoodCount = state.foodCount;
      let newFoodType = state.foodType;
      let newTickRate = state.tickRate;

      if (newHead.x === state.food.x && newHead.y === state.food.y) {
        if (state.foodType === 'heart') {
          soundManager.play('eat');
          newLives = Math.min(5, state.lives + 1);
          newScore += 1;
        } else {
          soundManager.play('eat');
          newScore += 1;
        }
        newFoodCount += 1;
        newFoodType = (newFoodCount + 1) % 10 === 0 ? 'heart' : 'apple';
        newFood = generateFood(newSnake);
        newTickRate = Math.max(50, state.tickRate * 0.975);
      } else {
        soundManager.play('move');
        newSnake.pop();
      }

      return {
        ...state,
        snake: newSnake,
        direction: currentDir,
        score: newScore,
        food: newFood,
        lives: newLives,
        foodCount: newFoodCount,
        foodType: newFoodType,
        tickRate: newTickRate,
      };
    }
    default:
      return state;
  }
};

export default function SnakeGame() {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Countdown Loop
  useEffect(() => {
    if (state.countdown !== null) {
      if (state.countdown === 'Go!') {
        const timer = setTimeout(() => {
          dispatch({ type: 'END_COUNTDOWN' });
        }, 1000);
        return () => clearTimeout(timer);
      } else if (typeof state.countdown === 'number' && state.countdown > 0) {
        const timer = setTimeout(() => {
          dispatch({ type: 'DECREMENT_COUNTDOWN' });
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [state.countdown]);

  // Game Loop
  useEffect(() => {
    if (state.isPaused || !state.hasStarted || state.gameOver || state.countdown !== null) return;

    const interval = setInterval(() => {
      dispatch({ type: 'TICK' });
    }, state.tickRate);
    
    return () => clearInterval(interval);
  }, [state.tickRate, state.isPaused, state.hasStarted, state.gameOver, state.countdown]);

  // Keyboard Controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)
      ) {
        e.preventDefault();
      }
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          dispatch({ type: 'CHANGE_DIRECTION', payload: 'UP' });
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          dispatch({ type: 'CHANGE_DIRECTION', payload: 'DOWN' });
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          dispatch({ type: 'CHANGE_DIRECTION', payload: 'LEFT' });
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          dispatch({ type: 'CHANGE_DIRECTION', payload: 'RIGHT' });
          break;
        case 'Escape':
          dispatch({ type: 'RESET' });
          break;
        case ' ':
          dispatch({ type: 'TOGGLE_PLAY' });
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear background
    ctx.fillStyle = '#9bbc0f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cellW = canvas.width / GRID_WIDTH;
    const cellH = canvas.height / GRID_HEIGHT;

    // Draw food
    if (state.foodType === 'heart') {
      ctx.fillStyle = '#0f380f';
      const cx = state.food.x * cellW;
      const cy = state.food.y * cellH;
      const px = cellW / 8;
      const py = cellH / 8;
      const heartPixels = [
        [0,1,1,0,0,1,1,0],
        [1,1,1,1,1,1,1,1],
        [1,1,1,1,1,1,1,1],
        [1,1,1,1,1,1,1,1],
        [0,1,1,1,1,1,1,0],
        [0,0,1,1,1,1,0,0],
        [0,0,0,1,1,0,0,0],
        [0,0,0,0,0,0,0,0],
      ];
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          if (heartPixels[r][c]) {
            ctx.fillRect(cx + c * px, cy + r * py, px, py);
          }
        }
      }
    } else {
      ctx.fillStyle = '#306230';
      ctx.beginPath();
      ctx.arc(
        state.food.x * cellW + cellW / 2,
        state.food.y * cellH + cellH / 2,
        cellW / 2 - 2,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    // Draw snake
    state.snake.forEach((segment, index) => {
      ctx.fillStyle = '#0f380f';
      ctx.fillRect(segment.x * cellW, segment.y * cellH, cellW, cellH);

      // Inner detail for segments
      ctx.fillStyle = '#9bbc0f';
      ctx.fillRect(
        segment.x * cellW + 2,
        segment.y * cellH + 2,
        cellW - 4,
        cellH - 4
      );
      ctx.fillStyle = '#0f380f';
      ctx.fillRect(
        segment.x * cellW + 4,
        segment.y * cellH + 4,
        cellW - 8,
        cellH - 8
      );

      // If head, draw eyes
      if (index === 0) {
        ctx.fillStyle = '#9bbc0f';
        const dir = state.direction;
        const eyeSize = 3;
        if (dir === 'UP' || dir === 'DOWN') {
          ctx.fillRect(
            segment.x * cellW + 3,
            segment.y * cellH + 6,
            eyeSize,
            eyeSize
          );
          ctx.fillRect(
            segment.x * cellW + cellW - 3 - eyeSize,
            segment.y * cellH + 6,
            eyeSize,
            eyeSize
          );
        } else {
          ctx.fillRect(
            segment.x * cellW + 6,
            segment.y * cellH + 3,
            eyeSize,
            eyeSize
          );
          ctx.fillRect(
            segment.x * cellW + 6,
            segment.y * cellH + cellH - 3 - eyeSize,
            eyeSize,
            eyeSize
          );
        }
      }
    });
  }, [state.snake, state.food, state.direction]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] bg-[#e5e5e5] dark:bg-[#2c2c2c] sm:bg-neutral-900 sm:dark:bg-black font-mono text-gb-darkest selection:bg-gb-light sm:p-4">
      {/* Device Body */}
      <div className="bg-[#e5e5e5] dark:bg-[#2c2c2c] p-4 rounded-none sm:rounded-[32px] shadow-none sm:shadow-2xl border-0 sm:border border-neutral-300 dark:border-neutral-700 w-full h-[100dvh] sm:h-auto sm:max-w-[360px] relative pb-6 flex flex-col justify-between">
        {/* Screen Bezel */}
        <div className="bg-[#1a1a1a] p-3 sm:p-4 rounded-[16px] shadow-inner relative mb-2 sm:mb-4">
          {/* Logo */}
          <div className="flex justify-center mb-2 px-1">
            <img src="logo.svg" alt="Snake" className="h-3 sm:h-3.5" />
          </div>

          {/* Canvas Container */}
          <div className="relative bg-gb-lightest rounded-[8px] border-2 border-neutral-900 overflow-hidden aspect-square shadow-inner flex flex-col">
            {/* Top stats on screen */}
            <div className="flex justify-between items-center text-gb-darkest text-[11px] sm:text-xs px-2 py-1.5 font-bold tracking-widest uppercase border-b border-gb-dark/20 z-10 shrink-0">
              <span className="flex-1">Score: {state.score}</span>
              <span className="flex gap-0.5 justify-center flex-1">
                {[...Array(5)].map((_, i) => (
                  <Heart key={i} size={12} className={i < state.lives ? "fill-gb-darkest text-gb-darkest" : "opacity-20 text-gb-darkest"} />
                ))}
              </span>
              <span className="flex-1 text-right">Top: {state.highScore}</span>
            </div>
            
            <div className="relative flex-1 w-full">
              <canvas
                ref={canvasRef}
                width={400}
                height={370}
                className="absolute inset-0 w-full h-full block"
              />
              {/* Overlays */}
              {!state.hasStarted && !state.gameOver && state.countdown === null && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gb-lightest/90 z-20 p-4 text-center">
                  <PixelApple />
                  <div className="text-gb-darkest mb-4 font-bold">
                    <p className="text-xs leading-tight mb-1.5">Use arrow keys to make a turn</p>
                    <p className="text-xs leading-tight mb-1.5">Space to play/pause</p>
                    <p className="text-xs leading-tight">Esc to reset</p>
                  </div>
                  <div className="animate-pulse">
                    <p className="text-sm font-bold flex items-center justify-center gap-1 text-gb-darkest">
                      Press <Play size={14} className="fill-current" /> to start
                    </p>
                  </div>
                </div>
              )}
              
              {state.countdown !== null && (
                <div className="absolute inset-0 flex items-center justify-center bg-gb-lightest/90 z-20">
                  <div className="text-center">
                    <p key={state.countdown} className="text-6xl font-bold animate-pop text-gb-darkest">
                      {state.countdown}
                    </p>
                  </div>
                </div>
              )}

              {state.gameOver && (
                <div className="absolute inset-0 flex items-center justify-center bg-gb-lightest/90 z-20">
                  <div className="text-center text-gb-darkest">
                    <p className="text-2xl font-extrabold mb-2">GAME OVER</p>
                    <p className="text-base font-bold mb-4">Score: {state.score}</p>
                    <p className="text-sm font-bold flex items-center justify-center gap-1 animate-pulse">
                      Press <Play size={14} className="fill-current" /> to start again
                    </p>
                  </div>
                </div>
              )}
              {state.isPaused && state.hasStarted && !state.gameOver && (
                <div className="absolute inset-0 flex items-center justify-center bg-gb-lightest/90 z-20">
                  <p className="text-2xl font-bold animate-pulse text-gb-darkest">PAUSED</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* LED */}
        <div className="flex justify-center mb-auto sm:mb-3">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_4px_#22c55e]"></div>
        </div>

        {/* Controls Section */}
        <div className="flex flex-col gap-2 px-4 sm:px-6 mb-4 mt-auto">
          {/* Top row: D-pad and Action Buttons */}
          <div className="grid grid-cols-2 gap-4 sm:gap-8 w-full">
            {/* D-pad Container */}
            <div className="flex items-center justify-center relative aspect-square">
              {/* D-pad */}
              <div className="relative w-28 h-28 shrink-0">
                {/* Vertical bar */}
                <div className="absolute left-[33.33%] top-0 w-[33.33%] h-full bg-[#222] dark:bg-[#111] rounded-sm shadow-[inset_0_2px_0_rgba(255,255,255,0.1),0_4px_6px_rgba(0,0,0,0.3)] flex flex-col justify-between items-center py-1">
                  <ChevronUp size={16} className="text-neutral-600 dark:text-neutral-700" />
                  <ChevronDown size={16} className="text-neutral-600 dark:text-neutral-700" />
                </div>
                {/* Horizontal bar */}
                <div className="absolute top-[33.33%] left-0 w-full h-[33.33%] bg-[#222] dark:bg-[#111] rounded-sm shadow-[inset_0_2px_0_rgba(255,255,255,0.1),0_4px_6px_rgba(0,0,0,0.3)] flex justify-between items-center px-1">
                  <ChevronLeft size={16} className="text-neutral-600 dark:text-neutral-700" />
                  <ChevronRight size={16} className="text-neutral-600 dark:text-neutral-700" />
                </div>
                {/* Center circle */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 bg-[#1a1a1a] dark:bg-black rounded-full shadow-inner z-10"></div>
                
                {/* Invisible clickable areas */}
                <button onClick={() => dispatch({ type: 'CHANGE_DIRECTION', payload: 'UP' })} className="absolute top-0 left-1/3 w-1/3 h-1/3 z-20 active:bg-white/10 rounded-t-sm"></button>
                <button onClick={() => dispatch({ type: 'CHANGE_DIRECTION', payload: 'DOWN' })} className="absolute bottom-0 left-1/3 w-1/3 h-1/3 z-20 active:bg-white/10 rounded-b-sm"></button>
                <button onClick={() => dispatch({ type: 'CHANGE_DIRECTION', payload: 'LEFT' })} className="absolute top-1/3 left-0 w-1/3 h-1/3 z-20 active:bg-white/10 rounded-l-sm"></button>
                <button onClick={() => dispatch({ type: 'CHANGE_DIRECTION', payload: 'RIGHT' })} className="absolute top-1/3 right-0 w-1/3 h-1/3 z-20 active:bg-white/10 rounded-r-sm"></button>
              </div>
            </div>

            {/* Action Buttons (A/B) */}
            <div className="flex items-center justify-center">
              <div className="relative w-28 h-28 shrink-0">
                <div className="absolute -bottom-1 -left-1 sm:-bottom-2 sm:-left-2 flex flex-col items-center">
                  <button
                    onClick={() => dispatch({ type: 'TURN_LEFT' })}
                    className="w-14 h-14 bg-[#900048] dark:bg-[#a00050] text-neutral-200 rounded-full shadow-[inset_0_2px_0_rgba(255,255,255,0.3),inset_0_-3px_0_rgba(0,0,0,0.5),0_4px_4px_rgba(0,0,0,0.4)] active:shadow-[inset_0_1px_0_rgba(255,255,255,0.3),inset_0_-1px_0_rgba(0,0,0,0.5),0_1px_2px_rgba(0,0,0,0.4)] active:translate-y-1 transition-all flex items-center justify-center"
                  >
                    <Undo size={24} />
                  </button>
                  <span className="text-xs font-extrabold text-neutral-500 dark:text-neutral-400 mt-2 tracking-tighter">B</span>
                </div>
                <div className="absolute top-0 right-0 flex flex-col items-center">
                  <button
                    onClick={() => dispatch({ type: 'TURN_RIGHT' })}
                    className="w-14 h-14 bg-[#900048] dark:bg-[#a00050] text-neutral-200 rounded-full shadow-[inset_0_2px_0_rgba(255,255,255,0.3),inset_0_-3px_0_rgba(0,0,0,0.5),0_4px_4px_rgba(0,0,0,0.4)] active:shadow-[inset_0_1px_0_rgba(255,255,255,0.3),inset_0_-1px_0_rgba(0,0,0,0.5),0_1px_2px_rgba(0,0,0,0.4)] active:translate-y-1 transition-all flex items-center justify-center"
                  >
                    <Redo size={24} />
                  </button>
                  <span className="text-xs font-extrabold text-neutral-500 dark:text-neutral-400 mt-2 tracking-tighter">A</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom row: Select and Start */}
          <div className="flex justify-center gap-6 mt-4">
            <div className="flex flex-col items-center">
              <button
                onClick={() => dispatch({ type: 'RESET' })}
                className="w-14 h-5 bg-[#222] dark:bg-[#111] rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-2px_0_rgba(0,0,0,0.6),0_2px_3px_rgba(0,0,0,0.4)] active:shadow-[inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-1px_0_rgba(0,0,0,0.6),0_1px_1px_rgba(0,0,0,0.4)] active:translate-y-0.5 transition-all flex items-center justify-center"
              >
                <X size={12} className="text-neutral-400 dark:text-neutral-500 opacity-50 stroke-[3]" />
              </button>
              <span className="text-[10px] font-extrabold text-neutral-500 dark:text-neutral-400 mt-1.5 tracking-tighter uppercase">Reset</span>
            </div>
            <div className="flex flex-col items-center">
              <button
                onClick={() => dispatch({ type: 'TOGGLE_PLAY' })}
                className="w-14 h-5 bg-[#222] dark:bg-[#111] rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-2px_0_rgba(0,0,0,0.6),0_2px_3px_rgba(0,0,0,0.4)] active:shadow-[inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-1px_0_rgba(0,0,0,0.6),0_1px_1px_rgba(0,0,0,0.4)] active:translate-y-0.5 transition-all flex items-center justify-center"
              >
                <Play size={10} className="text-neutral-400 dark:text-neutral-500 fill-current opacity-50" />
              </button>
              <span className="text-[10px] font-extrabold text-neutral-500 dark:text-neutral-400 mt-1.5 tracking-tighter uppercase">Play/Pause</span>
            </div>
          </div>
        </div>

        {/* Speaker Grills */}
        <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 flex gap-1.5 transform -rotate-[35deg]">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="w-1 h-8 sm:w-1.5 sm:h-10 bg-neutral-300 dark:bg-neutral-600 rounded-full shadow-[inset_1px_1px_2px_rgba(0,0,0,0.2)]"></div>
          ))}
        </div>
      </div>
    </div>
  );
}
