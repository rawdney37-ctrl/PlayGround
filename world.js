import * as THREE from './vendor/three.module.min.js';

/* ============================================================
   AFTERLIGHT — world generation
   ============================================================ */

export const WORLD = 1800;
export const HALF = WORLD / 2;
export const WATER_LEVEL = 0.55;

let seed = 743192;
export function rand() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}
export const pick = (arr) => arr[Math.floor(rand() * arr.length)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const lerp = (a, b, t) => a + (b - a) * t;

/* ------------------------------------------------------------
   Settlements, roads, water
   ------------------------------------------------------------ */
export const settlements = [
  { id: 'pine', name: 'Pine Ridge', kind: 'village', x: 0, z: 0, r: 62, discovered: true, note: 'A quiet hamlet swallowed by the forest.' },
  { id: 'raven', name: 'Ravenwood', kind: 'city', x: 520, z: -430, r: 92, discovered: false, note: 'Ruined blocks, a supermarket and a police station.' },
  { id: 'marlow', name: 'Marlow Farm', kind: 'farm', x: -560, z: -380, r: 64, discovered: false, note: 'Barn, silo and fields. Good for food and fuel.' },
  { id: 'mill', name: 'Old Mill', kind: 'industrial', x: 600, z: 470, r: 74, discovered: false, note: 'Warehouses and scrap. Loud, dangerous work.' },
  { id: 'ashwood', name: 'Ashwood Camp', kind: 'camp', x: -520, z: 430, r: 52, discovered: false, note: 'Ranger camp. Hunting gear and clean water.' },
  { id: 'delta', name: 'Blacksite Delta', kind: 'military', x: 40, z: 690, r: 74, discovered: false, note: 'Quarantine checkpoint. Military loot, heavy infected.' },
  { id: 'clinic', name: 'Riverside Clinic', kind: 'hospital', x: -160, z: -620, r: 42, discovered: false, note: 'Medical supplies. Worth the risk.' },
];

export const roads = [
  ['pine', 'raven'], ['pine', 'marlow'], ['pine', 'mill'], ['pine', 'ashwood'],
  ['pine', 'delta'], ['marlow', 'clinic'], ['raven', 'clinic'], ['mill', 'delta'],
];

export const lakes = [
  { x: 300, z: 150, rx: 148, rz: 108 },
];

export const rivers = [
  { x: -770, amp: 55, freq: 0.0062, half: 21, name: 'Cascade River' },
];

export const riverPoint = (river, z) => ({
  x: river.x + Math.sin(z * river.freq) * river.amp,
  z,
});

function rawHeight(x, z) {
  let h = 3.4;
  h += Math.sin(x * 0.0082) * Math.cos(z * 0.0071) * 2.1;
  h += Math.sin(x * 0.019 + 1.2) * Math.cos(z * 0.016 - 0.7) * 1.15;
  h += Math.sin((x + z) * 0.041) * 0.32;
  // edge mountains
  const edge = Math.max(Math.abs(x), Math.abs(z));
  h += smoothstep(620, 900, edge) * 26 * (0.55 + 0.45 * Math.sin(x * 0.013) * Math.cos(z * 0.011));
  // keep a broad basin open for the lake
  const dx = (x - 300) / 260, dz = (z - 150) / 210;
  h -= smoothstep(1.55, 0.35, Math.sqrt(dx * dx + dz * dz)) * 3.2;
  // carve lake basin
  for (const l of lakes) {
    const d = Math.sqrt(((x - l.x) / l.rx) ** 2 + ((z - l.z) / l.rz) ** 2);
    h -= smoothstep(1.55, 0.92, d) * 7.5;
  }
  // carve river
  for (const r of rivers) {
    const p = riverPoint(r, z);
    const d = Math.abs(x - p.x);
    h -= smoothstep(2.2, 0.7, d / r.half) * 6.4;
  }
  return h;
}

export const settlementGround = new Map();
for (const s of settlements) {
  s.baseY = rawHeight(s.x, s.z);
  s.baseY = Math.max(s.baseY, WATER_LEVEL + 0.8);
  settlementGround.set(s.id, s.baseY);
  s.flatR = s.r * 1.25;
}

export function heightAt(x, z) {
  let h = rawHeight(x, z);
  for (const s of settlements) {
    const d = Math.hypot(x - s.x, z - s.z);
    if (d < s.flatR) {
      const t = smoothstep(s.flatR, s.flatR * 0.52, d);
      h = lerp(h, s.baseY, t);
    }
  }
  return h;
}

export function waterMask(x, z) {
  let m = 0;
  for (const l of lakes) {
    const d = Math.sqrt(((x - l.x) / l.rx) ** 2 + ((z - l.z) / l.rz) ** 2);
    m = Math.max(m, 1 - smoothstep(0.82, 1.32, d));
  }
  for (const r of rivers) {
    const p = riverPoint(r, z);
    const d = Math.abs(x - p.x);
    m = Math.max(m, 1 - smoothstep(0.5, 2.1, d / r.half));
  }
  return m;
}

export function isWaterAt(x, z) {
  return heightAt(x, z) < WATER_LEVEL - 0.05;
}

export function nearWater(x, z, radius = 4) {
  if (waterMask(x, z) > 0.05) return true;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    if (waterMask(x + Math.cos(a) * radius, z + Math.sin(a) * radius) > 0.35) return true;
  }
  return false;
}

export function inSettlement(x, z) {
  for (const s of settlements) if (Math.hypot(x - s.x, z - s.z) < s.r * 1.4) return s;
  return null;
}

/* ------------------------------------------------------------
   Collision data
   ------------------------------------------------------------ */
export const wallColliders = [];   // {minX,maxX,minZ,maxZ,blocksSight}
export const circleColliders = []; // {x,z,r}
export const doors = [];           // {mesh, collider, open, locked, x,z}
export const structures = [];      // player-built objects
export const interactables = [];   // loot crates, cars, tents, trees, water etc.
export const containers = [];      // loot containers
export const zombiesSpawn = [];    // spawn descriptors
export const trees = [];
export const props = [];

export function collidePush(pos, radius) {
  for (const c of wallColliders) {
    if (c.disabled) continue;
    if (pos.x + radius < c.minX || pos.x - radius > c.maxX || pos.z + radius < c.minZ || pos.z - radius > c.maxZ) continue;
    const cx = clamp(pos.x, c.minX, c.maxX);
    const cz = clamp(pos.z, c.minZ, c.maxZ);
    let dx = pos.x - cx, dz = pos.z - cz;
    const d = Math.hypot(dx, dz);
    if (d < radius) {
      if (d < 0.0001) {
        const left = Math.abs(pos.x - c.minX), right = Math.abs(c.maxX - pos.x);
        const near = Math.abs(pos.z - c.minZ), far = Math.abs(c.maxZ - pos.z);
        const m = Math.min(left, right, near, far);
        if (m === left) pos.x = c.minX - radius;
        else if (m === right) pos.x = c.maxX + radius;
        else if (m === near) pos.z = c.minZ - radius;
        else pos.z = c.maxZ + radius;
      } else {
        pos.x = cx + (dx / d) * radius;
        pos.z = cz + (dz / d) * radius;
      }
    }
  }
  for (const c of circleColliders) {
    if (c.disabled) continue;
    const dx = pos.x - c.x, dz = pos.z - c.z;
    const rr = c.r + radius;
    const d2 = dx * dx + dz * dz;
    if (d2 < rr * rr && d2 > 0.000001) {
      const d = Math.sqrt(d2);
      pos.x = c.x + (dx / d) * rr;
      pos.z = c.z + (dz / d) * rr;
    }
  }
}

