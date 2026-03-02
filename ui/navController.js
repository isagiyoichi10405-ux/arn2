import * as THREE from "three";
import { campusCoords } from "../data/campusMap.js";

/* ===============================
   FORCE AR MODE (CSS FALLBACK)
================================ */
document.body.classList.add("ar-mode");

/* ===============================
   CAMERA FEED
================================ */
const video = document.getElementById("camera");
navigator.mediaDevices.getUserMedia({
  video: { facingMode: "environment" }
}).then(stream => {
  video.srcObject = stream;
});

/* ===============================
   LOAD NAV STATE
================================ */
const navState = JSON.parse(sessionStorage.getItem("navState"));
if (!navState || !navState.path) {
  alert("No route data");
  location.href = "index.html";
}

const path = navState.path;
let index = 0;
let current = path[index];
let arrived = false;

/* ===============================
   UI ELEMENTS
================================ */
const instruction = document.getElementById("instruction");
const distance = document.getElementById("distance");
const progressFill = document.getElementById("progress-fill");

function updateProgressBar() {
  if (progressFill) {
    const progress = (index / (path.length - 1)) * 100;
    progressFill.style.width = `${progress}%`;
  }
}

updateInstruction();
updateProgressBar();

/* ===============================
   THREE.JS SETUP
================================ */
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  70,
  innerWidth / innerHeight,
  0.01,
  50
);

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
document.getElementById("canvas-container").appendChild(renderer.domElement);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ===============================
   3D WORLD ELEMENTS (WORLD AR)
================================ */
const pathGroup = new THREE.Group();
const labelGroup = new THREE.Group();
scene.add(pathGroup);
scene.add(labelGroup);

function makeTextLabel(text) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = 256;
  canvas.height = 64;

  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.roundRect(0, 0, 256, 64, 12);
  ctx.fill();
  ctx.strokeStyle = "#00ff88";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 28px Outfit, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 128, 32);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.5, 0.375, 1);
  return sprite;
}

function createWorldPath() {
  pathGroup.clear();
  labelGroup.clear();
  const points = path.map(id => {
    const coords = campusCoords[id];
    return new THREE.Vector3(coords.x * 10, -1.6, coords.z * 10);
  });

  const curve = new THREE.CatmullRomCurve3(points);
  const tubeGeo = new THREE.TubeGeometry(curve, path.length * 10, 0.08, 8, false);
  const tubeMat = new THREE.MeshBasicMaterial({
    color: 0x00ff88,
    transparent: true,
    opacity: 0.8
  });
  const pathLine = new THREE.Mesh(tubeGeo, tubeMat);
  pathGroup.add(pathLine);

  // Add glowing nodes and labels
  points.forEach((p, i) => {
    const id = path[i];
    const nodeGeo = new THREE.SphereGeometry(0.15, 16, 16);
    const nodeMat = new THREE.MeshBasicMaterial({ color: i === index ? 0x00ff00 : 0xffffff });
    const node = new THREE.Mesh(nodeGeo, nodeMat);
    node.position.copy(p);
    node.name = i === index ? "activeNode" : "node";
    pathGroup.add(node);

    // Add labels for blocks, roads and key locations
    if (id.startsWith("B") || id.startsWith("R") || id.includes("HOSTEL") || id.includes("ADMIN") || i === 0 || i === path.length - 1) {
      let labelText = id;
      if (id.startsWith("R")) labelText = "ROAD";
      if (i === 0) labelText = "START";
      if (i === path.length - 1) labelText = id;

      const label = makeTextLabel(labelText);
      label.position.set(p.x, p.y + 0.6, p.z);
      labelGroup.add(label);
    }
  });
}

createWorldPath();

scene.add(camera);

/* ===============================
   DEVICE ORIENTATION
================================ */
let yaw = 0;           // Camera rotation (CCW)
let alphaHeading = 0;  // Raw compass heading (deg CW)
let wrongDirTimer = 0;
const WRONG_DIR_LIMIT = Math.PI / 2;

window.addEventListener("deviceorientation", e => {
  if (e.alpha === null) return;
  // Convert CCW alpha to CW heading (0 = North, 90 = East)
  alphaHeading = (360 - e.alpha) % 360;
  // Camera yaw for Three.js (CCW)
  yaw = -THREE.MathUtils.degToRad(alphaHeading);
});

/* ===============================
   NAV HELPERS
================================ */
function angle(a, b) {
  const p1 = campusCoords[a];
  const p2 = campusCoords[b];
  return Math.atan2(p2.z - p1.z, p2.x - p1.x);
}

function approxDistance(a, b) {
  const p1 = campusCoords[a];
  const p2 = campusCoords[b];
  return Math.round(Math.hypot(p2.x - p1.x, p2.z - p1.z) * 10);
}

function updateInstruction(showWarning = false) {
  const start = path[0];
  const end = path.at(-1);
  const next = path[index + 1];

  if (arrived || !next) {
    instruction.innerHTML = `<span style="color:var(--secondary)">DESTINATION REACHED</span>`;
    return;
  }

  if (showWarning) {
    instruction.innerHTML = `<span style="color:#ff3333">POINTING WRONG DIRECTION</span>`;
  } else {
    const dist = approxDistance(current, next);
    const dir = (dist < 2) ? "FORWARD" : "ADVANCE";
    // Using CSS classes defined in style.css for consistent green theme
    instruction.innerHTML = `
      <div class="hud-main">FROM ${start} TO ${end}</div>
      <div class="hud-sub">DIR: ${dir} | NEXT: ${next} (${dist}m)</div>
    `;
  }
}

