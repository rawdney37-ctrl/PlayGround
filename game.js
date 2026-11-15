import * as THREE from './vendor/three.module.min.js';
import {
  WORLD, WATER_LEVEL, settlements, heightAt, collidePush, sightBlocked, wallColliders,
  doors, containers, trees, pois, nearWater, buildWorld, updateContainerGlints,
  hideTree, nearestContainer, nearestTree, nearestDoor, isWaterAt, inSettlement,
  buildings, circleColliders, structures, zombiesSpawn, roads, lakes, rivers,
} from './world.js';

/* ============================================================
   AFTERLIGHT — survival systems & game loop
   ============================================================ */

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const rand = Math.random;
const pick = (a) => a[Math.floor(rand() * a.length)];
const fmt = (n) => (Math.round(n * 10) / 10).toString();

/* ------------------------------------------------------------
   Items
   ------------------------------------------------------------ */
const ITEMS = {
  'Canned beans': { type: 'food', w: 0.55, icon: '◍', use: 'food', value: 30, desc: 'Cold beans. Safe to eat.' },
  'Canned peaches': { type: 'food', w: 0.55, icon: '◒', use: 'food', value: 24, desc: 'Sweet syrup and fruit.' },
  'Military ration': { type: 'food', w: 0.7, icon: '▣', use: 'food', value: 42, desc: 'High-calorie field ration.' },
  'Trail mix': { type: 'food', w: 0.25, icon: '◌', use: 'food', value: 16, desc: 'Nuts and raisins.' },
  'Protein bar': { type: 'food', w: 0.15, icon: '▬', use: 'food', value: 14, desc: 'Cardboard with ambition.' },
  'Dried meat': { type: 'food', w: 0.35, icon: '▰', use: 'food', value: 22, desc: 'Smoked strips. Safe.' },
  'Raw fish': { type: 'food', w: 0.5, icon: '◖', use: 'rawfood', value: 18, desc: 'Cook it before eating.' },
  'Cooked fish': { type: 'food', w: 0.45, icon: '◗', use: 'food', value: 34, desc: 'Cooked over a fire.' },
  'Apple': { type: 'food', w: 0.2, icon: '●', use: 'food', value: 10, desc: 'Bruised but edible.' },
  'Moldy bread': { type: 'food', w: 0.3, icon: '▭', use: 'rawfood', value: 8, desc: 'Risky. Only the desperate.' },
  'Purified water': { type: 'water', w: 0.9, icon: '◉', use: 'water', value: 34, desc: 'Clean, safe water.' },
  'Dirty water': { type: 'water', w: 0.9, icon: '◍', use: 'dirtywater', value: 26, desc: 'Boil it or risk sickness.' },
  'Soda can': { type: 'water', w: 0.35, icon: '◎', use: 'water', value: 16, desc: 'Flat, warm, wonderful.' },
  'Empty bottle': { type: 'water', w: 0.12, icon: '○', use: 'bottle', desc: 'Fill it at a water source.' },
  'Bandage': { type: 'medical', w: 0.08, icon: '＋', use: 'bandage', desc: 'Stops bleeding. Heals wounds.' },
  'Antibiotics': { type: 'medical', w: 0.06, icon: '✚', use: 'antibiotics', desc: 'Cures infection and fever.' },
  'Painkillers': { type: 'medical', w: 0.05, icon: '✜', use: 'painkillers', desc: 'Eases pain, restores a little health.' },
  'Antiseptic': { type: 'medical', w: 0.12, icon: '✧', use: 'antiseptic', desc: 'Cleans a wound before it infects.' },
  'First aid kit': { type: 'medical', w: 0.7, icon: '✚', use: 'firstaid', desc: 'Stops bleeding and mends a lot.' },
  'Rag': { type: 'material', w: 0.06, icon: '▱', desc: 'Cloth scrap. Bandages and fire.' },
  'Cloth': { type: 'material', w: 0.2, icon: '▱', desc: 'Useful padding.' },
  'Wood Scrap': { type: 'material', w: 0.45, icon: '▤', desc: 'Salvaged timber.' },
  'Metal Scrap': { type: 'material', w: 0.6, icon: '▧', desc: 'Bent sheet and wire.' },
  'Nails': { type: 'material', w: 0.05, icon: '⌁', desc: 'For building and ammunition.' },
  'Fuel': { type: 'material', w: 0.7, icon: '◫', desc: 'Volatile. Burns well.' },
  'Duct tape': { type: 'material', w: 0.15, icon: '◍', desc: 'Fixes almost anything.' },
  'Flashlight': { type: 'tool', w: 0.25, icon: '⌁', use: 'torch', desc: 'A beam in the dark. Needs batteries.' },
  'Batteries': { type: 'tool', w: 0.08, icon: '▮', use: 'battery', desc: 'Power for the torch.' },
  'Pocket knife': { type: 'weapon', w: 0.15, icon: '†', dmg: 24, range: 1.9, rate: 0.45, noise: 0.1, dur: 100, desc: 'Small, quick, quiet.' },
  'Hunting knife': { type: 'weapon', w: 0.25, icon: '†', dmg: 30, range: 2.0, rate: 0.5, noise: 0.1, dur: 140, desc: 'Skinning knife. Sharp.' },
  'Fire axe': { type: 'weapon', w: 1.6, icon: '⚒', dmg: 42, range: 2.15, rate: 0.85, noise: 0.35, dur: 180, desc: 'Heavy, brutal, chops wood.' },
  'Baseball bat': { type: 'weapon', w: 1.1, icon: '╱', dmg: 32, range: 2.25, rate: 0.7, noise: 0.3, dur: 160, desc: 'A reliable swing.' },
  'Crowbar': { type: 'weapon', w: 1.0, icon: '⌐', dmg: 30, range: 2.05, rate: 0.65, noise: 0.3, dur: 200, desc: 'Prying and bludgeoning.' },
  '9mm pistol': { type: 'weapon', w: 0.9, icon: '⌐', dmg: 30, range: 70, rate: 0.28, auto: false, mag: 12, ammo: '9mm rounds', noise: 1.0, dur: 100, desc: 'Sidearm. Loud.' },
  'Revolver': { type: 'weapon', w: 1.0, icon: '⌐', dmg: 46, range: 70, rate: 0.55, auto: false, mag: 6, ammo: '.357 rounds', noise: 1.0, dur: 130, desc: 'Six heavy shots.' },
  'Pump shotgun': { type: 'weapon', w: 2.9, icon: '═', dmg: 13, pellets: 7, range: 32, rate: 0.95, auto: false, mag: 5, ammo: '12ga shells', noise: 1.2, dur: 150, desc: 'Devastating up close.' },
  'Hunting rifle': { type: 'weapon', w: 3.2, icon: '═', dmg: 72, range: 190, rate: 1.1, auto: false, mag: 5, ammo: '.308 rounds', noise: 1.3, dur: 140, desc: 'Slow, precise, lethal.' },
  'Assault rifle': { type: 'weapon', w: 3.0, icon: '═', dmg: 26, range: 120, rate: 0.12, auto: true, mag: 30, ammo: '5.56 rounds', noise: 1.25, dur: 170, desc: 'Military select-fire rifle.' },
  '9mm rounds': { type: 'ammo', w: 0.01, icon: '▪', desc: 'Pistol ammunition.' },
  '.357 rounds': { type: 'ammo', w: 0.02, icon: '▪', desc: 'Revolver ammunition.' },
  '12ga shells': { type: 'ammo', w: 0.03, icon: '▪', desc: 'Shotgun shells.' },
  '.308 rounds': { type: 'ammo', w: 0.03, icon: '▪', desc: 'Rifle ammunition.' },
  '5.56 rounds': { type: 'ammo', w: 0.02, icon: '▪', desc: 'Assault rifle ammunition.' },
  'Warm jacket': { type: 'clothing', w: 1.0, icon: '◈', ins: 6, dur: 100, desc: 'Keeps the cold out.' },
  'Rain coat': { type: 'clothing', w: 0.8, icon: '◈', ins: 2, wet: 0.65, dur: 90, desc: 'Sheds rain. Thin insulation.' },
  'Military vest': { type: 'clothing', w: 2.2, icon: '◈', ins: 5, armor: 0.35, dur: 160, desc: 'Stops teeth. Heavy.' },
  'Hiking boots': { type: 'clothing', w: 0.9, icon: '◈', ins: 1, desc: 'Better footing on rough ground.' },
  'Canvas backpack': { type: 'backpack', w: 0.8, icon: '▣', cap: 12, desc: 'Adds 12 kg of capacity.' },
  'Hiking pack': { type: 'backpack', w: 1.2, icon: '▣', cap: 20, desc: 'Adds 20 kg of capacity.' },
  'Military rucksack': { type: 'backpack', w: 1.6, icon: '▣', cap: 28, desc: 'Adds 28 kg of capacity.' },
  'Beanie': { type: 'clothing', w: 0.1, icon: '◓', ins: 2, dur: 70, desc: 'Warm head, clearer thoughts.' },
  'Gas mask': { type: 'clothing', w: 0.6, icon: '◔', ins: 1, desc: 'Filters smoke and spores.' },
};

const LOOT = {
  residential: [['Canned beans', 8], ['Trail mix', 7], ['Purified water', 5], ['Rag', 9], ['Bandage', 5], ['Pocket knife', 3], ['Flashlight', 3], ['Batteries', 4], ['Warm jacket', 3], ['Duct tape', 4], ['Wood Scrap', 4], ['Empty bottle', 4], ['Apple', 4], ['Soda can', 5], ['Beanie', 3], ['First aid kit', 1]],
  store: [['Canned beans', 10], ['Canned peaches', 8], ['Purified water', 9], ['Soda can', 8], ['Trail mix', 7], ['Protein bar', 6], ['Rag', 6], ['Bandage', 4], ['Canvas backpack', 3], ['Flashlight', 3], ['Batteries', 3], ['Empty bottle', 6], ['Apple', 6], ['Moldy bread', 4]],
  supermarket: [['Canned beans', 12], ['Canned peaches', 10], ['Purified water', 10], ['Soda can', 10], ['Trail mix', 8], ['Protein bar', 8], ['Apple', 8], ['Moldy bread', 6], ['Bandage', 5], ['Hiking pack', 3], ['Empty bottle', 7], ['Raw fish', 3]],
  medical: [['Bandage', 12], ['Antibiotics', 6], ['Painkillers', 8], ['Antiseptic', 7], ['First aid kit', 5], ['Purified water', 4], ['Rag', 5], ['Flashlight', 2], ['Warm jacket', 2]],
  police: [['9mm pistol', 7], ['9mm rounds', 12], ['Revolver', 4], ['.357 rounds', 6], ['Bandage', 7], ['Military vest', 3], ['Flashlight', 5], ['Batteries', 6], ['Duct tape', 5], ['Pocket knife', 4], ['Military ration', 3]],
  military: [['Assault rifle', 5], ['5.56 rounds', 12], ['Hunting rifle', 4], ['.308 rounds', 8], ['Pump shotgun', 3], ['12ga shells', 8], ['Military vest', 6], ['Military rucksack', 4], ['Military ration', 7], ['Bandage', 9], ['First aid kit', 5], ['Antibiotics', 4], ['Gas mask', 3], ['Flashlight', 4], ['Batteries', 5]],
  industrial: [['Metal Scrap', 12], ['Wood Scrap', 8], ['Nails', 10], ['Fuel', 6], ['Duct tape', 8], ['Crowbar', 5], ['Fire axe', 4], ['Baseball bat', 3], ['Rag', 7], ['Flashlight', 3], ['Batteries', 4], ['Hiking boots', 3]],
  farm: [['Dried meat', 9], ['Canned beans', 6], ['Raw fish', 6], ['Apple', 7], ['Purified water', 5], ['Wood Scrap', 8], ['Rag', 7], ['Bandage', 4], ['Hunting knife', 4], ['Beanie', 3], ['Nails', 4]],
  hunting: [['Hunting rifle', 5], ['.308 rounds', 9], ['Hunting knife', 7], ['Dried meat', 8], ['Trail mix', 6], ['Purified water', 5], ['Beanie', 5], ['Warm jacket', 4], ['Bandage', 4], ['Wood Scrap', 6], ['Rag', 5], ['Empty bottle', 4]],
  camp: [['Trail mix', 8], ['Canned beans', 6], ['Purified water', 7], ['Empty bottle', 6], ['Bandage', 5], ['Rag', 6], ['Flashlight', 4], ['Batteries', 5], ['Duct tape', 4], ['Canvas backpack', 2], ['Hunting knife', 3], ['Raw fish', 3]],
  medicalVehicle: [['First aid kit', 8], ['Bandage', 10], ['Antibiotics', 6], ['Painkillers', 7], ['Antiseptic', 6]],
};

const RECIPES = [
  { id: 'bandage', name: 'Bandage', cost: { Rag: 2 }, out: 'Bandage', qty: 1, note: 'Clean cloth, tight wrap.' },
  { id: 'nails', name: 'Nails (×4)', cost: { 'Metal Scrap': 1 }, out: 'Nails', qty: 4, note: 'Cut scrap into spikes.' },
  { id: 'ammo9', name: '9mm rounds (×6)', cost: { 'Metal Scrap': 2, Nails: 1 }, out: '9mm rounds', qty: 6, note: 'Hand-pressed reloads. Crude.' },
  { id: 'purify', name: 'Boil water', cost: { 'Dirty water': 1 }, out: 'Purified water', qty: 1, note: 'Requires a lit campfire.' },
  { id: 'cookfish', name: 'Cook fish', cost: { 'Raw fish': 1 }, out: 'Cooked fish', qty: 1, note: 'Requires a lit campfire.' },
  { id: 'antiseptic', name: 'Antiseptic', cost: { Rag: 1, Fuel: 1 }, out: 'Antiseptic', qty: 1, note: 'Rough but effective.' },
];

const BUILDS = {
  woodWall: { name: 'Wooden wall', cat: 'Defence', cost: { 'Wood Scrap': 4 }, w: 3.2, h: 2.7, d: 0.28, hp: 220, kind: 'wall', desc: 'A plank wall. Blocks sight and infected.' },
  metalWall: { name: 'Metal wall', cat: 'Defence', cost: { 'Metal Scrap': 4, 'Wood Scrap': 1 }, w: 3.2, h: 2.7, d: 0.28, hp: 420, kind: 'wall', desc: 'Scrap plating. Tough, ugly.' },
  door: { name: 'Doorway', cat: 'Defence', cost: { 'Wood Scrap': 6, 'Metal Scrap': 1 }, w: 3.2, h: 2.7, d: 0.4, hp: 260, kind: 'door', desc: 'A real door. Opens, closes, locks.' },
  gate: { name: 'Gate', cat: 'Defence', cost: { 'Wood Scrap': 6, 'Metal Scrap': 2 }, w: 3.6, h: 2.4, d: 0.3, hp: 340, kind: 'gate', desc: 'Wider gate for vehicles and allies.' },
  spikes: { name: 'Spike barricade', cat: 'Defence', cost: { 'Wood Scrap': 4, 'Metal Scrap': 1 }, w: 2.6, h: 0.9, d: 0.9, hp: 120, kind: 'spikes', desc: 'Wounds anything that pushes through.' },
  windowWall: { name: 'Window wall', cat: 'Defence', cost: { 'Wood Scrap': 4, 'Metal Scrap': 1 }, w: 3.2, h: 2.7, d: 0.28, hp: 170, kind: 'window', desc: 'A firing port. You can see and shoot through.' },
  floor: { name: 'Wood floor', cat: 'Structure', cost: { 'Wood Scrap': 3 }, w: 3.2, h: 0.12, d: 3.2, hp: 160, kind: 'floor', desc: 'A raised, dry floor.' },
  watchtower: { name: 'Watchtower', cat: 'Structure', cost: { 'Wood Scrap': 10, 'Metal Scrap': 4 }, w: 3.2, h: 5.4, d: 3.2, hp: 300, kind: 'tower', desc: 'High ground and a cache shelf.' },
  shelter: { name: 'Lean-to shelter', cat: 'Structure', cost: { 'Wood Scrap': 8, Rag: 2 }, w: 3.6, h: 2.2, d: 3.0, hp: 180, kind: 'shelter', desc: 'Keeps rain off. Warms you.' },
  canopy: { name: 'Roof canopy', cat: 'Structure', cost: { 'Wood Scrap': 4, Rag: 1 }, w: 3.4, h: 2.6, d: 3.4, hp: 140, kind: 'canopy', desc: 'A simple roof for a work area or bedroll.' },
  storage: { name: 'Storage crate', cat: 'Utility', cost: { 'Wood Scrap': 6, 'Metal Scrap': 1 }, w: 1.4, h: 1.1, d: 1.0, hp: 240, kind: 'storage', desc: 'Store supplies safely.' },
  campfire: { name: 'Campfire', cat: 'Utility', cost: { 'Wood Scrap': 3, Rag: 1 }, w: 1.6, h: 0.5, d: 1.6, hp: 100, kind: 'campfire', desc: 'Warmth, light, cooking, boiling.' },
  bedroll: { name: 'Sleeping bag', cat: 'Utility', cost: { Rag: 3, 'Wood Scrap': 1 }, w: 2.0, h: 0.18, d: 0.9, hp: 60, kind: 'bed', desc: 'Sleep through the dark hours.' },
};

/* ------------------------------------------------------------
   Runtime state
   ------------------------------------------------------------ */
const state = {
  started: false, paused: true, over: false, overlay: null,
  time: 9.0, day: 1, weather: 'CLEAR', weatherTimer: 140, weatherBlend: 0,
  elapsed: 0, kills: 0, distance: 0, buildMode: false, buildType: 'woodWall',
  ghost: null, ghostRot: 0, sleepT: 0, lightning: 0, thunderT: 0,
  nearest: null, nearTick: 0, noiseTick: 0, hudTick: 0, threat: false, indoor: false,
  char: { gender: 'female', name: 'Mara', color: '#5c6b45' },
  audioReady: false, hitFlash: 0, messageLog: [], noiseEvents: [], flash: 0, lastObjectiveCheck: 0,
};

const player = {
  x: 6, z: 42, y: 0, vy: 0, yaw: 0.11, pitch: -0.02,
  health: 100, blood: 100, food: 88, water: 82, temp: 37.0, stamina: 100, energy: 92,
  wet: 0, bleed: 0, crouch: false, sprint: false, grounded: true, aim: false,
  flashlight: false, third: false, alive: true, attackCd: 0, attackAnim: 0,
  useCd: 0, reload: 0, noise: 0, mag: 0, bob: 0, breath: 0,
  pain: 0, infection: 0, fever: 0, cold: 0, poison: 0, sickTimer: 0,
  lastDamage: '', deathCause: 'Exposure', fall: 0, invuln: 0, stepT: 0,
};

let inventory = [
  { name: 'Rag', qty: 3, cond: 100 },
  { name: 'Trail mix', qty: 1, cond: 100 },
  { name: 'Empty bottle', qty: 1, cond: 100 },
  { name: 'Wood Scrap', qty: 4, cond: 100 },
  { name: 'Metal Scrap', qty: 1, cond: 100 },
];
const equipped = { primary: null, melee: { name: 'Pocket knife', cond: 82 }, clothing: { name: 'Warm jacket', cond: 74 }, backpack: null };
const quick = [null, null, null];

let capacityBase = 13;
const capacity = () => capacityBase + (equipped.backpack ? (ITEMS[equipped.backpack.name]?.cap || 0) : 0);
const weight = () => inventory.reduce((n, it) => n + (ITEMS[it.name]?.w || 0.3) * it.qty, 0);
const count = (name) => inventory.reduce((n, it) => n + (it.name === name ? it.qty : 0), 0);
/* ------------------------------------------------------------
   Audio (synthesised — no external assets)
   ------------------------------------------------------------ */
