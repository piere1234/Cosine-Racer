const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");


const backwheel = { x: 100, y: 100, r: 20, vx: 0, vy: 0 };
const frontwheel = { x: 150, y: 100, r: 20, vx: 0, vy: 0 };



const GRAVITY = 1200;          
const MOVE_ACCEL = 2500;       
const MOVE_DAMP_GROUND = 0.98; 
const JUMP_SPEED = 420;        
let onGround = false;


const keys = { left: false, right: false, up: false };
window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
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


const A = 40, K = 0.015;
function groundY(x) { return Math.sin(x * K) * A + 600; }
function groundSlope(x) { return Math.cos(x * K) * A * K; }

let lastTime = performance.now();
function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 1/30);
  lastTime = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

function update(dt) {
  let ax = 0, ay = GRAVITY;
  if (onGround) {
    if (keys.left)  ax -= MOVE_ACCEL;
    if (keys.right) ax += MOVE_ACCEL;
  } 

  backwheel.vx += ax * dt;
  backwheel.vy += ay * dt;

  backwheel.x += backwheel.vx * dt;
  backwheel.y += backwheel.vy * dt;

  frontwheel.x += frontwheel.vx * dt;
  frontwheel.y += frontwheel.vy * dt;

  frontwheel.vx = backwheel.vx;
  frontwheel.vy += ay * dt - 0.5 * ax * dt;  

  const gy = groundY(backwheel.x);
  const slope = groundSlope(backwheel.x);

  let nx = slope, ny = -1;
  const nlen = Math.hypot(nx, ny);
  nx /= nlen; ny /= nlen;


  let tx = 1, ty = slope;
  const tlen = Math.hypot(tx, ty);
  tx /= tlen; ty /= tlen;


  const sx = backwheel.x, sy = gy;
  const d = ((backwheel.x - sx) * nx + (backwheel.y - sy) * ny) - backwheel.r;
  


  onGround = false;
  if (d < 0) {

    const corr = -d;
    backwheel.x += nx * corr;
    backwheel.y += ny * corr;


    const vn = backwheel.vx * nx + backwheel.vy * ny;
    if (vn < 0) {
      backwheel.vx -= vn * nx;
      backwheel.vy -= vn * ny;
    }

    onGround = true;


    const vt = backwheel.vx * tx + backwheel.vy * ty;
    const vtAfter = vt * MOVE_DAMP_GROUND;

    backwheel.vx = vtAfter * tx;
    backwheel.vy = vtAfter * ty;


    if (keys.up) {
      backwheel.vx += JUMP_SPEED * nx;
      backwheel.vy += JUMP_SPEED * ny;
      onGround = false;
      keys.up = false;
    }
  }

  if (backwheel.x - backwheel.r < 0) {
    backwheel.x = backwheel.r;
    if (backwheel.vx < 0) backwheel.vx = 0;
  }
  if (backwheel.x + backwheel.r > canvas.width) {
    backwheel.x = canvas.width - backwheel.r;
    if (backwheel.vx > 0) backwheel.vx = 0;
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);


  ctx.fillStyle = "#2f7d32";
  ctx.beginPath();
  ctx.moveTo(0, groundY(0));
  for (let x = 0; x <= canvas.width; x++) {
    ctx.lineTo(x, groundY(x));
  }
  ctx.lineTo(canvas.width, canvas.height);
  ctx.lineTo(0, canvas.height);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "black";
  ctx.beginPath();
  ctx.arc(backwheel.x, backwheel.y, backwheel.r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#111";
  ctx.font = "14px system-ui";
  ctx.fillText(
    `x: ${backwheel.x.toFixed(1)} y: ${(backwheel.y - 380).toFixed(1)} vx: ${backwheel.vx.toFixed(1)} vy: ${backwheel.vy.toFixed(1)} onGround: ${onGround}, groundSlope: ${groundSlope(backwheel.x).toFixed(2)}`,
    10, 20
  );
  ctx.fillText("Controls: Q/←, D/→, Z/↑ (jump)", 10, 40);
}

requestAnimationFrame(loop);