/* ===============================
   MINIMAP SETUP
================================ */
const map = document.createElement("canvas");
map.width = 150;
map.height = 150;
map.className = "minimap";
document.querySelector(".nav-card").appendChild(map);

const ctx = map.getContext("2d");

/* ===============================
   MINIMAP HELPERS
================================ */
function drawUserArrow(x, y, a) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(5, 6);
  ctx.lineTo(-5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawLabel(text, x, y, color = "#ffffff") {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = "10px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(text, x, y + 6);
  ctx.restore();
}

/* ===============================
   DRAW MINIMAP (CORRECT VERSION)
================================ */
/* ===============================
   DRAW MINIMAP (CORRECT VERSION)
================================ */
function drawMiniMap() {
  ctx.clearRect(0, 0, 300, 300);

  const nodes = path.map(id => campusCoords[id]);
  const xs = nodes.map(n => n.x);
  const zs = nodes.map(n => n.z);

  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minZ = Math.min(...zs), maxZ = Math.max(...zs);

  const sx = x => ((x - minX) / (maxX - minX)) * 90 + 30;
  const sz = z => ((z - minZ) / (maxZ - minZ)) * 90 + 30;

  /* ---- PATH + NODES (INVERTED Y) ---- */
  ctx.save();
  ctx.translate(0, 150);
  ctx.scale(1, -1);

  // Path
  ctx.strokeStyle = "#00c6ff";
  ctx.lineWidth = 3;
  ctx.beginPath();
  path.forEach((id, i) => {
    const p = campusCoords[id];
    i === 0
      ? ctx.moveTo(sx(p.x), sz(p.z))
      : ctx.lineTo(sx(p.x), sz(p.z));
  });
  ctx.stroke();

  // Nodes
  path.forEach((id, i) => {
    const p = campusCoords[id];
    let color = "rgba(255,255,255,0.7)";

    if (i === 0) color = "#00ffcc";                     // START
    else if (i === path.length - 1) color = "#ff5555"; // END
    else if (i === index) color = "#00ff88";           // CURRENT

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(sx(p.x), sz(p.z), 6, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();

  /* ---- LABELS (NORMAL CANVAS SPACE) ---- */
  path.forEach((id, i) => {
    const p = campusCoords[id];
    const x = sx(p.x);
    const y = 300 - sz(p.z);

    if (
      i === 0 ||
      i === path.length - 1 ||
      i === index ||
      id.startsWith("B") ||
      id.includes("HOSTEL") ||
      id.includes("ADMIN")
    ) {
      let label = id;
      if (i === 0) label = "START";
      else if (i === path.length - 1) label = "END";

      drawLabel(label, x, y);
    }
  });

  /* ---- USER ORIENTATION ---- */
  const c = campusCoords[current];
  drawUserArrow(sx(c.x), 300 - sz(c.z), THREE.MathUtils.degToRad(alphaHeading));
}

/* ===============================
   NAVIGATION PROGRESS
================================ */
function nextStep() {
  if (index < path.length - 1) {
    index++;
    current = path[index];
    distance.innerText = `${path.length - 1 - index} steps remaining`;
    updateInstruction();
    updateProgressBar();

    if (index === path.length - 1) {
      arrived = true;
      instruction.innerText = "Scan destination QR to confirm arrival";
    }
  }
}

/* ===============================
   UI BUTTONS (INTEGRATED INTO HUD)
================================ */
const nextBtn = document.createElement("button");
nextBtn.className = "nav-action-btn btn-hud-next";
nextBtn.innerHTML = "STEP FORWARD 👣";
document.querySelector(".nav-card").appendChild(nextBtn);

nextBtn.onclick = nextStep;

const rerouteBtn = document.createElement("button");
rerouteBtn.className = "btn-hud-reset";
rerouteBtn.innerText = "🔄 Reset";
document.querySelector(".nav-card").appendChild(rerouteBtn);

rerouteBtn.onclick = () => {
  index = 0;
  current = path[0];
  arrived = false;
  wrongDirTimer = 0;
  distance.innerText = `${path.length - 1} steps remaining`;
  updateInstruction();
  updateProgressBar();
  createWorldPath();
};

// Tap to advance on canvas
renderer.domElement.addEventListener("click", nextStep);

/* ===============================
   RENDER LOOP
================================ */
function animate() {
  requestAnimationFrame(animate);

  const time = Date.now() * 0.005;

  // Pulse animation for active node
  pathGroup.children.forEach(child => {
    if (child.name === "activeNode") {
      const s = 1 + Math.sin(time) * 0.2;
      child.scale.set(s, s, s);
    }
  });

  // World-Space Viewport Logic
  const currentPos = campusCoords[current];
  camera.position.set(currentPos.x * 10, 0, currentPos.z * 10);
  camera.rotation.set(0, yaw, 0);

  const next = path[index + 1];
  if (next && !arrived) {
    const p1 = campusCoords[current];
    const p2 = campusCoords[next];
    const target = Math.atan2(p2.x - p1.x, p2.z - p1.z);
    const currentHeadingRad = THREE.MathUtils.degToRad(alphaHeading);

    // World path logic continues...
    const diff = Math.abs(target - currentHeadingRad);
    const normalizedDiff = Math.abs(((diff + Math.PI) % (Math.PI * 2)) - Math.PI);

    if (normalizedDiff > WRONG_DIR_LIMIT) {
      wrongDirTimer++;
      if (wrongDirTimer > 60) {
        updateInstruction(true);
      }
    } else {
      wrongDirTimer = 0;
      updateInstruction(false);
    }
  }

  drawMiniMap();
  renderer.render(scene, camera);
}
animate();