const audio = {
  ctx: null, master: null, wind: null, rain: null, fire: null,

  init() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      const ctx = this.ctx = new AC();
      this.master = ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(ctx.destination);
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;

      const wind = ctx.createBufferSource(); wind.buffer = buf; wind.loop = true;
      const windF = ctx.createBiquadFilter(); windF.type = 'lowpass'; windF.frequency.value = 420;
      const windG = ctx.createGain(); windG.gain.value = 0.1;
      wind.connect(windF).connect(windG).connect(this.master); wind.start();
      this.wind = windG; this.windFilter = windF;

      const rain = ctx.createBufferSource(); rain.buffer = buf; rain.loop = true;
      const rainF = ctx.createBiquadFilter(); rainF.type = 'highpass'; rainF.frequency.value = 1100;
      const rainG = ctx.createGain(); rainG.gain.value = 0;
      rain.connect(rainF).connect(rainG).connect(this.master); rain.start();
      this.rain = rainG;

      const fire = ctx.createBufferSource(); fire.buffer = buf; fire.loop = true;
      const fireF = ctx.createBiquadFilter(); fireF.type = 'bandpass'; fireF.frequency.value = 2400; fireF.Q.value = 0.7;
      const fireG = ctx.createGain(); fireG.gain.value = 0;
      fire.connect(fireF).connect(fireG).connect(this.master); fire.start();
      this.fire = fireG;
      state.audioReady = true;
    } catch (e) { console.warn('audio unavailable', e); }
  },

  burst(dur, freq, gain, type = 'lowpass', q = 0.7) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t); src.stop(t + dur + 0.05);
  },

  tone(freq, dur, gain, type = 'sine', slide = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.03);
  },

  shot(kind) {
    if (!this.ctx) return;
    this.burst(0.3, kind === 'shotgun' ? 700 : 1500, 0.5);
    this.burst(0.55, 180, 0.3, 'lowpass');
    this.tone(kind === 'rifle' ? 90 : 120, 0.22, 0.3, 'triangle', -50);
  },
  swing() { this.burst(0.13, 900, 0.12, 'bandpass', 1.2); },
  hit() { this.burst(0.12, 380, 0.22, 'lowpass'); this.tone(70, 0.12, 0.2, 'sine'); },
  hurt() { this.burst(0.25, 260, 0.3); this.tone(58, 0.35, 0.16, 'sine'); },
  pickup() { this.tone(520, 0.08, 0.06, 'triangle'); this.tone(760, 0.1, 0.045, 'triangle'); },
  ui() { this.tone(420, 0.045, 0.035, 'square'); },
  step(surface) {
    const f = surface === 'water' ? 700 : surface === 'wood' ? 500 : surface === 'gravel' ? 900 : 380;
    this.burst(0.05, f, 0.05 + player.noise * 0.05, 'bandpass', 1.5);
  },
  growl(vol = 0.2) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(72 + rand() * 26, t);
    o.frequency.linearRampToValueAtTime(52 + rand() * 16, t + 0.7);
    f.type = 'lowpass'; f.frequency.value = 480;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(f).connect(g).connect(this.master);
    o.start(t); o.stop(t + 1);
  },
  scream(vol = 0.25) {
    this.tone(360, 0.5, vol, 'sawtooth', -180);
    this.burst(0.5, 900, vol * 0.4, 'bandpass', 2);
  },
  thunder() {
    this.burst(2.4, 120, 0.35, 'lowpass');
    this.tone(42, 2.0, 0.14, 'sine', -12);
  },
  heartbeat() { this.tone(48, 0.16, 0.22, 'sine', -8); },
  reload() { this.burst(0.08, 2000, 0.09, 'highpass', 2); },
  eat() { this.burst(0.2, 700, 0.12, 'bandpass', 1.2); },
  drink() { this.tone(360, 0.22, 0.08, 'sine', 80); },
  craft() { this.burst(0.12, 900, 0.1, 'bandpass'); this.tone(320, 0.2, 0.05, 'triangle'); },
};

/* ------------------------------------------------------------
   Renderer / scene / lights
   ------------------------------------------------------------ */
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.14;
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x9aa88f, 0.0024);
const camera = new THREE.PerspectiveCamera(76, 1, 0.08, 1100);
camera.rotation.order = 'YXZ';
scene.add(camera);

const hemi = new THREE.HemisphereLight(0xc9d9d9, 0x46513a, 1.0);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe4b8, 1.5);
scene.add(sun);
const moon = new THREE.DirectionalLight(0x9db8d8, 0);
scene.add(moon);
const ambient = new THREE.AmbientLight(0x2f3a2c, 0.55);
scene.add(ambient);

const flashlight = new THREE.SpotLight(0xfff0cc, 0, 38, 0.48, 0.5, 1.25);
flashlight.position.set(0.12, -0.08, 0.1);
const flashlightTarget = new THREE.Object3D();
flashlightTarget.position.set(0, -0.15, -1);
camera.add(flashlightTarget);
flashlight.target = flashlightTarget;
camera.add(flashlight);

const muzzleLight = new THREE.PointLight(0xffc98a, 0, 14, 1.8);
scene.add(muzzleLight);

/* gradient sky dome */
const skyMat = new THREE.ShaderMaterial({
  uniforms: {
    top: { value: new THREE.Color(0x4f7484) },
    bottom: { value: new THREE.Color(0xb5bcae) },
    sunDir: { value: new THREE.Vector3(0, 1, 0) },
    sunColor: { value: new THREE.Color(0xffe3b0) },
  },
  vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunColor; varying vec3 vDir;
    void main(){
      vec3 d = normalize(vDir);
      float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
      vec3 col = mix(bottom, top, pow(h, 0.72));
      float s = max(dot(d, normalize(sunDir)), 0.0);
      col += sunColor * pow(s, 36.0) * 0.55;
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  side: THREE.BackSide, depthWrite: false, fog: false,
});
const skyDome = new THREE.Mesh(new THREE.SphereGeometry(880, 24, 16), skyMat);
skyDome.renderOrder = -20;
skyDome.frustumCulled = false;
scene.add(skyDome);
scene.background = new THREE.Color(0x0a141d);

/* sky dome */
const skyGroup = new THREE.Group();
scene.add(skyGroup);
const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(14, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffe8bb, fog: false }));
const moonDisc = new THREE.Mesh(new THREE.SphereGeometry(9, 12, 12), new THREE.MeshBasicMaterial({ color: 0xd6e2ed, fog: false }));
skyGroup.add(sunDisc, moonDisc);
const starGeo = new THREE.BufferGeometry();
{
  const pts = [];
  for (let i = 0; i < 900; i++) {
    const a = rand() * Math.PI * 2, e = rand() * Math.PI * 0.5 + 0.04;
    pts.push(Math.cos(a) * Math.cos(e) * 800, Math.sin(e) * 800, Math.sin(a) * Math.cos(e) * 800);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
}
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xdde6e0, size: 1.5, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
skyGroup.add(stars);

/* rain */
const RAIN_N = 900;
const rainGeo = new THREE.BufferGeometry();
const rainPos = new Float32Array(RAIN_N * 6);
const rainSeed = new Float32Array(RAIN_N * 3);
for (let i = 0; i < RAIN_N; i++) {
  rainSeed[i * 3] = (rand() - 0.5) * 46;
  rainSeed[i * 3 + 1] = rand() * 24;
  rainSeed[i * 3 + 2] = (rand() - 0.5) * 46;
}
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xc7d6d8, transparent: true, opacity: 0.35, fog: false }));
rain.visible = false;
scene.add(rain);

/* ------------------------------------------------------------
   Player body (third person) + view model
   ------------------------------------------------------------ */
const playerMesh = new THREE.Group();
const skinMat = new THREE.MeshLambertMaterial({ color: 0xb99777 });
const jacketMat = new THREE.MeshLambertMaterial({ color: 0x5c6b45 });
const pantsMat = new THREE.MeshLambertMaterial({ color: 0x3e4637 });
const hairMat = new THREE.MeshLambertMaterial({ color: 0x3a2f26 });
const pTorso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.72, 8), jacketMat); pTorso.position.y = 1.12;
const pHead = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), skinMat); pHead.position.y = 1.63;
const pHair = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), hairMat); pHair.position.y = 1.66;
const pArmL = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.62, 6), jacketMat); pArmL.position.set(-0.34, 1.16, 0);
const pArmR = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.62, 6), jacketMat); pArmR.position.set(0.34, 1.16, 0);
const pLegL = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.085, 0.76, 6), pantsMat); pLegL.position.set(-0.13, 0.4, 0);
const pLegR = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.085, 0.76, 6), pantsMat); pLegR.position.set(0.13, 0.4, 0);
const pPack = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.5, 0.22), new THREE.MeshLambertMaterial({ color: 0x5a5136 })); pPack.position.set(0, 1.16, 0.25);
const pNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.14, 7), skinMat); pNeck.position.y = 1.47;
const pShoulderL = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), jacketMat); pShoulderL.position.set(-0.3, 1.38, 0);
const pShoulderR = pShoulderL.clone(); pShoulderR.position.x = 0.3;
const pHandL = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), skinMat); pHandL.position.set(-0.34, 0.83, 0);
const pHandR = pHandL.clone(); pHandR.position.x = 0.34;
const pBootL = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.16, 0.34), new THREE.MeshLambertMaterial({ color: 0x2c2f27 })); pBootL.position.set(-0.13, 0.07, 0.05);
const pBootR = pBootL.clone(); pBootR.position.x = 0.13;
pArmL.add(pHandL); pHandL.position.set(0, -0.34, 0);
pArmR.add(pHandR); pHandR.position.set(0, -0.34, 0);
pLegL.add(pBootL); pBootL.position.set(0, -0.39, 0.06);
pLegR.add(pBootR); pBootR.position.set(0, -0.39, 0.06);
const pShadow = new THREE.Mesh(new THREE.CircleGeometry(0.42, 12), new THREE.MeshBasicMaterial({ color: 0x0a0f0b, transparent: true, opacity: 0.24, depthWrite: false }));
pShadow.rotation.x = -Math.PI / 2; pShadow.position.y = 0.02; playerMesh.add(pTorso, pHead, pHair, pNeck, pShoulderL, pShoulderR, pArmL, pArmR, pLegL, pLegR, pPack, pShadow);
playerMesh.visible = false;
scene.add(playerMesh);

/* view model */
const viewModel = new THREE.Group();
const vmSkin = new THREE.MeshLambertMaterial({ color: 0xb99777 });
const vmMetal = new THREE.MeshLambertMaterial({ color: 0x4a4e4a });
const vmWood = new THREE.MeshLambertMaterial({ color: 0x5d4a34 });
const vmBlade = new THREE.MeshLambertMaterial({ color: 0x7c877e });
const vmGlove = new THREE.MeshLambertMaterial({ color: 0x4d5140 });
const vmHands = new THREE.Group();
vmHands.visible = false;
viewModel.add(vmHands);
const vmWeapon = new THREE.Group();
viewModel.add(vmWeapon);
camera.add(viewModel);
viewModel.scale.setScalar(0.38);
viewModel.position.set(0.1, -0.12, -0.3);
function rebuildViewmodel() {
  while (vmWeapon.children.length) { const c = vmWeapon.children.pop(); c.geometry?.dispose?.(); }

  const w = currentWeapon();
  if (!w) {
    const knife = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.28), vmBlade);
    knife.position.set(0.22, -0.22, -0.47); knife.rotation.x = -0.16; vmWeapon.add(knife);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.055, 0.12), vmWood);
    grip.position.set(0.22, -0.23, -0.33); vmWeapon.add(grip);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.12), vmGlove);
    hand.position.set(0.22, -0.24, -0.3); hand.rotation.x = -0.2; vmWeapon.add(hand);
    return;
  }
  if (w.kind === 'gun') {
    const long = w.name === '9mm pistol' || w.name === 'Revolver' ? 0.34 : 0.62;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, long), vmMetal);
    body.position.set(0.15, -0.11, -0.3 - long / 2); vmWeapon.add(body);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.16, 6), vmMetal);
    barrel.rotation.x = Math.PI / 2; barrel.position.set(0.15, -0.09, -0.32 - long); vmWeapon.add(barrel);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.06), vmWood);
    grip.position.set(0.15, -0.2, -0.34); grip.rotation.x = -0.22; vmWeapon.add(grip);
    if (w.name === 'Hunting rifle') {
      const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.16, 6), vmMetal);
      scope.rotation.x = Math.PI / 2; scope.position.set(0.15, -0.02, -0.55); vmWeapon.add(scope);
    }
    const gripHand = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.08, 0.12), vmGlove);
    gripHand.position.set(0.15, -0.19, -0.33); gripHand.rotation.x = -0.25; vmWeapon.add(gripHand);
    if (long > 0.4) {
      const foreHand = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.13), vmGlove);
      foreHand.position.set(0.15, -0.14, -0.3 - long * 0.62); foreHand.rotation.x = -0.1; vmWeapon.add(foreHand);
    }
  } else if (w.name === 'Fire axe') {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.55, 6), vmWood);
    handle.rotation.x = 0.5; handle.position.set(0.17, -0.11, -0.35); vmWeapon.add(handle);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.11, 0.03), vmBlade);
    head.position.set(0.17, 0.08, -0.48); head.rotation.x = 0.5; vmWeapon.add(head);
  } else if (w.name === 'Baseball bat' || w.name === 'Crowbar') {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.032, 0.6, 6), w.name === 'Crowbar' ? vmMetal : vmWood);
    bar.rotation.x = 0.55; bar.position.set(0.17, -0.09, -0.4); vmWeapon.add(bar);
  } else {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.022, 0.32), vmBlade);
    blade.position.set(0.15, -0.18, -0.55); blade.rotation.x = -0.12; vmWeapon.add(blade);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.13), vmWood);
    grip.position.set(0.15, -0.19, -0.4); vmWeapon.add(grip);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.085, 0.13), vmGlove);
    hand.position.set(0.15, -0.2, -0.36); vmWeapon.add(hand);
  }
}

/* ------------------------------------------------------------
   Zombies
   ------------------------------------------------------------ */
const ZOMBIE_TYPES = {
  walker: { hp: 60, speed: 1.45, dmg: 9, scale: 1.0, color: 0x6e7c5c, hear: 16, name: 'Walker' },
  runner: { hp: 44, speed: 3.15, dmg: 7, scale: 0.94, color: 0x8a6b52, hear: 22, name: 'Runner' },
  brute: { hp: 230, speed: 1.25, dmg: 20, scale: 1.32, color: 0x596447, hear: 18, name: 'Brute' },
  armored: { hp: 155, speed: 1.35, dmg: 12, scale: 1.06, color: 0x4e5752, hear: 15, name: 'Armoured' },
  screecher: { hp: 55, speed: 2.0, dmg: 5, scale: 0.96, color: 0x7a6272, hear: 30, name: 'Screecher' },
};
const zGeo = {
  torso: new THREE.CylinderGeometry(0.27, 0.22, 0.72, 7),
  head: new THREE.SphereGeometry(0.18, 8, 6),
  arm: new THREE.CylinderGeometry(0.07, 0.06, 0.7, 5),
  leg: new THREE.CylinderGeometry(0.09, 0.075, 0.78, 5),
};
const zMat = {};
for (const k in ZOMBIE_TYPES) zMat[k] = new THREE.MeshLambertMaterial({ color: ZOMBIE_TYPES[k].color });
const zDarkMat = new THREE.MeshLambertMaterial({ color: 0x3a4032 });
const zHeadMat = new THREE.MeshLambertMaterial({ color: 0x9a9272 });
const zombies = [];

function newZombie(x, z, typeName) {
  const t = ZOMBIE_TYPES[typeName];
  const g = new THREE.Group();
  const mat = zMat[typeName];
  const torso = new THREE.Mesh(zGeo.torso, mat); torso.position.y = 1.08;
  const head = new THREE.Mesh(zGeo.head, zHeadMat); head.position.y = 1.58;
  const armL = new THREE.Mesh(zGeo.arm, mat); armL.position.set(-0.33, 1.12, 0); armL.rotation.x = -1.2;
  const armR = new THREE.Mesh(zGeo.arm, mat); armR.position.set(0.33, 1.12, 0); armR.rotation.x = -1.2;
  const legL = new THREE.Mesh(zGeo.leg, zDarkMat); legL.position.set(-0.12, 0.4, 0);
  const legR = new THREE.Mesh(zGeo.leg, zDarkMat); legR.position.set(0.12, 0.4, 0);
  g.add(torso, head, armL, armR, legL, legR);
  const zShadow = new THREE.Mesh(new THREE.CircleGeometry(0.45, 10), new THREE.MeshBasicMaterial({ color: 0x0a0f0b, transparent: true, opacity: 0.22, depthWrite: false }));
  zShadow.rotation.x = -Math.PI / 2; zShadow.position.y = 0.02; g.add(zShadow);
  if (typeName === 'armored') {
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.6), new THREE.MeshLambertMaterial({ color: 0x3d4744 }));
    helmet.position.y = 1.62; g.add(helmet);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.1), new THREE.MeshLambertMaterial({ color: 0x3d4744 }));
    plate.position.set(0, 1.18, -0.21); g.add(plate);
  }
  if (typeName === 'brute') {
    torso.scale.set(1.35, 1.2, 1.25);
    armL.scale.set(1.5, 1.15, 1.5); armR.scale.set(1.5, 1.15, 1.5);
  }
  if (typeName === 'screecher') {
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.04), new THREE.MeshBasicMaterial({ color: 0x3a1010 }));
    mouth.position.set(0, 1.54, -0.17); g.add(mouth);
  }
  g.scale.setScalar(t.scale);
  g.position.set(x, heightAt(x, z), z);
  scene.add(g);
  const zObj = {
    x, z, homeX: x, homeZ: z, y: heightAt(x, z), type: typeName, hp: t.hp, maxHp: t.hp,
    speed: t.speed, dmg: t.dmg, mesh: g, state: 'idle', dir: rand() * Math.PI * 2,
    wander: rand() * 2, lastSeenX: x, lastSeenZ: z, searchT: 0, attackCd: 0,
    stun: 0, alert: 0, dead: false, respawn: 0, growlT: rand() * 20, phase: rand() * 10,
    armL, armR, legL, legR, torso, head,
  };
  zombies.push(zObj);
  return zObj;
}

function pickZombieType(hot) {
  const r = rand();
  if (hot) {
    if (r < 0.42) return 'walker';
    if (r < 0.58) return 'runner';
    if (r < 0.74) return 'armored';
    if (r < 0.85) return 'brute';
    return 'screecher';
  }
  if (r < 0.63) return 'walker';
  if (r < 0.79) return 'runner';
  if (r < 0.88) return 'brute';
  if (r < 0.95) return 'armored';
  return 'screecher';
}

function currentWeapon() {
  if (equipped.primary) {
    const it = ITEMS[equipped.primary.name];
    if (it?.type === 'weapon') return { ...it, name: equipped.primary.name, kind: 'gun', cond: equipped.primary.cond };
  }
  if (equipped.melee) {
    const it = ITEMS[equipped.melee.name];
    if (it?.type === 'weapon') return { ...it, name: equipped.melee.name, kind: 'melee', cond: equipped.melee.cond };
  }
  return null;
}
function weaponIsGun() {
  const w = currentWeapon();
  return !!(w && ITEMS[w.name]?.mag);
}
/* ------------------------------------------------------------
   Inventory helpers
   ------------------------------------------------------------ */
const UNIQUE_TYPES = new Set(['weapon', 'clothing', 'backpack']);
const isStackable = (name) => !UNIQUE_TYPES.has(ITEMS[name]?.type);

function addItem(name, qty = 1, cond = null) {
  const def = ITEMS[name];
  if (!def) return;
  if (isStackable(name)) {
    const row = inventory.find(r => r.name === name);
    if (row) row.qty += qty;
    else inventory.push({ name, qty, cond: cond ?? 100 });
  } else {
    for (let i = 0; i < qty; i++) inventory.push({ name, qty: 1, cond: cond ?? (def.dur ?? 100) });
  }
  refreshQuick();
}

function removeItem(name, qty = 1) {
  const removed = [];
  for (let i = inventory.length - 1; i >= 0 && qty > 0; i--) {
    const row = inventory[i];
    if (row.name !== name) continue;
    const take = Math.min(qty, row.qty);
    row.qty -= take; qty -= take;
    for (let k = 0; k < take; k++) removed.push({ name, cond: row.cond });
    if (row.qty <= 0) inventory.splice(i, 1);
  }
  refreshQuick();
  return removed;
}

function hasItem(name) { return count(name) > 0; }

