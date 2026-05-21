"use client";

import { useEffect, useRef } from "react";
import { changeGameStatus, createGame } from "@/service/api";

type Rect = { x: number; y: number; w: number; h: number };
type BallState = { fx: number; fy: number; vx: number; vy: number };

const BORDER = 6;
const GRAVITY = 1200;
const FRICTION = 0.95;
const MAX_V = 600;

export const START = { x: 0.08, y: 0.13 };
export const GOAL = { x: 0.58, y: 0.8655 };

export const ballR = (W: number) => W * 0.024;
export const goalR = (W: number) => W * 0.038;

// 6×4 grid maze (cell width=0.153 of W, cell height=0.23 of H)
// x/w are fractions of canvas W; y/h are fractions of canvas H
export const WALLS: Rect[] = [
  // horizontal walls (h = 0.028)
  { x: 0.009, y: 0.256, w: 0.306, h: 0.028 },
  { x: 0.658, y: 0.263, w: 0.153, h: 0.028 },
  { x: 0.35159, y: 0.477, w: 0.153, h: 0.028 },
  { x: 0.838, y: 0.486, w: 0.153, h: 0.028 },
  { x: 0.199, y: 0.707, w: 0.153, h: 0.028 },
  { x: 0.493, y: 0.723, w: 0.306, h: 0.028 },

  // vertical walls (w = 0.012)
  { x: 0.187, y: 0.2835, w: 0.013, h: 0.23 },
  { x: 0.34, y: 0.477, w: 0.012, h: 0.23 },
  { x: 0.493, y: 0.017, w: 0.012, h: 0.46 },
  { x: 0.493, y: 0.751, w: 0.012, h: 0.23 },
  { x: 0.646, y: 0.263, w: 0.012, h: 0.46 },
];

type Spike = { x: number; y: number; dir: "N" | "S" | "E" | "W"; phase: number };

const SPIKES: Spike[] = [
  { x: 0.24, y: 0.284, dir: "S", phase: 0 },
  { x: 0.428, y: 0.505, dir: "S", phase: 0 },
  { x: 0.505, y: 0.24, dir: "E", phase: 0 },
  { x: 0.658, y: 0.49, dir: "E", phase: 0 },
  { x: 0.493, y: 0.85, dir: "W", phase: 1.5 },
  { x: 0.34, y: 0.6, dir: "W", phase: 1.5 },
  { x: 0.8695, y: 0.515, dir: "S", phase: 1.5 },
  { x: 0.779, y: 0.263, dir: "N", phase: 1.5 },
];

