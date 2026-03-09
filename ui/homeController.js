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

const previewOverlay = document.getElementById("path-preview-overlay");
const previewContainer = document.getElementById("path-preview-3d-container");

function draw3DPathAnimation(pathData, callback) {
  previewOverlay.classList.remove("hidden");

  // THREE.JS SCENE SETUP
  const scene3D = new THREE.Scene();
  const camera3D = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  const renderer3D = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer3D.setSize(320, 320);
  previewContainer.appendChild(renderer3D.domElement);

  // Lighting
  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  const point = new THREE.PointLight(0x00f2ff, 1);
  point.position.set(0, 10, 10);
  scene3D.add(ambient, point);

  // Load Model
  const loader = new THREE.GLTFLoader();
  let campusModel = null;

  loader.load("./models/campus_model.glb", (gltf) => {
    campusModel = gltf.scene;
    // Scale down for mini-view
    campusModel.scale.set(0.2, 0.2, 0.2);
    campusModel.rotation.y = -Math.PI / 4;
    scene3D.add(campusModel);

    startPathGrowth();
  }, undefined, (err) => {
    console.error("3D Preview Model Load Error:", err);
    startPathGrowth();
  });

  camera3D.position.set(0, 12, 12);
  camera3D.lookAt(0, 0, 0);

  // PATH GROWTH LOGIC
  const points = pathData.map(id => {
    const coords = campusCoords[id];
    // Scale coords down to match mini-model scale (0.2)
    return new THREE.Vector3(coords.x * 10 * 0.2, 0.1, coords.z * 10 * 0.2);
  });

  let progress = 0;
  let pathGroup = new THREE.Group();
  scene3D.add(pathGroup);

  function startPathGrowth() {
    function animate() {
      if (progress < 1) {
        progress += 0.02; // Speed of growth

        pathGroup.clear();

        // Use a subset of points based on progress
        const segmentCount = Math.floor(points.length * progress);
        if (segmentCount > 1) {
          const activePoints = points.slice(0, segmentCount);

          // Smoother path tube
          const curve = new THREE.CatmullRomCurve3(activePoints);
          const tubeGeo = new THREE.TubeGeometry(curve, activePoints.length * 5, 0.08, 8, false);
          const tubeMat = new THREE.MeshBasicMaterial({
            color: 0x00ff88,
            transparent: true,
            opacity: 0.9
          });
          const pathTube = new THREE.Mesh(tubeGeo, tubeMat);
          pathGroup.add(pathTube);

          // Glowing end point
          const endGeo = new THREE.SphereGeometry(0.15, 12, 12);
          const endMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
          const endNode = new THREE.Mesh(endGeo, endMat);
          endNode.position.copy(points[segmentCount - 1]);
          pathGroup.add(endNode);
        }

        // Camera Orbit
        camera3D.position.x = 12 * Math.sin(Date.now() * 0.0005);
        camera3D.position.z = 12 * Math.cos(Date.now() * 0.0005);
        camera3D.lookAt(0, 0, 0);

        renderer3D.render(scene3D, camera3D);
        requestAnimationFrame(animate);
      } else {
        // Finalized
        setTimeout(() => {
          previewContainer.removeChild(renderer3D.domElement);
          callback();
        }, 1000);
      }
    }
    animate();
  }
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
    draw3DPathAnimation(path, () => {
      window.location.href = "nav.html";
    });
  }, 500);
};