function conditionWord(c) {
  if (c >= 85) return 'PRISTINE';
  if (c >= 60) return 'GOOD';
  if (c >= 35) return 'WORN';
  if (c >= 12) return 'POOR';
  return 'BROKEN';
}
function condClass(c) { return c >= 60 ? '' : c >= 30 ? 'low' : 'bad'; }

function refreshQuick() {
  const foods = inventory.filter(r => ITEMS[r.name].use === 'food' || ITEMS[r.name].use === 'rawfood');
  foods.sort((a, b) => (ITEMS[b.name].value || 0) - (ITEMS[a.name].value || 0));
  const waters = inventory.filter(r => ITEMS[r.name].use === 'water' || ITEMS[r.name].use === 'dirtywater');
  waters.sort((a, b) => (ITEMS[b.name].value || 0) - (ITEMS[a.name].value || 0));
  quick[0] = foods[0]?.name || null;
  quick[1] = waters[0]?.name || (hasItem('Empty bottle') ? 'Empty bottle' : null);
  quick[2] = hasItem('Bandage') ? 'Bandage' : hasItem('First aid kit') ? 'First aid kit' : null;
  for (let i = 0; i < 3; i++) {
    const target = $('qs' + i);
    if (!target) continue;
    const name = quick[i];
    target.textContent = name ? `${ITEMS[name]?.icon || '·'}${count(name)}` : '—';
    target.title = name || '';
  }
}

function toast(text, kind = '') {
  const box = $('toasts');
  if (!box) return;
  while (box.children.length > 3) box.removeChild(box.firstChild);
  const d = document.createElement('div');
  d.className = 'toast ' + kind;
  d.textContent = text;
  box.appendChild(d);
  setTimeout(() => d.remove(), 3400);
}

function hitmarker() {
  const h = $('hitmarker');
  h.classList.remove('show');
  void h.offsetWidth;
  h.classList.add('show');
}

/* ------------------------------------------------------------
   Loot
   ------------------------------------------------------------ */
function weightedPick(table) {
  const total = table.reduce((n, row) => n + row[1], 0);
  let r = rand() * total;
  for (const row of table) { r -= row[1]; if (r <= 0) return row[0]; }
  return table[0][0];
}

function rollLoot(tier, countN) {
  const table = LOOT[tier] || LOOT.residential;
  const out = [];
  const used = new Set();
  for (let i = 0; i < countN; i++) {
    let name = weightedPick(table);
    if (used.has(name) && rand() < 0.6) name = weightedPick(table);
    used.add(name);
    const def = ITEMS[name];
    let qty = 1;
    if (def.type === 'ammo') qty = tier === 'military' ? 8 + Math.floor(rand() * 13) : 4 + Math.floor(rand() * 8);
    if (def.type === 'material') qty = 1 + Math.floor(rand() * 3);
    out.push({ name, qty, cond: def.dur ? 40 + Math.floor(rand() * 60) : 100 });
  }
  return out;
}

function containerLoot(c) {
  if (!c.items) {
    const n = c.tier === 'military' ? 3 + Math.floor(rand() * 3)
      : c.tier === 'medical' || c.tier === 'police' ? 2 + Math.floor(rand() * 3)
      : 2 + Math.floor(rand() * 2);
    c.items = rollLoot(c.tier, n);
  }
  return c.items;
}

function takeLoot(c, index = -1) {
  const items = containerLoot(c).filter(it => it.qty > 0);
  if (!items.length) { c.searched = true; toast('Nothing left here'); return; }
  const take = (row) => {
    const def = ITEMS[row.name];
    let qty = row.qty;
    const free = capacity() - weight();
    if (free < def.w * qty) qty = Math.max(0, Math.floor(free / def.w));
    if (qty <= 0) { toast('Pack is full — drop something first', 'warn'); return false; }
    addItem(row.name, qty, row.cond);
    row.qty -= qty;
    audio.pickup();
    toast(`Took ${row.name}${qty > 1 ? ' ×' + qty : ''}`);
    return true;
  };
  if (index >= 0) take(items[index]);
  else { let any = false; for (const row of [...items]) if (take(row)) any = true; if (!any) return; }
  if (c.items.every(it => it.qty <= 0)) { c.searched = true; if (c.glint) c.glint.visible = false; }
  if (state.overlay === 'loot') openLoot(c);
  updateHud();
}

/* ------------------------------------------------------------
   Items & equipment
   ------------------------------------------------------------ */
function useItem(name) {
  if (!name) { toast('Nothing in that slot'); return; }
  if (!hasItem(name)) { toast(`No ${name.toLowerCase()} left`); return; }
  const def = ITEMS[name];
  const use = def.use;
  if (!use) {
    if (def.type === 'weapon' || def.type === 'clothing' || def.type === 'backpack') { equipItemByName(name); return; }
    toast(`${name} cannot be used directly`);
    return;
  }
  if (use === 'food' || use === 'rawfood') {
    removeItem(name, 1);
    player.food = clamp(player.food + (def.value || 15), 0, 100);
    if (use === 'rawfood' && rand() < 0.38) {
      player.poison = Math.max(player.poison, 70);
      toast('That was a mistake. Your stomach turns.', 'bad');
    } else toast(`Ate ${name}`);
    audio.eat();
  } else if (use === 'water' || use === 'dirtywater') {
    removeItem(name, 1);
    player.water = clamp(player.water + (def.value || 24), 0, 100);
    if (use === 'dirtywater' && rand() < 0.42) {
      player.poison = Math.max(player.poison, 80);
      toast('The water tasted foul. You feel sick.', 'bad');
    } else toast('Drank ' + name.toLowerCase());
    audio.drink();
    if (name === 'Empty bottle') return;
  } else if (use === 'bandage') {
    removeItem(name, 1);
    player.bleed = 0;
    player.health = clamp(player.health + 10, 0, 100);
    if (player.infection > 0 && rand() < 0.4) player.infection = 0;
    toast('Wounds bandaged. Bleeding stopped.');
    audio.craft();
  } else if (use === 'firstaid') {
    removeItem(name, 1);
    player.bleed = 0; player.health = clamp(player.health + 38, 0, 100); player.infection = 0;
    toast('First aid applied. You feel steadier.');
    audio.craft();
  } else if (use === 'antibiotics') {
    removeItem(name, 1);
    player.infection = 0; player.fever = 0; player.health = clamp(player.health + 6, 0, 100);
    toast('Antibiotics taken. Infection clearing.');
    audio.eat();
  } else if (use === 'painkillers') {
    removeItem(name, 1);
    player.health = clamp(player.health + 8, 0, 100); player.pain = 0;
    toast('The ache fades a little.');
    audio.eat();
  } else if (use === 'antiseptic') {
    removeItem(name, 1);
    player.infection = 0;
    toast('Wound cleaned. Infection risk gone.');
    audio.craft();
  } else if (use === 'bottle') {
    if (nearWater(player.x, player.z, 5)) {
      removeItem('Empty bottle', 1); addItem('Dirty water', 1);
      toast('Filled bottle with dirty water. Boil it at a fire.');
      audio.drink();
    } else toast('You need to stand at a water source', 'warn');
  } else if (use === 'battery') {
    removeItem('Batteries', 1);
    player.battery = clamp((player.battery ?? 0) + 60, 0, 100);
    toast('Torch battery replaced');
    audio.ui();
  } else if (use === 'torch') {
    if (player.battery <= 0) { toast('The torch battery is dead. Find batteries.', 'warn'); return; }
    player.flashlight = !player.flashlight;
    toast(player.flashlight ? 'Torch on' : 'Torch off');
    audio.ui();
  } else toast('Nothing happens.');
  updateHud();
  if (state.overlay === 'inventory') openInventory();
}

function equipItemByName(name) {
  const rowIndex = inventory.findIndex(r => r.name === name);
  if (rowIndex < 0) return;
  const row = inventory[rowIndex];
  const def = ITEMS[name];
  let slot = null;
  if (def.type === 'weapon') slot = def.mag ? 'primary' : 'melee';
  else if (def.type === 'clothing') slot = 'clothing';
  else if (def.type === 'backpack') slot = 'backpack';
  if (!slot) return;
  const old = equipped[slot];
  inventory.splice(rowIndex, 1);
  equipped[slot] = { name, cond: row.cond };
  if (old) addItem(old.name, 1, old.cond);
  if (slot === 'primary') {
    const w = ITEMS[name];
    equipped[slot].mag = Math.min(w.mag, count(w.ammo));
    if (equipped[slot].mag > 0) removeItem(w.ammo, equipped[slot].mag);
    player.mag = equipped[slot].mag;
    rebuildViewmodel();
  }
  if (slot === 'melee' && equipped.primary) {
    // melee remains available as a fallback, but firearm stays primary
  }
  refreshQuick(); updateHud();
  if (state.overlay === 'inventory') openInventory();
  toast(`Equipped ${name}`);
  audio.ui();
}

function equipmentLabel(slot) {
  const e = equipped[slot];
  if (!e) return '—';
  if (slot === 'primary') {
    const w = ITEMS[e.name];
    return `${e.name} · ${e.mag ?? 0}/${w.mag} · ${Math.round(e.cond)}%`;
  }
  return `${e.name} · ${Math.round(e.cond)}%`;
}

/* ------------------------------------------------------------
   Survival simulation
   ------------------------------------------------------------ */
function ambientTemp() {
  let t = 14 + 8 * Math.sin(((state.time - 6) / 24) * Math.PI * 2);
  if (state.weather === 'RAIN') t -= 3.5;
  if (state.weather === 'STORM') t -= 5.5;
  if (state.weather === 'FOG') t -= 2;
  if (state.weather === 'OVERCAST') t -= 1;
  return t;
}

function isIndoors() {
  for (const b of buildings) {
    if (Math.abs(player.x - b.x) < b.w / 2 - 0.2 && Math.abs(player.z - b.z) < b.d / 2 - 0.2) return true;
    for (const st of structures) if ((st.kind === 'shelter' || st.kind === 'canopy') && Math.hypot(player.x - st.x, player.z - st.z) < 2.2) return true;
  }
  return false;
}

function nearCampfire() {
  for (const st of structures) {
    if (st.kind === 'campfire' && Math.hypot(player.x - st.x, player.z - st.z) < 6.5) return st;
  }
  return null;
}

function nearBed() {
  for (const st of structures) {
    if (st.kind === 'bed' && Math.hypot(player.x - st.x, player.z - st.z) < 2.4) return st;
  }
  return null;
}

function addConditionToast(text, type = 'warn') {
  toast(text, type);
  player.lastDamage = text;
}

function updateSurvival(dt) {
  const sprint = player.sprint && player.stamina > 0;
  const moving = Math.hypot(player.vx || 0, player.vz || 0) > 0.4;

  // needs
  player.food = clamp(player.food - dt * (0.042 + (sprint ? 0.05 : 0) + (player.fever > 0 ? 0.02 : 0) + (player.poison > 0 ? 0.05 : 0)), 0, 100);
  player.water = clamp(player.water - dt * (0.06 + (sprint ? 0.07 : 0) + (player.fever > 0 ? 0.055 : 0) + (player.poison > 0 ? 0.05 : 0)), 0, 100);
  player.energy = clamp(player.energy - dt * (0.012 + (sprint ? 0.075 : 0) + (player.cold > 0 ? 0.012 : 0)), 0, 100);

  // stamina
  if (sprint && moving) {
    player.stamina = clamp(player.stamina - dt * 19, 0, 100);
    if (player.stamina <= 0.1) player.sprint = false;
  } else {
    const rate = player.crouch ? 17 : 12;
    player.stamina = clamp(player.stamina + dt * rate * (player.energy < 20 ? 0.5 : 1), 0, 100);
  }

  // wetness + temperature
  const indoors = isIndoors();
  state.indoor = indoors;
  const fire = nearCampfire();
  const raincoat = equipped.clothing && ITEMS[equipped.clothing.name]?.wet ? ITEMS[equipped.clothing.name].wet : 0;
  if (state.weather === 'RAIN' || state.weather === 'STORM') {
    if (!indoors && !fire) player.wet = clamp(player.wet + dt * (state.weather === 'STORM' ? 2.4 : 1.5) * (1 - raincoat), 0, 100);
  }
  player.wet = clamp(player.wet - dt * (fire ? 2.2 : indoors ? 0.7 : 0.25), 0, 100);

  let target = ambientTemp();
  const clothing = equipped.clothing ? ITEMS[equipped.clothing.name] : null;
  target += clothing?.ins || 0;
  if (indoors) target += 2;
  if (fire) target += 9;
  if (player.wet > 35) target -= (player.wet - 35) * 0.055;
  if (player.fever > 0) target += 2.2;
  if (player.cold > 0) target -= 0.7;
  const rate = 0.055 + (player.temp < 34 ? 0.03 : 0);
  player.temp += (target - player.temp) * Math.min(1, rate * dt);

  // bleeding
  if (player.bleed > 0) {
    player.bleed = Math.max(0, player.bleed - dt);
    player.blood = clamp(player.blood - dt * 0.75, 0, 100);
    if (player.bleed > 20) player.health = clamp(player.health - dt * 0.16, 0, 100);
  }
  // blood regen
  if (player.bleed <= 0 && player.food > 50 && player.water > 50) player.blood = clamp(player.blood + dt * 0.035, 0, 100);

  // diseases
  if (player.infection > 0) {
    player.infection = Math.max(0, player.infection - dt);
    player.health = clamp(player.health - dt * 0.10, 0, 100);
    if (player.infection > 30 && player.fever <= 0 && rand() < dt * 0.03) {
      player.fever = 100;
      addConditionToast('Fever setting in — find antibiotics', 'bad');
    }
  }
  if (player.fever > 0) {
    player.fever = Math.max(0, player.fever - dt);
    player.health = clamp(player.health - dt * 0.045, 0, 100);
  }
  if (player.poison > 0) {
    player.poison = Math.max(0, player.poison - dt);
    player.health = clamp(player.health - dt * 0.09, 0, 100);
    if (rand() < dt * 0.02) addConditionToast('Nausea doubles you over', 'warn');
  }
  if (player.cold > 0) {
    player.cold = Math.max(0, player.cold - dt);
    if (rand() < dt * 0.006) {
      makeNoise(player.x, player.z, 6, 'cough');
    }
  } else if (player.wet > 55 && player.temp < 35.5 && rand() < dt * 0.012) {
    player.cold = 110;
    addConditionToast('You are shivering — get warm and dry', 'warn');
  }
  if (player.temp < 35 && player.cold <= 0) {
    if (rand() < dt * 0.02) addConditionToast('Hypothermia. Get to a fire.', 'bad');
  }
  if (player.temp < 34) player.health = clamp(player.health - dt * 0.22, 0, 100);
  if (player.food <= 0.5 || player.water <= 0.5) {
    player.health = clamp(player.health - dt * 0.34, 0, 100);
  }
  if (player.energy <= 0) {
    player.health = clamp(player.health - dt * 0.06, 0, 100);
    player.energy = 0;
  }

  // dying
  if (player.health <= 0) {
    if (!state.over) die(player.lastDamage || 'Exposure and blood loss');
    return;
  }

  // natural recovery
  const stable = player.food > 35 && player.water > 35 && player.bleed <= 0 && player.temp > 35 && player.temp < 38.6 && player.infection <= 0;
  if (stable) player.health = clamp(player.health + dt * 0.10, 0, 100);

  // noise
  player.noise = player.crouch ? 0.1 : player.sprint && moving ? 1 : moving ? 0.42 : 0.08;
  if (moving && player.grounded) {
    player.stepT -= dt;
    if (player.stepT <= 0) {
      player.stepT = player.sprint ? 0.32 : player.crouch ? 0.7 : 0.48;
      const surface = isWaterAt(player.x, player.z) ? 'water' : state.indoor ? 'wood' : 'dirt';
      if (!audio.ctx || audio.ctx.state === 'running') audio.step(surface);
      makeNoise(player.x, player.z, 4 + player.noise * 14, 'step');
    }
  }

  // torch battery
  if (player.flashlight) {
    player.battery = Math.max(0, (player.battery ?? 100) - dt * 0.55);
    if (player.battery <= 0) { player.flashlight = false; toast('The torch dies.', 'warn'); }
  }

  // death
  if (!state.over && player.health <= 0) die(player.lastDamage || 'Exposure');
  player.pain = Math.max(0, player.pain - dt);
  player.invuln = Math.max(0, player.invuln - dt);
  player.attackCd = Math.max(0, player.attackCd - dt);
  player.useCd = Math.max(0, player.useCd - dt);
  if (player.aim) player.stamina = clamp(player.stamina - dt * 1.2, 0, 100);
}

function die(cause) {
  state.over = true;
  player.alive = false;
  state.deathCause = cause;
  document.exitPointerLock?.();
  showEnd(cause);
}

function makeNoise(x, z, radius, type = 'noise') {
  state.noiseEvents.push({ x, z, r: radius, type, t: 0.8 });
  if (state.noiseEvents.length > 24) state.noiseEvents.shift();
}

/* ------------------------------------------------------------
   Time, weather
   ------------------------------------------------------------ */
const WEATHER_TEXT = { CLEAR: 'CLEAR', OVERCAST: 'OVERCAST', RAIN: 'RAIN', STORM: 'STORM', FOG: 'FOG' };
const WEATHER_ICON = { CLEAR: '☼', OVERCAST: '☁', RAIN: '☂', STORM: '⚡', FOG: '≋' };

function advanceTime(dt) {
  state.time += dt * 0.0085;
  if (state.time >= 24) { state.time -= 24; state.day++; }
  state.weatherTimer -= dt;
  if (state.weatherTimer <= 0) changeWeather();
  if (state.weather === 'STORM') {
    state.lightning -= dt;
    if (state.lightning <= 0) {
      state.lightning = 1.2 + rand() * 3.5;
      state.thunderT = 0.4 + rand() * 1.2;
      state.flash = 1;
    }
  }
  if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 3.5);
  if (state.thunderT > 0) {
    state.thunderT -= dt;
    if (state.thunderT <= 0) audio.thunder();
  }
}

function changeWeather() {
  const roll = rand();
  let next;
  if (state.weather === 'CLEAR') next = roll < 0.5 ? 'OVERCAST' : roll < 0.8 ? 'FOG' : 'RAIN';
  else if (state.weather === 'OVERCAST') next = roll < 0.4 ? 'RAIN' : roll < 0.7 ? 'CLEAR' : 'FOG';
  else if (state.weather === 'RAIN') next = roll < 0.45 ? 'STORM' : roll < 0.8 ? 'OVERCAST' : 'CLEAR';
  else if (state.weather === 'STORM') next = roll < 0.6 ? 'RAIN' : 'OVERCAST';
  else next = roll < 0.6 ? 'CLEAR' : 'OVERCAST';
  state.weather = next;
  state.weatherTimer = 110 + rand() * 160;
  const msg = next === 'RAIN' ? 'Rain moving in' : next === 'STORM' ? 'Thunder rolls across the valley'
    : next === 'FOG' ? 'Fog thickens in the trees' : next === 'CLEAR' ? 'The sky begins to clear' : 'Cloud cover settles in';
  toast(msg, next === 'STORM' ? 'warn' : '');
}

/* ------------------------------------------------------------
   World init
   ------------------------------------------------------------ */
buildWorld(scene);

// spawn the infected
{
  for (const s of zombiesSpawn) {
    let sx = s.x, sz = s.z;
    const d = dist2(sx, sz, player.x, player.z);
    if (d < 15) {
      const a = Math.atan2(sz - player.z, sx - player.x) + (rand() - 0.5);
      sx = player.x + Math.cos(a) * (28 + rand() * 40);
      sz = player.z + Math.sin(a) * (28 + rand() * 40);
    }
    const t = pickZombieType(s.hot);
    const z = newZombie(sx, sz, t);
    z.homeX = sx; z.homeZ = sz;
  }
}

// players start with a light source once found; give a faint starting supply
player.battery = 100;
player.y = heightAt(player.x, player.z);
refreshQuick();
rebuildViewmodel();
/* ------------------------------------------------------------
   Input
   ------------------------------------------------------------ */
const keys = {};
const joy = { active: false, x: 0, y: 0, id: null };
let look = { id: null, x: 0, y: 0 };
let firing = false;
const isTouch = matchMedia('(pointer:coarse)').matches;