function drawSpike(ctx: CanvasRenderingContext2D, spike: Spike, W: number, H: number, t: number) {
  const cx = spike.x * W,
    cy = spike.y * H;
  //cycle: 0.3s shoot out → 2s hold → 1s slow retract → 2.7s retracted
  const t0 = (((t + spike.phase) % 6) + 6) % 6;
  const extend = t0 < 0.3 ? t0 / 0.3 : t0 < 2.3 ? 1 : t0 < 3.3 ? 1 - (t0 - 2.3) : 0;
  const base = W * 0.009;

  const len = W * 0.055 * Math.max(0.04, extend);
  ctx.fillStyle = "#c0c8d0";
  ctx.strokeStyle = "#50585e";
  ctx.lineWidth = 1;
  for (let i = -1; i <= 1; i++) {
    const off = i * base * 2.5;
    ctx.beginPath();
    if (spike.dir === "S") {
      ctx.moveTo(cx + off - base, cy);
      ctx.lineTo(cx + off + base, cy);
      ctx.lineTo(cx + off, cy + len);
    } else if (spike.dir === "N") {
      ctx.moveTo(cx + off - base, cy);
      ctx.lineTo(cx + off + base, cy);
      ctx.lineTo(cx + off, cy - len);
    } else if (spike.dir === "E") {
      ctx.moveTo(cx, cy + off - base);
      ctx.lineTo(cx, cy + off + base);
      ctx.lineTo(cx + len, cy + off);
    } else {
      ctx.moveTo(cx, cy + off - base);
      ctx.lineTo(cx, cy + off + base);
      ctx.lineTo(cx - len, cy + off);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

function drawBoard(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#d4a055");
  g.addColorStop(0.25, "#c49040");
  g.addColorStop(0.5, "#d8aa60");
  g.addColorStop(0.75, "#be8c3a");
  g.addColorStop(1, "#cfa050");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  for (let i = 0; i < 32; i++) {
    const x = (i / 32) * W * 1.3 - W * 0.15;
    const w0 = Math.sin(i * 1.7) * 14;
    const w1 = Math.cos(i * 2.1) * 10;
    ctx.strokeStyle = `rgba(80,40,0,${0.025 + (i % 4 === 0 ? 0.04 : 0)})`;
    ctx.lineWidth = i % 7 === 0 ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x + w0, 0);
    ctx.bezierCurveTo(x + w0 + 8, H * 0.33, x + w1 - 6, H * 0.66, x + w1 - 10, H);
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = "#5c3310";
  ctx.lineWidth = BORDER * 2;
  ctx.strokeRect(BORDER, BORDER, W - BORDER * 2, H - BORDER * 2);
  ctx.strokeStyle = "#8c5522";
  ctx.lineWidth = 2;
  ctx.strokeRect(BORDER + 3, BORDER + 3, W - BORDER * 2 - 6, H - BORDER * 2 - 6);
}

//easter egg idk lol im tired of writing this stuff

function drawWall(ctx: CanvasRenderingContext2D, wall: Rect, W: number, H: number) {
  const x = wall.x * W,
    y = wall.y * H,
    w = wall.w * W,
    h = wall.h * H;
  ctx.fillStyle = "#4a1f0a";
  ctx.fillRect(x, y, w, h);
}

function drawGoal(ctx: CanvasRenderingContext2D, W: number, H: number, t: number) {
  const cx = GOAL.x * W,
    cy = GOAL.y * H,
    r = goalR(W);
  const pulse = 0.92 + Math.sin(t * 2) * 0.08;

  // outer glow
  const glow = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r * 2.4);
  glow.addColorStop(0, "rgba(80,220,255,0.22)");
  glow.addColorStop(0.4, "rgba(140,60,255,0.14)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2.4, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.fill();

  // black hole base
  ctx.beginPath();
  ctx.arc(cx, cy, r * pulse, 0, Math.PI * 2);
  ctx.fillStyle = "#020008";
  ctx.fill();

  // rotating arc segments (portal rim)
  ctx.save();
  ctx.translate(cx, cy);
  const segCount = 6;
  const gap = 0.18;
  for (let i = 0; i < segCount; i++) {
    const start = (i / segCount) * Math.PI * 2 + t * 1.1;
    const end = start + ((Math.PI * 2) / segCount) * (1 - gap);
    const frac = i / segCount;
    const r1 = 0.78,
      r2 = 0.98;
    ctx.beginPath();
    ctx.arc(0, 0, r * pulse * r2, start, end);
    ctx.arc(0, 0, r * pulse * r1, end, start, true);
    ctx.closePath();
    // teal → purple gradient per segment
    const col =
      frac < 0.5
        ? `rgba(${Math.round(40 + frac * 200)},${Math.round(200 - frac * 60)},255,0.9)`
        : `rgba(180,${Math.round(80 - (frac - 0.5) * 80)},255,0.9)`;
    ctx.fillStyle = col;
    ctx.fill();
  }
  ctx.restore();

  // inner depth radial gradient
  const depth = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * pulse * 0.76);
  depth.addColorStop(0, "rgba(100,40,200,0.5)");
  depth.addColorStop(0.5, "rgba(20,10,60,0.6)");
  depth.addColorStop(1, "rgba(0,0,0,0)");
  ctx.beginPath();
  ctx.arc(cx, cy, r * pulse * 0.76, 0, Math.PI * 2);
  ctx.fillStyle = depth;
  ctx.fill();

  // bright center shimmer
  ctx.beginPath();
  ctx.arc(cx, cy, r * pulse * 0.18, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(180,240,255,${0.6 + Math.sin(t * 4) * 0.3})`;
  ctx.fill();
}

function drawTimer(ctx: CanvasRenderingContext2D, W: number, time: string) {
  const text = time + "s";
  const fontSize = Math.round(W * 0.02);
  ctx.save();
  ctx.font = `bold ${fontSize}px monospace`;
  const tw = ctx.measureText(text).width;
  const pad = fontSize * 0.6;
  const rx = W - BORDER - 10 - tw - pad * 2;
  const ry = BORDER + 10;
  const rw = tw + pad * 2;
  const rh = fontSize + pad;
  ctx.beginPath();
  ctx.roundRect(rx, ry, rw, rh, 6);
  ctx.fillStyle = "rgba(20,8,2,0.65)";
  ctx.fill();
  ctx.strokeStyle = "rgba(160,90,20,0.5)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#f0d8a0";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const m = ctx.measureText(text);
  ctx.fillText(
    text,
    rx + rw / 2,
    ry + rh / 2 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2
  );
  ctx.restore();
}

function drawDeathShards(
  ctx: CanvasRenderingContext2D,
  bx: number,
  by: number,
  r: number,
  W: number,
  elapsed: number
) {
  const fade = Math.max(0, 1 - elapsed / 0.55);
  if (fade <= 0) return;
  for (let i = 0; i < 9; i++) {
    const angle = (i / 9) * Math.PI * 2 + 0.4;
    const spd = (0.09 + (i % 3) * 0.05) * W;
    const sx = bx + Math.cos(angle) * spd * elapsed;
    const sy = by + Math.sin(angle) * spd * elapsed + W * 0.18 * elapsed * elapsed;
    const sr = r * (0.25 + (i % 2) * 0.2) * fade;
    if (sr <= 0) continue;
    const mg = ctx.createRadialGradient(sx - sr * 0.3, sy - sr * 0.3, 0, sx, sy, sr);
    mg.addColorStop(0, `rgba(242,242,242,${fade})`);
    mg.addColorStop(1, `rgba(40,40,40,${fade * 0.7})`);
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fillStyle = mg;
    ctx.fill();
  }
}

export function drawBall(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx + r * 0.15, cy + r * 0.5, r * 0.9, r * 0.25, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fill();
  ctx.restore();
  const mg = ctx.createRadialGradient(cx - r * 0.28, cy - r * 0.3, 0, cx, cy, r);
  mg.addColorStop(0, "#e8e8e8");
  mg.addColorStop(0.55, "#787878");
  mg.addColorStop(1, "#1a1a1a");
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = mg;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx - r * 0.25, cy - r * 0.28, r * 0.17, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.fill();
}

export function drawScene(ctx: CanvasRenderingContext2D, W: number, H: number, t: number) {
  drawBoard(ctx, W, H);
  for (const wall of WALLS) drawWall(ctx, wall, W, H);
  for (const spike of SPIKES) drawSpike(ctx, spike, W, H, t);
  drawGoal(ctx, W, H, t);
}

export default function MarbleGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);
  const tRef = useRef(0);
  const lastTsRef = useRef<number | null>(null);
  const ballRef = useRef<BallState>({ fx: START.x, fy: START.y, vx: 0, vy: 0 });
  const keysRef = useRef(new Set<string>());
  const holdRef = useRef({ x: 0, y: 0 });
  const gameIdRef = useRef<number | null>(null);
  const gameInitRef = useRef(false);
  const wonRef = useRef<{ won: boolean; t: number; sx: number; sy: number }>({
    won: false,
    t: 0,
    sx: 0,
    sy: 0,
  });
  const deadRef = useRef<{ dead: boolean; t: number; bx: number; by: number }>({
    dead: false,
    t: 0,
    bx: 0,
    by: 0,
  });

  const startTimeRef = useRef<number>(0);
  const timeDisplayRef = useRef("0.00");

  useEffect(() => {
    if (!gameInitRef.current) {
      gameInitRef.current = true;
      createGame()
        .then((g) => {
          gameIdRef.current = g.id;
        })
        .catch(console.error);
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    function resize() {
      const p = canvas!.parentElement!;
      canvas!.width = p.clientWidth;
      canvas!.height = p.clientHeight;
    }

    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement!);
    resize();

    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key.toLowerCase());
      if (["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(e.key.toLowerCase()))
        e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase());
    const clearKeys = () => {
      keysRef.current.clear();
      holdRef.current = { x: 0, y: 0 };
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clearKeys);
    window.addEventListener("contextmenu", clearKeys);

    function frame(ts: number) {
      if (!lastTsRef.current) {
        lastTsRef.current = ts;
        startTimeRef.current = Date.now();
      }
      const dt = Math.min((ts - lastTsRef.current) / 1000, 0.05);
      lastTsRef.current = ts;
      tRef.current += dt;

      if (!wonRef.current.won && !deadRef.current.dead && startTimeRef.current > 0) {
        timeDisplayRef.current = ((Date.now() - startTimeRef.current) / 1000).toFixed(2);
      }

      const ctx = canvas!.getContext("2d")!;
      const W = canvas!.width,
        H = canvas!.height;
      if (W === 0 || H === 0) {
        animRef.current = requestAnimationFrame(frame);
        return;
      }

      const ball = ballRef.current;
      const keys = keysRef.current;
      const r = ballR(W);

      const right = keys.has("arrowright") || keys.has("d") ? 1 : 0;
      const left = keys.has("arrowleft") || keys.has("a") ? 1 : 0;
      const down = keys.has("arrowdown") || keys.has("s") ? 1 : 0;
      const up = keys.has("arrowup") || keys.has("w") || keys.has("z") ? 1 : 0;

      const tx = right - left;
      const ty = down - up;
      const hold = holdRef.current;
      if (tx !== 0) hold.x = Math.max(-1, Math.min(1, hold.x + tx * 5 * dt));
      else hold.x *= Math.pow(0.4, dt * 60);
      if (ty !== 0) hold.y = Math.max(-1, Math.min(1, hold.y + ty * 5 * dt));
      else hold.y *= Math.pow(0.4, dt * 60);

      ball.vx += hold.x * GRAVITY * dt;
      ball.vy += hold.y * GRAVITY * dt;

      const fric = Math.pow(FRICTION, dt * 60);
      ball.vx = Math.max(-MAX_V, Math.min(MAX_V, ball.vx * fric));
      ball.vy = Math.max(-MAX_V, Math.min(MAX_V, ball.vy * fric));

      let px = ball.fx * W + ball.vx * dt;
      let py = ball.fy * H + ball.vy * dt;

      //border for ball
      if (px < BORDER + r) {
        px = BORDER + r;
        ball.vx *= -0.2;
      } else if (px > W - BORDER - r) {
        px = W - BORDER - r;
        ball.vx *= -0.2;
      }
      if (py < BORDER + r) {
        py = BORDER + r;
        ball.vy *= -0.2;
      } else if (py > H - BORDER - r) {
        py = H - BORDER - r;
        ball.vy *= -0.2;
      }

      for (const wall of WALLS) {
        const wx = wall.x * W,
          wy = wall.y * H,
          ww = wall.w * W,
          wh = wall.h * H;
        const nearX = Math.max(wx, Math.min(px, wx + ww));
        const nearY = Math.max(wy, Math.min(py, wy + wh));
        const dx = px - nearX,
          dy = py - nearY;
        const dist2 = dx * dx + dy * dy;
        if (dist2 > 0 && dist2 < r * r) {
          const dist = Math.sqrt(dist2);
          const nx = dx / dist,
            ny = dy / dist;
          px += nx * (r - dist);
          py += ny * (r - dist);
          const dot = ball.vx * nx + ball.vy * ny;
          if (dot < 0) {
            ball.vx -= 1.1 * dot * nx;
            ball.vy -= 1.1 * dot * ny;
          }
        }
        if (!deadRef.current.dead && !wonRef.current.won) {
          const t0 = tRef.current;
          for (const spike of SPIKES) {
            const s0 = (((t0 + spike.phase) % 6) + 6) % 6;
            const extend = s0 < 0.3 ? s0 / 0.3 : s0 < 2.3 ? 1 : s0 < 3.3 ? 1 - (s0 - 2.3) : 0;
            if (extend < 0.3) continue;
            const len = W * 0.055 * extend;
            const base = W * 0.009;
            const scx = spike.x * W;
            const scy = spike.y * H;
            for (let i = -1; i <= 1; i++) {
              const off = i * base * 2.5;
              let cx: number, cy: number;
              if (spike.dir === "S") {
                cx = scx + off;
                cy = Math.max(scy, Math.min(py, scy + len));
              } else if (spike.dir === "N") {
                cx = scx + off;
                cy = Math.max(scy - len, Math.min(py, scy));
              } else if (spike.dir === "E") {
                cx = Math.max(scx, Math.min(px, scx + len));
                cy = scy + off;
              } else {
                cx = Math.max(scx - len, Math.min(px, scx));
                cy = scy + off;
              }
              const ddx = px - cx,
                ddy = py - cy;
              if (ddx * ddx + ddy * ddy < r * r) {
                deadRef.current = { dead: true, t: tRef.current, bx: px, by: py };
                if (gameIdRef.current !== null) {
                  changeGameStatus(gameIdRef.current, "lost").catch(console.error);
                }
                break;
              }
            }
            if (deadRef.current.dead) break;
          }
        }
      }

      if (!wonRef.current.won && !deadRef.current.dead) {
        const gx = GOAL.x * W,
          gy = GOAL.y * H,
          gr = goalR(W);
        const gdx = px - gx,
          gdy = py - gy;
        if (gdx * gdx + gdy * gdy < gr * gr) {
          wonRef.current = { won: true, t: tRef.current, sx: px, sy: py };
          ball.vx = 0;
          ball.vy = 0;
          holdRef.current = { x: 0, y: 0 };
          if (gameIdRef.current !== null) {
            changeGameStatus(gameIdRef.current, "won").catch(console.error);
          }
        }
      }

      if (deadRef.current.dead) {
        const elapsed = tRef.current - deadRef.current.t;
        const { bx: dbx, by: dby } = deadRef.current;
        drawScene(ctx, W, H, tRef.current);
        drawDeathShards(ctx, dbx, dby, r, W, elapsed);
        drawTimer(ctx, W, timeDisplayRef.current);
        if (elapsed > 0.4) {
          const screenElapsed = elapsed - 0.4;
          const overlayAlpha = Math.min(0.72, (screenElapsed / 0.25) * 0.72);
          ctx.fillStyle = `rgba(0,0,0,${overlayAlpha})`;
          ctx.fillRect(0, 0, W, H);
          ctx.save();
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const textFade = Math.min(1, screenElapsed / 0.25);
          ctx.shadowColor = "#ff1100";
          ctx.shadowBlur = 40;
          ctx.fillStyle = `rgba(204,17,0,${textFade})`;
          ctx.font = `bold ${Math.round(W * 0.09)}px serif`;
          ctx.fillText("im crine son 😭", W / 2, H / 2);
          ctx.shadowBlur = 0;
          if (screenElapsed > 1.2) {
            const remaining = Math.ceil(2.5 - screenElapsed);
            ctx.fillStyle = `rgba(180,180,180,0.7)`;
            ctx.font = `${Math.round(W * 0.022)}px monospace`;
            ctx.fillText(`respawning in ${remaining}...`, W / 2, H / 2 + H * 0.1);
          }
          ctx.restore();
          if (screenElapsed >= 2.5) {
            deadRef.current = { dead: false, t: 0, bx: 0, by: 0 };
            ball.fx = START.x;
            ball.fy = START.y;
            ball.vx = 0;
            ball.vy = 0;
            startTimeRef.current = Date.now();
            timeDisplayRef.current = "0.00";
            gameIdRef.current = null;
            createGame()
              .then((g) => {
                gameIdRef.current = g.id;
              })
              .catch(console.error);
          }
        }
        animRef.current = requestAnimationFrame(frame);
        return;
      }

      if (wonRef.current.won) {
        const elapsed = tRef.current - wonRef.current.t;
        const gx = GOAL.x * W,
          gy = GOAL.y * H;
        drawScene(ctx, W, H, tRef.current);
        drawTimer(ctx, W, timeDisplayRef.current);
        if (elapsed < 0.75) {
          const prog = elapsed / 0.75;
          const ease = prog * prog;
          const bx = wonRef.current.sx + (gx - wonRef.current.sx) * ease;
          const by = wonRef.current.sy + (gy - wonRef.current.sy) * ease;
          const br = r * (1 - prog);
          if (br > 1) drawBall(ctx, bx, by, br);
          const ringR = goalR(W) * (1 + prog * 2.5);
          ctx.beginPath();
          ctx.arc(gx, gy, ringR, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(80,220,255,${(1 - prog) * 0.7})`;
          ctx.lineWidth = 3;
          ctx.stroke();
        } else {
          const screenElapsed = elapsed - 0.75;
          const fade = Math.min(1, screenElapsed / 0.35);
          ctx.fillStyle = `rgba(0,0,20,${0.78 * fade})`;
          ctx.fillRect(0, 0, W, H);
          ctx.save();
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.shadowColor = "#40ffcc";
          ctx.shadowBlur = 50;
          ctx.fillStyle = `rgba(80,255,200,${fade})`;
          ctx.font = `bold ${Math.round(W * 0.08)}px serif`;
          ctx.fillText("congrats buddy", W / 2, H / 2);
          ctx.shadowBlur = 0;
          ctx.restore();
        }
        animRef.current = requestAnimationFrame(frame);
        return;
      }

      drawScene(ctx, W, H, tRef.current);
      drawBall(ctx, px, py, r);
      drawTimer(ctx, W, timeDisplayRef.current);

      ball.fx = px / W;
      ball.fy = py / H;

      animRef.current = requestAnimationFrame(frame);
    }

    animRef.current = requestAnimationFrame(frame);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clearKeys);
      window.removeEventListener("contextmenu", clearKeys);
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="w-full h-full">
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}