export function sightBlocked(ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len = Math.hypot(dx, dz);
  if (len < 0.01) return false;
  const steps = Math.min(48, Math.ceil(len / 2.2));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = ax + dx * t, z = az + dz * t;
    for (const c of wallColliders) {
      if (!c.blocksSight || c.disabled) continue;
      if (x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ) return true;
    }
  }
  return false;
}

/* ------------------------------------------------------------
   Procedural ground texture
   ------------------------------------------------------------ */
function drawRoad(ctx, a, b) {
  const dist = Math.hypot(b.x - a.x, b.z - a.z);
  const mx = (a.x + b.x) / 2 + Math.sin(a.z * 0.01) * dist * 0.11;
  const mz = (a.z + b.z) / 2 + Math.cos(b.x * 0.01) * dist * 0.11;
  ctx.beginPath();
  ctx.moveTo(a.x, a.z);
  ctx.quadraticCurveTo(mx, mz, b.x, b.z);
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(69,64,47,.8)';
  ctx.lineWidth = 21;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(135,121,87,.96)';
  ctx.lineWidth = 15;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(174,161,118,.5)';
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 12]);
  ctx.stroke();
  ctx.setLineDash([]);
}

export function makeGroundTexture() {
  const size = 2048;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const scale = size / WORLD;
  g.fillStyle = '#495536';
  g.fillRect(0, 0, size, size);
  // broad tonal blotches
  for (let i = 0; i < 260; i++) {
    const x = rand() * size, y = rand() * size, r = 20 + rand() * 130;
    g.fillStyle = pick(['rgba(90,106,64,.30)', 'rgba(49,62,41,.28)', 'rgba(112,119,77,.18)', 'rgba(62,77,48,.3)']);
    g.beginPath(); g.ellipse(x, y, r, r * (0.5 + rand() * 0.7), rand() * Math.PI, 0, Math.PI * 2); g.fill();
  }
  // field patches around farm
  const farm = settlements.find(s => s.id === 'marlow');
  for (let i = 0; i < 7; i++) {
    g.save();
    g.translate((farm.x + (rand() - 0.5) * 150) * scale, (farm.z + (rand() - 0.5) * 130) * scale);
    g.rotate(rand() * 0.8 - 0.4);
    const w = (24 + rand() * 46) * scale, h = (16 + rand() * 30) * scale;
    g.fillStyle = pick(['#7a7340', '#8a7f45', '#6d6a3a']);
    g.fillRect(-w / 2, -h / 2, w, h);
    g.strokeStyle = 'rgba(58,54,30,.4)'; g.lineWidth = 1;
    for (let x = -w / 2; x < w / 2; x += 5) { g.beginPath(); g.moveTo(x, -h / 2); g.lineTo(x, h / 2); g.stroke(); }
    g.restore();
  }
  // sand around water
  for (const l of lakes) {
    g.fillStyle = 'rgba(170,156,111,.55)';
    g.beginPath(); g.ellipse(l.x * scale, l.z * scale, (l.rx + 26) * scale, (l.rz + 22) * scale, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#4b6360';
    g.beginPath(); g.ellipse(l.x * scale, l.z * scale, l.rx * scale, l.rz * scale, 0, 0, Math.PI * 2); g.fill();
  }
  for (const r of rivers) {
    g.beginPath();
    for (let z = -HALF; z <= HALF; z += 10) {
      const p = riverPoint(r, z);
      if (z === -HALF) g.moveTo(p.x * scale, z * scale + HALF * scale);
      else g.lineTo(p.x * scale, (z + HALF) * scale);
    }
    g.strokeStyle = 'rgba(172,159,113,.5)'; g.lineWidth = (r.half * 2 + 16) * scale; g.lineCap = 'round'; g.stroke();
    g.strokeStyle = '#48615e'; g.lineWidth = r.half * 2 * scale; g.stroke();
  }
  // town dirt
  for (const s of settlements) {
    g.fillStyle = 'rgba(122,112,83,.42)';
    g.beginPath(); g.arc((s.x + HALF) * scale, (s.z + HALF) * scale, s.r * 1.12 * scale, 0, Math.PI * 2); g.fill();
  }
  // roads
  for (const [aId, bId] of roads) {
    const a = settlements.find(s => s.id === aId), b = settlements.find(s => s.id === bId);
    if (!a || !b) continue;
    g.save(); g.translate(HALF * scale, HALF * scale);
    drawRoad(g, { x: a.x * scale, z: a.z * scale }, { x: b.x * scale, z: b.z * scale });
    g.restore();
  }
  // fine noise
  for (let i = 0; i < 70000; i++) {
    const x = rand() * size, y = rand() * size;
    g.fillStyle = rand() < 0.5 ? 'rgba(23,34,22,.2)' : 'rgba(168,172,120,.16)';
    g.fillRect(x, y, 1 + rand() * 3, 1 + rand() * 3);
  }
  for (let i = 0; i < 24000; i++) {
    const x = rand() * size, y = rand() * size;
    g.strokeStyle = rand() < 0.6 ? 'rgba(96,116,65,.35)' : 'rgba(44,58,36,.3)';
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + rand() * 3 - 1.5, y - 2 - rand() * 4); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
/* ------------------------------------------------------------
   Shared materials & primitives
   ------------------------------------------------------------ */
const M = {
  wood: new THREE.MeshLambertMaterial({ color: 0x6e6350 }),
  woodDark: new THREE.MeshLambertMaterial({ color: 0x50483a }),
  plaster: new THREE.MeshLambertMaterial({ color: 0x918b76 }),
  brick: new THREE.MeshLambertMaterial({ color: 0x7c5f4d }),
  concrete: new THREE.MeshLambertMaterial({ color: 0x888879 }),
  metal: new THREE.MeshLambertMaterial({ color: 0x5d6862 }),
  rust: new THREE.MeshLambertMaterial({ color: 0x8a5c40 }),
  roof: new THREE.MeshLambertMaterial({ color: 0x5a5646 }),
  roofRust: new THREE.MeshLambertMaterial({ color: 0x7a5a40 }),
  floor: new THREE.MeshLambertMaterial({ color: 0x6a6350 }),
  glass: new THREE.MeshLambertMaterial({ color: 0x1b2a2b }),
  crate: new THREE.MeshLambertMaterial({ color: 0x7d6a48 }),
  crateMil: new THREE.MeshLambertMaterial({ color: 0x4c5a43 }),
  fabric: new THREE.MeshLambertMaterial({ color: 0x5b6047 }),
  tarp: new THREE.MeshLambertMaterial({ color: 0x4a5548 }),
  tent: new THREE.MeshLambertMaterial({ color: 0x6c7052 }),
  black: new THREE.MeshLambertMaterial({ color: 0x2a2f2a }),
  trunk: new THREE.MeshLambertMaterial({ color: 0x4c3f30 }),
  pine: new THREE.MeshLambertMaterial({ color: 0xffffff }),
  pineLight: new THREE.MeshLambertMaterial({ color: 0x3a563a }),
  leaf: new THREE.MeshLambertMaterial({ color: 0x465b39 }),
  rock: new THREE.MeshLambertMaterial({ color: 0x777a6d }),
  sand: new THREE.MeshLambertMaterial({ color: 0xa8986f }),
};

const shadowMat = new THREE.MeshBasicMaterial({ color: 0x0b110c, transparent: true, opacity: 0.2, depthWrite: false });
const shadowGeo = new THREE.CircleGeometry(1, 12);
shadowGeo.rotateX(-Math.PI / 2);

function dropShadow(parent, w, d, y, rot = 0) {
  const m = new THREE.Mesh(shadowGeo, shadowMat);
  m.scale.set(w, 1, d);
  m.position.y = y;
  m.rotation.y = rot;
  m.renderOrder = 1;
  parent.add(m);
  return m;
}

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 8);

function box(parent, w, h, d, mat, x, y, z, ry = 0) {
  const m = new THREE.Mesh(BOX, mat);
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  parent.add(m);
  return m;
}

function addWall(x, z, w, d, h, y, mat) {
  const m = box(sceneRoot, w, h, d, mat, x, y + h / 2, z);
  wallColliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, blocksSight: true, mesh: m });
  return m;
}