function forwardVec() {
  return { x: -Math.sin(player.yaw), z: -Math.cos(player.yaw) };
}
function rightVec() {
  return { x: Math.cos(player.yaw), z: -Math.sin(player.yaw) };
}

window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  const k = e.key.toLowerCase();
  if (!state.started || state.over) {
    if (k === 'h' && !state.started) openHelp();
    return;
  }
  if (k === 'escape') {
    if (state.overlay) closeModal();
    else if (state.buildMode) setBuildMode(false);
    else if (document.pointerLockElement) document.exitPointerLock();
    return;
  }
  if (state.overlay && !['m', 'i', 'c', 'h', 'escape'].includes(k)) return;
  if (k === 'w' || k === 'arrowup') keys.w = true;
  if (k === 's' || k === 'arrowdown') keys.s = true;
  if (k === 'a' || k === 'arrowleft') keys.a = true;
  if (k === 'd' || k === 'arrowright') keys.d = true;
  if (k === 'shift') keys.shift = true;
  if (k === 'e') interact();
  if (k === 'f') attack();
  if (k === ' ') jump();
  if (k === 'r') reloadWeapon();
  if (k === 'c') toggleModal('craft');
  if (k === 'x') toggleCrouch();
  if (k === 'v') toggleView();
  if (k === 't') toggleTorch();
  if (k === 'b') { if (state.buildMode) setBuildMode(false); else toggleModal('build'); }
  if (k === 'q' && state.buildMode) { state.ghostRot += Math.PI / 2; }
  if (k === 'i') toggleModal('inventory');
  if (k === 'm') toggleModal('map');
  if (k === 'h') toggleModal('help');
  if (k === '1') useItem(quick[0]);
  if (k === '2') useItem(quick[1]);
  if (k === '3') useItem(quick[2]);
});
window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'w' || k === 'arrowup') keys.w = false;
  if (k === 's' || k === 'arrowdown') keys.s = false;
  if (k === 'a' || k === 'arrowleft') keys.a = false;
  if (k === 'd' || k === 'arrowright') keys.d = false;
  if (k === 'shift') keys.shift = false;
});
window.addEventListener('blur', () => { keys.w = keys.a = keys.s = keys.d = keys.shift = false; firing = false; });

/* mouse look + desktop actions */
canvas.addEventListener('click', (e) => {
  if (!state.started || state.paused || state.over) return;
  if (isTouch) return;
  if (document.pointerLockElement !== canvas) {
    canvas.requestPointerLock?.();
    return;
  }
  if (state.overlay) return;
  attack();
});
canvas.addEventListener('mousedown', (e) => {
  if (isTouch || !state.started || state.over || state.paused) return;
  if (e.button === 2) { player.aim = true; }
  if (e.button === 0 && document.pointerLockElement === canvas) { firing = true; attack(); }
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 0) firing = false;
  if (e.button === 2) player.aim = false;
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('mousemove', (e) => {
  if (!state.started || state.paused || state.over) return;
  if (document.pointerLockElement === canvas) {
    player.yaw -= e.movementX * 0.0022;
    player.pitch = clamp(player.pitch - e.movementY * 0.0022, -1.35, 1.3);
  } else if (look.id === 'mouse' && (e.buttons & 1)) {
    player.yaw -= e.movementX * 0.003;
    player.pitch = clamp(player.pitch - e.movementY * 0.003, -1.35, 1.3);
  }
});
canvas.addEventListener('pointerdown', (e) => {
  if (!state.started || state.paused || state.over) return;
  if (e.pointerType === 'mouse') {
    if (document.pointerLockElement !== canvas && e.button === 0) look = { id: 'mouse', x: e.clientX, y: e.clientY };
    return;
  }
  if (state.overlay || state.buildMode) return;
  look = { id: e.pointerId, x: e.clientX, y: e.clientY };
  canvas.setPointerCapture?.(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse' || look.id !== e.pointerId) return;
  const dx = e.clientX - look.x, dy = e.clientY - look.y;
  look.x = e.clientX; look.y = e.clientY;
  player.yaw -= dx * 0.0052;
  player.pitch = clamp(player.pitch - dy * 0.0052, -1.3, 1.25);
});
function endLook(e) {
  if (e && e.pointerType === 'mouse') { if (look.id === 'mouse') look.id = null; return; }
  if (!e || look.id === e.pointerId) look.id = null;
}
canvas.addEventListener('pointerup', endLook);
canvas.addEventListener('pointercancel', endLook);

/* joystick */
const joyEl = $('joystick'), knob = $('joyKnob');
function joyMove(e) {
  if (!joy.active || e.pointerId !== joy.id) return;
  const r = joyEl.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let dx = e.clientX - cx, dy = e.clientY - cy;
  const len = Math.hypot(dx, dy), max = r.width * 0.32;
  if (len > max) { dx = dx / len * max; dy = dy / len * max; }
  joy.x = dx / max; joy.y = dy / max;
  knob.style.transform = `translate(${dx}px,${dy}px)`;
}
joyEl?.addEventListener('pointerdown', (e) => {
  e.preventDefault(); e.stopPropagation();
  joy.active = true; joy.id = e.pointerId;
  joyEl.setPointerCapture?.(e.pointerId);
  joyMove(e);
});
joyEl?.addEventListener('pointermove', joyMove);
function joyEnd(e) {
  if (e.pointerId !== joy.id) return;
  joy.active = false; joy.x = joy.y = 0; knob.style.transform = 'translate(0,0)';
}
joyEl?.addEventListener('pointerup', joyEnd);
joyEl?.addEventListener('pointercancel', joyEnd);

/* touch buttons */
function bind(id, fn, hold = false) {
  const btn = $(id);
  if (!btn) return;
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    audio.init();
    fn();
    if (hold) btn.dataset.held = '1';
  });
  btn.addEventListener('pointerup', (e) => { e.stopPropagation(); if (hold) delete btn.dataset.held; });
  btn.addEventListener('pointercancel', () => { if (hold) delete btn.dataset.held; });
}
bind('btnUse', interact);
bind('btnAttack', attack, true);
bind('btnReload', reloadWeapon);
bind('btnJump', jump);
bind('btnCrouch', toggleCrouch);
bind('btnTorch', toggleTorch);
bind('btnBuild', () => { if (state.buildMode) setBuildMode(false); else openBuild(); });
bind('btnAim', () => { player.aim = !player.aim; $('btnAim').classList.toggle('active', player.aim); });
['btnUse', 'btnAttack', 'btnReload', 'btnJump', 'btnCrouch', 'btnTorch', 'btnBuild', 'btnAim', 'btnView'].forEach(id => {
  const b = $(id);
  b?.addEventListener('click', (e) => e.stopPropagation());
});

/* HUD buttons */
$('packBtn').addEventListener('click', () => toggleModal('inventory'));
$('craftBtn').addEventListener('click', () => toggleModal('craft'));
$('mapBtn').addEventListener('click', () => toggleModal('map'));
$('helpBtn').addEventListener('click', () => toggleModal('help'));
$('objectiveNext')?.addEventListener('click', () => { $('objective').classList.add('hide'); });
document.querySelectorAll('.quick').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!state.started || state.over) return;
    audio.init();
    useItem(quick[+btn.dataset.slot]);
  });
});

/* ------------------------------------------------------------
   Player movement + camera
   ------------------------------------------------------------ */
function jump() {
  if (!state.started || state.over || state.overlay) return;
  if (player.grounded && player.stamina > 4) {
    player.vy = 4.9;
    player.grounded = false;
    player.stamina = clamp(player.stamina - 6, 0, 100);
    audio.burst?.(0.08, 300, 0.05);
  }
}
function toggleCrouch() {
  player.crouch = !player.crouch;
  if (player.crouch) player.sprint = false;
  audio.ui();
}
function toggleView() {
  player.third = !player.third;
  playerMesh.visible = player.third;
  viewModel.visible = !player.third;
  toast(player.third ? 'Third-person view' : 'First-person view');
}
function toggleTorch() {
  if (!state.started) return;
  if (!hasItem('Flashlight') && !player.hasTorchGiven) {
    toast('You have no flashlight', 'warn'); return;
  }
  if (player.battery <= 0) { toast('Torch battery is dead', 'warn'); return; }
  player.flashlight = !player.flashlight;
  toast(player.flashlight ? 'Torch on' : 'Torch off');
  audio.ui();
}

const input = { mx: 0, mz: 0 };
function updatePlayer(dt) {
  if (state.paused || state.over || state.overlay) {
    player.sprint = false;
    return;
  }
  let x = (keys.d ? 1 : 0) - (keys.a ? 1 : 0) + joy.x;
  let z = (keys.s ? 1 : 0) - (keys.w ? 1 : 0) + joy.y;
  const mag = Math.hypot(x, z);
  if (mag > 1) { x /= mag; z /= mag; }
  input.mx = x; input.mz = z;

  const moving = Math.hypot(x, z) > 0.12;
  const wantsSprint = keys.shift || (joy.active && Math.hypot(joy.x, joy.y) > 0.92);
  player.sprint = wantsSprint && moving && !player.crouch && player.stamina > 1 && player.energy > 3;
  if (player.sprint) player.crouch = false;

  let speed = player.crouch ? 1.55 : player.sprint ? 5.5 : 2.85;
  if (player.aim) speed *= 0.55;
  if (player.energy < 15) speed *= 0.82;
  if (player.temp < 35) speed *= 0.88;
  if (isWaterAt(player.x, player.z)) speed *= 0.52;
  if (player.health < 25) speed *= 0.85;
  if (state.buildMode) speed *= 0.6;

  const f = forwardVec(), r = rightVec();
  const tx = (f.x * -z + r.x * x) * speed;
  const tz = (f.z * -z + r.z * x) * speed;
  player.vx = player.vx ?? 0;
  player.vz = player.vz ?? 0;
  const accel = player.grounded ? 14 : 4;
  player.vx = lerp(player.vx, tx, Math.min(1, accel * dt));
  player.vz = lerp(player.vz, tz, Math.min(1, accel * dt));

  const px = player.x, pz = player.z;
  player.x += player.vx * dt;
  player.z += player.vz * dt;
  collidePush(player, 0.34);
  player.x = clamp(player.x, -WORLD / 2 + 20, WORLD / 2 - 20);
  player.z = clamp(player.z, -WORLD / 2 + 20, WORLD / 2 - 20);
  const realMove = Math.hypot(player.x - px, player.z - pz);
  state.distance += realMove;
  if (realMove < 0.001 && moving) { player.vx *= 0.4; player.vz *= 0.4; }

  // vertical
  const ground = heightAt(player.x, player.z);
  const support = Math.max(ground, WATER_LEVEL - 0.86);
  player.vy -= 13.5 * dt;
  player.y += player.vy * dt;
  if (player.y <= support) {
    player.y = support;
    player.vy = 0;
    player.grounded = true;
  } else player.grounded = false;
  if (player.grounded) player.y = lerp(player.y, support, Math.min(1, 18 * dt));

  // bob
  const spd = Math.hypot(player.vx, player.vz);
  if (spd > 0.4 && player.grounded) {
    player.bob += dt * (player.sprint ? 11 : player.crouch ? 4.5 : 7.2);
    player.breath += dt;
  } else {
    player.bob += dt * 1.2;
  }

  // doors animate
  for (const d of doors) {
    const target = d.open ? 1.55 : 0;
    d.angle = lerp(d.angle ?? 0, target, Math.min(1, dt * 8));
    d.pivot.rotation.y = d.angle;
  }
  for (const st of structures) {
    if (st.kind === 'door' || st.kind === 'gate') {
      const target = st.open ? 1.5 : 0;
      st.angle = lerp(st.angle ?? 0, target, Math.min(1, dt * 8));
      if (st.pivot) st.pivot.rotation.y = st.angle;
    }
  }

  if (firing || (isTouch && $('btnAttack')?.dataset.held)) autoAttack(dt);

  cameraUpdate(dt, spd);
  const nearFire = nearCampfire();
  if (nearFire) audio.fire.gain.value = Math.min(0.14, audio.fire.gain.value + dt);
  else if (audio.fire) audio.fire.gain.value = Math.max(0, audio.fire.gain.value - dt * 0.4);
}

function cameraUpdate(dt, spd) {
  const eyeBase = player.crouch ? 1.06 : 1.66;
  const bob = player.grounded ? Math.sin(player.bob) * (player.sprint ? 0.055 : 0.025) * Math.min(1, spd / 2) : 0;
  const sideBob = Math.cos(player.bob * 0.5) * 0.02;
  const movingTarget = player.third ? 4.3 : 0;
  player.thirdDist = lerp(player.thirdDist ?? 0, movingTarget, Math.min(1, dt * 7));
  const targetY = player.y + eyeBase + bob;
  if (player.third) {
    const cp = Math.cos(player.pitch), sp = Math.sin(player.pitch);
    const tx = player.x, ty = player.y + 1.5 + bob, tz = player.z;
    const back = player.thirdDist;
    camera.position.set(
      tx + Math.sin(player.yaw) * cp * back + sideBob,
      ty - sp * back + 0.25,
      tz + Math.cos(player.yaw) * cp * back
    );
    const minY = heightAt(camera.position.x, camera.position.z) + 0.45;
    if (camera.position.y < minY) camera.position.y = minY;
    camera.lookAt(tx, ty, tz);
    playerMesh.visible = true;
    viewModel.visible = false;
  } else {
    player.camY = lerp(player.camY ?? targetY, targetY, Math.min(1, dt * 14));
    camera.position.set(player.x + sideBob, player.camY, player.z);
    camera.rotation.set(player.pitch, player.yaw, Math.sin(player.bob * 0.5) * 0.006);
    playerMesh.visible = false;
    viewModel.visible = true;
  }
  const targetFov = player.aim ? 58 : (matchMedia('(pointer:coarse)').matches ? 84 : 76);
  camera.fov = lerp(camera.fov, targetFov, Math.min(1, dt * 9));
  camera.updateProjectionMatrix();
  $('crosshair').classList.toggle('ads', player.aim);

  // view model sway
  if (!player.third) {
    viewModel.position.x = lerp(viewModel.position.x, 0.1 + sideBob * 2, dt * 8);
    viewModel.position.y = lerp(viewModel.position.y, -0.12 - bob * 0.7, dt * 8);
    viewModel.position.z = lerp(viewModel.position.z, -0.3 + (player.sprint ? 0.03 : 0), dt * 6);
    viewModel.rotation.z = lerp(viewModel.rotation.z, -sideBob * 0.8, dt * 6);
    const atk = player.attackAnim > 0 ? player.attackAnim : 0;
    viewModel.rotation.x = lerp(viewModel.rotation.x, -atk * 0.9, Math.min(1, dt * 16));
    viewModel.rotation.y = lerp(viewModel.rotation.y, player.reload > 0 ? 0.5 : 0, Math.min(1, dt * 5));
  }

  // flashlight
  flashlight.intensity = player.flashlight ? (42 + Math.sin(state.elapsed * 40) * 1.5) : 0;
  if (player.flashlight) {
    flashlight.position.set(0.15, -0.1, 0);
  }

  // held player glow? none
  playerMesh.rotation.y = player.yaw;
  const walk = Math.sin(player.bob * (player.sprint ? 1.3 : 1));
  pLegL.rotation.x = walk * 0.55; pLegR.rotation.x = -walk * 0.55;
  pArmL.rotation.x = -walk * 0.45 - (player.aim ? 1.1 : 0);
  pArmR.rotation.x = walk * 0.45 - (player.aim ? 1.1 : 0);
  playerMesh.position.set(player.x, player.y, player.z);
  if (player.crouch) playerMesh.scale.y = lerp(playerMesh.scale.y, 0.78, dt * 8);
  else playerMesh.scale.y = lerp(playerMesh.scale.y, 1, dt * 8);

  // jacket colour
  jacketMat.color.set(state.char.color);
}

/* ------------------------------------------------------------
   Interaction targets
   ------------------------------------------------------------ */
function updateNearest() {
  let best = null;
  const consider = (kind, obj, d, radius, label) => {
    if (d < radius && (!best || d < best.d)) best = { kind, obj, d, label };
  };
  for (const c of containers) {
    if (c.searched) continue;
    const d = dist2(player.x, player.z, c.x, c.z);
    const tier = c.tier === 'military' ? 'MILITARY' : c.tier === 'medical' ? 'MEDICAL' : c.tier === 'police' ? 'POLICE'
      : c.tier === 'industrial' ? 'INDUSTRIAL' : c.tier === 'supermarket' || c.tier === 'store' ? 'SUPPLY' : c.type === 'car' ? 'VEHICLE' : 'SUPPLY';
    consider('container', c, d, c.onTower ? 3.5 : 2.9, 'SEARCH ' + tier + (c.type === 'car' ? ' TRUNK' : ' CACHE'));
  }
  for (const d of doors) {
    const dd = dist2(player.x, player.z, d.x, d.z);
    consider('door', d, dd, 2.8, d.open ? 'CLOSE DOOR' : 'OPEN DOOR');
  }
  for (const st of structures) {
    const dd = dist2(player.x, player.z, st.x, st.z);
    if (st.kind === 'storage') consider('storage', st, dd, 2.8, 'OPEN STORAGE');
    if (st.kind === 'campfire') consider('fire', st, dd, 3.0, 'USE CAMPFIRE');
    if (st.kind === 'bed') consider('bed', st, dd, 2.6, 'SLEEP');
    if (st.kind === 'door' || st.kind === 'gate') consider('sdoor', st, dd, 2.8, st.open ? 'CLOSE & LOCK ' + (st.kind === 'gate' ? 'GATE' : 'DOOR') : st.locked ? 'UNLOCK ' + (st.kind === 'gate' ? 'GATE' : 'DOOR') : 'OPEN ' + (st.kind === 'gate' ? 'GATE' : 'DOOR'));
    if (st.kind === 'wall' || st.kind === 'tower' || st.kind === 'spikes') consider('structure', st, dd, 2.8, st.hp < st.maxHp ? 'REPAIR (2 WOOD)' : 'INSPECT');
  }
  const tree = nearestTree(player.x, player.z, 2.9);
  if (tree) consider('tree', tree, dist2(player.x, player.z, tree.x, tree.z), 2.9, 'CHOP WOOD');
  if (nearWater(player.x, player.z, 4.5)) {
    consider('water', null, 2.5, 99, hasItem('Empty bottle') ? 'FILL BOTTLE' : 'DRINK WATER');
  }
  state.nearest = best;
  const prompt = $('prompt'), text = $('promptText');
  if (best && !state.overlay && !state.buildMode) {
    text.textContent = best.label;
    prompt.classList.add('show');
    prompt.querySelector('kbd').textContent = isTouch ? 'USE' : 'E';
  } else prompt.classList.remove('show');
}

/* ------------------------------------------------------------
   Actions
   ------------------------------------------------------------ */
