const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const BODY_OFFSET = -18;
const BODY_HEIGHT = 26; 

// Music ? --
let musicStarted = false;
const music = new Audio("Hill Climb Racing Menu Theme.mp3");
music.loop = true;
music.volume = 0.6;
music.preload = "auto";
music.crossOrigin = "anonymous";

// -- Start once on first input
function armMusic() {
  const start = async () => {
    if (musicStarted) return;
    musicStarted = true;
    try { await music.play(); } catch (e) { console.warn("Autoplay blocked:", e); }
    window.removeEventListener("keydown", start);
    window.removeEventListener("pointerdown", start);
    window.removeEventListener("touchstart", start);
  };
  window.addEventListener("keydown", start);
  window.addEventListener("pointerdown", start);
  window.addEventListener("touchstart", start, { passive: true });
}
armMusic();

// Camera
let cameraX = 0;
const targetScreenX = canvas.width * 0.35;

// Backwheel new state
const backwheel = { x: 100, y: 100, r: 20, vx: 0, vy: 0, ax: 0, ay: 0, angle: 0, omega: 0 };
const frontwheel = { x: 170, y: 100, r: 20, vx: 0, vy: 0, ax: 0, ay: 0, angle: 0, omega: 0 };
let chassis = { x: 0, y: 0, angle: 0 } // unused

// Constants
const GRAVITY = 1200;           // +y = downward
const MOVE_ACCEL = 2500;        // user accel
const MOVE_DAMP_GROUND = 0.987; // tangential damping on ground
const JUMP_SPEED = 420;         // unused here but kept (used in ball originally)
let onGroundBack = false;
let onGroundFront = false;
let crashed = false;
let highscore = 0;

// Input
const keys = { left: false, right: false, up: false };
window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (crashed && k === "r") {
    restart();
    return;
  }
  if (k === "arrowleft" || k === "q") keys.left = true;
  if (k === "arrowright" || k === "d") keys.right = true;
  if (k === "arrowup" || k === "z") keys.up = true;
});
window.addEventListener("keyup", (e) => {
  const k = e.key.toLowerCase();
  if (k === "arrowleft" || k === "q") keys.left = false;
  if (k === "arrowright" || k === "d") keys.right = false;
  if (k === "arrowup" || k === "z") keys.up = false;
});

// Ground functions (could have been randomized)
const A = 0.3, K = 0.15;
function groundY(x) {
  return (
    0.5 *
      (120 * Math.sin(0.02 * A * x) +
       50 * Math.sin(0.07 * A * x + 1.3) +
       10 * Math.sin(0.12 * (A * A * x * x) / 4000)) +
    500
  );
}
function groundSlope(x) {
  return (
    0.5 *
    A *
    (2.4 * Math.cos(0.02 * A * x) +
     3.5 * Math.cos(0.07 * A * x + 1.3) +
     0.0006 * x * A * Math.cos(0.00003 * A * A * x * x))
  );
}

// Preload wheel image once
const wheelImg = new Image();
wheelImg.src = "wheel.png";

let lastTime = performance.now();
function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 1 / 30);
  lastTime = now;
  if (!crashed) {
    update(dt);
  }
  render();
  requestAnimationFrame(loop);
}