let sceneRoot = null;

/* ------------------------------------------------------------
   Buildings
   ------------------------------------------------------------ */
const BUILDING_NAMES = {
  house: ['Abandoned home', 'Ranger cabin', 'Ruined cottage', 'Farmhouse', 'Empty house', 'Burnt-out home'],
  store: ['General store', 'Corner market', 'Trading post'],
  clinic: ['Riverside Clinic', 'Medical outpost'],
  police: ['Ravenwood PD', 'Police station'],
  supermarket: ['Supermarket', 'Grocer'],
  warehouse: ['Old Mill warehouse', 'Freight depot'],
  factory: ['Machine shop', 'Processing plant'],
  barn: ['Marlow barn', 'Hay barn'],
  cabin: ['Ranger cabin', 'Hunter\'s hut'],
  barracks: ['Quarantine barracks', 'Blacksite barracks'],
  bunker: ['Blacksite Delta bunker', 'Sealed bunker'],
  hospital: ['Riverside hospital', 'Emergency ward'],
  office: ['Administration', 'Site office'],
};

export const buildings = [];

function addBuilding(opts) {
  const { x, z, w, d, h = 4, type = 'house', name, tier = 'residential', doorSide = 'south', windows = true } = opts;
  const gy = heightAt(x, z);
  const b = {
    x, z, w, d, h, type, tier,
    name: name || pick(BUILDING_NAMES[type] || ['Abandoned building']),
    y: gy, interior: [], door: null,
  };
  buildings.push(b);

  const wallMat = type === 'barn' ? M.woodDark : type === 'bunker' ? M.concrete : type === 'warehouse' || type === 'factory' ? M.metal
    : type === 'hospital' || type === 'clinic' ? M.plaster : type === 'police' ? M.brick : type === 'barracks' ? M.metal : pick([M.wood, M.plaster, M.brick]);
  const floorMat = type === 'warehouse' || type === 'factory' ? M.concrete : M.floor;
  // foundation + floor
  dropShadow(sceneRoot, w / 2 + 1.1, d / 2 + 1.0, gy + 0.045);
  // offset the shadow blob under the footprint
  sceneRoot.children[sceneRoot.children.length - 1].position.set(x + 1.2, gy + 0.045, z + 1.1);
  box(sceneRoot, w + 0.5, 0.35, d + 0.5, M.concrete, x, gy + 0.12, z);
  box(sceneRoot, w - 0.1, 0.08, d - 0.1, floorMat, x, gy + 0.33, z);

  const t = 0.32;
  const y = gy + 0.3;
  // back (north)
  addWall(x, z - d / 2, w, t, h, y, wallMat);
  // sides
  addWall(x - w / 2, z, t, d, h, y, wallMat);
  addWall(x + w / 2, z, t, d, h, y, wallMat);
  // front (south) with doorway
  const doorW = 1.8;
  const segW = (w - doorW) / 2;
  if (doorSide === 'south') {
    addWall(x - w / 2 + segW / 2, z + d / 2, segW, t, h, y, wallMat);
    addWall(x + w / 2 - segW / 2, z + d / 2, segW, t, h, y, wallMat);
    // lintel
    box(sceneRoot, doorW, Math.max(0.35, h - 2.35), t, wallMat, x, y + 2.35 + Math.max(0.35, h - 2.35) / 2, z + d / 2);
    makeDoor(x, z + d / 2, doorW, 2.35, y, type === 'metal' ? M.metal : M.woodDark, b);
  } else {
    addWall(x, z + d / 2, w, t, h, y, wallMat);
  }

  // roof
  const roofMat = type === 'warehouse' || type === 'factory' || type === 'barracks' ? M.roofRust : M.roof;
  const pitched = ['house', 'cabin', 'store', 'barn'].includes(type);
  if (pitched) {
    for (const side of [-1, 1]) {
      const slab = box(sceneRoot, w * 0.62, 0.22, d + 0.9, roofMat, x + side * w * 0.23, y + h + 0.55, z);
      slab.rotation.z = side * 0.46;
    }
    box(sceneRoot, 0.22, 0.2, d + 0.95, M.woodDark, x, y + h + 1.02, z);
    if (rand() < 0.7) box(sceneRoot, 0.7, 1.6, 0.7, M.brick, x + w * 0.25, y + h + 1.2, z - d * 0.22);
  } else {
    const roof = box(sceneRoot, w + 0.9, 0.42, d + 0.9, roofMat, x, y + h + 0.2, z);
    roof.rotation.z = 0;
  }
  if (type === 'barn') {
    const gable = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.72, 2.4, 4), M.roofRust);
    gable.rotation.y = Math.PI / 4;
    gable.position.set(x, y + h + 1.4, z);
    sceneRoot.add(gable);
  }
  // roof clutter
  if (rand() < 0.55) box(sceneRoot, 1.4, 0.8, 1.0, M.metal, x + (rand() - 0.5) * w * 0.6, y + h + 0.75, z + (rand() - 0.5) * d * 0.6);
  if (type === 'house' && rand() < 0.6) box(sceneRoot, 0.7, 1.8, 0.7, M.brick, x + w * 0.3, y + h + 1.1, z - d * 0.25);

  // windows
  if (windows) {
    const winMat = M.glass;
    const spread = Math.max(1, Math.floor(w / 3.2));
    for (let i = 0; i < spread; i++) {
      const wx = x - w / 2 + (i + 0.5) * (w / spread);
      box(sceneRoot, 1.05, 1.0, 0.06, winMat, wx, y + 1.75, z - d / 2 - 0.18);
      box(sceneRoot, 1.25, 0.12, 0.14, M.woodDark, wx, y + 2.28, z - d / 2 - 0.18);
    }
    for (const side of [-1, 1]) {
      box(sceneRoot, 0.06, 1.0, 1.05, winMat, x + side * (w / 2 + 0.18), y + 1.75, z + d * 0.12);
    }
    if (doorSide === 'south' && w > 5.5) {
      for (const side of [-1, 1]) {
        box(sceneRoot, 1.0, 0.95, 0.06, winMat, x + side * (w * 0.28), y + 1.75, z + d / 2 + 0.18);
        box(sceneRoot, 1.2, 0.1, 0.14, M.woodDark, x + side * (w * 0.28), y + 2.26, z + d / 2 + 0.18);
      }
      // porch awning
      box(sceneRoot, Math.min(3.4, w * 0.55), 0.12, 1.5, M.woodDark, x, y + 2.42, z + d / 2 + 0.68);
      for (const side of [-1, 1]) box(sceneRoot, 0.12, 2.4, 0.12, M.woodDark, x + side * Math.min(1.5, w * 0.25), y + 1.2, z + d / 2 + 1.3);
      box(sceneRoot, 2.0, 0.16, 0.7, M.concrete, x, y + 0.06, z + d / 2 + 0.35);
    }
  }

  // interior clutter
  const clutter = type === 'supermarket' ? 5 : type === 'warehouse' ? 4 : type === 'clinic' || type === 'hospital' ? 3 : 2;
  for (let i = 0; i < clutter; i++) {
    const cw = 0.8 + rand() * 1.8, cd = 0.6 + rand() * 1.1, ch = 0.5 + rand() * 0.9;
    const cx = x + (rand() - 0.5) * (w - 2.2);
    const cz = z + (rand() - 0.5) * (d - 2.2);
    if (Math.abs(cx - x) < 0.9 && Math.abs(cz - (z + d / 2)) < 1.4) continue;
    box(sceneRoot, cw, ch, cd, pick([M.woodDark, M.metal, M.crate]), cx, y + ch / 2, cz);
    wallColliders.push({ minX: cx - cw / 2, maxX: cx + cw / 2, minZ: cz - cd / 2, maxZ: cz + cd / 2, blocksSight: false });
  }
  // loot container spots
  const slots = type === 'supermarket' ? 4 : type === 'warehouse' ? 3 : type === 'clinic' || type === 'hospital' ? 3 : 2;
  for (let i = 0; i < slots; i++) {
    const cx = x + (rand() - 0.5) * (w - 1.8);
    const cz = z + (rand() - 0.5) * (d - 1.8);
    containers.push({ x: cx, z: cz, y: y + 0.3, tier, building: b, type: 'crate', searched: false, items: null });
  }
  b.interior.push({ x, z, w, d });
  zombiesSpawn.push({ x: x + (rand() - 0.5) * w * 1.8, z: z + (rand() - 0.5) * d * 1.8, camp: true });
  return b;
}