function interact() {
  if (!state.started || state.over || state.overlay) return;
  audio.init();
  if (state.buildMode) { placeStructure(); return; }
  const n = state.nearest;
  if (!n) { toast('Nothing within reach'); return; }
  if (n.kind === 'container') { openLoot(n.obj); return; }
  if (n.kind === 'door') {
    const d = n.obj;
    if (d.locked) { toast('The door is barred', 'warn'); return; }
    d.open = !d.open;
    d.col.disabled = d.open;
    audio.burst?.(0.12, 220, 0.08);
    toast(d.open ? 'Door opened' : 'Door closed');
    return;
  }
  if (n.kind === 'sdoor') {
    const st = n.obj;
    if (st.open) {
      st.open = false; st.locked = true; st.col.disabled = false;
      toast('Door closed and locked');
    } else if (st.locked) {
      st.locked = false;
      toast('Door unlocked — interact again to open');
    } else {
      st.open = true; st.col.disabled = true;
      toast('Door opened');
    }
    audio.burst?.(0.12, 220, 0.08);
    return;
  }
  if (n.kind === 'tree') {
    const t = n.obj;
    const axe = equipped.melee?.name === 'Fire axe';
    t.chopT = (t.chopT || 0) + 1;
    let wood = axe ? 3 : 2;
    if (t.chopT >= 3) {
      hideTree(t);
      wood += 2;
      toast('Tree felled — harvested wood');
    } else toast('Chopped deadwood');
    addItem('Wood Scrap', wood);
    player.stamina = clamp(player.stamina - 5, 0, 100);
    player.attackAnim = 0.6;
    audio.swing(); updateHud();
    if (state.overlay === 'inventory') openInventory();
    return;
  }
  if (n.kind === 'water') {
    if (hasItem('Empty bottle')) {
      removeItem('Empty bottle', 1); addItem('Dirty water', 1);
      toast('Bottle filled with dirty water. Boil it to be safe.');
      audio.drink();
    } else {
      player.water = clamp(player.water + 14, 0, 100);
      if (rand() < 0.35) { player.poison = Math.max(player.poison, 60); toast('You drank from the water. It may be tainted.', 'bad'); }
      else toast('You drank from the water');
      audio.drink();
    }
    updateHud(); return;
  }
  if (n.kind === 'fire') { openCraft(true); return; }
  if (n.kind === 'bed') { openSleep(); return; }
  if (n.kind === 'storage') { openStorage(n.obj); return; }
  if (n.kind === 'structure') {
    const st = n.obj;
    if (st.hp < st.maxHp) {
      if (count('Wood Scrap') >= 2) {
        removeItem('Wood Scrap', 2);
        st.hp = Math.min(st.maxHp, st.hp + 90);
        toast('Structure repaired');
        audio.craft();
      } else toast('Need 2 wood scrap to repair', 'warn');
    } else toast(`${st.name} · integrity ${Math.round(st.hp / st.maxHp * 100)}%`);
    updateHud();
  }
}
/* ------------------------------------------------------------
   Combat
   ------------------------------------------------------------ */
function autoAttack(dt) {
  const w = currentWeapon();
  const held = firing || (isTouch && $('btnAttack')?.dataset.held);
  if (held && w && ITEMS[w.name]?.auto && player.attackCd <= 0) attack();
}

function attack() {
  if (!state.started || state.over || state.paused) return;
  if (state.overlay) return;
  if (state.buildMode) { placeStructure(); return; }
  if (player.attackCd > 0 || player.reload > 0) return;
  const w = currentWeapon();
  if (w && ITEMS[w.name].mag) fireGun(w);
  else melee(w);
}

function melee(w) {
  const def = w ? ITEMS[w.name] : null;
  const range = def?.range || 1.75;
  const rate = def?.rate || 0.55;
  player.attackCd = rate;
  player.attackAnim = 0.55;
  player.stamina = clamp(player.stamina - 1.4, 0, 100);
  audio.swing();
  makeNoise(player.x, player.z, 10 + (def?.noise || 0.2) * 20, 'melee');

  const f = forwardVec();
  let best = null, bd = Infinity;
  for (const z of zombies) {
    if (z.dead) continue;
    const d = dist2(player.x, player.z, z.x, z.z);
    if (d > range + 0.55) continue;
    const dx = (z.x - player.x) / Math.max(0.01, d), dz = (z.z - player.z) / Math.max(0.01, d);
    if (dx * f.x + dz * f.z < 0.28) continue;
    if (d < bd) { bd = d; best = z; }
  }
  if (!best) {
    // hitting a wall / structure?
    if (def) {
      const st = nearestStructure(range + 0.4);
      if (st) { toast('You strike the structure. Nothing breaks.', 'warn'); }
    }
    return;
  }
  const dmg = (def?.dmg || 9) * (player.energy < 20 ? 0.8 : 1);
  damageZombie(best, dmg, false);
  if (def && equipped.melee) {
    equipped.melee.cond = Math.max(0, equipped.melee.cond - (w?.name === 'Fire axe' ? 1.4 : 0.8));
    if (equipped.melee.cond <= 0) { toast('Your melee weapon is broken', 'bad'); equipped.melee = null; rebuildViewmodel(); }
  }
  updateHud();
}

function fireGun(w) {
  if (player.mag <= 0) { reloadWeapon(); return; }
  const def = ITEMS[w.name];
  player.attackCd = def.rate;
  player.attackAnim = 0.28;
  player.mag = Math.max(0, player.mag - 1);
  if (equipped.primary) equipped.primary.mag = player.mag;
  const spread = (player.aim ? 0.008 : 0.028) + (player.sprint ? 0.03 : 0) + (player.crouch ? -0.004 : 0);
  audio.shot(def.name === 'Pump shotgun' ? 'shotgun' : def.name === 'Hunting rifle' ? 'rifle' : 'pistol');
  makeNoise(player.x, player.z, 120, 'gunshot');
  state.flash = 0.7;
  muzzleLight.position.copy(camera.position);
  muzzleLight.intensity = 55;
  setTimeout(() => { muzzleLight.intensity = 0; }, 55);
  player.pitch = clamp(player.pitch + 0.012 + rand() * 0.012, -1.3, 1.3);
  player.yaw += (rand() - 0.5) * 0.004;

  const pellets = def.pellets || 1;
  const origin = camera.position.clone();
  const baseDir = new THREE.Vector3();
  camera.getWorldDirection(baseDir);
  let anyHit = false;
  const hitSet = new Set();
  for (let p = 0; p < pellets; p++) {
    const dir = baseDir.clone();
    dir.x += (rand() - 0.5) * spread * 2;
    dir.y += (rand() - 0.5) * spread * 2;
    dir.z += (rand() - 0.5) * spread * 2;
    dir.normalize();
    const hit = rayHitZombie(origin, dir, def.range);
    if (hit) {
      damageZombie(hit.zombie, def.dmg, hit.head, dir);
      anyHit = true; hitSet.add(hit.zombie);
    }
  }
  if (anyHit) hitmarker();

  if (equipped.primary) {
    equipped.primary.cond = Math.max(0, equipped.primary.cond - 0.6);
    if (equipped.primary.cond <= 0) {
      toast('Your firearm has jammed beyond repair', 'bad');
      equipped.primary = null; player.mag = 0; rebuildViewmodel();
    }
  }
  updateHud();
}

function rayHitZombie(origin, dir, range) {
  let best = null, bestT = Infinity;
  for (const z of zombies) {
    if (z.dead) continue;
    const scale = z.mesh.scale.y || 1;
    const cy = z.y + 1.12 * scale;
    const tx = z.x - origin.x, ty = cy - origin.y, tz = z.z - origin.z;
    const t = tx * dir.x + ty * dir.y + tz * dir.z;
    if (t < 0.3 || t > range) continue;
    const px = tx - dir.x * t, py = ty - dir.y * t, pz = tz - dir.z * t;
    const perp = Math.sqrt(px * px + py * py + pz * pz);
    const threshold = 0.42 * scale + (player.aim ? 0.06 : 0.24);
    if (perp <= threshold && t < bestT) {
      if (sightBlocked(origin.x, origin.z, z.x, z.z)) continue;
      bestT = t;
      const head = py > 0.28 * scale;
      best = { zombie: z, t, head };
    }
  }
  return best;
}

function damageZombie(z, dmg, head, dir) {
  const armor = z.type === 'armored' ? 0.45 : 0;
  const final = dmg * (1 - armor) * (head ? 1.6 : 1);
  z.hp -= final;
  z.stun = Math.max(z.stun, head ? 0.75 : 0.35);
  z.state = 'chase';
  z.lastSeenX = player.x; z.lastSeenZ = player.z;
  z.alert = 12;
  makeNoise(z.x, z.z, 24, 'combat');
  if (z.hp <= 0) killZombie(z, head);
  else {
    audio.hit();
    hitmarker();
    if (z.type === 'screecher' && rand() < 0.55) scream(z);
  }
}

function killZombie(z, head) {
  z.dead = true;
  z.mesh.visible = false;
  z.respawn = 80 + rand() * 90;
  state.kills++;
  audio.hit();
  toast(head && rand() < 0.5 ? 'Headshot — infected down' : 'Infected down');
  if (rand() < 0.55) { addItem('Rag', 1); }
  if (rand() < 0.3) {
    const ammoNames = ['9mm rounds', '12ga shells', '.308 rounds', '5.56 rounds'];
    const ammo = ammoNames[Math.floor(rand() * ammoNames.length)];
    addItem(ammo, 2 + Math.floor(rand() * 4));
    toast('Recovered ammunition from the body');
  }
  updateHud();
}

function scream(z) {
  audio.scream(0.22);
  for (const other of zombies) {
    if (other.dead || other === z) continue;
    if (dist2(z.x, z.z, other.x, other.z) < 45) {
      other.state = 'hunt';
      other.lastSeenX = z.x; other.lastSeenZ = z.z;
      other.alert = 9;
    }
  }
  makeNoise(z.x, z.z, 45, 'scream');
}

function reloadWeapon() {
  if (state.buildMode) { state.ghostRot += Math.PI / 2; toast('Rotated blueprint'); return; }
  if (!state.started || state.over || state.overlay) return;
  const w = currentWeapon();
  if (!w || !ITEMS[w.name].mag) { toast('No firearm equipped'); return; }
  if (player.reload > 0) return;
  const need = ITEMS[w.name].mag - player.mag;
  if (need <= 0) { toast('Magazine is full'); return; }
  const avail = count(ITEMS[w.name].ammo);
  if (avail <= 0) { toast('No ' + ITEMS[w.name].ammo.toLowerCase() + ' left', 'warn'); return; }
  const take = Math.min(need, avail);
  removeItem(ITEMS[w.name].ammo, take);
  player.reload = 1.55;
  player.reloadTake = take;
  audio.reload();
  toast(`Reloading ${take} round${take > 1 ? 's' : ''}…`);
}

function finishReload() {
  const w = currentWeapon();
  if (!w || !ITEMS[w.name].mag) return;
  player.mag = Math.min(ITEMS[w.name].mag, player.mag + (player.reloadTake || 0));
  if (equipped.primary) equipped.primary.mag = player.mag;
  player.reloadTake = 0;
  toast('Weapon loaded');
  updateHud();
}

/* ------------------------------------------------------------
   Zombie AI
   ------------------------------------------------------------ */
let aiClock = 0;
function updateZombies(dt) {
  aiClock += dt;
  const aiStep = aiClock >= 0.12;
  if (aiStep) aiClock = 0;

  for (const z of zombies) {
    if (z.dead) {
      z.respawn -= dt;
      if (z.respawn <= 0) respawnZombie(z);
      continue;
    }
    const d = dist2(player.x, player.z, z.x, z.z);
    z.mesh.visible = d < 170;
    if (d > 170) continue;

    z.growlT -= dt;
    if (z.growlT <= 0) {
      z.growlT = 8 + rand() * 22;
      if (d < 28 && !state.over) audio.growl(clamp(0.22 * (1 - d / 40), 0.02, 0.2));
    }
    if (z.attackCd > 0) z.attackCd -= dt;
    if (z.stun > 0) {
      z.stun -= dt;
      z.mesh.rotation.z = Math.sin(state.elapsed * 40) * 0.06;
      continue;
    }
    z.mesh.rotation.z = 0;

    if (aiStep) {
      // perception
      const vision = state.time > 20 || state.time < 6 ? 30 : 44;
      let sees = false;
      if (d < vision && !sightBlocked(z.x, z.z, player.x, player.z)) {
        const dx = (player.x - z.x) / Math.max(0.01, d), dz = (player.z - z.z) / Math.max(0.01, d);
        const facing = Math.cos(z.dir) * dx + Math.sin(z.dir) * dz;
        if (facing > -0.15 || d < 14) sees = true;
      }
      if (sees) {
        z.state = 'chase';
        z.lastSeenX = player.x; z.lastSeenZ = player.z; z.alert = 14;
      } else {
        for (const ev of state.noiseEvents) {
          const nd = dist2(ev.x, ev.z, z.x, z.z);
          if (nd < ev.r + 9) {
            z.state = 'hunt'; z.lastSeenX = ev.x; z.lastSeenZ = ev.z; z.alert = 8;
            break;
          }
        }
      }
      if (z.state === 'chase' && d < 1.9 && z.attackCd <= 0) {
        zombieAttack(z);
      }
    }

    // movement
    let speedMul = 1, tx = z.x, tz = z.z;
    if (z.state === 'chase') {
      tx = player.x; tz = player.z;
      speedMul = z.type === 'runner' ? 1.15 : 1;
      if (d < 1.4) speedMul = 0;
    } else if (z.state === 'hunt') {
      tx = z.lastSeenX; tz = z.lastSeenZ;
      speedMul = 0.65;
      if (dist2(z.x, z.z, tx, tz) < 2.2) {
        z.searchT -= dt;
        z.dir += dt * 1.6;
        if (z.searchT <= 0) { z.state = 'idle'; z.searchT = 4 + rand() * 4; }
        speedMul = 0;
      }
    } else {
      z.wander -= dt;
      if (z.wander <= 0) {
        z.wander = 2 + rand() * 4;
        const homeD = dist2(z.x, z.z, z.homeX, z.homeZ);
        z.dir = homeD > 22 ? Math.atan2(z.homeZ - z.z, z.homeX - z.x) : rand() * Math.PI * 2;
      }
      speedMul = 0.28;
      tx = z.x + Math.cos(z.dir) * 4; tz = z.z + Math.sin(z.dir) * 4;
    }

    if (speedMul > 0) {
      const dx = tx - z.x, dz = tz - z.z;
      const dl = Math.hypot(dx, dz) || 1;
      z.dir = Math.atan2(dz, dx);
      const sp = z.speed * speedMul * (isWaterAt(z.x, z.z) ? 0.55 : 1);
      const ox = z.x, oz = z.z;
      z.x += (dx / dl) * sp * dt;
      z.z += (dz / dl) * sp * dt;
      collidePush(z, 0.3);
      // simple unstick
      if (Math.hypot(z.x - ox, z.z - oz) < sp * dt * 0.25 && z.state === 'chase') {
        z.dir += Math.PI / 2;
        z.x += Math.cos(z.dir) * sp * dt;
        z.z += Math.sin(z.dir) * sp * dt;
        collidePush(z, 0.3);
        state.blockedZombie = z;
      }
      z.y = lerp(z.y, heightAt(z.x, z.z), Math.min(1, dt * 10));
    }

    z.mesh.position.set(z.x, z.y, z.z);
    z.mesh.rotation.y = Math.atan2(-(tx - z.x), -(tz - z.z));
    const walk = state.elapsed * (z.type === 'runner' ? 13 : 8) + z.phase;
    z.legL.rotation.x = Math.sin(walk) * 0.6 * speedMul;
    z.legR.rotation.x = -Math.sin(walk) * 0.6 * speedMul;
    z.armR.rotation.x = -1.25 + Math.sin(walk) * 0.2;
    z.armL.rotation.x = -1.25 + Math.cos(walk) * 0.2;
    z.mesh.position.y = z.y + Math.abs(Math.sin(walk)) * 0.025;
  }

  // decay noise events
  for (let i = state.noiseEvents.length - 1; i >= 0; i--) {
    state.noiseEvents[i].t -= dt;
    if (state.noiseEvents[i].t <= 0) state.noiseEvents.splice(i, 1);
  }
  state.threat = zombies.some(z => !z.dead && dist2(z.x, z.z, player.x, player.z) < 45 && (z.state === 'chase' || z.state === 'hunt'));
}

function zombieAttack(z) {
  z.attackCd = 1.15 + rand() * 0.4;
  if (player.invuln > 0 || state.over) return;
  const armor = equipped.clothing ? (ITEMS[equipped.clothing.name]?.armor || 0) : 0;
  let dmg = z.dmg * (1 - armor);
  if (player.crouch) dmg *= 0.92;
  player.health = clamp(player.health - dmg, 0, 100);
  player.invuln = 0.75;
  player.pain = 1;
  state.hitFlash = 1;
  audio.hurt();
  const dx = player.x - z.x, dz = player.z - z.z;
  const d = Math.hypot(dx, dz) || 1;
  player.x += (dx / d) * 0.45;
  player.z += (dz / d) * 0.45;
  collidePush(player, 0.34);
  if (rand() < 0.32) {
    player.bleed = Math.max(player.bleed, 24 + rand() * 26);
    toast('You are bleeding — bandage the wound', 'bad');
  }
  if (rand() < 0.17) {
    player.infection = Math.max(player.infection, 130);
    toast('The bite feels wrong. Find antibiotics.', 'bad');
  }
  player.lastDamage = z.type === 'brute' ? 'Crushed by a brute' : 'Torn apart by the infected';
  if (z.type === 'screecher') scream(z);
  if (player.health <= 0) die(player.lastDamage);
}

function respawnZombie(z) {
  let sx = 0, sz = 0, tries = 0;
  do {
    const s = zombiesSpawn[Math.floor(rand() * zombiesSpawn.length)];
    sx = s.x + (rand() - 0.5) * 18;
    sz = s.z + (rand() - 0.5) * 18;
    tries++;
  } while (tries < 8 && dist2(sx, sz, player.x, player.z) < 110);
  const t = pickZombieType(rand() < 0.3);
  const nt = ZOMBIE_TYPES[t];
  z.x = sx; z.z = sz; z.homeX = sx; z.homeZ = sz; z.y = heightAt(sx, sz);
  z.type = t; z.hp = nt.hp; z.maxHp = nt.hp; z.speed = nt.speed; z.dmg = nt.dmg;
  z.mesh.scale.setScalar(nt.scale);
  z.dead = false; z.mesh.visible = true; z.state = 'idle';
  z.attackCd = 0; z.stun = 0; z.alert = 0;
  z.mesh.position.set(sx, z.y, sz);
}

function nearestStructure(radius) {
  let best = null, bd = radius;
  for (const st of structures) {
    const d = dist2(player.x, player.z, st.x, st.z);
    if (d < bd) { bd = d; best = st; }
  }
  return best;
}

function updateThreat() {
  const t = $('threat');
  t.classList.toggle('show', !!state.threat);
  $('lowHealth').style.opacity = player.health < 32 ? 1 : 0;
  if (state.hitFlash > 0) {
    state.hitFlash = Math.max(0, state.hitFlash - 0.05);
    $('damageFlash').style.opacity = state.hitFlash;
  } else $('damageFlash').style.opacity = 0;
}
/* ------------------------------------------------------------
   Base building
   ------------------------------------------------------------ */
const buildMats = {
  wood: new THREE.MeshLambertMaterial({ color: 0x6e5b43 }),
  woodDark: new THREE.MeshLambertMaterial({ color: 0x4e4130 }),
  metal: new THREE.MeshLambertMaterial({ color: 0x5d6862 }),
  rust: new THREE.MeshLambertMaterial({ color: 0x83583e }),
  fabric: new THREE.MeshLambertMaterial({ color: 0x5b6047 }),
  stone: new THREE.MeshLambertMaterial({ color: 0x6e7165 }),
};
const buildGeoBox = new THREE.BoxGeometry(1, 1, 1);
const flameMat = new THREE.MeshBasicMaterial({ color: 0xffb15c, transparent: true, opacity: 0.92 });
const flameMat2 = new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.95 });

function mkBox(group, w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(buildGeoBox, mat);
  m.scale.set(w, h, d); m.position.set(x, y, z); group.add(m); return m;
}

function spend(cost) {
  for (const [name, qty] of Object.entries(cost)) if (count(name) < qty) return false;
  for (const [name, qty] of Object.entries(cost)) removeItem(name, qty);
  refreshQuick();
  return true;
}
function canAfford(cost) {
  return Object.entries(cost).every(([name, qty]) => count(name) >= qty);
}
function costText(cost) {
  return Object.entries(cost).map(([n, q]) => `${q}× ${n}`).join(' + ');
}