function update(dt) {
  // Crash check: if both wheels on ground and front behind  (trivial)
  if (onGroundBack && onGroundFront) {
    if (frontwheel.x < backwheel.x) {
      crashed = true;
    }
  }

  // Reset accelerations
  backwheel.ay = GRAVITY;
  frontwheel.ay = 0;
  backwheel.ax = 0;
  frontwheel.ax = 0;

  // Controls
  if (onGroundBack) {
    if (keys.left) backwheel.ax -= MOVE_ACCEL;
    if (keys.right) backwheel.ax += MOVE_ACCEL;
  }
  if (onGroundFront) {
    if (keys.left) frontwheel.ax -= MOVE_ACCEL;
    if (keys.right) frontwheel.ax += MOVE_ACCEL;
  }

  // Rigid distance constraint between wheels (velocity-based) - Baumgarte stabilization (gave me a whole lot of work, and I feel like I could have used that for suspension calculations)
  const dxAB = frontwheel.x - backwheel.x;
  const dyAB = frontwheel.y - backwheel.y;
  let dist   = Math.hypot(dxAB, dyAB) || 1e-6;
  const unx  = dxAB / dist;   // normed
  const uny  = dyAB / dist;
  const desiredDistance = backwheel.r + frontwheel.r + 30;
  const C = dist - desiredDistance;

  const rvx = frontwheel.vx - backwheel.vx;
  const rvy = frontwheel.vy - backwheel.vy;
  const relN = rvx * unx + rvy * uny;
  const beta = 0.2;
  const corr = relN + (beta * C) / dt;

  frontwheel.vx -= 0.5 * corr * unx;
  frontwheel.vy -= 0.5 * corr * uny;
  backwheel.vx  += 0.5 * corr * unx;
  backwheel.vy  += 0.5 * corr * uny;

  const slop = 0.5;
  if (Math.abs(C) > slop) {
    const posCorr = (Math.abs(C) - slop) * Math.sign(C);
    frontwheel.x -= 0.5 * posCorr * unx;
    frontwheel.y -= 0.5 * posCorr * uny;
    backwheel.x  += 0.5 * posCorr * unx;
    backwheel.y  += 0.5 * posCorr * uny;
  }

  // Integrate velocities and positions
  backwheel.vx += backwheel.ax * dt;
  backwheel.vy += backwheel.ay * dt;
  backwheel.x  += backwheel.vx * dt;
  backwheel.y  += backwheel.vy * dt;

  frontwheel.vx += frontwheel.ax * dt;
  frontwheel.vy += frontwheel.ay * dt;
  frontwheel.x  += frontwheel.vx * dt;
  frontwheel.y  += frontwheel.vy * dt;

  // Attempt to account for throttle lift-off
  frontwheel.vy += backwheel.ay * dt;

  if (backwheel.x <= 0) backwheel.x = 0;

  // Ground gets
  const gyBack = groundY(backwheel.x);
  const slopeBack = groundSlope(backwheel.x);
  const gyFront = groundY(frontwheel.x);
  const slopeFront = groundSlope(frontwheel.x);

  // Back normal/tangent
  let nx = slopeBack, ny = -1;
  let nlen = Math.hypot(nx, ny);
  nx /= nlen; ny /= nlen;
  let tx = 1, ty = slopeBack;
  let tlen = Math.hypot(tx, ty);
  tx /= tlen; ty /= tlen;

  // Front normal/tangent
  let nxF = slopeFront, nyF = -1;
  let nlenF = Math.hypot(nxF, nyF);
  nxF /= nlenF; nyF /= nlenF;
  let txF = 1, tyF = slopeFront;
  let tlenF = Math.hypot(txF, tyF);
  txF /= tlenF; tyF /= tlenF;

  // Signed distances
  const dBack =
    (backwheel.x - backwheel.x) * nx + (backwheel.y - gyBack) * ny - backwheel.r;
  const dFront =
    (frontwheel.x - frontwheel.x) * nxF + (frontwheel.y - gyFront) * nyF - frontwheel.r;

  onGroundBack = false;
  onGroundFront = false;

  // Back collision solve
  if (dBack < 0) {
    const corrN = -dBack;
    backwheel.x += nx * corrN;
    backwheel.y += ny * corrN;

    const vn = backwheel.vx * nx + backwheel.vy * ny;
    if (vn < 0) {
      backwheel.vx -= vn * nx;
      backwheel.vy -= vn * ny;
    }
    onGroundBack = true;

    const vt = backwheel.vx * tx + backwheel.vy * ty;
    const vtAfter = vt * MOVE_DAMP_GROUND;
    backwheel.vx = vtAfter * tx;
    backwheel.vy = vtAfter * ty;
  }

  // Front collision solve
  if (dFront < 0) {
    const corrNf = -dFront;
    frontwheel.x += nxF * corrNf;
    frontwheel.y += nyF * corrNf;

    const vnF = frontwheel.vx * nxF + frontwheel.vy * nyF;
    if (vnF < 0) {
      frontwheel.vx -= vnF * nxF;
      frontwheel.vy -= vnF * nyF;
    }
    onGroundFront = true;
  }

  

  // Wheel spin update (rolling from tangential speed) - purely visual
  // Back wheel:
  if (onGroundBack) {
    const vt = backwheel.vx * tx + backwheel.vy * ty; // tangential speed along ground
    backwheel.omega = vt / backwheel.r;               // rad/s, sign follows vt
  } else {
    backwheel.omega *= 0.9; // air drag
  }
  backwheel.angle += backwheel.omega * dt;

  // Front wheel:
  if (onGroundFront) {
    const vtF = frontwheel.vx * txF + frontwheel.vy * tyF;
    frontwheel.omega = vtF / frontwheel.r;
  } else {
    frontwheel.omega *= 0.999;
  }
  frontwheel.angle += frontwheel.omega * dt;

  //Update camera after physics/collisions
  const middleX = 0.5 * (backwheel.x + frontwheel.x);
  const follow = 10;
  cameraX += (middleX - (cameraX + targetScreenX)) * Math.min(1, follow * dt);
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // WORLD LAYER
  ctx.save();
  ctx.translate(-cameraX, 0);

  // Ground
  ctx.fillStyle = "#2f7d32";
  ctx.beginPath();
  const startX = Math.floor(cameraX) - 1;
  const endX   = Math.ceil(cameraX + canvas.width) + 1;
  ctx.moveTo(startX, groundY(startX));
  for (let x = startX; x <= endX; x++) {
    ctx.lineTo(x, groundY(x));
  }
  ctx.lineTo(endX, canvas.height);
  ctx.lineTo(startX, canvas.height);
  ctx.closePath();
  ctx.fill();

  // Car body (carrosserie)
  const dx = frontwheel.x - backwheel.x;
  const dy = frontwheel.y - backwheel.y;
  const barLen = Math.hypot(dx, dy) || 1e-6;
  const theta = Math.atan2(dy, dx);
  const midx = (frontwheel.x + backwheel.x) / 2;
  const midy = (frontwheel.y + backwheel.y) / 2;

  // Perpendicular unit (to lift the body up from the wheel-axle bar)
  const px = -Math.sin(theta);
  const py =  Math.cos(theta);
  const bodyOffset = -18;      // negative => lift upwards visually
  const bodyH = 26;            // body height
  const bodyW = barLen;        // body length spans between wheels
  const bodyCx = midx + px * bodyOffset;
  const bodyCy = midy + py * bodyOffset;

  // Draw rounded rect centered at (bodyCx,bodyCy) rotated by theta
  ctx.save();
  ctx.translate(bodyCx, bodyCy);
  ctx.rotate(theta);

  const rx = -bodyW / 2, ry = -bodyH / 2, rw = bodyW, rh = bodyH, rr = Math.min(12, bodyH/2);
  ctx.fillStyle = "#4b6cb7"; // body color
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 3;

  // Rounded rectangle path
  roundedRectPath(ctx, rx, ry, rw, rh, rr);
  ctx.fill();
  ctx.stroke();

  // Simple "cabin" detail
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  roundedRectPath(ctx, -rw*0.15, -rh*0.35, rw*0.3, rh*0.6, rr*0.6);
  ctx.fill();

  ctx.restore();

  // Wheels (with rotation)
  drawWheel(backwheel);
  drawWheel(frontwheel);

  ctx.restore(); // world -> screen

  // HUD LAYER
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#111";
  ctx.font = "14px system-ui";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(
    `Distance: ${(backwheel.x / 10).toFixed(1)} m / Highscore: ${highscore.toFixed(1)} m`,
    10, 20
  );
  ctx.fillText("Controls: Q/←, D/→ - Press R after crash", 10, 40);
  ctx.restore();

  // GAME OVER OVERLAY
  if (crashed) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const boxW = 420;
    const boxH = 220;
    const boxX = (canvas.width  - boxW) / 2;
    const boxY = (canvas.height - boxH) / 2;

    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 4;
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    ctx.fillStyle = "#222";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.font = "bold 32px system-ui";
    ctx.fillText("GAME OVER", canvas.width / 2, boxY + 55);
    ctx.font = "16px system-ui";
    ctx.fillText("You crashed!", canvas.width / 2, boxY + 95);
    ctx.fillText("Press R to try again", canvas.width / 2, boxY + 125);

    ctx.restore();
  }
}

