import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js';

const widget = document.getElementById('pi5-widget');
const canvas = document.getElementById('pi5-canvas');

if (widget && canvas) {
  initPi5Widget(widget, canvas);
}

function initPi5Widget(container, canvasEl) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: canvasEl,
      alpha: true,
      antialias: true,
      powerPreference: 'low-power',
    });
  } catch {
    container.style.display = 'none';
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();

  // Camera distance chosen so full 360-degree diagonal rotation + bob never clips canvas edges
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 0.12, 9.4);
  camera.lookAt(0, 0, 0);

  // Studio 3-point lighting tuned for glossy-satin ABS curves in both light & dark themes
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x6c5e7d, 1.35);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xfffaf4, 2.1);
  keyLight.position.set(4.2, 6.8, 5.8);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xdce9ff, 1.15);
  rimLight.position.set(-5.2, 3.4, -4.6);
  scene.add(rimLight);

  const fillLight = new THREE.DirectionalLight(0xfff0f4, 0.65);
  fillLight.position.set(-2.8, -4.5, 3.8);
  scene.add(fillLight);

  // Outer float group (vertical bob) + inner model group (quaternion orientation)
  const floatGroup = new THREE.Group();
  scene.add(floatGroup);

  const { group: piModel, statusLedMat } = buildPi5Model();
  floatGroup.add(piModel);

  // Iconic 3/4 hero angle showcasing the streamlined red-white swoop, ports, and white lid
  const defaultEuler = new THREE.Euler(0.36, -0.58, -0.05, 'YXZ');
  const defaultQuat = new THREE.Quaternion().setFromEuler(defaultEuler);
  piModel.quaternion.copy(defaultQuat);

  function resize() {
    const rect = container.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  resize();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);

  // Interaction state: trackball quaternion drag + flick inertia + double-click reset
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let isDragging = false;
  let lastX = 0;
  let lastY = 0;
  let velX = 0;
  let velY = 0;
  let idleResumeAt = 0;
  let isResetting = false;

  const axisY = new THREE.Vector3(0, 1, 0);
  const axisX = new THREE.Vector3(1, 0, 0);
  const qYaw = new THREE.Quaternion();
  const qPitch = new THREE.Quaternion();

  function applyWorldRotation(dx, dy) {
    const sensitivity = 0.0115;
    qYaw.setFromAxisAngle(axisY, dx * sensitivity);
    qPitch.setFromAxisAngle(axisX, dy * sensitivity);
    piModel.quaternion.premultiply(qYaw);
    piModel.quaternion.premultiply(qPitch);
    piModel.quaternion.normalize();
  }

  canvasEl.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    isDragging = true;
    isResetting = false;
    lastX = e.clientX;
    lastY = e.clientY;
    velX = 0;
    velY = 0;
    container.classList.add('is-dragging');
    canvasEl.setPointerCapture(e.pointerId);
  });

  canvasEl.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;

    applyWorldRotation(dx, dy);
    velX = velX * 0.4 + dx * 0.6;
    velY = velY * 0.4 + dy * 0.6;
  });

  function endDrag(e) {
    if (!isDragging) return;
    isDragging = false;
    container.classList.remove('is-dragging');
    idleResumeAt = performance.now() + 2600;
    if (e && canvasEl.hasPointerCapture(e.pointerId)) {
      canvasEl.releasePointerCapture(e.pointerId);
    }
  }

  canvasEl.addEventListener('pointerup', endDrag);
  canvasEl.addEventListener('pointercancel', endDrag);

  canvasEl.addEventListener('dblclick', () => {
    velX = 0;
    velY = 0;
    isResetting = true;
    idleResumeAt = performance.now() + 1800;
  });

  // Keyboard accessibility: arrow keys rotate, R or Enter resets
  canvasEl.addEventListener('keydown', (e) => {
    const step = 14;
    if (e.key === 'ArrowLeft') {
      applyWorldRotation(-step, 0);
      e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      applyWorldRotation(step, 0);
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      applyWorldRotation(0, -step);
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      applyWorldRotation(0, step);
      e.preventDefault();
    } else if (e.key === 'r' || e.key === 'R' || e.key === 'Enter') {
      isResetting = true;
      e.preventDefault();
    }
  });

  // Animation loop
  const shadowEl = container.querySelector('.pi5-shadow');
  let lastTime = performance.now();

  function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    const t = now * 0.001;
    const reduced = motionQuery.matches;

    if (!isDragging) {
      if (isResetting) {
        piModel.quaternion.slerp(defaultQuat, 1 - Math.exp(-8 * dt));
        if (piModel.quaternion.angleTo(defaultQuat) < 0.005) {
          piModel.quaternion.copy(defaultQuat);
          isResetting = false;
        }
      } else if (Math.abs(velX) > 0.05 || Math.abs(velY) > 0.05) {
        applyWorldRotation(velX, velY);
        const damping = Math.exp(-4.8 * dt);
        velX *= damping;
        velY *= damping;
      } else if (!reduced && now > idleResumeAt) {
        qYaw.setFromAxisAngle(axisY, 0.24 * dt);
        piModel.quaternion.premultiply(qYaw);
        piModel.quaternion.normalize();
      }
    }

    if (!reduced) {
      const bob = Math.sin(t * 1.9);
      floatGroup.position.y = bob * 0.11;
      if (shadowEl) {
        const s = 1 - bob * 0.08;
        const op = 0.88 - bob * 0.14;
        shadowEl.style.transform = `translateX(-50%) scale(${s.toFixed(3)})`;
        shadowEl.style.opacity = op.toFixed(3);
      }
    } else {
      floatGroup.position.y = 0;
    }

    // Subtle live Raspberry Pi activity LED heartbeat
    if (statusLedMat) {
      const pulse = 0.65 + 0.35 * Math.sin(t * 2.8) + 0.25 * Math.max(0, Math.sin(t * 11.3) * Math.sin(t * 1.7));
      statusLedMat.emissiveIntensity = 1.1 + pulse * 1.2;
    }

    renderer.render(scene, camera);
  }

  requestAnimationFrame(animate);
  container.classList.add('is-ready');
}

function smootherstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * Sample a closed rounded-rectangle perimeter in XZ plane with outward normals.
 * Ordering ensures (U x T) points outward for lofted vertical rings.
 */
function sampleRoundedRectPerimeter(L, W, R, cornerSegs = 14, edgeSegs = 22) {
  const cx = L / 2 - R;
  const cz = W / 2 - R;
  const pts = [];

  const pushArc = (ox, oz, a0, a1) => {
    for (let i = 0; i < cornerSegs; i++) {
      const a = a0 + ((a1 - a0) * i) / cornerSegs;
      const nx = Math.cos(a);
      const nz = Math.sin(a);
      pts.push({ x: ox + R * nx, z: oz + R * nz, nx, nz });
    }
  };

  const pushEdge = (x0, z0, x1, z1, nx, nz, segs) => {
    for (let i = 0; i < segs; i++) {
      const f = i / segs;
      pts.push({ x: x0 + (x1 - x0) * f, z: z0 + (z1 - z0) * f, nx, nz });
    }
  };

  // Front-right arc -> Front (+Z) -> Front-left arc -> Left (-X) ->
  // Back-left arc -> Back (-Z) -> Back-right arc -> Right (+X)
  pushArc(cx, cz, 0, Math.PI / 2);
  pushEdge(cx, W / 2, -cx, W / 2, 0, 1, edgeSegs);
  pushArc(-cx, cz, Math.PI / 2, Math.PI);
  pushEdge(-L / 2, cz, -L / 2, -cz, -1, 0, Math.round(edgeSegs * 0.65));
  pushArc(-cx, -cz, Math.PI, Math.PI * 1.5);
  pushEdge(-cx, -W / 2, cx, -W / 2, 0, -1, edgeSegs);
  pushArc(cx, -cz, Math.PI * 1.5, Math.PI * 2);
  pushEdge(L / 2, -cz, L / 2, cz, 1, 0, Math.round(edgeSegs * 0.65));

  return pts;
}

