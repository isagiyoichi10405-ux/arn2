import { campusCoords } from './data/campusMap.js';

/* ======================
   THREE + AR SETUP
====================== */
const scene = new THREE.Scene();
const camera = new THREE.Camera();
scene.add(camera);

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);
document.body.appendChild(renderer.domElement);

/* ======================
   AR TOOLKIT
====================== */
const arSource = new THREEx.ArToolkitSource({ sourceType: 'webcam' });

arSource.init(() => resize());
window.addEventListener('resize', resize);

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  renderer.setSize(width, height);
  arSource.onResizeElement();
  arSource.copyElementSizeTo(renderer.domElement);

  if (arContext.arController) {
    arSource.copyElementSizeTo(arContext.arController.canvas);
  }
}

const arContext = new THREEx.ArToolkitContext({
  cameraParametersUrl: 'data/camera_para.dat',
  detectionMode: 'mono'
});

arContext.init(() => {
  camera.projectionMatrix.copy(arContext.getProjectionMatrix());
});

/* ======================
   MARKER ROOT (QR)
====================== */
const markerRoot = new THREE.Group();
scene.add(markerRoot);

new THREEx.ArMarkerControls(arContext, markerRoot, {
  type: 'pattern',
  patternUrl: 'data/markers/b8-marker.patt'
});

/* ======================
   LOAD CAMPUS MODEL
====================== */
const loader = new THREE.GLTFLoader();
loader.load('./models/campus_model.glb', (gltf) => {
  const campus = gltf.scene;
  campus.position.set(0, 0, 0);
  campus.scale.set(1, 1, 1); // already meters
  markerRoot.add(campus);
});

/* ======================
   ARROWS (TEST PATH)
====================== */
const arrows = new THREE.Group();
markerRoot.add(arrows);

function addArrow(from, to) {
  const geo = new THREE.ConeGeometry(0.3, 0.8, 12);
  const mat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
  const arrow = new THREE.Mesh(geo, mat);

  arrow.position.set(from.x, 0.15, from.z);

  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const angle = Math.atan2(dx, dz);
  arrow.rotation.set(Math.PI / 2, angle, 0);

  arrows.add(arrow);
}

const path = ['ENTRY', 'B8', 'B3', 'ADMIN_BLOCK'];
let spawned = false;

/* ======================
   RENDER LOOP
====================== */
function animate() {
  requestAnimationFrame(animate);

  if (arSource.ready) {
    arContext.update(arSource.domElement);

    if (markerRoot.visible && !spawned) {
      for (let i = 0; i < path.length - 1; i++) {
        addArrow(campusCoords[path[i]], campusCoords[path[i + 1]]);
      }
      spawned = true;
    }
  }

  renderer.render(scene, camera);
}

animate();