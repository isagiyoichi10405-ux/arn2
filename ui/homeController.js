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

startBtn.onclick = () => {
  const destInput = document.getElementById("destinationInput").value;
  const destination = normalize(destInput);

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

  setRoute({ source, destination, path });

  sessionStorage.setItem(
    "navState",
    JSON.stringify({ source, destination, path })
  );

  window.location.href = "nav.html";
};