/**
 * Build a smooth lofted 3D shell along the perimeter where each perimeter point
 * can have a custom vertical profile (allowing sculpted S-curve parting lines).
 */
function buildLoftedShell(perimeter, getRingsForPoint) {
  const N = perimeter.length;
  const sampleRings = getRingsForPoint(perimeter[0]);
  const M = sampleRings.length;

  const positions = new Float32Array(N * M * 3);
  for (let i = 0; i < N; i++) {
    const p = perimeter[i];
    const rings = getRingsForPoint(p);
    for (let r = 0; r < M; r++) {
      const { y, inset } = rings[r];
      const idx = (i * M + r) * 3;
      positions[idx] = p.x - p.nx * inset;
      positions[idx + 1] = y;
      positions[idx + 2] = p.z - p.nz * inset;
    }
  }

  const indices = [];
  for (let i = 0; i < N; i++) {
    const next = (i + 1) % N;
    for (let r = 0; r < M - 1; r++) {
      const a = i * M + r;
      const b = next * M + r;
      const c = next * M + (r + 1);
      const d = i * M + (r + 1);
      indices.push(a, d, c, a, c, b);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function createRoundedRectShape(width, height, radius) {
  const s = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  const r = Math.min(radius, width / 2, height / 2);

  s.moveTo(x + r, y);
  s.lineTo(x + width - r, y);
  s.quadraticCurveTo(x + width, y, x + width, y + r);
  s.lineTo(x + width, y + height - r);
  s.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  s.lineTo(x + r, y + height);
  s.quadraticCurveTo(x, y + height, x, y + height - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function createRoundedPlateGeometry(width, depth, radius, facingUp = true) {
  const shape = createRoundedRectShape(width, depth, radius);
  const geo = new THREE.ShapeGeometry(shape, 18);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) + width / 2) / width, (pos.getY(i) + depth / 2) / depth);
  }
  uv.needsUpdate = true;
  geo.rotateX(facingUp ? -Math.PI / 2 : Math.PI / 2);
  return geo;
}

function createExtrudedCapsule(width, height, radius, depth) {
  const shape = createRoundedRectShape(width, height, radius);
  return new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: 12,
  });
}

function createTopLidTextures(plateW, plateD) {
  const size = 1024;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d');

  // Crisp glossy-satin official white lid
  ctx.fillStyle = '#f8f8f6';
  ctx.fillRect(0, 0, size, size);

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  // Subtle embossed Raspberry Pi berry silhouette right near the USB (+X) end,
  // with the bottom of the berry pointing toward the USB ports.
  const drawBerry = (c, fill, stroke, lineWidth, isBump) => {
    c.save();
    // Position near u = 1 (+X, USB end), centered along Z
    c.translate(size * 0.865, size * 0.5);
    // Compensate for non-square top plate aspect ratio BEFORE rotating
    c.scale(1.0, plateW / plateD);
    // Rotate -90 deg so local +Y (bottom of berry) points toward +X (USB end)
    c.rotate(-Math.PI / 2);
    c.scale(0.84, 0.84);

    const leaf = (lx, ly, rot) => {
      c.save();
      c.translate(lx, ly);
      c.rotate(rot);
      c.beginPath();
      c.ellipse(0, 0, 36, 17, 0, 0, Math.PI * 2);
      c.fillStyle = fill;
      c.fill();
      c.strokeStyle = stroke;
      c.lineWidth = lineWidth;
      c.stroke();
      c.restore();
    };
    leaf(-30, -76, 0.42);
    leaf(30, -76, -0.42);

    const drupelets = [
      [-25, -40, 18],
      [25, -40, 18],
      [0, -46, 16],
      [-49, -10, 19],
      [0, -14, 21],
      [49, -10, 19],
      [-35, 25, 19],
      [35, 25, 19],
      [0, 25, 19],
      [-19, 56, 16],
      [19, 56, 16],
      [0, 72, 16],
    ];

    for (const [dx, dy, rad] of drupelets) {
      c.beginPath();
      c.arc(dx, dy, rad, 0, Math.PI * 2);
      c.fillStyle = fill;
      c.fill();
      c.strokeStyle = stroke;
      c.lineWidth = lineWidth;
      c.stroke();
    }

    if (!isBump) {
      for (const [dx, dy, rad] of drupelets) {
        c.beginPath();
        c.arc(dx - 3, dy - 3, rad * 0.5, 0, Math.PI * 2);
        c.fillStyle = 'rgba(255, 255, 255, 0.42)';
        c.fill();
      }
    }

    c.restore();
  };

  drawBerry(ctx, '#ebe8e3', 'rgba(128, 118, 126, 0.24)', 4.5, false);
  drawBerry(bCtx, '#686868', '#444444', 7, true);

  const colorMap = new THREE.CanvasTexture(colorCanvas);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.anisotropy = 4;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.anisotropy = 4;

  return { colorMap, bumpMap };
}