function makeDoor(x, z, w, h, y, mat, b) {
  const pivot = new THREE.Group();
  pivot.position.set(x - w / 2, y, z);
  const panel = box(pivot, w, h, 0.12, mat, w / 2, h / 2, 0);
  const handle = box(pivot, 0.06, 0.06, 0.16, M.metal, w - 0.18, h * 0.5, 0.09);
  sceneRoot.add(pivot);
  const col = { minX: x - w / 2, maxX: x + w / 2, minZ: z - 0.2, maxZ: z + 0.2, blocksSight: false, disabled: false };
  wallColliders.push(col);
  const door = { x, z, w, open: false, locked: false, pivot, col, building: b };
  doors.push(door);
  b.door = door;
  interactables.push({ kind: 'door', x, z, door });
  return door;
}

/* ------------------------------------------------------------
   Props
   ------------------------------------------------------------ */
function addCar(x, z, ry = 0, tier = 'residential') {
  const y = heightAt(x, z);
  const g = new THREE.Group();
  g.position.set(x, y, z); g.rotation.y = ry;
  const bodyMat = pick([M.rust, M.metal, new THREE.MeshLambertMaterial({ color: 0x55614f })]);
  box(g, 2.0, 0.62, 4.2, bodyMat, 0, 0.62, 0);
  box(g, 1.8, 0.55, 2.2, bodyMat, 0, 1.16, -0.2);
  box(g, 1.62, 0.42, 1.9, M.glass, 0, 1.26, -0.2);
  for (const sx of [-0.95, 0.95]) for (const sz of [-1.35, 1.35]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.28, 10), M.black);
    wheel.rotation.z = Math.PI / 2; wheel.position.set(sx, 0.38, sz); g.add(wheel);
  }
  dropShadow(g, 0.98, 1.9, 0.03);
  sceneRoot.add(g);
  wallColliders.push({ minX: x - 1.25, maxX: x + 1.25, minZ: z - 2.2, maxZ: z + 2.2, blocksSight: false });
  containers.push({ x, z, y: y + 0.4, tier, type: 'car', searched: false, items: null });
  interactables.push({ kind: 'loot', x, z, label: 'Search vehicle' });
  return g;
}

function addTent(x, z, tier = 'camp') {
  const y = heightAt(x, z);
  const g = new THREE.Group();
  g.position.set(x, y, z); g.rotation.y = rand() * Math.PI;
  const mat = rand() < 0.5 ? M.tent : M.tarp;
  const tent = new THREE.Mesh(new THREE.ConeGeometry(2.0, 2.2, 4), mat);
  tent.rotation.y = Math.PI / 4; tent.position.y = 1.1; g.add(tent);
  box(g, 3.2, 0.12, 3.2, M.tarp, 0, 0.06, 0);
  dropShadow(g, 1.35, 1.35, 0.02);
  sceneRoot.add(g);
  wallColliders.push({ minX: x - 1.4, maxX: x + 1.4, minZ: z - 1.4, maxZ: z + 1.4, blocksSight: false });
  containers.push({ x: x + 1.2, z: z + 1.0, y: y + 0.35, tier, type: 'duffel', searched: false, items: null });
  interactables.push({ kind: 'loot', x: x + 1.2, z: z + 1.0, label: 'Search tent' });
  zombiesSpawn.push({ x: x + (rand() - 0.5) * 14, z: z + (rand() - 0.5) * 14, camp: true });
}

function addWatchtower(x, z) {
  const y = heightAt(x, z);
  const g = new THREE.Group(); g.position.set(x, y, z);
  for (const sx of [-1.2, 1.2]) for (const sz of [-1.2, 1.2]) box(g, 0.22, 5.4, 0.22, M.woodDark, sx, 2.7, sz);
  box(g, 3.4, 0.24, 3.4, M.wood, 0, 5.2, 0);
  for (const sx of [-1.6, 1.6]) box(g, 0.16, 1.0, 3.3, M.woodDark, sx, 5.8, 0);
  box(g, 3.4, 0.18, 0.16, M.woodDark, 0, 5.8, 1.6);
  box(g, 2.0, 0.3, 2.0, M.woodDark, 0, 6.2, -0.5);
  sceneRoot.add(g);
  wallColliders.push({ minX: x - 1.45, maxX: x + 1.45, minZ: z - 1.45, maxZ: z + 1.45, blocksSight: false });
  containers.push({ x: x + 0.2, z: z + 0.2, y: y + 5.5, tier: 'military', type: 'crate', searched: false, items: null, onTower: true });
  interactables.push({ kind: 'loot', x: x + 0.2, z: z + 0.2, label: 'Search watchtower cache' });
}

function addFenceRow(x1, z1, x2, z2, gap = 0) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  const count = Math.max(1, Math.floor(len / 3.2));
  for (let i = 0; i <= count; i++) {
    if (gap && i % gap === 0) continue;
    const t = i / count;
    const x = lerp(x1, x2, t), z = lerp(z1, z2, t);
    const y = heightAt(x, z);
    box(sceneRoot, 0.14, 2.1, 0.14, M.metal, x, y + 1.05, z);
    const rot = Math.atan2(z2 - z1, x2 - x1);
    for (const hy of [0.55, 1.4]) {
      const rail = box(sceneRoot, 3.3, 0.08, 0.08, M.rust, x + Math.cos(rot) * 1.6, y + hy, z + Math.sin(rot) * 1.6);
      rail.rotation.y = -rot;
    }
    wallColliders.push({ minX: x - 0.35, maxX: x + Math.cos(rot) * 1.7, minZ: z - 0.35, maxZ: z + Math.sin(rot) * 1.7, blocksSight: false });
  }
}

function addSilo(x, z) {
  const y = heightAt(x, z);
  const g = new THREE.Group(); g.position.set(x, y, z);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 12, 14), M.metal);
  body.position.y = 6; g.add(body);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(3.6, 2.4, 14), M.roofRust);
  cap.position.y = 13.2; g.add(cap);
  sceneRoot.add(g);
  circleColliders.push({ x, z, r: 3.6 });
}