function createStructure(type, x, z, ry = 0, opts = {}) {
  const def = BUILDS[type];
  const y = heightAt(x, z);
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = ry;
  scene.add(group);
  const st = {
    id: type, name: def.name, kind: def.kind, x, z, y, ry, mesh: group,
    hp: def.hp, maxHp: def.hp, open: false, locked: false, angle: 0,
    stash: opts.stash || null, light: null, flames: [], col: null,
  };

  if (def.kind === 'wall') {
    const mat = type === 'metalWall' ? buildMats.metal : buildMats.wood;
    for (let i = 0; i < 5; i++) mkBox(group, def.w, 0.5, 0.16, i % 2 ? mat : buildMats.woodDark, 0, 0.3 + i * 0.52, 0);
    mkBox(group, 0.18, def.h, 0.22, buildMats.woodDark, -def.w / 2 + 0.1, def.h / 2, 0);
    mkBox(group, 0.18, def.h, 0.22, buildMats.woodDark, def.w / 2 - 0.1, def.h / 2, 0);
    const col = { minX: x - def.w / 2, maxX: x + def.w / 2, minZ: z - 0.25, maxZ: z + 0.25, blocksSight: true, disabled: false, structure: st };
    wallColliders.push(col); st.col = col;
  } else if (def.kind === 'door' || def.kind === 'gate') {
    const w = def.w, h = def.h;
    mkBox(group, 0.22, h, 0.3, buildMats.woodDark, -w / 2 + 0.11, h / 2, 0);
    mkBox(group, 0.22, h, 0.3, buildMats.woodDark, w / 2 - 0.11, h / 2, 0);
    mkBox(group, w, 0.28, 0.3, buildMats.woodDark, 0, h - 0.14, 0);
    const pivot = new THREE.Group();
    pivot.position.set(-w / 2 + 0.3, 0, 0);
    mkBox(pivot, w - 0.6, h - 0.4, 0.1, type === 'gate' ? buildMats.rust : buildMats.wood, (w - 0.6) / 2, (h - 0.4) / 2, 0);
    mkBox(pivot, 0.06, 0.1, 0.18, buildMats.metal, w - 0.7, h * 0.52, 0.08);
    group.add(pivot);
    st.pivot = pivot;
    const col = { minX: x - w / 2 + 0.3, maxX: x + w / 2 - 0.3, minZ: z - 0.24, maxZ: z + 0.24, blocksSight: true, disabled: false, structure: st };
    wallColliders.push(col); st.col = col;
  } else if (def.kind === 'floor') {
    mkBox(group, def.w, 0.1, def.d, buildMats.wood, 0, 0.06, 0);
    for (let i = 0; i < 4; i++) mkBox(group, def.w, 0.04, 0.06, buildMats.woodDark, 0, 0.12, -def.d / 2 + 0.4 + i * 0.8);
  } else if (def.kind === 'window') {
    mkBox(group, def.w, 1.0, 0.2, buildMats.wood, 0, 0.5, 0);
    mkBox(group, def.w, 0.35, 0.2, buildMats.wood, 0, def.h - 0.18, 0);
    mkBox(group, 0.22, def.h, 0.24, buildMats.woodDark, -def.w / 2 + 0.11, def.h / 2, 0);
    mkBox(group, 0.22, def.h, 0.24, buildMats.woodDark, def.w / 2 - 0.11, def.h / 2, 0);
    mkBox(group, 0.18, 0.9, 0.22, buildMats.woodDark, -0.9, 1.55, 0);
    mkBox(group, 0.18, 0.9, 0.22, buildMats.woodDark, 0.9, 1.55, 0);
    const col = { minX: x - def.w / 2, maxX: x + def.w / 2, minZ: z - 0.24, maxZ: z + 0.24, blocksSight: false, disabled: false, structure: st };
    wallColliders.push(col); st.col = col;
  } else if (def.kind === 'canopy') {
    for (const sx of [-1.55, 1.55]) for (const sz of [-1.55, 1.55]) mkBox(group, 0.16, 2.5, 0.16, buildMats.woodDark, sx, 1.25, sz);
    const roof = mkBox(group, 3.8, 0.16, 3.8, buildMats.fabric, 0, 2.55, 0);
    roof.rotation.x = 0.05;
    mkBox(group, 3.4, 0.07, 0.1, buildMats.woodDark, 0, 2.46, -1.7);
  } else if (def.kind === 'spikes') {
    mkBox(group, def.w, 0.16, def.d * 0.6, buildMats.woodDark, 0, 0.1, 0);
    for (let i = 0; i < 5; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.85, 5), buildMats.metal);
      spike.position.set(-def.w / 2 + 0.35 + i * (def.w - 0.7) / 4, 0.55, 0);
      spike.rotation.z = (rand() - 0.5) * 0.35;
      group.add(spike);
    }
  } else if (def.kind === 'tower') {
    for (const sx of [-1.35, 1.35]) for (const sz of [-1.35, 1.35]) mkBox(group, 0.22, 5.2, 0.22, buildMats.woodDark, sx, 2.6, sz);
    mkBox(group, 3.2, 0.24, 3.2, buildMats.wood, 0, 5.1, 0);
    for (const sx of [-1.55, 1.55]) mkBox(group, 0.14, 0.9, 3.1, buildMats.woodDark, sx, 5.7, 0);
    mkBox(group, 3.1, 0.14, 0.14, buildMats.woodDark, 0, 5.7, 1.55);
    mkBox(group, 2.4, 0.3, 1.0, buildMats.woodDark, 0, 5.95, -1.1);
    const col = { minX: x - 1.4, maxX: x + 1.4, minZ: z - 1.4, maxZ: z + 1.4, blocksSight: false, disabled: false, structure: st };
    wallColliders.push(col); st.col = col;
  } else if (def.kind === 'shelter') {
    for (const sx of [-1.6, 1.6]) for (const sz of [-1.3, 1.3]) mkBox(group, 0.16, 2.1, 0.16, buildMats.woodDark, sx, 1.05, sz);
    const roof = mkBox(group, 4.0, 0.12, 3.4, buildMats.fabric, 0, 2.2, 0);
    roof.rotation.x = 0.12;
    mkBox(group, 3.6, 0.06, 0.1, buildMats.woodDark, 0, 2.14, -1.55);
    mkBox(group, 2.6, 0.4, 0.8, buildMats.fabric, 0.4, 0.2, -0.4);
  } else if (def.kind === 'storage') {
    mkBox(group, 1.4, 0.9, 1.0, buildMats.wood, 0, 0.5, 0);
    mkBox(group, 1.46, 0.14, 1.06, buildMats.woodDark, 0, 1.0, 0);
    mkBox(group, 0.08, 0.14, 1.06, buildMats.metal, -0.44, 0.65, 0);
    mkBox(group, 0.08, 0.14, 1.06, buildMats.metal, 0.44, 0.65, 0);
    const col = { minX: x - 0.75, maxX: x + 0.75, minZ: z - 0.56, maxZ: z + 0.56, blocksSight: false, disabled: false, structure: st };
    wallColliders.push(col); st.col = col;
    st.stash = st.stash || [];
  } else if (def.kind === 'campfire') {
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), buildMats.stone);
      rock.position.set(Math.cos(a) * 0.75, 0.12, Math.sin(a) * 0.75); group.add(rock);
    }
    for (let i = 0; i < 3; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.1, 5), buildMats.woodDark);
      log.rotation.z = Math.PI / 2; log.rotation.y = i * 1.1; log.position.y = 0.18; group.add(log);
    }
    for (let i = 0; i < 3; i++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.28 - i * 0.06, 0.85 - i * 0.18, 5), i === 0 ? flameMat : flameMat2);
      f.position.set((rand() - 0.5) * 0.16, 0.55 + i * 0.12, (rand() - 0.5) * 0.16);
      group.add(f); st.flames.push(f);
    }
    const light = new THREE.PointLight(0xffa452, 18, 11, 1.5);
    light.position.set(0, 1.0, 0);
    group.add(light); st.light = light;
  } else if (def.kind === 'bed') {
    mkBox(group, 2.0, 0.14, 0.9, buildMats.fabric, 0, 0.1, 0);
    mkBox(group, 0.6, 0.18, 0.7, buildMats.woodDark, -0.62, 0.16, 0);
    mkBox(group, 0.5, 0.2, 0.6, new THREE.MeshLambertMaterial({ color: 0x8b8f76 }), -0.5, 0.22, 0);
  }
  st.mesh = group;
  structures.push(st);
  return st;
}

function destroyStructure(st) {
  scene.remove(st.mesh);
  if (st.col) st.col.disabled = true;
  const i = structures.indexOf(st);
  if (i >= 0) structures.splice(i, 1);
}

/* ghost */
let ghostMesh = null;
function setBuildMode(on, type) {
  if (on && type) state.buildType = type;
  state.buildMode = on;
  if (ghostMesh) { scene.remove(ghostMesh); ghostMesh = null; }
  if (on) {
    const def = BUILDS[state.buildType];
    const mat = new THREE.MeshBasicMaterial({ color: 0x9fd08a, transparent: true, opacity: 0.38, depthWrite: false });
    ghostMesh = new THREE.Mesh(new THREE.BoxGeometry(def.w, def.h, def.d), mat);
    ghostMesh.position.y = def.h / 2;
    scene.add(ghostMesh);
    toast(`Build mode — ${def.name}. E to place, Q to rotate, B to exit`);
    $('prompt').classList.add('show');
    $('promptText').textContent = 'PLACE ' + def.name.toUpperCase();
  } else {
    $('prompt').classList.remove('show');
    toast('Build mode off');
  }
  audio.ui();
}

function ghostValid(x, z, ry) {
  const def = BUILDS[state.buildType];
  if (heightAt(x, z) < WATER_LEVEL - 0.1) return false;
  const r = Math.max(def.w, def.d) / 2;
  const pts = [[x, z], [x + def.w / 2, z], [x - def.w / 2, z], [x, z + def.d / 2], [x, z - def.d / 2]];
  const base = heightAt(x, z);
  for (const [px, pz] of pts) if (Math.abs(heightAt(px, pz) - base) > 1.6) return false;
  for (const c of wallColliders) {
    if (c.disabled) continue;
    if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) return false;
  }
  for (const c of circleColliders) {
    if (c.disabled) continue;
    if (Math.hypot(x - c.x, z - c.z) < c.r + r * 0.7) return false;
  }
  for (const st of structures) if (Math.hypot(x - st.x, z - st.z) < r * 0.9) return false;
  return true;
}

function updateGhost() {
  if (!state.buildMode || !ghostMesh) return;
  const f = forwardVec();
  const x = player.x + f.x * 3.3, z = player.z + f.z * 3.3;
  const valid = ghostValid(x, z, state.ghostRot);
  ghostMesh.position.set(x, heightAt(x, z) + ghostMesh.geometry.parameters.height / 2, z);
  ghostMesh.rotation.y = state.ghostRot;
  ghostMesh.material.color.set(valid ? 0x9fd08a : 0xd07a66);
  const prompt = $('prompt');
  prompt.classList.add('show');
  $('promptText').textContent = valid ? 'PLACE ' + BUILDS[state.buildType].name.toUpperCase() : 'BLOCKED — MOVE';
}

function placeStructure() {
  if (!state.buildMode) return;
  const def = BUILDS[state.buildType];
  const f = forwardVec();
  const x = player.x + f.x * 3.3, z = player.z + f.z * 3.3;
  if (!ghostValid(x, z, state.ghostRot)) { toast('Cannot build there', 'warn'); return; }
  if (!canAfford(def.cost)) { toast('Missing: ' + costText(def.cost), 'warn'); return; }
  spend(def.cost);
  const st = createStructure(state.buildType, x, z, state.ghostRot);
  audio.craft();
  toast(`${def.name} built`);
  updateHud();
  if (!canAfford(def.cost) && state.overlay === 'build') openBuild();
}

/* ------------------------------------------------------------
   Campfire, sleep and storage
   ------------------------------------------------------------ */
function updateStructures(dt) {
  for (const st of structures) {
    if (st.light) {
      const t = state.elapsed;
      st.light.intensity = 16 + Math.sin(t * 9 + st.x) * 2.6 + Math.sin(t * 23) * 0.9;
      for (let i = 0; i < st.flames.length; i++) {
        const f = st.flames[i];
        f.scale.y = 0.85 + Math.sin(t * 10 + i * 1.7) * 0.18;
        f.position.y = 0.5 + i * 0.12 + Math.sin(t * 7 + i) * 0.04;
      }
    }
    if (st.kind === 'spikes') {
      for (const z of zombies) {
        if (z.dead) continue;
        if (dist2(z.x, z.z, st.x, st.z) < 1.5) {
          z.hp -= dt * 26;
          z.stun = Math.max(z.stun, 0.25);
          if (z.hp <= 0) killZombie(z, false);
        }
      }
    }
  }
  // zombie banging on structures
  for (const z of zombies) {
    if (z.dead || z.state !== 'chase') continue;
    if (dist2(z.x, z.z, player.x, player.z) > 3.2) {
      for (const st of structures) {
        if (st.kind !== 'wall' && st.kind !== 'door' && st.kind !== 'gate') continue;
        if (st.col?.disabled) continue;
        if (dist2(z.x, z.z, st.x, st.z) < 2.1) {
          z.bangT = (z.bangT || 0) + dt;
          if (z.bangT > 1.2) {
            z.bangT = 0;
            st.hp -= 7 + rand() * 8;
            audio.burst?.(0.12, 160, 0.08);
            if (st.hp <= 0) {
              destroyStructure(st);
              toast('A structure was torn down!', 'bad');
            }
          }
          break;
        }
      }
    }
  }
}

function openSleep() {
  if (zombies.some(z => !z.dead && dist2(z.x, z.z, player.x, player.z) < 28)) {
    toast('Too dangerous to sleep — infected are close', 'bad');
    return;
  }
  state.overlay = 'sleep';
  showModal(`<div class="modal-head"><div><small>REST</small><h2>Sleeping bag</h2><div class="modal-sub">Sleeping passes time. Needs do not pause.</div></div><button class="close" data-close>×</button></div>
  <div class="modal-body">
    <p class="loot-empty" style="text-align:left;line-height:1.8">Current fatigue: ${Math.round(100 - player.energy)}%. You will wake with restored energy, but hunger and thirst will fall. Night passes fastest.</p>
    <div class="recipe-grid">
      <button class="recipe" data-sleep="2"><strong>Sleep 2 hours</strong><small>Recover energy and a little health.</small></button>
      <button class="recipe" data-sleep="dawn"><strong>Sleep until dawn</strong><small>Skip the night. Risky if infected find you.</small></button>
    </div>
  </div>
  <div class="modal-foot">You can be attacked while asleep. Secure your shelter first.</div>`);
}

function doSleep(hours) {
  closeModal();
  state.paused = true;
  state.overlay = 'sleeping';
  showModal(`<div class="end-screen"><small>RESTING</small><h2>Sleeping…</h2><p>Breathing slows. The forest keeps its noise.</p></div>`);
  setTimeout(() => {
    let h = hours === 'dawn' ? (state.time > 6 && state.time < 18 ? 2 : (7 - state.time + 24) % 24) : Number(hours);
    state.time += h;
    if (state.time >= 24) { state.time -= 24; state.day += 1; }
    player.energy = clamp(player.energy + 55 + rand() * 20, 0, 100);
    player.stamina = 100;
    player.food = clamp(player.food - h * 1.6, 0, 100);
    player.water = clamp(player.water - h * 2.0, 0, 100);
    player.health = clamp(player.health + 12, 0, 100);
    state.paused = false;
    state.overlay = null;
    closeModal();
    toast('You wake. Stiff, but rested.');
    audio.ui();
  }, 1600);
}

function openStorage(st) {
  state.overlay = 'storage';
  state.storageRef = st;
  const stash = st.stash || (st.stash = []);
  const stashWeight = stash.reduce((n, it) => n + (ITEMS[it.name]?.w || 0.3) * it.qty, 0);
  const stashRows = stash.length ? stash.map((it, i) => `
    <div class="inv-row">
      <span class="inv-icon">${ITEMS[it.name].icon || '·'}</span>
      <div class="inv-main"><strong>${it.name}</strong><small>${ITEMS[it.name].type.toUpperCase()} · ${(ITEMS[it.name].w * it.qty).toFixed(1)} KG</small></div>
      <b>×${it.qty}</b>
      <div class="inv-actions"><button class="primary" data-stash-take="${i}">TAKE</button></div>
    </div>`).join('') : '<p class="empty-note">Storage is empty. Store supplies here for safekeeping.</p>';
  const invRows = inventory.length ? inventory.map((it, i) => `
    <div class="inv-row">
      <span class="inv-icon">${ITEMS[it.name].icon || '·'}</span>
      <div class="inv-main"><strong>${it.name}</strong><small>${ITEMS[it.name].type.toUpperCase()} · ${(ITEMS[it.name].w * it.qty).toFixed(1)} KG</small></div>
      <b>×${it.qty}</b>
      <div class="inv-actions"><button data-stash-put="${i}">STORE</button></div>
    </div>`).join('') : '<p class="empty-note">Your pack is empty.</p>';
  showModal(`<div class="modal-head"><div><small>BASE STORAGE</small><h2>Storage crate</h2><div class="modal-sub">${stashWeight.toFixed(1)} / 80 KG stored · ${stash.length} slots used</div></div><button class="close" data-close>×</button></div>
  <div class="modal-body">
    <div class="sec-title"><h3>STORED SUPPLIES</h3><span>${stashWeight.toFixed(1)} KG</span></div>
    <div class="inv-list">${stashRows}</div>
    <div class="sec-title"><h3>YOUR PACK</h3><span>${weight().toFixed(1)} / ${capacity()} KG</span></div>
    <div class="inv-list">${invRows}</div>
  </div>
  <div class="modal-foot">Storage is private to you. Its contents persist for this session.</div>`);
}

function stashTake(i) {
  const st = state.storageRef;
  if (!st) return;
  const it = st.stash[i];
  if (!it) return;
  const def = ITEMS[it.name];
  const free = capacity() - weight();
  let qty = Math.min(it.qty, Math.floor(free / def.w));
  if (qty <= 0) { toast('Pack is full', 'warn'); return; }
  addItem(it.name, qty, it.cond);
  it.qty -= qty;
  if (it.qty <= 0) st.stash.splice(i, 1);
  audio.pickup();
  openStorage(st);
  updateHud();
}

function stashPut(i) {
  const st = state.storageRef;
  if (!st) return;
  const it = inventory[i];
  if (!it) return;
  const stashWeight = st.stash.reduce((n, row) => n + (ITEMS[row.name]?.w || 0.3) * row.qty, 0);
  if (stashWeight + (ITEMS[it.name]?.w || 0.3) * it.qty > 80) { toast('Storage is full', 'warn'); return; }
  st.stash.push({ name: it.name, qty: it.qty, cond: it.cond });
  inventory.splice(i, 1);
  audio.ui();
  refreshQuick();
  openStorage(st);
  updateHud();
}

/* campfire crafting */
function craft(recipeId) {
  const recipe = RECIPES.find(r => r.id === recipeId);
  if (!recipe) return;
  const fireNeeded = recipe.id === 'purify' || recipe.id === 'cookfish';
  if (fireNeeded && !nearCampfire()) { toast('You need a lit campfire', 'warn'); return; }
  if (!canAfford(recipe.cost)) { toast('Missing materials', 'warn'); return; }
  spend(recipe.cost);
  addItem(recipe.out, recipe.qty);
  audio.craft();
  toast(`Crafted ${recipe.out}${recipe.qty > 1 ? ' ×' + recipe.qty : ''}`);
  updateHud();
  if (state.overlay === 'craft') openCraft(fireNeeded);
}
/* ------------------------------------------------------------
   Modals
   ------------------------------------------------------------ */
function showModal(html) {
  document.exitPointerLock?.();
  $('modal').innerHTML = html;
  $('overlay').hidden = false;
}
function closeModal() {
  $('overlay').hidden = true;
  $('modal').innerHTML = '';
  state.overlay = null;
  state.lootRef = null;
}

function toggleModal(name) {
  if (!state.started && name !== 'help') return;
  audio.init();
  if (state.overlay === name) { closeModal(); return; }
  if (name === 'inventory') openInventory();
  if (name === 'map') openMap();
  if (name === 'craft') openCraft(false);
  if (name === 'build') openBuild();
  if (name === 'help') openHelp();
}

function modalHead(eyebrow, title, sub, extra = '') {
  return `<div class="modal-head"><div><small>${eyebrow}</small><h2>${title}</h2>${sub ? `<div class="modal-sub">${sub}</div>` : ''}</div><div style="display:flex;gap:6px;align-items:center">${extra}<button class="close" data-close>×</button></div></div>`;
}

