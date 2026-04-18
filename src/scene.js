import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// ---------------------------------------------------------------------------
// Scene: sky, animated sun, moving clouds, ground grid, orbit controls.
// Exposes helpers used by the IFC loader and the measure tool.
// ---------------------------------------------------------------------------

export function createScene(container) {
  const scene = new THREE.Scene();

  // Sky gradient background via a big inverted sphere (simple but effective).
  const skyGeo = new THREE.SphereGeometry(1000, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      top: { value: new THREE.Color('#6fb7ff') },
      bottom: { value: new THREE.Color('#eaf4ff') },
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vWorld;
      uniform vec3 top;
      uniform vec3 bottom;
      void main() {
        float h = clamp((normalize(vWorld).y + 0.2) * 0.9, 0.0, 1.0);
        gl_FragColor = vec4(mix(bottom, top, h), 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  // Camera
  const camera = new THREE.PerspectiveCamera(
    55,
    container.clientWidth / container.clientHeight,
    0.1,
    5000
  );
  camera.position.set(25, 18, 30);

  // Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);

  // Lights
  const ambient = new THREE.HemisphereLight(0xfff1cc, 0x224466, 0.7);
  scene.add(ambient);

  const sunLight = new THREE.DirectionalLight(0xfff1cc, 1.3);
  sunLight.position.set(40, 60, 30);
  scene.add(sunLight);

  // Decorative sun (glowing sphere)
  const sunGroup = new THREE.Group();
  const sunCore = new THREE.Mesh(
    new THREE.SphereGeometry(2.8, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd27a })
  );
  const sunHalo = new THREE.Mesh(
    new THREE.SphereGeometry(4.2, 32, 32),
    new THREE.MeshBasicMaterial({
      color: 0xffb347,
      transparent: true,
      opacity: 0.25,
    })
  );
  const sunHaloOuter = new THREE.Mesh(
    new THREE.SphereGeometry(6, 32, 32),
    new THREE.MeshBasicMaterial({
      color: 0xffb347,
      transparent: true,
      opacity: 0.08,
    })
  );
  sunGroup.add(sunCore, sunHalo, sunHaloOuter);
  sunGroup.position.set(50, 45, -40);
  scene.add(sunGroup);

  // Clouds: soft white sprites that drift across the sky.
  const clouds = createClouds(scene);

  // Ground grid
  const grid = new THREE.GridHelper(200, 40, 0x4a6aa0, 0x2a3a5a);
  grid.position.y = -0.01;
  grid.material.opacity = 0.45;
  grid.material.transparent = true;
  scene.add(grid);

  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x243045,
    metalness: 0,
    roughness: 0.95,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  scene.add(ground);

  // Controls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 2, 0);

  // Group that holds the loaded IFC models
  const modelsGroup = new THREE.Group();
  modelsGroup.name = 'models';
  scene.add(modelsGroup);

  // Resize handling
  const onResize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', onResize);

  // Animation loop
  const clock = new THREE.Clock();
  const animate = () => {
    const t = clock.getElapsedTime();
    // Gentle sun pulse
    sunHalo.scale.setScalar(1 + Math.sin(t * 1.5) * 0.04);
    sunHaloOuter.scale.setScalar(1 + Math.sin(t * 0.9) * 0.06);
    // Clouds drift
    clouds.update(t);

    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };
  animate();

  // Fit camera to a bounding box (used after an IFC is loaded)
  function frameObject(object3D) {
    const box = new THREE.Box3().setFromObject(object3D);
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    const dist = (maxDim / 2) / Math.tan(fov / 2);
    const dir = new THREE.Vector3(1, 0.8, 1).normalize();
    camera.position.copy(center).add(dir.multiplyScalar(dist * 1.6));
    controls.target.copy(center);
    camera.near = Math.max(0.1, dist / 1000);
    camera.far = dist * 100;
    camera.updateProjectionMatrix();
  }

  return {
    scene,
    camera,
    renderer,
    controls,
    modelsGroup,
    frameObject,
  };
}

function createClouds(scene) {
  const group = new THREE.Group();
  group.name = 'clouds';

  // Procedural cloud texture — a soft radial blob on a canvas
  const tex = makeCloudTexture();

  const count = 14;
  const clouds = [];
  for (let i = 0; i < count; i++) {
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity: 0.55 + Math.random() * 0.25,
      depthWrite: false,
    });
    const s = new THREE.Sprite(mat);
    const scale = 10 + Math.random() * 18;
    s.scale.set(scale, scale * 0.55, 1);
    const angle = Math.random() * Math.PI * 2;
    const radius = 80 + Math.random() * 40;
    s.position.set(
      Math.cos(angle) * radius,
      25 + Math.random() * 25,
      Math.sin(angle) * radius
    );
    s.userData = {
      speed: 0.3 + Math.random() * 0.7,
      baseY: s.position.y,
      phase: Math.random() * Math.PI * 2,
    };
    clouds.push(s);
    group.add(s);
  }
  scene.add(group);

  return {
    group,
    update(t) {
      for (const c of clouds) {
        // Slow orbit around the scene + tiny vertical bobbing
        const ud = c.userData;
        c.position.x += Math.cos(t * 0.05 + ud.phase) * 0.02 * ud.speed;
        c.position.z += Math.sin(t * 0.05 + ud.phase) * 0.02 * ud.speed;
        // Drift eastward slowly
        c.position.x -= 0.04 * ud.speed;
        if (c.position.x < -150) c.position.x = 150;
        c.position.y = ud.baseY + Math.sin(t * 0.4 + ud.phase) * 0.6;
      }
    },
  };
}

function makeCloudTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(
    size / 2,
    size / 2,
    2,
    size / 2,
    size / 2,
    size / 2
  );
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.85)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