function addHuntingStand(x, z) {
  const y = heightAt(x, z);
  const g = new THREE.Group(); g.position.set(x, y, z);
  for (const sx of [-0.9, 0.9]) for (const sz of [-0.9, 0.9]) box(g, 0.16, 3.2, 0.16, M.woodDark, sx, 1.6, sz);
  box(g, 2.4, 0.2, 2.4, M.wood, 0, 3.1, 0);
  box(g, 2.4, 0.7, 0.15, M.woodDark, 0, 3.5, 1.1);
  box(g, 0.15, 0.7, 2.4, M.woodDark, -1.1, 3.5, 0);
  sceneRoot.add(g);
  wallColliders.push({ minX: x - 1.1, maxX: x + 1.1, minZ: z - 1.1, maxZ: z + 1.1, blocksSight: false });
  containers.push({ x: x + 0.4, z: z, y: y + 3.35, tier: 'hunting', type: 'crate', searched: false, items: null });
  interactables.push({ kind: 'loot', x: x + 0.4, z, label: 'Search hunting stand' });
}

function addBarrel(x, z, tier = 'industrial') {
  const y = heightAt(x, z);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.0, 10), rand() < 0.5 ? M.rust : M.metal);
  m.position.set(x, y + 0.5, z); sceneRoot.add(m);
  if (rand() < 0.5) containers.push({ x, z, y: y + 0.2, tier, type: 'barrel', searched: false, items: null });
}

function addSign(x, z, text) {
  const y = heightAt(x, z);
  box(sceneRoot, 0.12, 2.3, 0.12, M.woodDark, x, y + 1.15, z);
  box(sceneRoot, 1.9, 0.58, 0.08, M.wood, x, y + 1.95, z);
  props.push({ x, z, text });
}
/* ------------------------------------------------------------
   Settlement layouts
   ------------------------------------------------------------ */
function layoutWorld() {
  const S = Object.fromEntries(settlements.map(s => [s.id, s]));

  // --- Pine Ridge ---
  addBuilding({ x: 24, z: -14, w: 11, d: 8, h: 4.2, type: 'store', name: 'Pine Ridge Supply', tier: 'store' });
  addBuilding({ x: -25, z: -22, w: 9, d: 7, h: 4, type: 'house', tier: 'residential' });
  addBuilding({ x: 23, z: 21, w: 9, d: 7, h: 4, type: 'house', tier: 'residential' });
  addBuilding({ x: -27, z: 19, w: 9, d: 8, h: 4.2, type: 'house', tier: 'residential' });
  addBuilding({ x: 1, z: -37, w: 8, d: 6, h: 3.8, type: 'house', tier: 'residential' });
  addBuilding({ x: 44, z: 4, w: 9, d: 7, h: 4.2, type: 'house', tier: 'residential' });
  addBuilding({ x: -44, z: -3, w: 8, d: 6, h: 3.8, type: 'house', tier: 'residential' });
  addCar(-7, 31, 0.3);
  addCar(33, 35, -0.6);
  addBarrel(-16, 4, 'residential');
  addBarrel(15, 3, 'residential');

  // --- Ravenwood (city) ---
  addBuilding({ x: 520, z: -472, w: 17, d: 11, h: 5.4, type: 'supermarket', tier: 'supermarket' });
  addBuilding({ x: 474, z: -430, w: 11, d: 8, h: 4.6, type: 'police', tier: 'police' });
  addBuilding({ x: 552, z: -398, w: 10, d: 8, h: 6.4, type: 'house', tier: 'residential' });
  addBuilding({ x: 490, z: -392, w: 9, d: 7, h: 6.2, type: 'house', tier: 'residential' });
  addBuilding({ x: 452, z: -460, w: 10, d: 7, h: 6.2, type: 'house', tier: 'residential' });
  addBuilding({ x: 564, z: -462, w: 10, d: 8, h: 6.6, type: 'house', tier: 'residential' });
  addBuilding({ x: 520, z: -344, w: 9, d: 7, h: 4.4, type: 'clinic', name: 'Ravenwood Pharmacy', tier: 'medical' });
  addBuilding({ x: 602, z: -418, w: 8, d: 7, h: 4.4, type: 'house', tier: 'residential' });
  addBuilding({ x: 432, z: -410, w: 8, d: 6, h: 4.4, type: 'house', tier: 'residential' });
  addCar(508, -430, 0.08, 'police');
  addCar(536, -420, 1.62, 'residential');
  addCar(490, -430, 1.5, 'residential');
  addBarrel(540, -455, 'industrial');
  addBarrel(438, -440, 'industrial');
  addSign(520, -368, 'RAVENWOOD');

  // --- Marlow Farm ---
  addBuilding({ x: -582, z: -392, w: 15, d: 9, h: 5.2, type: 'barn', tier: 'farm' });
  addBuilding({ x: -530, z: -358, w: 10, d: 8, h: 4.2, type: 'house', name: 'Marlow farmhouse', tier: 'residential' });
  addBuilding({ x: -596, z: -348, w: 6, d: 5, h: 3.2, type: 'cabin', name: 'Tool shed', tier: 'farm' });
  addSilo(-556, -424);
  addCar(-528, -414, 0.5, 'farm');
  for (let i = 0; i < 5; i++) {
    const x = -620 + i * 5.5, z = -320 + (i % 2) * 3;
    box(sceneRoot, 2.2, 1.1, 1.4, M.sand, x, heightAt(x, z) + 0.55, z, rand());
  }
  addSign(-520, -330, 'MARLOW FARM');

  // --- Old Mill ---
  addBuilding({ x: 600, z: 448, w: 18, d: 12, h: 6.2, type: 'warehouse', tier: 'industrial' });
  addBuilding({ x: 628, z: 502, w: 13, d: 9, h: 5.6, type: 'factory', tier: 'industrial' });
  addBuilding({ x: 566, z: 500, w: 9, d: 7, h: 4.2, type: 'office', tier: 'residential' });
  addSilo(646, 432);
  addSilo(658, 452);
  addCar(570, 470, 1.5, 'industrial');
  addCar(626, 462, 0.2, 'industrial');
  for (let i = 0; i < 7; i++) addBarrel(566 + rand() * 74, 420 + rand() * 90, 'industrial');
  addSign(600, 420, 'OLD MILL');

  // --- Ashwood Camp ---
  addBuilding({ x: -542, z: 408, w: 8, d: 6, h: 3.6, type: 'cabin', name: 'Ranger cabin', tier: 'hunting' });
  addTent(-502, 452, 'hunting');
  addTent(-542, 452, 'hunting');
  addTent(-496, 404, 'camp');
  addCar(-480, 414, 0.4, 'hunting');
  addHuntingStand(-458, 360);
  addHuntingStand(-592, 502);
  addHuntingStand(-432, 470);
  addSign(-530, 380, 'ASHWOOD CAMP');

  // --- Blacksite Delta ---
  addBuilding({ x: 12, z: 654, w: 14, d: 7, h: 4.2, type: 'barracks', name: 'Barracks A', tier: 'military' });
  addBuilding({ x: 66, z: 720, w: 11, d: 9, h: 4.0, type: 'bunker', name: 'Blacksite bunker', tier: 'military' });
  addWatchtower(-6, 744);
  addWatchtower(88, 652);
  addTent(-6, 700, 'military');
  addTent(26, 726, 'military');
  // perimeter fence with gate gap on the west side
  addFenceRow(-28, 626, -28, 668);
  addFenceRow(-28, 700, -28, 768);
  addFenceRow(-28, 626, 46, 626);
  addFenceRow(72, 626, 110, 626);
  addFenceRow(110, 626, 110, 768);
  addFenceRow(-28, 768, 110, 768);
  addFenceRow(46, 626, 46, 610);
  addCar(34, 640, 1.55, 'military');
  addCar(56, 660, 0.1, 'military');
  for (let i = 0; i < 5; i++) addBarrel(32 + rand() * 40, 700 + rand() * 40, 'military');
  addSign(18, 600, 'QUARANTINE — BLACKSITE DELTA');

  // --- Riverside Clinic ---
  addBuilding({ x: -172, z: -642, w: 17, d: 11, h: 5.0, type: 'hospital', name: 'Riverside Hospital', tier: 'medical' });
  addBuilding({ x: -132, z: -600, w: 9, d: 7, h: 4.2, type: 'clinic', name: 'Clinic annex', tier: 'medical' });
  addTent(-196, -594, 'medical');
  addCar(-146, -574, 0.4, 'medical');
  addBarrel(-190, -600, 'medical');
  addSign(-140, -650, 'RIVERSIDE CLINIC');

  // --- backcountry cabins & landmarks ---
  addBuilding({ x: -302, z: -128, w: 8, d: 7, h: 3.6, type: 'cabin', name: 'Forester\'s cabin', tier: 'hunting' });
  addBuilding({ x: 330, z: -176, w: 7, d: 6, h: 3.4, type: 'cabin', name: 'Lakeside shack', tier: 'hunting' });
  addBuilding({ x: 252, z: 536, w: 7, d: 6, h: 3.4, type: 'cabin', name: 'Trapper\'s hut', tier: 'hunting' });
  addHuntingStand(-206, -250);
  addHuntingStand(312, 40);

  // crashed convoy between Pine Ridge and Ravenwood
  addCar(290, -214, 1.4, 'military');
  addCar(302, -206, 1.1, 'police');
  addCar(280, -226, 0.7, 'residential');
  addBarrel(296, -230, 'military');
  addBarrel(312, -220, 'military');
  addSign(280, -190, 'CONVOY AMBUSH');
  pois.push({ x: 296, z: -218, name: 'Crashed convoy', kind: 'landmark', note: 'Military crates. Someone lost this fight.' });

  // lake shore camp
  addCar(226, 214, 0.9, 'residential');
  addTent(210, 202, 'camp');
  addHuntingStand(372, 228);
  pois.push({ x: 300, z: 150, name: 'Cascade Lake', kind: 'water', note: 'Fresh water — boil it before drinking.' });
  pois.push({ x: -770, z: 0, name: 'Cascade River', kind: 'water', note: 'Fast, cold water. Fills bottles.' });
  pois.push({ x: -6, z: 744, name: 'Delta watchtower', kind: 'landmark', note: 'Overlooks the quarantine checkpoint.' });
  pois.push({ x: -520, z: 430, name: 'Ashwood fires', kind: 'landmark', note: 'An old ranger camp with hunting gear.' });

  // zombie spawn rings
  const ringCount = { village: 7, city: 14, farm: 7, industrial: 10, camp: 5, military: 13, hospital: 7 };
  for (const s of settlements) {
    const n = ringCount[s.kind] || 6;
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2;
      const r = s.r * (0.65 + rand() * 1.25);
      zombiesSpawn.push({ x: s.x + Math.cos(a) * r, z: s.z + Math.sin(a) * r, camp: true, hot: s.kind === 'military' || s.kind === 'city' });
    }
  }
  for (let i = 0; i < 34; i++) {
    const a = rand() * Math.PI * 2, r = 120 + rand() * 700;
    zombiesSpawn.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, camp: false });
  }
  // a few visible dead wandering the village approaches
  zombiesSpawn.push({ x: 7, z: 8, camp: true }, { x: -16, z: -2, camp: true }, { x: 19, z: 29, camp: true }, { x: 5, z: 19, camp: true }, { x: -7, z: 18, camp: true }, { x: 16, z: 15, camp: true });
  // makeshift roadblock on the southern approach
  addBarrel(9, 25, 'residential');
  addBarrel(2, 27, 'residential');
  addCar(15, 27, 0.15, 'residential');
  box(sceneRoot, 3.4, 0.16, 0.3, M.woodDark, 5, heightAt(5, 25) + 1.0, 25);
  box(sceneRoot, 0.14, 1.05, 0.14, M.woodDark, 3.4, heightAt(3.4, 25) + 0.5, 25);
  box(sceneRoot, 0.14, 1.05, 0.14, M.woodDark, 6.6, heightAt(6.6, 25) + 0.5, 25);
}