/* ---------------- inventory ---------------- */
function equipmentSlot(slot, label) {
  const e = equipped[slot];
  return `<div class="equip-slot"><small>${label}</small><strong>${e ? e.name : '—'}</strong><span>${e ? `${conditionWord(e.cond)} · ${Math.round(e.cond)}%` : 'empty'}</span>${e ? `<button style="margin-top:4px;font:7px var(--mono);color:#9fb18a;border:1px solid rgba(214,222,199,.16);padding:2px 5px;border-radius:2px" data-unequip="${slot}">REMOVE</button>` : ''}</div>`;
}

function openInventory() {
  state.overlay = 'inventory';
  const rows = inventory.length ? inventory.map((it, i) => {
    const def = ITEMS[it.name] || { type: 'misc', w: 0.3, icon: '·', desc: '' };
    const canUse = !!def.use || ['weapon', 'clothing', 'backpack'].includes(def.type);
    const equippedSame = ['primary', 'melee', 'clothing', 'backpack'].some(s => equipped[s]?.name === it.name);
    return `<div class="inv-row">
      <span class="inv-icon">${def.icon || '·'}</span>
      <div class="inv-main"><strong>${it.name}${equippedSame ? ' · EQUIPPED' : ''}</strong>
        <small>${def.type.toUpperCase()} · ${((def.w || 0.3) * it.qty).toFixed(1)} KG${def.desc ? ' · ' + def.desc : ''}</small></div>
      ${def.dur || (it.cond < 100 && UNIQUE_TYPES.has(def.type)) ? `<span class="cond-pill ${condClass(it.cond)}">${conditionWord(it.cond)}</span>` : '<b>×' + it.qty + '</b>'}
      <div class="inv-actions">
        ${['weapon', 'clothing', 'backpack'].includes(def.type) ? `<button class="primary" data-equip="${i}">EQUIP</button>` : ''}
        ${def.use || def.type === 'tool' ? `<button class="primary" data-use="${i}">USE</button>` : ''}
        <button data-drop="${i}">DROP</button>
      </div>
    </div>`;
  }).join('') : '<p class="empty-note">Your pack is empty. Search houses, vehicles and stores.</p>';

  showModal(`
    ${modalHead('SURVIVOR LOADOUT', 'Pack & equipment', `${inventory.length} stacks · ${weight().toFixed(1)} / ${capacity()} KG carried`)}
    <div class="equip-strip">
      ${equipmentSlot('primary', 'PRIMARY')}
      ${equipmentSlot('melee', 'MELEE')}
      ${equipmentSlot('clothing', 'CLOTHING')}
      ${equipmentSlot('backpack', 'BACKPACK')}
    </div>
    <div class="weight-line"><span>PACK WEIGHT</span><b>${weight().toFixed(1)} / ${capacity()} KG</b></div>
    <div class="inv-list">${rows}</div>
    <div class="modal-foot">Quick access: <kbd>1</kbd> food · <kbd>2</kbd> water · <kbd>3</kbd> bandage. Weapons and clothing can be equipped directly. <kbd>I</kbd> closes.</div>
  `);
}

function dropItem(i) {
  const it = inventory[i];
  if (!it) return;
  const def = ITEMS[it.name];
  inventory.splice(i, 1);
  const c = { x: player.x + forwardVec().x * 1.3, z: player.z + forwardVec().z * 1.3, y: heightAt(player.x, player.z) + 0.2, tier: 'residential', type: 'duffel', searched: false, items: [{ name: it.name, qty: it.qty, cond: it.cond }], mat: null };
  containers.push(c);
  // simple drop visual
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.28, 0.36), new THREE.MeshLambertMaterial({ color: 0x8a7955 }));
  mesh.position.y = 0.18; g.add(mesh); g.position.set(c.x, c.y - 0.2, c.z); scene.add(g);
  c.meshDrop = g;
  const glint = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), new THREE.MeshBasicMaterial({ color: 0xf0e3b2 }));
  glint.position.set(c.x, c.y + 0.8, c.z); glint.userData.base = c.y + 0.8; scene.add(glint); c.glint = glint;
  toast(`Dropped ${it.name}`);
  refreshQuick(); updateHud();
  openInventory();
}

function unequip(slot) {
  const e = equipped[slot];
  if (!e) return;
  equipped[slot] = null;
  addItem(e.name, 1, e.cond);
  if (slot === 'primary') { player.mag = 0; rebuildViewmodel(); }
  if (slot === 'backpack' && weight() > capacity()) toast('Pack is overloaded — drop something', 'warn');
  refreshQuick(); updateHud(); openInventory();
}

/* ---------------- crafting ---------------- */
function openCraft(fireMode) {
  state.overlay = 'craft';
  const fire = !!nearCampfire();
  const rows = RECIPES.filter(r => fireMode ? true : !['purify', 'cookfish'].includes(r.id)).map(r => {
    const fireNeeded = r.id === 'purify' || r.id === 'cookfish';
    const ok = canAfford(r.cost) && (!fireNeeded || fire);
    const costs = Object.entries(r.cost).map(([n, q]) =>
      `<span class="${count(n) >= q ? 'have' : ''}">${q}× ${n} (${count(n)})</span>`).join(' · ');
    return `<button class="recipe" data-craft="${r.id}" ${ok ? '' : 'disabled'}>
      <strong>${r.name}</strong>
      <small class="cost">${costs}</small>
      <small>${r.note}${fireNeeded ? (fire ? ' · <span class="have">fire ready</span>' : ' · <span style="color:#e0b08e">needs fire</span>') : ''}</small>
    </button>`;
  }).join('');
  showModal(`
    ${modalHead('FIELD CRAFTING', fireMode ? 'Campfire' : 'Crafting', fireMode ? 'Cook, boil and make medicine at the fire.' : 'Simple recipes from what you carry.')}
    <div class="modal-body">
      ${fireMode ? `<div class="loot-head"><span class="tier" style="border-color:rgba(217,180,119,.4);color:#e6c992">FIRE LIT</span><span class="modal-sub">Warmth and light. Cook raw food, boil dirty water.</span></div>` : ''}
      <div class="recipe-grid">${rows}</div>
      <div class="sec-title"><h3>MATERIALS</h3><span>${inventory.filter(i => ITEMS[i.name]?.type === 'material').reduce((n, i) => n + i.qty, 0)} items</span></div>
      <p class="loot-empty" style="text-align:left;line-height:1.8">Scrap, rags, nails and fuel come from shelves, workshops and vehicle trunks. A campfire is required for water purification and cooking.</p>
    </div>
    <div class="modal-foot">Press <kbd>C</kbd> to open crafting anywhere. Build a campfire with <kbd>B</kbd>.</div>
  `);
}

/* ---------------- build menu ---------------- */
function openBuild() {
  state.overlay = 'build';
  const cats = ['Defence', 'Structure', 'Utility'];
  const sections = cats.map(cat => {
    const cards = Object.entries(BUILDS).filter(([, d]) => d.cat === cat).map(([id, d]) => {
      const ok = canAfford(d.cost);
      return `<button class="build-card" data-build="${id}" ${ok ? '' : 'disabled'}>
        <strong>${d.name}</strong>
        <small>${costText(d.cost)}</small>
        <small style="color:${ok ? '#9fb584' : '#c08b77'}">${ok ? 'READY' : 'MISSING MATERIALS'}</small>
      </button>`;
    }).join('');
    return `<div class="sec-title"><h3>${cat.toUpperCase()}</h3><span>${cat === 'Defence' ? 'keep the dead out' : cat === 'Structure' ? 'build upward' : 'survive the night'}</span></div><div class="build-grid">${cards}</div>`;
  }).join('');
  showModal(`
    ${modalHead('CONSTRUCTION', 'Build', `Choose a structure, then place it. Carrying ${count('Wood Scrap')} wood · ${count('Metal Scrap')} metal · ${count('Rag')} rag.`)}
    <div class="modal-body">${sections}
      <div class="loot-empty" style="text-align:left;line-height:1.8;margin-top:12px">Gather wood by chopping trees (E). Scrap metal, nails and fuel come from industrial and military loot. Structures can be damaged by the infected — repair with 2 wood.</div>
    </div>
    <div class="modal-foot">In build mode: <kbd>E</kbd> place · <kbd>Q</kbd> rotate · <kbd>B</kbd> exit. Doors lock when closed — unlock with one interaction, open with the next.</div>
  `);
}

function startBuild(type) {
  if (!BUILDS[type]) return;
  if (!canAfford(BUILDS[type].cost)) { toast('Missing materials for ' + BUILDS[type].name, 'warn'); return; }
  closeModal();
  setBuildMode(true, type);
}

/* ---------------- loot ---------------- */
function openLoot(c) {
  if (!c) return;
  state.overlay = 'loot';
  state.lootRef = c;
  const items = containerLoot(c).filter(it => it.qty > 0);
  const tierName = c.tier === 'military' ? 'MILITARY' : c.tier === 'medical' ? 'MEDICAL' : c.tier === 'police' ? 'POLICE'
    : c.tier === 'industrial' ? 'INDUSTRIAL' : c.tier === 'supermarket' || c.tier === 'store' ? 'SUPPLY'
    : c.tier === 'hunting' ? 'HUNTING' : c.tier === 'farm' ? 'FARM' : 'RESIDENTIAL';
  const rows = items.length ? items.map((it, i) => {
    const def = ITEMS[it.name];
    return `<div class="loot-row">
      <span class="inv-icon">${def.icon || '·'}</span>
      <div class="inv-main"><strong>${it.name}${it.qty > 1 ? ' ×' + it.qty : ''}</strong><small>${def.type.toUpperCase()} · ${((def.w || 0.3) * it.qty).toFixed(1)} KG</small></div>
      <button data-loot="${i}">TAKE</button>
    </div>`;
  }).join('') : '<p class="loot-empty">Nothing but dust and old blood.</p>';
  showModal(`
    ${modalHead(tierName + ' CACHE', c.type === 'car' ? 'Vehicle trunk' : c.type === 'duffel' ? 'Dropped bag' : c.type === 'barrel' ? 'Storage barrel' : 'Supply cache',
      `${weight().toFixed(1)} / ${capacity()} KG carried`)}
    <div class="modal-body">
      <div class="loot-head"><span class="tier">${tierName}</span><span class="modal-sub">${items.length} item${items.length === 1 ? '' : 's'}</span></div>
      ${rows}
      ${items.length ? '<button class="take-all" data-loot-all>TAKE EVERYTHING</button>' : ''}
    </div>
    <div class="modal-foot">Weight matters. Leave what you cannot carry — or build a storage crate.</div>
  `);
}
/* ------------------------------------------------------------
   Map
   ------------------------------------------------------------ */
function openMap() {
  state.overlay = 'map';
  const distList = settlements.map(s => ({ ...s, d: dist2(player.x, player.z, s.x, s.z) }))
    .sort((a, b) => a.d - b.d);
  showModal(`
    ${modalHead('NORTH CASCADE · FIELD MAP', 'Surroundings', `Sector ${Math.floor((player.x + 900) / 100)} · ${Math.floor((player.z + 900) / 100)} — surveyed territory`)}
    <div class="map-wrap"><canvas id="mapCanvas" width="720" height="520"></canvas></div>
    <div class="map-legend">
      <span><i style="background:#c3d18c"></i>YOU</span>
      <span><i style="background:#d9b477"></i>TOWN</span>
      <span><i style="background:#84aeb1"></i>WATER</span>
      <span><i style="background:#b7a47c"></i>ROADS</span>
      <span><i style="background:#8f9c83"></i>HUNTING / LANDMARK</span>
    </div>
    <div class="map-list">
      ${distList.map(s => `<button data-waypoint="${s.x},${s.z}"><span>${s.name}${s.discovered ? '' : ' · UNSURVEYED'}</span><span>${Math.round(s.d)} m</span></button>`).join('')}
      ${pois.map(p => `<button data-waypoint="${p.x},${p.z}"><span>${p.name}</span><span>${Math.round(dist2(player.x, player.z, p.x, p.z))} m</span></button>`).join('')}
    </div>
    <div class="modal-foot">Towns hold loot and infected. Click a location to see its distance. Use <kbd>M</kbd> to close.</div>
  `);
  drawMap();
}

