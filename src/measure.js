import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Measure tool: two-click distance on the loaded IFC model.
// - Click A → place first marker
// - Click B → place second marker, draw line + label (meters / centimeters)
// - Click again → reset and start a new measurement
// ---------------------------------------------------------------------------

export class MeasureTool {
  constructor({ sceneCtx, modelsGroup, hudEl, onStateChange }) {
    this.sceneCtx = sceneCtx; // { scene, camera, renderer, controls }
    this.modelsGroup = modelsGroup;
    this.hud = hudEl;
    this.onStateChange = onStateChange || (() => {});

    this.active = false;
    this.pointA = null;
    this.pointB = null;

    this.group = new THREE.Group();
    this.group.name = 'measure';
    this.sceneCtx.scene.add(this.group);

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    this._onClick = this._onClick.bind(this);
    this._onMove = this._onMove.bind(this);

    // Label overlay (DOM)
    this.labelEl = document.createElement('div');
    Object.assign(this.labelEl.style, {
      position: 'absolute',
      pointerEvents: 'none',
      background: 'rgba(255, 179, 71, 0.95)',
      color: '#1a1200',
      padding: '6px 12px',
      borderRadius: '999px',
      fontSize: '13px',
      fontWeight: '700',
      boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
      transform: 'translate(-50%, -120%)',
      whiteSpace: 'nowrap',
      display: 'none',
      zIndex: '12',
    });
    this.sceneCtx.renderer.domElement.parentElement.appendChild(this.labelEl);
  }

  toggle() {
    this.active ? this.disable() : this.enable();
  }

  enable() {
    if (this.active) return;
    this.active = true;
    this._clear();
    const dom = this.sceneCtx.renderer.domElement;
    dom.addEventListener('pointerdown', this._onClick);
    dom.addEventListener('pointermove', this._onMove);
    dom.style.cursor = 'crosshair';
    this.hud.classList.remove('hidden');
    this.hud.innerHTML = '📏 Mode mesure — cliquez le <strong>point A</strong>';
    this.onStateChange(true);
  }

  disable() {
    if (!this.active) return;
    this.active = false;
    const dom = this.sceneCtx.renderer.domElement;
    dom.removeEventListener('pointerdown', this._onClick);
    dom.removeEventListener('pointermove', this._onMove);
    dom.style.cursor = '';
    this.hud.classList.add('hidden');
    this.onStateChange(false);
  }

  clear() {
    this._clear();
    if (this.active) {
      this.hud.innerHTML = '📏 Mode mesure — cliquez le <strong>point A</strong>';
    }
  }

  _clear() {
    while (this.group.children.length) {
      const c = this.group.children.pop();
      c.geometry?.dispose?.();
      c.material?.dispose?.();
    }
    this.pointA = null;
    this.pointB = null;
    this.labelEl.style.display = 'none';
  }

  _pickPoint(event) {
    const dom = this.sceneCtx.renderer.domElement;
    const rect = dom.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.sceneCtx.camera);

    const targets = [];
    this.modelsGroup.traverse((o) => {
      if (o.isMesh) targets.push(o);
    });
    if (targets.length === 0) return null;

    const hits = this.raycaster.intersectObjects(targets, true);
    return hits.length > 0 ? hits[0].point.clone() : null;
  }

  _onMove(event) {
    if (!this.pointA || this.pointB) return;
    // Could add a live preview line from A to cursor. Kept simple for now.
  }

  _onClick(event) {
    if (event.button !== 0) return; // left click only
    const point = this._pickPoint(event);
    if (!point) {
      this.hud.innerHTML =
        '⚠️ Clic hors modèle — visez un mur, un sol ou un autre élément.';
      return;
    }

    if (!this.pointA) {
      this.pointA = point;
      this._addMarker(point, '#74e08c');
      this.hud.innerHTML = '📏 Point A posé — cliquez le <strong>point B</strong>';
    } else if (!this.pointB) {
      this.pointB = point;
      this._addMarker(point, '#ff6b6b');
      this._drawLine(this.pointA, this.pointB);
      const dist = this.pointA.distanceTo(this.pointB);
      this._showLabel(this.pointA, this.pointB, dist);
      this.hud.innerHTML = `📏 Distance : <strong>${formatDistance(dist)}</strong> — cliquez pour recommencer`;
    } else {
      // third click → reset and use this as new A
      this._clear();
      this.pointA = point;
      this._addMarker(point, '#74e08c');
      this.hud.innerHTML = '📏 Point A posé — cliquez le <strong>point B</strong>';
    }
  }

  _addMarker(pos, color) {
    const geo = new THREE.SphereGeometry(0.12, 16, 16);
    const mat = new THREE.MeshBasicMaterial({ color, depthTest: false });
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(pos);
    m.renderOrder = 999;
    this.group.add(m);
  }

  _drawLine(a, b) {
    const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    const mat = new THREE.LineBasicMaterial({
      color: 0xffb347,
      linewidth: 3,
      depthTest: false,
    });
    const line = new THREE.Line(geo, mat);
    line.renderOrder = 998;
    this.group.add(line);
  }

  _showLabel(a, b, dist) {
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const text = formatDistance(dist);
    this.labelEl.textContent = text;
    this.labelEl.style.display = 'block';
    this._labelMid = mid;

    const updateLabel = () => {
      if (!this._labelMid) return;
      const v = this._labelMid.clone().project(this.sceneCtx.camera);
      const dom = this.sceneCtx.renderer.domElement;
      const rect = dom.getBoundingClientRect();
      const x = ((v.x + 1) / 2) * rect.width + rect.left;
      const y = ((-v.y + 1) / 2) * rect.height + rect.top;
      this.labelEl.style.left = `${x - rect.left}px`;
      this.labelEl.style.top = `${y - rect.top}px`;
      this._raf = requestAnimationFrame(updateLabel);
    };
    cancelAnimationFrame(this._raf);
    updateLabel();
  }
}

/** 5.237 → "5.24 m"  |  0.42 → "0.42 m"  |  12 → "12.00 m" */
export function formatDistance(meters) {
  if (!Number.isFinite(meters)) return '—';
  return `${meters.toFixed(2)} m`;
}