export const pois = [];

/* ------------------------------------------------------------
   Terrain, water, forest instancing
   ------------------------------------------------------------ */
let treeTrunkMesh = null, treeFoliageMesh = null;

function buildTerrain() {
  const geo = new THREE.PlaneGeometry(WORLD, WORLD, 150, 150);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, heightAt(x, z));
  }
  geo.computeVertexNormals();
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i);
    const n = Math.sin(x * 0.021 + z * 0.017) * 0.5 + Math.sin(x * 0.007 - z * 0.013) * 0.5;
    const shade = 0.88 + n * 0.1 + clamp((y - 4) * 0.006, -0.08, 0.08);
    colors[i * 3] = shade; colors[i * 3 + 1] = shade * 1.01; colors[i * 3 + 2] = shade * 0.9;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const tex = makeGroundTexture();
  const mat = new THREE.MeshLambertMaterial({ map: tex, vertexColors: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = false;
  sceneRoot.add(mesh);

  // lake surface
  for (const l of lakes) {
    const lakeMesh = new THREE.Mesh(new THREE.CircleGeometry(1, 56), new THREE.MeshLambertMaterial({
      color: 0x375f60, transparent: true, opacity: 0.92,
    }));
    lakeMesh.rotation.x = -Math.PI / 2;
    lakeMesh.scale.set(l.rx * 1.02, l.rz * 1.02, 1);
    lakeMesh.position.set(l.x, WATER_LEVEL, l.z);
    sceneRoot.add(lakeMesh);
  }
  // river ribbon
  for (const r of rivers) {
    const pts = [];
    for (let z = -HALF + 4; z <= HALF - 4; z += 12) pts.push(riverPoint(r, z));
    const verts = [], idx = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      verts.push(p.x - r.half, WATER_LEVEL, p.z, p.x + r.half, WATER_LEVEL, p.z);
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({
      color: 0x3b6162, transparent: true, opacity: 0.94,
    }));
    sceneRoot.add(mesh);
  }
  return mesh;
}