function drawMap() {
  const cv = $('mapCanvas');
  if (!cv) return;
  const g = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const s = 520 / WORLD;
  const ox = (W - 520) / 2 + 900 * s * 0, oy = 0;
  const X = (x) => (x + 900) * s + (W - WORLD * s) / 2;
  const Y = (z) => (z + 900) * s;
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#1b291e'; g.fillRect(0, 0, W, H);
  // grid
  g.strokeStyle = 'rgba(195,209,140,.06)'; g.lineWidth = 1;
  for (let i = 0; i <= 9; i++) {
    g.beginPath(); g.moveTo(i * W / 9, 0); g.lineTo(i * W / 9, H); g.stroke();
    g.beginPath(); g.moveTo(0, i * H / 9); g.lineTo(W, i * H / 9); g.stroke();
  }
  // forest
  g.fillStyle = 'rgba(61,84,53,.55)';
  for (const t of trees) {
    g.fillRect(X(t.x) - 0.9, Y(t.z) - 0.9, 1.8, 1.8);
  }
  // water
  g.fillStyle = '#375d5d';
  for (const l of lakes) {
    g.beginPath(); g.ellipse(X(l.x), Y(l.z), l.rx * s, l.rz * s, 0, 0, Math.PI * 2); g.fill();
  }
  for (const r of rivers) {
    g.beginPath();
    for (let z = -900; z <= 900; z += 30) {
      const p = { x: r.x + Math.sin(z * r.freq) * r.amp, z };
      if (z === -900) g.moveTo(X(p.x), Y(p.z)); else g.lineTo(X(p.x), Y(p.z));
    }
    g.strokeStyle = '#3d6666'; g.lineWidth = Math.max(2, r.half * 2 * s); g.lineCap = 'round'; g.stroke();
  }
  // roads
  g.strokeStyle = 'rgba(170,152,112,.65)'; g.lineWidth = 2;
  for (const [aId, bId] of roads) {
    const a = settlements.find(x => x.id === aId), b = settlements.find(x => x.id === bId);
    if (!a || !b) continue;
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
    g.beginPath(); g.moveTo(X(a.x), Y(a.z)); g.quadraticCurveTo(X(mx), Y(mz), X(b.x), Y(b.z)); g.stroke();
  }
  // buildings
  g.fillStyle = 'rgba(139,126,96,.9)';
  for (const b of buildings) {
    g.fillRect(X(b.x - b.w / 2), Y(b.z - b.d / 2), b.w * s, b.d * s);
  }
  // my structures
  g.fillStyle = '#c3d18c';
  for (const st of structures) g.fillRect(X(st.x) - 1.5, Y(st.z) - 1.5, 3, 3);
  // settlements
  for (const t of settlements) {
    g.beginPath(); g.arc(X(t.x), Y(t.z), 4.5, 0, Math.PI * 2);
    g.fillStyle = '#d9b477'; g.fill();
    g.strokeStyle = 'rgba(217,180,119,.5)'; g.lineWidth = 1.5;
    g.beginPath(); g.arc(X(t.x), Y(t.z), 10, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#e4e6d6'; g.font = '9px "DM Mono", monospace';
    g.fillText(t.name.toUpperCase(), X(t.x) + 8, Y(t.z) + 3);
  }
  for (const p of pois) {
    g.beginPath(); g.arc(X(p.x), Y(p.z), 2.4, 0, Math.PI * 2);
    g.fillStyle = '#9fb18a'; g.fill();
  }
  // player arrow
  const px = X(player.x), py = Y(player.z);
  const heading = -player.yaw;
  g.save();
  g.translate(px, py); g.rotate(heading);
  g.fillStyle = '#e9efcd'; g.strokeStyle = '#1b291e'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(0, -8); g.lineTo(5.5, 6); g.lineTo(0, 3); g.lineTo(-5.5, 6); g.closePath();
  g.fill(); g.stroke();
  g.restore();
  g.fillStyle = 'rgba(233,239,205,.85)'; g.font = '8px "DM Mono", monospace';
  g.fillText('YOU', px + 9, py + 12);
}

/* ------------------------------------------------------------
   Help
   ------------------------------------------------------------ */
function openHelp() {
  state.overlay = 'help';
  showModal(`
    ${modalHead('FIELD MANUAL', 'Stay alive', 'Everything the Cascade will not tell you.')}
    <div class="modal-body">
      <div class="help-cols">
        <div>
          <h3>MOVEMENT & COMBAT</h3>
          <div class="help-grid" style="grid-template-columns:1fr">
            <p><kbd>WASD</kbd><span>Walk · <kbd>SHIFT</kbd> sprint</span></p>
            <p><kbd>MOUSE</kbd><span>Look · <kbd>LMB</kbd> attack · <kbd>RMB</kbd> aim</span></p>
            <p><kbd>SPACE</kbd><span>Jump</span></p>
            <p><kbd>X</kbd><span>Crouch (quieter)</span></p>
            <p><kbd>R</kbd><span>Reload firearm</span></p>
            <p><kbd>V</kbd><span>First / third person</span></p>
            <p><kbd>E</kbd><span>Interact / search / place</span></p>
          </div>
        </div>
        <div>
          <h3>PACK & BASE</h3>
          <div class="help-grid" style="grid-template-columns:1fr">
            <p><kbd>I</kbd><span>Inventory & equipment</span></p>
            <p><kbd>C</kbd><span>Crafting</span></p>
            <p><kbd>B</kbd><span>Build menu & placement</span></p>
            <p><kbd>M</kbd><span>Field map</span></p>
            <p><kbd>1–3</kbd><span>Quick food / water / bandage</span></p>
            <p><kbd>T</kbd><span>Torch (needs batteries)</span></p>
            <p><kbd>H</kbd><span>This manual</span></p>
          </div>
        </div>
      </div>
      <div class="sec-title"><h3>STAYING ALIVE</h3><span>hardcore rules</span></div>
      <div class="help-grid">
        <p><kbd>THIRST</kbd><span>Falls fastest. Fill bottles at water, boil them at a fire.</span></p>
        <p><kbd>HUNGER</kbd><span>Canned food and cooked meat are safe. Raw food can poison you.</span></p>
        <p><kbd>BLOOD</kbd><span>Zombie hits cause bleeding. Bandage quickly or lose blood.</span></p>
        <p><kbd>WARMTH</kbd><span>Rain soaks you. Get dry, wear a jacket, stand by fire.</span></p>
        <p><kbd>INFECTION</kbd><span>Wounds can fester. Antiseptic prevents it, antibiotics cure it.</span></p>
        <p><kbd>SLEEP</kbd><span>Build a sleeping bag. Fatigue saps speed and stamina.</span></p>
      </div>
      <div class="sec-title"><h3>THE INFECTED</h3><span>they hear you</span></div>
      <div class="help-grid">
        <p><kbd>WALKER</kbd><span>Slow. Travels in groups. Dangerous in numbers.</span></p>
        <p><kbd>RUNNER</kbd><span>Fast and fragile. Do not fight in the open.</span></p>
        <p><kbd>BRUTE</kbd><span>Massive damage and health. Use firearms or avoid.</span></p>
        <p><kbd>ARMOURED</kbd><span>Plated. Body shots do little — aim for the head.</span></p>
        <p><kbd>SCREECHER</kbd><span>Screams to call every infected nearby. Kill it first.</span></p>
        <p><kbd>NOISE</kbd><span>Gunshots carry 120 m. Sprinting and fighting draw them in.</span></p>
      </div>
      <div class="sec-title"><h3>BASE BUILDING</h3><span>player-built</span></div>
      <p class="loot-empty" style="text-align:left;line-height:1.9">Choose a structure with <kbd>B</kbd>, aim with the ghost and place with <kbd>E</kbd>. Walls block infected and sight. Doors lock when closed — unlock with one interaction, open with the next. Storage crates hold 80 kg. Campfires provide warmth, light, cooking and water purification. Sleeping bags pass the night. Structures take damage — repair with 2 wood scrap.</p>
      <div class="modal-foot">Difficulty is fixed and unforgiving: needs fall, wounds bleed, the dead hear gunfire. Plan your routes, carry water, and always know where your base is.</div>
    </div>
  `);
}

/* ------------------------------------------------------------
   End screen
   ------------------------------------------------------------ */
function showEnd(cause) {
  state.over = true;
  state.paused = true;
  state.overlay = 'end';
  document.exitPointerLock?.();
  const minutes = Math.floor(state.elapsed / 60);
  showModal(`
    <div class="end-screen">
      <small>THE QUIET RETURNS</small>
      <h2>Lost to the wild</h2>
      <p class="cause">${cause || state.deathCause}</p>
      <div class="end-stats">
        <div class="end-stat"><b>${state.day}</b><span>DAYS</span></div>
        <div class="end-stat"><b>${state.kills}</b><span>INFECTED</span></div>
        <div class="end-stat"><b>${(state.distance / 1000).toFixed(1)}</b><span>KM WALKED</span></div>
      </div>
      <p>You lasted ${minutes} minute${minutes === 1 ? '' : 's'} in North Cascade.</p>
      <button data-restart>TRY AGAIN</button>
    </div>
  `);
}

/* ------------------------------------------------------------
   HUD
   ------------------------------------------------------------ */
const compassTicks = [];
function initCompass() {
  const wrap = $('compassTicks');
  if (!wrap) return;
  wrap.innerHTML = '';
  const labels = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
  for (let a = 0; a < 360; a += 15) {
    const sp = document.createElement('span');
    sp.textContent = labels[a] || '';
    sp.className = labels[a] ? 'major' : '';
    sp.style.position = 'absolute';
    sp.style.left = '50%';
    sp.style.top = '0';
    sp.dataset.angle = a;
    wrap.appendChild(sp);
    compassTicks.push(sp);
  }
}

function updateCompass() {
  const hdg = ((-player.yaw * 180 / Math.PI) % 360 + 360) % 360;
  for (const sp of compassTicks) {
    const a = +sp.dataset.angle;
    let rel = ((a - hdg + 540) % 360) - 180;
    const vis = Math.abs(rel) < 105;
    sp.style.opacity = vis ? (1 - Math.abs(rel) / 130).toFixed(2) : '0';
    sp.style.transform = `translateX(calc(-50% + ${rel * 1.85}px))`;
  }
  const card = hdg < 22.5 || hdg >= 337.5 ? 'N' : hdg < 67.5 ? 'NE' : hdg < 112.5 ? 'E' : hdg < 157.5 ? 'SE'
    : hdg < 202.5 ? 'S' : hdg < 247.5 ? 'SW' : hdg < 292.5 ? 'W' : 'NW';
  $('compassHeading').textContent = `${card} · ${String(Math.round(hdg) % 360).padStart(3, '0')}°`;
}

function locationName() {
  const s = inSettlement(player.x, player.z);
  if (s) return s.name;
  let best = null, bd = Infinity;
  for (const t of settlements) {
    const d = dist2(player.x, player.z, t.x, t.z);
    if (d < bd) { bd = d; best = t; }
  }
  if (best && bd < 230) return 'Wilds near ' + best.name;
  return 'North Cascade wilds';
}

const objectives = [
  { test: () => hasItem('Purified water') || player.water > 80, text: 'Find clean water. Fill a bottle or boil river water at a fire.' },
  { test: () => hasItem('Bandage') || hasItem('First aid kit'), text: 'Find or craft bandages before the infected draw blood.' },
  { test: () => structures.some(s => s.kind === 'campfire'), text: 'Build a campfire: warmth, light, cooking and clean water.' },
  { test: () => structures.some(s => s.kind === 'storage'), text: 'Secure a base. Build walls, a door and a storage crate.' },
  { test: () => equipped.backpack, text: 'Find a backpack to carry more supplies.' },
  { test: () => state.kills > 3, text: 'Clear the infected around your shelter. Noise draws more.' },
  { test: () => true, text: 'Survive the night. Sleep in a bag, keep a fire burning.' },
];
let objectiveIndex = 0;
let hudClock = 0;

function updateHud(force = false) {
  const bars = [
    ['health', player.health], ['blood', player.blood], ['food', player.food], ['water', player.water],
    ['temp', clamp((player.temp - 32) * 20, 0, 100)], ['stamina', player.stamina], ['energy', player.energy],
  ];
  for (const [key, val] of bars) {
    const bar = $((key === 'temp' ? 'tempBar' : key + 'Bar'));
    if (bar) bar.style.width = clamp(val, 0, 100) + '%';
  }
  $('healthVal').textContent = Math.round(player.health);
  $('bloodVal').textContent = Math.round(player.blood);
  $('foodVal').textContent = Math.round(player.food);
  $('waterVal').textContent = Math.round(player.water);
  $('tempVal').textContent = player.temp.toFixed(1);
  $('staminaVal').textContent = Math.round(player.stamina);
  $('energyVal').textContent = Math.round(player.energy);

  // conditions
  const chips = [];
  if (player.bleed > 0) chips.push(['BLEEDING', '']);
  if (player.infection > 0) chips.push(['INFECTED', '']);
  if (player.fever > 0) chips.push(['FEVER', '']);
  if (player.poison > 0) chips.push(['FOOD POISONING', 'warn']);
  if (player.cold > 0) chips.push(['COLD', 'cold']);
  if (player.temp < 35) chips.push(['HYPOTHERMIA', 'cold']);
  else if (player.wet > 55) chips.push(['SOAKED', 'cold']);
  if (player.food < 16) chips.push(['STARVING', 'warn']);
  if (player.water < 16) chips.push(['DEHYDRATED', 'warn']);
  if (player.energy < 15) chips.push(['EXHAUSTED', 'warn']);
  if (weight() > capacity()) chips.push(['OVERLOADED', 'warn']);
  if (nearCampfire()) chips.push(['WARM', 'good']);
  const condEl = $('conditions');
  condEl.innerHTML = chips.slice(0, 5).map(c => `<span class="chip ${c[1]}">${c[0]}</span>`).join('');

  // gear
  const w = currentWeapon();
  $('weaponName').textContent = w ? w.name : 'Bare hands';
  if (w && ITEMS[w.name].mag) {
    $('ammoVal').textContent = `${player.mag} / ${count(ITEMS[w.name].ammo)}`;
    $('weaponCond').textContent = `${Math.round(w.cond)}%`;
  } else if (w) {
    $('ammoVal').textContent = 'MELEE';
    $('weaponCond').textContent = `${Math.round(w.cond)}%`;
  } else {
    $('ammoVal').textContent = '—';
    $('weaponCond').textContent = 'FISTS';
  }
  for (let i = 0; i < 3; i++) {
    const el = $('qs' + i);
    if (el) { el.textContent = quick[i] ? `${ITEMS[quick[i]]?.icon || '·'}${count(quick[i])}` : '—'; el.title = quick[i] || ''; }
  }
  $('stanceLabel').textContent = player.crouch ? 'CROUCHED' : player.sprint ? 'SPRINTING' : 'STANDING';
  $('noiseLabel').textContent = player.noise > 0.8 ? 'LOUD' : player.noise > 0.35 ? 'MOVING' : 'QUIET';
  $('torchLabel').textContent = player.flashlight ? 'TORCH ON' : 'TORCH OFF';

  // clock/weather
  const hours = Math.floor(state.time), mins = Math.floor((state.time - hours) * 60);
  $('clock').textContent = String(hours).padStart(2, '0') + ':' + String(mins).padStart(2, '0');
  $('dayNum').textContent = 'DAY ' + String(state.day).padStart(2, '0');
  $('weatherIcon').textContent = WEATHER_ICON[state.weather] || '☼';
  $('weatherName').textContent = WEATHER_TEXT[state.weather] || 'CLEAR';
  $('ambientTemp').textContent = Math.round(ambientTemp()) + '°C';
  $('locationName').textContent = locationName();
  updateCompass();

  if (force || !state.lastObjectiveCheck || state.elapsed - state.lastObjectiveCheck > 3) {
    state.lastObjectiveCheck = state.elapsed;
    while (objectiveIndex < objectives.length - 1 && objectives[objectiveIndex].test()) objectiveIndex++;
    const txt = objectives[objectiveIndex].text;
    if ($('objectiveText').textContent !== txt) $('objectiveText').textContent = txt;
  }
}

/* ------------------------------------------------------------
   Start screen
   ------------------------------------------------------------ */
function applyCharacter() {
  const female = state.char.gender === 'female';
  pTorso.scale.set(female ? 0.9 : 1.08, female ? 0.98 : 1.05, female ? 0.92 : 1.02);
  pHead.scale.setScalar(female ? 0.94 : 1.0);
  pHair.scale.set(female ? 1.02 : 1.0, female ? 1.18 : 0.9, female ? 1.04 : 1.0);
  pArmL.scale.set(female ? 0.9 : 1.06, female ? 1 : 1.04, female ? 0.9 : 1.03);
  pArmR.scale.copy(pArmL.scale);
  pArmL.position.x = female ? -0.31 : -0.35;
  pArmR.position.x = female ? 0.31 : 0.35;
  jacketMat.color.set(state.char.color);
}

function bindStart() {
  document.querySelectorAll('.char-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.char-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      state.char.gender = card.dataset.gender;
      state.char.name = card.dataset.name;
      jacketMat.color.set(state.char.color);
      audio.ui();
    });
  });
  document.querySelectorAll('.swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      state.char.color = sw.dataset.color;
      jacketMat.color.set(state.char.color);
      audio.ui();
    });
  });
  $('startBtn').addEventListener('click', () => {
    applyCharacter();
    audio.init();
    $('toasts').innerHTML = '';
    $('startScreen').classList.add('hidden');
    state.started = true;
    state.paused = false;
    player.y = heightAt(player.x, player.z);
    player.camY = player.y + 1.66;
    toast('Pine Ridge. Find supplies. Stay alive.');
    setTimeout(() => toast(isTouch ? 'Drag anywhere to look. USE searches containers.' : 'Click the world to capture the mouse. E searches containers.'), 2200);
    setTimeout(() => toast('Tip: build a campfire before dark — B opens construction.'), 6000);
    updateHud(true);
  });
  $('startHelp').addEventListener('click', openHelp);
}

/* global modal delegation */
$('overlay').addEventListener('click', (e) => {
  if (e.target === $('overlay') || e.target.closest('[data-close]')) { closeModal(); return; }
  const use = e.target.closest('[data-use]');
  if (use) { const it = inventory[+use.dataset.use]; if (it) useItem(it.name); return; }
  const drop = e.target.closest('[data-drop]');
  if (drop) { dropItem(+drop.dataset.drop); return; }
  const equip = e.target.closest('[data-equip]');
  if (equip) { const it = inventory[+equip.dataset.equip]; if (it) equipItemByName(it.name); return; }
  const uneq = e.target.closest('[data-unequip]');
  if (uneq) { unequip(uneq.dataset.unequip); return; }
  const craftBtn = e.target.closest('[data-craft]');
  if (craftBtn) { craft(craftBtn.dataset.craft); return; }
  const buildBtn = e.target.closest('[data-build]');
  if (buildBtn) { startBuild(buildBtn.dataset.build); return; }
  const sleepBtn = e.target.closest('[data-sleep]');
  if (sleepBtn) { doSleep(sleepBtn.dataset.sleep); return; }
  const take = e.target.closest('[data-loot]');
  if (take) { takeLoot(state.lootRef, +take.dataset.loot); return; }
  if (e.target.closest('[data-loot-all]')) { takeLoot(state.lootRef, -1); return; }
  const takeStash = e.target.closest('[data-stash-take]');
  if (takeStash) { stashTake(+takeStash.dataset.stashTake); return; }
  const putStash = e.target.closest('[data-stash-put]');
  if (putStash) { stashPut(+putStash.dataset.stashPut); return; }
  if (e.target.closest('[data-restart]')) { location.reload(); return; }
  const wp = e.target.closest('[data-waypoint]');
  if (wp) {
    const [x, z] = wp.dataset.waypoint.split(',').map(Number);
    toast(`Bearing ${Math.round((Math.atan2(x - player.x, -(z - player.z)) * 180 / Math.PI + 360) % 360)}° · ${Math.round(dist2(player.x, player.z, x, z))} m`);
  }
});

initCompass();
bindStart();
updateHud(true);
/* ------------------------------------------------------------
   Environment / weather visuals
   ------------------------------------------------------------ */
const skyDay = new THREE.Color(0x93abae);
const skyOvercast = new THREE.Color(0x8d9a92);
const skyDusk = new THREE.Color(0xb3765a);
const skyNight = new THREE.Color(0x0a141d);
const fogDay = new THREE.Color(0xa8b5a4);
const fogNight = new THREE.Color(0x121d21);
const tmpColor = new THREE.Color();

function updateEnvironment(dt) {
  const t = state.time;
  const sunA = ((t - 6) / 14) * Math.PI;
  const sx = Math.cos(sunA), sy = Math.sin(sunA);
  const elev = sy;
  const day = clamp(elev * 2.4, 0, 1);
  const dusk = clamp(1 - Math.abs(elev) / 0.3, 0, 1) * (elev > -0.22 ? 1 : 0);

  const baseSky = state.weather === 'CLEAR' ? skyDay : state.weather === 'STORM' ? new THREE.Color(0x44505a)
    : state.weather === 'FOG' ? new THREE.Color(0x9aa49a) : skyOvercast;
  tmpColor.copy(skyNight).lerp(baseSky, clamp(day * 1.25 + 0.05, 0, 1));
  tmpColor.lerp(skyDusk, dusk * (state.weather === 'CLEAR' ? 0.55 : 0.2));
  if (state.flash > 0) tmpColor.lerp(new THREE.Color(0xd8e2e6), state.flash * 0.7);
  skyDome.position.copy(camera.position);
  const skyTop = new THREE.Color(0x10202c).lerp(new THREE.Color(0x5a7f8c), clamp(day * 1.2, 0, 1));
  if (dusk > 0) skyTop.lerp(new THREE.Color(0x6c6274), dusk * 0.45);
  if (state.flash > 0) skyTop.lerp(new THREE.Color(0xdde7e8), state.flash * 0.7);
  skyMat.uniforms.top.value.copy(skyTop);
  const skyBot = new THREE.Color(0x1b2627).lerp(new THREE.Color(0xb3b7a8), clamp(day * 1.12, 0, 1));
  if (dusk > 0) skyBot.lerp(new THREE.Color(0xc18a63), dusk * 0.7);
  if (state.flash > 0) skyBot.lerp(new THREE.Color(0xe6eef0), state.flash * 0.8);
  skyMat.uniforms.bottom.value.copy(skyBot);

  const fogBase = state.weather === 'FOG' ? 0.012 : state.weather === 'STORM' ? 0.0062
    : state.weather === 'RAIN' ? 0.0044 : state.weather === 'OVERCAST' ? 0.0028 : 0.0019;
  const nightExtra = (1 - day) * 0.0018;
  scene.fog.density = fogBase + nightExtra;
  tmpColor.copy(fogNight).lerp(fogDay, day);
  if (state.weather === 'FOG') tmpColor.lerp(new THREE.Color(0xb3bdb0), 0.55 * day);
  scene.fog.color.copy(tmpColor);

  // sun / moon direction
  skyMat.uniforms.sunDir.value.set(sx, Math.max(-0.4, sy), 0.22).normalize();
  skyMat.uniforms.sunColor.value.setHex(dusk > 0.25 ? 0xffa76e : 0xffe9c0).multiplyScalar(clamp(day * 1.2, 0, 1));
  sun.position.set(player.x + sx * 90, player.y + Math.max(-20, sy) * 110 + 12, player.z + 34);
  sun.target.position.set(player.x, player.y, player.z);
  sun.target.updateMatrixWorld();
  moon.position.set(player.x - sx * 90, player.y + Math.max(-20, -sy) * 110 + 12, player.z - 34);
  moon.target = sun.target;
  moon.intensity = Math.max(0, -sy) * 0.6;
  sun.intensity = day * 1.75 * (state.weather === 'CLEAR' ? 1 : state.weather === 'OVERCAST' ? 0.55 : state.weather === 'FOG' ? 0.5 : 0.32);
  if (dusk > 0.2) sun.color.setHex(0xffb98a);
  else sun.color.setHex(0xfff1d6);
  hemi.intensity = 0.26 + day * 0.95 + (state.flash > 0 ? state.flash * 1.6 : 0);
  ambient.intensity = 0.34 + day * 0.32 + (state.flash > 0 ? state.flash * 0.9 : 0);

  // sky discs + stars
  skyGroup.position.copy(camera.position);
  sunDisc.position.set(sx * 620, sy * 620, 120);
  sunDisc.visible = sy > -0.05;
  sunDisc.material.color.setHex(dusk > 0.25 ? 0xffb177 : 0xffe9c4);
  moonDisc.position.set(-sx * 620, -sy * 620, -160);
  moonDisc.visible = -sy > -0.02;
  stars.material.opacity = clamp(-sy * 1.8, 0, 0.9);
  stars.visible = stars.material.opacity > 0.02;

  // rain
  const wet = state.weather === 'RAIN' || state.weather === 'STORM';
  rain.visible = wet;
  if (wet) {
    const pos = rainGeo.attributes.position.array;
    const speed = state.weather === 'STORM' ? 34 : 24;
    for (let i = 0; i < RAIN_N; i++) {
      const sxr = rainSeed[i * 3] + ((state.elapsed * (state.weather === 'STORM' ? 8 : 5)) % 40) - 20;
      const szr = rainSeed[i * 3 + 2];
      const fall = (rainSeed[i * 3 + 1] + state.elapsed * speed) % 26;
      const y = player.y + 20 - fall;
      const x = player.x + sxr, z = player.z + szr;
      pos[i * 6] = x; pos[i * 6 + 1] = y; pos[i * 6 + 2] = z;
      pos[i * 6 + 3] = x - 0.1; pos[i * 6 + 4] = y + (state.weather === 'STORM' ? 1.15 : 0.7); pos[i * 6 + 5] = z;
    }
    rainGeo.attributes.position.needsUpdate = true;
    rain.material.opacity = 0.28 + (state.weather === 'STORM' ? 0.2 : 0);
  }

  // ambient audio beds
  if (audio.ctx) {
    const stormy = state.weather === 'STORM';
    const rainy = state.weather === 'RAIN' || stormy;
    const windTarget = 0.05 + (rainy ? 0.035 : 0) + (stormy ? 0.06 : 0);
    audio.wind.gain.value = lerp(audio.wind.gain.value, windTarget, Math.min(1, dt * 0.6));
    audio.rain.gain.value = lerp(audio.rain.gain.value, rainy ? (stormy ? 0.14 : 0.09) : 0, Math.min(1, dt * 0.8));
  }

  // weather label icons handled in HUD
  if (state.flash > 0) {
    state.flash = Math.max(0, state.flash - dt * 3.6);
  }
}

/* ------------------------------------------------------------
   Resize
   ------------------------------------------------------------ */
function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 1.75));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);
onResize();

/* ------------------------------------------------------------
   Main loop
   ------------------------------------------------------------ */
let last = performance.now();
let reloadWasActive = false;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;
  const active = state.started && !state.paused && !state.over && !state.overlay;
  if (active) {
    state.elapsed += dt;
    advanceTime(dt);
    updatePlayer(dt);
    updateSurvival(dt);
    updateZombies(dt);
    updateStructures(dt);
    updateContainerGlints(dt, state.elapsed);
    updateGhost();
    if (player.reload > 0) {
      player.reload -= dt;
      if (player.reload <= 0) finishReload();
    }
    state.nearTick -= dt;
    if (state.nearTick <= 0) { updateNearest(); state.nearTick = 0.18; }
    hudClock -= dt;
    if (hudClock <= 0) { updateHud(); hudClock = 0.14; }
    updateThreat();
    updateEnvironment(dt);
    if (state.threat && !audio.ctx) audio.init();
  } else {
    // keep the world visible while menus are open
    updateEnvironment(dt * 0.2);
    if (state.started) {
      cameraUpdate(dt, 0);
      updateCompass();
    }
    updateThreat();
  }
  renderer.render(scene, camera);
}

/* first frame / boot */
player.y = heightAt(player.x, player.z);
player.camY = player.y + 1.66;
player.battery = 100;
cameraUpdate(0.016, 0);
updateHud(true);
refreshQuick();
rebuildViewmodel();
updateEnvironment(0.016);
renderer.render(scene, camera);
setTimeout(() => $('loading').classList.add('hidden'), 240);

requestAnimationFrame(frame);