function createBottomTextures() {
  const w = 1024;
  const h = 724;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  // Official bright raspberry red underside
  ctx.fillStyle = '#d41d4f';
  ctx.fillRect(0, 0, w, h);

  // Subtle recessed underside bay
  ctx.fillStyle = '#c21847';
  ctx.beginPath();
  ctx.roundRect(110, 86, w - 220, h - 172, 56);
  ctx.fill();

  // Cooling intake vent slits
  ctx.fillStyle = '#5e0a23';
  const rows = 3;
  const cols = 10;
  const startX = 240;
  const gapX = 56;
  const startY = 178;
  const gapY = 128;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      ctx.beginPath();
      ctx.roundRect(startX + col * gapX, startY + r * gapY, 22, 86, 11);
      ctx.fill();
    }
  }

  // Molded subtle text
  ctx.fillStyle = 'rgba(255, 228, 238, 0.4)';
  ctx.font = '600 32px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Raspberry Pi 5', w * 0.5, h - 116);

  // MicroSD finger notch cutout on the -X edge
  ctx.fillStyle = '#7e0f30';
  ctx.beginPath();
  ctx.arc(46, h * 0.5, 58, -Math.PI / 2, Math.PI / 2);
  ctx.fill();

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  return map;
}

function buildPi5Model() {
  const group = new THREE.Group();

  // Official Pi 5 Case (SC1159) proportions (~98mm x 70mm x 30mm scaled by 1/25)
  const L = 3.92;
  const W = 2.8;
  const R = 0.4;

  // Materials — satin-matte official Raspberry Red & White body + slightly glossier white lid
  const redPlasticMat = new THREE.MeshStandardMaterial({
    color: 0xd61e4f,
    roughness: 0.34,
    metalness: 0.02,
  });

  const whiteBodyMat = new THREE.MeshStandardMaterial({
    color: 0xf7f7f5,
    roughness: 0.32,
    metalness: 0.02,
  });

  const whiteLidMat = new THREE.MeshStandardMaterial({
    color: 0xfafaf8,
    roughness: 0.18,
    metalness: 0.02,
  });

  const darkLinerMat = new THREE.MeshStandardMaterial({
    color: 0x221c28,
    roughness: 0.82,
    metalness: 0.04,
  });

  const rubberMat = new THREE.MeshStandardMaterial({
    color: 0x221f28,
    roughness: 0.88,
    metalness: 0.02,
  });

  const metalPortMat = new THREE.MeshStandardMaterial({
    color: 0xdbe0e7,
    roughness: 0.24,
    metalness: 0.88,
  });

  const portInteriorMat = new THREE.MeshStandardMaterial({
    color: 0x131318,
    roughness: 0.85,
    metalness: 0.1,
  });

  const usb3BlueMat = new THREE.MeshStandardMaterial({
    color: 0x1a6cf0,
    roughness: 0.35,
    metalness: 0.05,
  });

  const usb2BlackMat = new THREE.MeshStandardMaterial({
    color: 0x2c2d36,
    roughness: 0.5,
    metalness: 0.05,
  });

  const goldPinMat = new THREE.MeshStandardMaterial({
    color: 0xd9a841,
    roughness: 0.3,
    metalness: 0.9,
  });

  // High edge sampling (64 segments along long sides) keeps the steep S-curve elbows silky smooth
  const perimeter = sampleRoundedRectPerimeter(L, W, R, 16, 64);

  // Subtle ~4-degree outward flare from bottom belly up to the top rim (matches real SC1159 profile)
  function wallInset(y) {
    const t = Math.max(0, Math.min(1, (0.4 - y) / 0.84));
    return 0.055 * t;
  }

  // Steep, crisp official Pi 5 red-white S-curve parting line:
  // Stays high (+0.22) across ~64% from the -X (SD/Power) end, then drops steeply over a compact
  // ~17% transition (x = +0.52 .. +1.20) down to a thin red lower chin (-0.35) under USB/Ethernet.
  function seamYAtX(x) {
    const yHigh = 0.22;
    const yLow = -0.35;
    const s = smootherstep(0.52, 1.2, x);
    return yHigh + (yLow - yHigh) * s;
  }

  // 1. Sculpted Red Lower Shell (tapered wall + crisp steep S-curve upper rim)
  const redShellGeo = buildLoftedShell(perimeter, (p) => {
    const sy = seamYAtX(p.x);
    const yBelow = sy - 0.022;
    const yLip = sy - 0.004;
    const lipIn = wallInset(yLip);
    return [
      { y: -0.58, inset: 0.145 },
      { y: -0.56, inset: 0.095 },
      { y: -0.52, inset: 0.068 },
      { y: -0.44, inset: wallInset(-0.44) },
      { y: yBelow, inset: wallInset(yBelow) },
      { y: yLip, inset: lipIn + 0.013 },
      { y: yLip, inset: lipIn + 0.055 },
    ];
  });
  group.add(new THREE.Mesh(redShellGeo, redPlasticMat));

  // 2. Sculpted White Upper Frame (interlocks cleanly along the steep S-curve)
  const whiteFrameGeo = buildLoftedShell(perimeter, (p) => {
    const sy = seamYAtX(p.x);
    const yLip = sy + 0.004;
    const yAbove = sy + 0.022;
    const yMid = yAbove + (0.376 - yAbove) * 0.5;
    const lipIn = wallInset(yLip);
    return [
      { y: yLip, inset: lipIn + 0.055 },
      { y: yLip, inset: lipIn + 0.013 },
      { y: yAbove, inset: wallInset(yAbove) },
      { y: yMid, inset: wallInset(yMid) },
      { y: 0.376, inset: wallInset(0.376) },
      { y: 0.402, inset: 0.014 },
      { y: 0.402, inset: 0.075 },
    ];
  });
  group.add(new THREE.Mesh(whiteFrameGeo, whiteBodyMat));

  // 3. Recessed Inner Dark Liner (backs both the S-curve parting groove & the slim airflow slot)
  const linerGeo = buildLoftedShell(perimeter, () => [
    { y: -0.42, inset: 0.075 },
    { y: 0.472, inset: 0.072 },
  ]);
  group.add(new THREE.Mesh(linerGeo, darkLinerMat));

  // 4. Sleek Overhanging White Top Lid (crisp chamfered overhang lip + gentle low-profile dome)
  const whiteLidGeo = buildLoftedShell(perimeter, () => [
    { y: 0.45, inset: 0.075 },
    { y: 0.456, inset: 0.008 },
    { y: 0.482, inset: -0.022 },
    { y: 0.51, inset: -0.012 },
    { y: 0.546, inset: 0.032 },
    { y: 0.576, inset: 0.095 },
    { y: 0.592, inset: 0.16 },
  ]);
  group.add(new THREE.Mesh(whiteLidGeo, whiteLidMat));

  // 5. Flush Rounded White Top Cap with Subtle Embossed Raspberry Pi Emblem
  const topW = L - 0.32;
  const topD = W - 0.32;
  const topR = R - 0.16;
  const { colorMap: topColorMap, bumpMap: topBumpMap } = createTopLidTextures(topW, topD);
  const topPlateGeo = createRoundedPlateGeometry(topW, topD, topR, true);
  const topPlateMat = new THREE.MeshStandardMaterial({
    map: topColorMap,
    bumpMap: topBumpMap,
    bumpScale: 0.015,
    roughness: 0.18,
    metalness: 0.02,
  });
  const topPlate = new THREE.Mesh(topPlateGeo, topPlateMat);
  topPlate.position.y = 0.592;
  group.add(topPlate);

  // 6. Flush Rounded Red Underside Cap (cooling vents + molded text) & 4 Anti-Slip Rubber Feet
  const botW = L - 0.29;
  const botD = W - 0.29;
  const botR = R - 0.145;
  const bottomMap = createBottomTextures();
  const bottomPlateGeo = createRoundedPlateGeometry(botW, botD, botR, false);
  const bottomPlateMat = new THREE.MeshStandardMaterial({
    map: bottomMap,
    roughness: 0.42,
    metalness: 0.03,
  });
  const bottomPlate = new THREE.Mesh(bottomPlateGeo, bottomPlateMat);
  bottomPlate.position.y = -0.58;
  group.add(bottomPlate);

  const footGeo = new THREE.CylinderGeometry(0.13, 0.15, 0.05, 20);
  const footCoords = [
    [-1.26, -0.602, -0.8],
    [1.26, -0.602, -0.8],
    [-1.26, -0.602, 0.8],
    [1.26, -0.602, 0.8],
  ];
  for (const [fx, fy, fz] of footCoords) {
    const foot = new THREE.Mesh(footGeo, rubberMat);
    foot.position.set(fx, fy, fz);
    group.add(foot);
  }

  // 7. Right Short Edge (+X): Framed by White Upper Shell above the Thin Red Chin
  // Pi 5 Rear I/O order: Ethernet (+Z), 2x USB 3.0 Blue (mid), 2x USB 2.0 Black (-Z)
  const ioX = L / 2 - wallInset(0.04);
  const ioBay = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.56, 1.76), portInteriorMat);
  ioBay.position.set(ioX - 0.02, 0.04, 0);
  group.add(ioBay);

  // 7a. Gigabit Ethernet RJ45 (+Z side)
  const ethGroup = new THREE.Group();
  ethGroup.position.set(ioX - 0.01, 0.04, 0.6);
  ethGroup.add(new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.48, 0.52), metalPortMat));
  const ethCavity = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.33, 0.38), portInteriorMat);
  ethCavity.position.set(0.038, -0.02, 0);
  ethGroup.add(ethCavity);
  const ethNotch = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.075, 0.17), portInteriorMat);
  ethNotch.position.set(0.038, 0.155, 0);
  ethGroup.add(ethNotch);
  for (let i = -3; i <= 3; i++) {
    const pin = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.075, 0.018), goldPinMat);
    pin.position.set(0.056, -0.125, i * 0.042);
    ethGroup.add(pin);
  }
  const ethLedGreen = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.052, 0.055),
    new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x16a34a, emissiveIntensity: 0.7 })
  );
  ethLedGreen.position.set(0.052, 0.18, 0.17);
  ethGroup.add(ethLedGreen);

  const ethLedAmber = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.052, 0.055),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.55 })
  );
  ethLedAmber.position.set(0.052, 0.18, -0.17);
  ethGroup.add(ethLedAmber);
  group.add(ethGroup);

  function createUsbStack(zPos, tongueMat) {
    const uGroup = new THREE.Group();
    uGroup.position.set(ioX - 0.01, 0.04, zPos);

    uGroup.add(new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.52, 0.46), metalPortMat));

    for (const slotY of [0.12, -0.12]) {
      const cav = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.17, 0.37), portInteriorMat);
      cav.position.set(0.038, slotY, 0);
      uGroup.add(cav);

      const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.32), tongueMat);
      tongue.position.set(0.048, slotY + 0.032, 0);
      uGroup.add(tongue);
    }
    return uGroup;
  }

  group.add(createUsbStack(-0.02, usb3BlueMat));
  group.add(createUsbStack(-0.6, usb2BlackMat));

  // 8. Front Long Edge (+Z): USB-C + Dual Micro-HDMI flush in the Tall Red Section
  const frontZ = W / 2 - wallInset(-0.15);
  const usbcGroup = new THREE.Group();
  usbcGroup.position.set(-1.1, -0.15, frontZ - 0.01);
  usbcGroup.add(new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.165, 0.04), portInteriorMat));

  const usbcRim = new THREE.Mesh(createExtrudedCapsule(0.32, 0.115, 0.056, 0.04), metalPortMat);
  usbcRim.position.z = 0.006;
  usbcGroup.add(usbcRim);

  const usbcCav = new THREE.Mesh(createExtrudedCapsule(0.25, 0.072, 0.035, 0.045), portInteriorMat);
  usbcCav.position.z = 0.01;
  usbcGroup.add(usbcCav);

  const usbcTongue = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.03), usb2BlackMat);
  usbcTongue.position.z = 0.043;
  usbcGroup.add(usbcTongue);
  group.add(usbcGroup);

  function createMicroHdmi(xPos) {
    const hGroup = new THREE.Group();
    hGroup.position.set(xPos, -0.15, frontZ - 0.01);

    hGroup.add(new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.155, 0.04), portInteriorMat));

    const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.105, 0.06), metalPortMat);
    bezel.position.z = 0.01;
    hGroup.add(bezel);

    const cav = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.062, 0.045), portInteriorMat);
    cav.position.z = 0.022;
    hGroup.add(cav);

    const pinBar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.018, 0.025), goldPinMat);
    pinBar.position.set(0, 0, 0.034);
    hGroup.add(pinBar);

    return hGroup;
  }

  group.add(createMicroHdmi(-0.48));
  group.add(createMicroHdmi(0.08));

  // 9. Left Short Edge (-X): High Red Wall with Clear 2-in-1 Power Button + MicroSD Slot
  const pwrX = -(L / 2 - wallInset(-0.06));
  const pwrGroup = new THREE.Group();
  pwrGroup.position.set(pwrX + 0.01, -0.06, 0.72);
  pwrGroup.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.22), portInteriorMat));

  const statusLedMat = new THREE.MeshStandardMaterial({
    color: 0x34f58c,
    emissive: 0x1ee678,
    emissiveIntensity: 1.8,
    roughness: 0.2,
  });
  const statusLed = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.06, 0.06), statusLedMat);
  statusLed.position.set(-0.022, 0, -0.02);
  pwrGroup.add(statusLed);

  const pwrBtnMat = new THREE.MeshStandardMaterial({
    color: 0xf4f7fb,
    roughness: 0.18,
    metalness: 0.05,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });
  const pwrBtn = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.11, 0.15), pwrBtnMat);
  pwrBtn.position.set(-0.026, 0, 0);
  pwrGroup.add(pwrBtn);
  group.add(pwrGroup);

  // MicroSD Slot + subtly peeking MicroSD card on lower -X tapered edge
  const sdX = -(L / 2 - wallInset(-0.39));
  const sdGroup = new THREE.Group();
  sdGroup.position.set(sdX + 0.02, -0.39, 0);
  sdGroup.add(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.088, 0.48), portInteriorMat));

  const sdCard = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.38), rubberMat);
  sdCard.position.set(-0.04, 0, 0);
  sdGroup.add(sdCard);

  const sdStripe = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.043, 0.36), redPlasticMat);
  sdStripe.position.set(-0.08, 0, 0);
  sdGroup.add(sdStripe);
  group.add(sdGroup);

  return { group, statusLedMat };
}