// Helpers: rounded rect path + wheel draw (with rotation/spokes)
function roundedRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function drawWheel(w) {
  const { x, y, r, angle } = w;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  if (wheelImg.complete && wheelImg.naturalWidth) {
    ctx.drawImage(wheelImg, -r, -r, r * 2, r * 2);
  } else {
    // Fallback: simple wheel with spokes
    ctx.fillStyle = "#444";
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#222";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-r * 0.9, 0);
    ctx.lineTo(r * 0.9, 0);
    ctx.moveTo(0, -r * 0.9);
    ctx.lineTo(0, r * 0.9);
    ctx.stroke();

    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

requestAnimationFrame(loop);
// Restart (self-explanatory)
function restart() {
  if ((backwheel.x / 10) > highscore) {
    highscore = backwheel.x / 10;
  }
  crashed = false;
  backwheel.x = 100;
  backwheel.y = 100;
  frontwheel.x = 170;
  frontwheel.y = 100;
  backwheel.vx = 0;
  backwheel.vy = 0;
  frontwheel.vx = 0;
  frontwheel.vy = 0;

  backwheel.angle = 0;
  frontwheel.angle = 0;
  backwheel.omega = 0;
  frontwheel.omega = 0;

  chassis = { x: 0, y: 0, angle: 0 };

  lastTime = performance.now();
}