function buildForest() {
  const forestPts = [];
  const avoid = (x, z) => {
    for (const s of settlements) if (Math.hypot(x - s.x, z - s.z) < s.r * 1.35) return true;
    for (const b of buildings) if (Math.abs(x - b.x) < b.w * 0.8 + 3 && Math.abs(z - b.z) < b.d * 0.8 + 3) return true;
    if (waterMask(x, z) > 0.06) return true;
    if (nearWater(x, z, 6)) return true;
    return false;
  };
  let guard = 0;
  while (forestPts.length < 720 && guard < 16000) {
    guard++;
    const x = (rand() - 0.5) * (WORLD - 70);
    const z = (rand() - 0.5) * (WORLD - 70);
    if (avoid(x, z)) continue;
    const edge = Math.max(Math.abs(x), Math.abs(z));
    if (edge > 760 && rand() < 0.75) continue;
    forestPts.push({ x, z, s: 0.7 + rand() * 0.8, pine: rand() < 0.78 });
  }

  const yardTrees = [
    [40, -34], [-18, -50], [53, 24], [-50, 36], [12, 55], [-58, -26], [68, -8],
    [470, -360], [590, -380], [452, -500], [604, -470], [500, -350], [580, -520],
    [-540, -300], [-610, -420], [-500, -430], [640, 380], [530, 440], [680, 520],
    [-460, 380], [-590, 440], [-455, 500], [-80, 640], [100, 640], [-230, -680], [-100, -690],
  ];
  for (const [tx, tz] of yardTrees) {
    if (waterMask(tx, tz) > 0.05) continue;
    if (buildings.some(b => Math.abs(tx - b.x) < b.w * 0.7 + 1.5 && Math.abs(tz - b.z) < b.d * 0.7 + 1.5)) continue;
    forestPts.push({ x: tx, z: tz, s: 1.0 + rand() * 0.7, pine: rand() < 0.6 });
  }
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.32, 4.4, 6);
  trunkGeo.translate(0, 2.2, 0);
  const folGeo = new THREE.ConeGeometry(1.7, 4.4, 7);
  folGeo.translate(0, 4.4, 0);
  treeTrunkMesh = new THREE.InstancedMesh(trunkGeo, M.trunk, forestPts.length);
  treeFoliageMesh = new THREE.InstancedMesh(folGeo, M.pine, forestPts.length);
  treeFoliageMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(forestPts.length * 3), 3);
  const mtx = new THREE.Matrix4();
  const col = new THREE.Color();
  forestPts.forEach((t, i) => {
    const y = heightAt(t.x, t.z);
    mtx.makeScale(t.s, t.s, t.s);
    mtx.setPosition(t.x, y, t.z);
    treeTrunkMesh.setMatrixAt(i, mtx);
    treeFoliageMesh.setMatrixAt(i, mtx);
    col.setHex(t.pine ? (rand() < 0.5 ? 0x29452b : 0x335233) : 0x3f5c36);
    treeFoliageMesh.setColorAt(i, col);
    const tree = { x: t.x, z: t.z, s: t.s, r: 0.55 * t.s, i, chopped: 0, felled: false, type: t.pine ? 'pine' : 'oak' };
    trees.push(tree);
    circleColliders.push({ x: t.x, z: t.z, r: 0.5 * t.s, type: 'tree', tree });
  });
  treeTrunkMesh.instanceMatrix.needsUpdate = true;
  treeFoliageMesh.instanceMatrix.needsUpdate = true;
  sceneRoot.add(treeTrunkMesh, treeFoliageMesh);
  const treeShadows = new THREE.InstancedMesh(shadowGeo, shadowMat, forestPts.length);
  forestPts.forEach((t, i) => {
    mtx.makeScale(t.s * 1.7, 1, t.s * 1.7);
    mtx.setPosition(t.x + 0.8, heightAt(t.x, t.z) + 0.04, t.z + 0.7);
    treeShadows.setMatrixAt(i, mtx);
  });
  treeShadows.instanceMatrix.needsUpdate = true;
  treeShadows.renderOrder = 1;
  sceneRoot.add(treeShadows);

  // bushes
  const bushGeo = new THREE.IcosahedronGeometry(1, 0);
  const bushMesh = new THREE.InstancedMesh(bushGeo, M.leaf, 300);
  const q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  for (let i = 0; i < 300; i++) {
    let x, z, ok = false;
    for (let k = 0; k < 20 && !ok; k++) {
      x = (rand() - 0.5) * (WORLD - 80); z = (rand() - 0.5) * (WORLD - 80);
      ok = !avoid(x, z);
    }
    if (!ok) { x = 0; z = 0; }
    const s = 0.5 + rand() * 1.1;
    v.set(x, heightAt(x, z) + s * 0.5, z);
    sc.set(s * 1.3, s * 0.8, s * 1.3);
    mtx.compose(v, q, sc);
    bushMesh.setMatrixAt(i, mtx);
  }
  bushMesh.instanceMatrix.needsUpdate = true;
  sceneRoot.add(bushMesh);

  // rocks
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rockMesh = new THREE.InstancedMesh(rockGeo, M.rock, 120);
  for (let i = 0; i < 120; i++) {
    const x = (rand() - 0.5) * (WORLD - 60), z = (rand() - 0.5) * (WORLD - 60);
    const s = 0.5 + rand() * 2.0;
    v.set(x, heightAt(x, z) + s * 0.25, z);
    sc.set(s, s * 0.7, s);
    q.setFromEuler(new THREE.Euler(0, rand() * Math.PI, 0));
    mtx.compose(v, q, sc);
    rockMesh.setMatrixAt(i, mtx);
    if (s > 1.0) circleColliders.push({ x, z, r: s * 0.8 });
  }
  rockMesh.instanceMatrix.needsUpdate = true;
  sceneRoot.add(rockMesh);
}

export function hideTree(tree) {
  if (!tree || tree.felled) return;
  tree.felled = true;
  const mtx = new THREE.Matrix4();
  mtx.makeScale(0, 0, 0);
  treeTrunkMesh.setMatrixAt(tree.i, mtx);
  treeFoliageMesh.setMatrixAt(tree.i, mtx);
  treeTrunkMesh.instanceMatrix.needsUpdate = true;
  treeFoliageMesh.instanceMatrix.needsUpdate = true;
}
/* ------------------------------------------------------------
   Loot containers (visuals)
   ------------------------------------------------------------ */
const TIER_COLORS = {
  residential: 0x7a6847, store: 0x8b7a50, supermarket: 0x9a8658, medical: 0xb9b6a4,
  police: 0x3f4f5c, military: 0x4c5a3d, industrial: 0x6a6a5f, farm: 0x77603f,
  hunting: 0x5c6144, camp: 0x67704f,
};

function buildContainers() {
  for (const c of containers) {
    const baseY = c.y ?? heightAt(c.x, c.z);
    const mat = new THREE.MeshLambertMaterial({ color: TIER_COLORS[c.tier] || 0x7a6847, emissive: 0x000000 });
    let mesh;
    if (c.type === 'barrel') {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.95, 8), mat);
      mesh.position.set(c.x, baseY + 0.48, c.z);
    } else if (c.type === 'duffel') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.52, 0.5), mat);
      mesh.position.set(c.x, baseY + 0.27, c.z);
      mesh.rotation.y = rand() * Math.PI;
    } else {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.62, 0.72), mat);
      mesh.position.set(c.x, baseY + 0.34, c.z);
      mesh.rotation.y = rand() * Math.PI;
    }
    c.mat = mat;
    // small marker so loot is findable in the dark
    const glintMat = new THREE.MeshBasicMaterial({ color: c.tier === 'military' ? 0xd8cf9a : 0xf0e3b2, transparent: true, opacity: 0.85 });
    const glint = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 0), glintMat);
    glint.position.set(c.x, baseY + 1.05, c.z);
    glint.userData.base = baseY + 1.05;
    sceneRoot.add(glint);
    c.glint = glint;
    c.mesh = mesh;
    sceneRoot.add(mesh);
  }
}

export function updateContainerGlints(dt, t) {
  for (const c of containers) {
    if (!c.glint) continue;
    c.glint.visible = !c.searched;
    if (c.searched) continue;
    c.glint.rotation.y += dt * 1.5;
    c.glint.position.y = c.glint.userData.base + Math.sin(t * 2 + c.x) * 0.05;
  }
}

/* ------------------------------------------------------------
   World assembly
   ------------------------------------------------------------ */
