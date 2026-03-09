import { aStarShortestPath } from "../core/graph.js";
import { campusCoords, campusGraph } from "../data/campusMap.js";
import { setRoute } from "../state/navigationStore.js";

const normalize = s => s.replace(/\s+/g, "_").toUpperCase();

const locText = document.getElementById("locText");
const startBtn = document.getElementById("startBtn");

const qrOverlay = document.getElementById("qr-overlay");
const appUI = document.getElementById("app");
const qrStatus = document.getElementById("qr-status");
const startScanBtn = document.getElementById("startScanBtn");

function showApp() {
  qrOverlay.classList.remove("is-scanning");
  qrOverlay.classList.add("hidden");
  appUI.classList.remove("hidden");
  appUI.classList.add("active");
}

let source = null;

if (startScanBtn) {
  const scanner = new Html5Qrcode("qr-reader");

  startScanBtn.onclick = async () => {
    try {
      startScanBtn.classList.add("hidden");
      qrOverlay.classList.add("is-scanning");
      qrStatus.innerText = "Align QR code with camera";

      await scanner.start(
        { facingMode: "environment" },
        { fps: 15, qrbox: 250 },
        qrText => {
          let data;

          try {
            data = JSON.parse(qrText);
          } catch {
            data = { id: qrText.trim() };
          }

          source = normalize(data.id);

          if (!campusCoords[source]) {
            qrStatus.innerText = `Unknown Building: ${source}`;
            return;
          }

          sessionStorage.setItem(
            "qrAnchor",
            JSON.stringify({ id: source })
          );

          locText.value = source;
          qrStatus.innerText = `Matched: ${source}`;

          scanner.stop().then(showApp);
        }
      );
    } catch (err) {
      console.error(err);
      qrOverlay.classList.remove("is-scanning");
      qrStatus.innerText = "Camera access required";
      startScanBtn.classList.remove("hidden");
    }
  };
}

// Full Blocks Selection
const allBlocksGrid = document.getElementById("all-blocks-grid");
const destInput = document.getElementById("destinationInput");

const allBlocks = Object.keys(campusCoords).filter(id => {
  // Filter out Roads and Entry
  return !id.startsWith("R") && id !== "ENTRY";
}).sort();

allBlocks.forEach(block => {
  const btn = document.createElement("button");
  btn.className = "chip";
  btn.textContent = block.replace("_", " ");
  btn.setAttribute("data-id", block);
  btn.onclick = () => {
    destInput.value = block;
    refreshActiveChip(block);
  };
  allBlocksGrid.appendChild(btn);
});

function refreshActiveChip(activeId) {
  document.querySelectorAll(".chip").forEach(c => {
    if (c.getAttribute("data-id") === activeId) {
      c.classList.add("active");
    } else {
      c.classList.remove("active");
    }
  });
}

// Quick Destination Chips (existing ones in HTML)
const quickChips = document.querySelectorAll(".quick-destinations .chip");
quickChips.forEach(chip => {
  chip.onclick = () => {
    const id = chip.getAttribute("data-id");
    destInput.value = id;
    refreshActiveChip(id);
  };
});

const overlay = document.getElementById("path-preview-overlay");
const canvas = document.getElementById("path-preview-canvas");
const ctx = canvas.getContext("2d");

function drawPathAnimation(path, callback) {
  overlay.classList.remove("hidden");

  // Set canvas size
  canvas.width = 320;
  canvas.height = 320;

  const nodes = path.map(id => campusCoords[id]);
  const xs = nodes.map(n => n.x);
  const zs = nodes.map(n => n.z);

  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minZ = Math.min(...zs), maxZ = Math.max(...zs);

  // Normalize mapping (fit path into 260px area with 30px padding)
  const pad = 30;
  const sx = x => ((x - minX) / (Math.max(1, maxX - minX))) * 260 + pad;
  const sz = z => ((z - minZ) / (Math.max(1, maxZ - minZ))) * 260 + pad;

  let currentStep = 0;
  let progress = 0;

  function animate() {
    ctx.clearRect(0, 0, 320, 320);

    // Draw background grid (blueprint feel)
    ctx.strokeStyle = "rgba(0, 242, 255, 0.05)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 320; i += 20) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 320); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(320, i); ctx.stroke();
    }

    // Draw lines already completed
    ctx.strokeStyle = "#00f2ff";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#00f2ff";

    ctx.beginPath();
    for (let i = 0; i < currentStep; i++) {
      const p1 = nodes[i];
      const p2 = nodes[i + 1];
      ctx.moveTo(sx(p1.x), sz(p1.z));
      ctx.lineTo(sx(p2.x), sz(p2.z));
    }
    ctx.stroke();

    // Draw current segment
    if (currentStep < nodes.length - 1) {
      const p1 = nodes[currentStep];
      const p2 = nodes[currentStep + 1];
      const tx = sx(p1.x) + (sx(p2.x) - sx(p1.x)) * progress;
      const tz = sz(p1.z) + (sz(p2.z) - sz(p1.z)) * progress;

      ctx.beginPath();
      ctx.moveTo(sx(p1.x), sz(p1.z));
      ctx.lineTo(tx, tz);
      ctx.stroke();

      progress += 0.1; // Speed of lines
      if (progress >= 1) {
        progress = 0;
        currentStep++;
      }
      requestAnimationFrame(animate);
    } else {
      // Done - draw nodes
      nodes.forEach((n, i) => {
        ctx.fillStyle = (i === 0) ? "#00ff88" : (i === nodes.length - 1) ? "#ff3333" : "#ffffff";
        ctx.beginPath();
        ctx.arc(sx(n.x), sz(n.z), 5, 0, Math.PI * 2);
        ctx.fill();
      });
      setTimeout(callback, 800);
    }
  }

  animate();
}

startBtn.onclick = () => {
  const destInputVal = document.getElementById("destinationInput").value;
  const destination = normalize(destInputVal);

  if (!source) {
    alert("Please scan a starting QR first");
    return;
  }

  if (!destination || !campusCoords[destination]) {
    alert("Please enter a valid destination (e.g. ADMIN_BLOCK)");
    return;
  }

  const path = aStarShortestPath(
    campusGraph,
    campusCoords,
    source,
    destination
  );

  if (!path) {
    alert("No path found between these locations");
    return;
  }

  // Set state for session
  setRoute({ source, destination, path });
  sessionStorage.setItem("navState", JSON.stringify({ source, destination, path }));

  // UI TRANSITION SEQUENCE
  appUI.classList.add("fade-out");

  setTimeout(() => {
    drawPathAnimation(path, () => {
      window.location.href = "nav.html";
    });
  }, 500);
};