function mergeStaticBoxes() {
  const groups = new Map();
  for (const m of [...sceneRoot.children]) {
    if (!m.isMesh || !m.geometry || m.geometry.type !== 'BoxGeometry') continue;
    if (m.userData.dynamic) continue;
    const key = m.material.uuid;
    if (!groups.has(key)) groups.set(key, { mat: m.material, meshes: [] });
    groups.get(key).meshes.push(m);
  }
  for (const { mat, meshes } of groups.values()) {
    if (meshes.length < 2) continue;
    const positions = [], normals = [], uvs = [], indices = [];
    let offset = 0;
    for (const m of meshes) {
      m.updateWorldMatrix(true, false);
      const g = m.geometry;
      const pos = g.attributes.position, norm = g.attributes.normal, uv = g.attributes.uv;
      const nm = new THREE.Matrix3().getNormalMatrix(m.matrixWorld);
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        positions.push(v.x, v.y, v.z);
        v.fromBufferAttribute(norm, i).applyMatrix3(nm).normalize();
        normals.push(v.x, v.y, v.z);
        if (uv) uvs.push(uv.getX(i), uv.getY(i));
      }
      if (g.index) for (let i = 0; i < g.index.count; i++) indices.push(g.index.getX(i) + offset);
      else for (let i = 0; i < pos.count; i++) indices.push(i + offset);
      offset += pos.count;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    if (uvs.length) geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeBoundingSphere();
    const merged = new THREE.Mesh(geo, mat);
    merged.frustumCulled = true;
    sceneRoot.add(merged);
    for (const m of meshes) sceneRoot.remove(m);
  }
}

export function buildWorld(scene) {
  sceneRoot = new THREE.Group();
  scene.add(sceneRoot);
  buildTerrain();
  layoutWorld();
  buildForest();
  buildGrass();
  buildMountains();
  addTownDressing();
  buildContainers();
  mergeStaticBoxes();
  return sceneRoot;
}

export function nearestContainer(x, z, radius = 2.6) {
  let best = null, bd = radius;
  for (const c of containers) {
    if (c.searched) continue;
    const d = Math.hypot(c.x - x, c.z - z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

export function nearestTree(x, z, radius = 2.8) {
  let best = null, bd = radius;
  for (const t of trees) {
    if (t.felled) continue;
    const d = Math.hypot(t.x - x, t.z - z);
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}

export function nearestDoor(x, z, radius = 2.6) {
  let best = null, bd = radius;
  for (const d of doors) {
    const dd = Math.hypot(d.x - x, d.z - z);
    if (dd < bd) { bd = dd; best = d; }
  }
  return best;
}
/* ------------------------------------------------------------
   Grass, mountains, town clutter
   ------------------------------------------------------------ */
function buildGrass() {
  const N = 13000;
  const geo = new THREE.ConeGeometry(0.17, 0.36, 3);
  geo.translate(0, 0.18, 0);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
  const mtx = new THREE.Matrix4();
  const col = new THREE.Color();
  const q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    let x, z;
    if (i < N * 0.55) {
      const s = settlements[Math.floor(rand() * settlements.length)];
      const a = rand() * Math.PI * 2, r = 8 + Math.pow(rand(), 0.6) * 95;
      x = s.x + Math.cos(a) * r; z = s.z + Math.sin(a) * r;
    } else {
      x = (rand() - 0.5) * (WORLD - 40); z = (rand() - 0.5) * (WORLD - 40);
    }
    if (waterMask(x, z) > 0.03) { x += 20; z += 12; }
    const s2 = 0.6 + rand() * 0.9;
    v.set(x, heightAt(x, z), z);
    q.setFromEuler(new THREE.Euler(0, rand() * Math.PI, 0));
    sc.set(s2, s2, s2);
    mtx.compose(v, q, sc);
    mesh.setMatrixAt(i, mtx);
    col.setHex(rand() < 0.5 ? 0x556b3a : rand() < 0.5 ? 0x667c45 : 0x496034);
    mesh.setColorAt(i, col);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  sceneRoot.add(mesh);
}

function buildMountains() {
  const layers = [
    { r: 930, base: -8, hMin: 70, hMax: 150, color: 0x5c6b64, opacity: 0.95, order: -16 },
    { r: 1050, base: -6, hMin: 120, hMax: 240, color: 0x77857d, opacity: 0.85, order: -17 },
  ];
  for (const L of layers) {
    const segs = 96;
    const verts = [], idx = [];
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const wob = 0.55 + 0.45 * Math.sin(i * 0.7) * Math.cos(i * 0.23);
      const h = L.hMin + (L.hMax - L.hMin) * wob;
      verts.push(Math.cos(a) * L.r, L.base, Math.sin(a) * L.r);
      verts.push(Math.cos(a) * L.r, L.base + h, Math.sin(a) * L.r);
      if (i < segs) {
        const k = i * 2;
        idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: L.color, transparent: true, opacity: L.opacity, side: THREE.DoubleSide, fog: false, depthWrite: false }));
    m.renderOrder = L.order;
    sceneRoot.add(m);
  }
}

function addLamp(x, z) {
  const y = heightAt(x, z);
  box(sceneRoot, 0.14, 5.0, 0.14, M.woodDark, x, y + 2.5, z);
  box(sceneRoot, 1.3, 0.1, 0.1, M.woodDark, x + 0.55, y + 4.95, z);
  const head = box(sceneRoot, 0.34, 0.22, 0.34, new THREE.MeshLambertMaterial({ color: 0x2a3028 }), x + 1.1, y + 4.85, z);
  const bulb = box(sceneRoot, 0.18, 0.06, 0.18, new THREE.MeshLambertMaterial({ color: 0xded7ad, emissive: 0x6b6238 }), x + 1.1, y + 4.72, z);
  circleColliders.push({ x, z, r: 0.25 });
}

function addBench(x, z, ry = 0) {
  const y = heightAt(x, z);
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry;
  box(g, 1.6, 0.1, 0.45, M.wood, 0, 0.48, 0);
  box(g, 1.6, 0.1, 0.16, M.wood, 0, 0.8, -0.22);
  for (const sx of [-0.65, 0.65]) box(g, 0.1, 0.48, 0.4, M.woodDark, sx, 0.24, 0);
  sceneRoot.add(g);
  circleColliders.push({ x, z, r: 0.7 });
}

function addTownDressing() {
  // Pine Ridge
  addLamp(16, 9); addLamp(-16, 7); addLamp(7, -20); addLamp(-9, 28);
  addBench(21, -3, 0.2); addBench(-5, 25, -0.4);
  containers.push({ x: 27, z: -4, y: heightAt(27, -4) + 0.3, tier: 'store', type: 'crate', searched: false, items: null });
  containers.push({ x: 30, z: -6, y: heightAt(30, -6) + 0.3, tier: 'residential', type: 'crate', searched: false, items: null });
  addBarrel(13, 24, 'residential');
  // Ravenwood
  addLamp(508, -448); addLamp(536, -410); addLamp(492, -414);
  addBench(508, -404, 0.1);
  containers.push({ x: 507, z: -462, y: heightAt(507, -462) + 0.3, tier: 'supermarket', type: 'crate', searched: false, items: null });
  containers.push({ x: 530, z: -466, y: heightAt(530, -466) + 0.3, tier: 'supermarket', type: 'crate', searched: false, items: null });
  // Ashwood
  containers.push({ x: -510, z: 418, y: heightAt(-510, 418) + 0.3, tier: 'hunting', type: 'duffel', searched: false, items: null });
  // burning barrel at camp (glow)
  const by = heightAt(-521, 442);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.0, 10), M.rust);
  barrel.position.set(-521, by + 0.5, 442); sceneRoot.add(barrel);
  const fireMat = new THREE.MeshBasicMaterial({ color: 0xffa95a });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.8, 5), fireMat);
  flame.position.set(-521, by + 1.25, 442); sceneRoot.add(flame);
  const bl = new THREE.PointLight(0xff9a52, 10, 10, 1.4); bl.position.set(-521, by + 1.5, 442); sceneRoot.add(bl);
  containers.push({ x: -521, z: 442, y: by + 0.3, tier: 'camp', type: 'barrel', searched: false, items: null });
}
