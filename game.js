(() => {
  'use strict';

  /* ============================================================
     AFTERLIGHT — Cedar County survival prototype
     Top-down 2D sandbox. Single player. State is snapshot-ready
     for a future authoritative multiplayer server.
     ============================================================ */

  const $ = s => document.querySelector(s);
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const angleDiff = (a, b) => { let d = (a - b + Math.PI) % TAU; if (d < 0) d += TAU; return d - Math.PI; };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let seed = 7331;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const rnd = (a, b) => a + rand() * (b - a);
  const pick = arr => arr[Math.floor(rand() * arr.length)];
  const chance = p => rand() < p;

  /* ---------------- data ---------------- */

  const WORLD = { w: 3600, h: 2800 };
  const LAKE = { x: 3290, y: 850, rx: 310, ry: 270 };
  const DAY_LENGTH = 720; // real seconds per in-game 24h
  const SAVE_KEY = 'afterlight.save.v3';

  const ITEMS = {
    'Water bottle': { w: 1, cat: 'drink', use: { thirst: 30, poison: .22 }, note: 'Unpurified. Boil it at a fire.' },
    'Purified water': { w: 1, cat: 'drink', use: { thirst: 48 } },
    'Canned beans': { w: .7, cat: 'food', use: { hunger: 32 } },
    'Canned peaches': { w: .6, cat: 'food', use: { hunger: 26, thirst: 6 } },
    'Moldy bread': { w: .4, cat: 'food', use: { hunger: 16, poison: .38 }, note: 'Risky. Eat only if desperate.' },
    'Cooked meat': { w: .5, cat: 'food', use: { hunger: 48, health: 6 } },
    'Raw meat': { w: .5, cat: 'food', use: { hunger: 22, poison: .62 }, note: 'Cook it before eating.' },
    'Bandage': { w: .2, cat: 'med', use: { bleed: true, health: 7 } },
    'Painkillers': { w: .1, cat: 'med', use: { health: 14, infection: -6 } },
    'Antibiotics': { w: .1, cat: 'med', use: { cure: 'infection' }, note: 'Cures wound infection.' },
    'Vitamins': { w: .1, cat: 'med', use: { cure: 'cold', fatigue: -22 } },
    'Charcoal tablets': { w: .1, cat: 'med', use: { cure: 'poisoning' }, note: 'Cures food poisoning.' },
    'Hatchet': { w: 2.2, cat: 'melee', dmg: 46, reach: 64 },
    'Crowbar': { w: 3, cat: 'melee', dmg: 58, reach: 72 },
    'Pistol': { w: 1.1, cat: 'gun', dmg: 52, range: 520, ammo: '9mm rounds', noise: 1.2 },
    'Hunting rifle': { w: 3.4, cat: 'gun', dmg: 128, range: 920, ammo: '.308 rounds', noise: 1.7 },
    '9mm rounds': { w: .015, cat: 'ammo' },
    '.308 rounds': { w: .03, cat: 'ammo' },
    'Fuel can': { w: 2.2, cat: 'part' },
    'Car battery': { w: 4.5, cat: 'part' },
    'Spark plug': { w: .2, cat: 'part' },
    'Wood': { w: 1.2, cat: 'material' },
    'Scrap metal': { w: 1.5, cat: 'material' },
    'Cloth': { w: .3, cat: 'material' },
    'Matches': { w: .05, cat: 'tool' },
    'Repair kit': { w: 1.8, cat: 'tool', note: 'Restores weapon and vehicle condition.' },
    'Hiking backpack': { w: 1, cat: 'gear', note: 'Adds 8 kg of pack capacity.' },
    'Flashlight': { w: .4, cat: 'gear', note: 'Toggle with L. Consumes no batteries in this build.' }
  };

  const TABLES = {
    market: [['Canned beans', 2], ['Canned peaches', 2], ['Moldy bread', 1.4], ['Water bottle', 2], ['Purified water', 1.2], ['Cloth', 1.2], ['Matches', .8], ['Bandage', .6]],
    medical: [['Bandage', 3], ['Painkillers', 1.6], ['Antibiotics', 1.2], ['Vitamins', 1], ['Charcoal tablets', 1], ['Cloth', 1]],
    police: [['Pistol', 1], ['9mm rounds', 4], ['Bandage', 1.6], ['Crowbar', 1], ['Painkillers', .8], ['Flashlight', 1]],
    military: [['Hunting rifle', .8], ['.308 rounds', 4], ['9mm rounds', 4], ['Antibiotics', 1.4], ['Bandage', 2], ['Fuel can', 1], ['Repair kit', 1]],
    house: [['Water bottle', 2], ['Canned beans', 1.6], ['Moldy bread', 1.6], ['Cloth', 2], ['Matches', 1], ['Bandage', .8], ['Hiking backpack', .3]],
    farm: [['Canned beans', 1.4], ['Moldy bread', 1.2], ['Matches', 1], ['Wood', 2], ['Cloth', 1], ['Raw meat', .5]],
    industrial: [['Wood', 3], ['Scrap metal', 3], ['Fuel can', 1.4], ['Spark plug', 1.4], ['Car battery', .8], ['Repair kit', 1]],
    hunting: [['Hunting rifle', 1], ['.308 rounds', 3], ['Raw meat', 1.2], ['Matches', 1.2], ['Bandage', 1], ['Cloth', 1]],
    gas: [['Fuel can', 2.4], ['Spark plug', 1.6], ['Car battery', .8], ['Water bottle', 1.4], ['Moldy bread', 1], ['9mm rounds', 1]],
    generic: [['Water bottle', 2], ['Canned beans', 1.4], ['Cloth', 1.8], ['Bandage', .8], ['Wood', 1.4], ['Moldy bread', 1.2]]
  };

  const BUILDINGS = [
    { x: 1430, y: 1040, w: 250, h: 150, type: 'market', name: 'PINE RIDGE MARKET', table: 'market', searches: 4 },
    { x: 1720, y: 1000, w: 240, h: 160, type: 'store', name: 'SAVE-MART', table: 'market', searches: 3 },
    { x: 1220, y: 1050, w: 150, h: 110, type: 'pharmacy', name: 'PINE RIDGE PHARMACY', table: 'medical', searches: 3 },
    { x: 1160, y: 1310, w: 200, h: 150, type: 'police', name: 'CEDAR COUNTY SHERIFF', table: 'police', searches: 3 },
    { x: 1530, y: 1350, w: 220, h: 160, type: 'clinic', name: 'FIELD CLINIC', table: 'medical', searches: 4 },
    { x: 1790, y: 1290, w: 170, h: 120, type: 'house', name: 'ABANDONED HOUSE', table: 'house', searches: 2 },
    { x: 1020, y: 960, w: 170, h: 120, type: 'house', name: 'RURAL COTTAGE', table: 'house', searches: 2 },
    { x: 1490, y: 1600, w: 190, h: 130, type: 'house', name: 'BURNT HOUSE', table: 'house', searches: 1 },
    { x: 420, y: 620, w: 250, h: 170, type: 'barn', name: 'HOLLOW FARM', table: 'farm', searches: 3 },
    { x: 250, y: 880, w: 160, h: 115, type: 'house', name: 'FARMHOUSE', table: 'house', searches: 2 },
    { x: 2480, y: 650, w: 300, h: 210, type: 'industrial', name: 'CEDAR SAWMILL', table: 'industrial', searches: 4 },
    { x: 2600, y: 1760, w: 270, h: 190, type: 'military', name: 'CHECKPOINT KILO', table: 'military', searches: 4 },
    { x: 2900, y: 2090, w: 150, h: 120, type: 'bunker', name: 'BUNKER 12', table: 'military', searches: 3 },
    { x: 640, y: 1930, w: 180, h: 130, type: 'cabin', name: 'HUNTER CABIN', table: 'hunting', searches: 3 },
    { x: 1650, y: 1750, w: 180, h: 120, type: 'gas', name: 'ROADSIDE FUEL', table: 'gas', searches: 3 }
  ];

  const BUILDS = [
    { type: 'campfire', name: 'Campfire', desc: 'Warmth, light, cooking and water purification.', cost: { Wood: 6, Cloth: 1 }, w: 34, h: 34 },
    { type: 'storage', name: 'Storage crate', desc: 'Holds 40 kg of supplies. Solid cover.', cost: { Wood: 8, 'Scrap metal': 2 }, w: 44, h: 34 },
    { type: 'wall', name: 'Wooden wall', desc: 'Blocks movement and slows the infected.', cost: { Wood: 8, 'Scrap metal': 2 } },
    { type: 'bedroll', name: 'Bedroll', desc: 'Sleep off fatigue and recover health.', cost: { Cloth: 5, Wood: 2 }, w: 46, h: 28 },
    { type: 'barricade', name: 'Spike barricade', desc: 'Wounds infected that push against it.', cost: { Wood: 5, 'Scrap metal': 4 }, w: 56, h: 20 }
  ];

  const RECIPES = [
    { name: 'Bandage', desc: 'Clean cloth for dressing wounds.', cost: { Cloth: 2 }, station: null },
    { name: 'Repair kit', desc: 'Tools and cloth for field repairs.', cost: { 'Scrap metal': 1, Cloth: 1 }, station: null },
    { name: 'Purified water', desc: 'Boil a water bottle over a lit fire.', cost: { 'Water bottle': 1 }, station: 'fire' },
    { name: 'Cooked meat', desc: 'Cook raw meat over a lit fire.', cost: { 'Raw meat': 1 }, station: 'fire' }
  ];

  const NOTES = [
    { id: 'water', title: 'Find clean water.', text: 'Search the settlement, then purify water at a campfire. Raw water can carry disease.', check: () => stats.drank > 0 },
    { id: 'wound', title: 'Treat a wound.', text: 'The infected tear flesh. Keep bandages on hand and stop bleeding before it drains you.', check: () => stats.bandaged > 0 },
    { id: 'gun', title: 'Find a firearm.', text: 'The sheriff and the checkpoint keep the county armoury. Ammunition is scarce.', check: () => !!player.gun },
    { id: 'fire', title: 'Build a campfire.', text: 'Gather wood with E near trees, then press B to build. Fire means warmth, cooking and clean water.', check: () => structures.some(s => s.type === 'campfire') },
    { id: 'vehicle', title: 'Get a vehicle running.', text: 'Find a battery, spark plug and fuel. A working vehicle changes how far you can range.', check: () => stats.drove > 0 },
    { id: 'night', title: 'Survive until dawn.', text: 'The infected grow bolder after dark. Find shelter, light a fire, and last until morning.', check: () => stats.survivedNight }
  ];

  /* ---------------- state ---------------- */

  let playing = false, paused = false, dead = false, modalKind = null, modalCtx = null;
  let worldSeconds = 0, clock = 7, day = 1, weather = 'CLEAR', weatherTimer = 150, uiTimer = 0, saveTimer = 0, spawnTimer = 0, animalTimer = 0;
  let gameTime = 0, shake = 0, flash = 0, thunderTimer = 0, waterCooldown = 0;
  let selected = 0, cam = { x: 0, y: 0 }, zoom = 1, zoomBias = 1, W = 0, H = 0, dpr = 1;
  let mouse = { x: 0, y: 0, active: false };
  let lastAim = -99;
  let last = 0, deathReason = '';
  let survivorsChoice = 'ava';
  let quality = 'high', shakeEnabled = true;
  let lastCondHTML = '';
  let keys = {}, joystick = { x: 0, y: 0, run: false };
  let joyPointer = null;
  let trees = [], loot = [], zombies = [], animals = [], vehicles = [], structures = [], particles = [], tracers = [], decor = [];
  let buildings = [];
  let audio = null;
  let lightCanvas = null, lightCtx = null;
  let minimapSignature = '';

  const player = {
    x: 1400, y: 1230, r: 11, face: 0, hp: 100, blood: 100, stamina: 100, hunger: 78, thirst: 74,
    temp: 36.8, fatigue: 12, wetness: 0, infection: 0, noise: 0, crouch: false, flashlight: false,
    capacity: 16, melee: 'Hatchet', gun: null, driving: null, survivor: 'Ava Reyes',
    inventory: {}, condition: { Hatchet: 100, Crowbar: 100, Pistol: 100, 'Hunting rifle': 100 },
    conditions: { bleeding: 0, poisoning: 0, cold: 0 }
  };
  const stats = { kills: 0, found: 0, drank: 0, bandaged: 0, wood: 0, drove: 0, distance: 0, shots: 0, notes: 0, slept: 0, survivedNight: false };
  let noteSeen = {}, wasNight = false, lastDamage = '';
  let toastTimer = 0, audioVolume = .55;

  /* ---------------- audio ---------------- */

  function initAudio() {
    try {
      if (audio) { audio.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const master = ctx.createGain();
      master.gain.value = audioVolume;
      master.connect(ctx.destination);
      const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const wind = ctx.createBufferSource(); wind.buffer = buf; wind.loop = true;
      const wf = ctx.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 380;
      const wg = ctx.createGain(); wg.gain.value = .055;
      wind.connect(wf); wf.connect(wg); wg.connect(master); wind.start();
      const rain = ctx.createBufferSource(); rain.buffer = buf; rain.loop = true;
      const rf = ctx.createBiquadFilter(); rf.type = 'highpass'; rf.frequency.value = 900;
      const rg = ctx.createGain(); rg.gain.value = 0;
      rain.connect(rf); rf.connect(rg); rg.connect(master); rain.start();
      audio = { ctx, master, buf, windGain: wg, rainGain: rg, muted: false };
      audio.windGain.gain.value = .045;
      setRainAudio();
    } catch (e) { audio = null; }
  }

  function setRainAudio() {
    if (!audio) return;
    const wet = weather === 'RAIN' ? .12 : weather === 'STORM' ? .2 : weather === 'FOG' ? .03 : 0;
    try { audio.rainGain.gain.setTargetAtTime(audio.muted ? 0 : wet, audio.ctx.currentTime, .8); } catch (e) {}
  }

  function noiseBurst(dur, freq, gain, type) {
    if (!audio || audio.muted) return;
    try {
      const ctx = audio.ctx, src = ctx.createBufferSource(); src.buffer = audio.buf;
      const f = ctx.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + dur);
      src.connect(f); f.connect(g); g.connect(audio.master);
      src.start(); src.stop(ctx.currentTime + dur);
    } catch (e) {}
  }

  function tone(freq, dur, gain, type) {
    if (!audio || audio.muted) return;
    try {
      const ctx = audio.ctx, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(freq, ctx.currentTime);
      g.gain.setValueAtTime(gain, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + dur);
      o.connect(g); g.connect(audio.master); o.start(); o.stop(ctx.currentTime + dur);
    } catch (e) {}
  }

  const SFX = {
    shot: () => { noiseBurst(.2, 900, .5); tone(70, .12, .18, 'square'); },
    quietShot: () => { noiseBurst(.08, 1200, .18); },
    swing: () => noiseBurst(.11, 480, .16, 'bandpass'),
    hit: () => { noiseBurst(.14, 220, .28); tone(120, .1, .12, 'triangle'); },
    pickup: () => { tone(520, .08, .09); setTimeout(() => tone(760, .08, .07), 55); },
    drink: () => tone(300, .18, .06, 'sine'),
    build: () => { noiseBurst(.12, 320, .3); setTimeout(() => noiseBurst(.1, 260, .22), 110); },
    step: () => noiseBurst(.04, 300, .05),
    zombie: () => tone(90 + Math.random() * 30, .45, .06, 'sawtooth'),
    thunder: () => { noiseBurst(1.6, 140, .35); setTimeout(() => noiseBurst(1.1, 90, .22), 180); },
    ui: () => tone(620, .04, .04)
  };

  try { audioVolume = Number(localStorage.getItem('afterlight.volume') || .55); if (isNaN(audioVolume)) audioVolume = .55; } catch (e) {}

  /* ---------------- save / load ---------------- */

  function snapshot() {
    return {
      v: 3, survivorName: player.survivor, player: JSON.parse(JSON.stringify(player)),
      worldSeconds, clock, day, weather, weatherTimer, stats: { ...stats }, noteSeen,
      buildings: buildings.map(b => b.searches),
      loot: loot.map(l => ({ taken: l.taken, item: l.item, kind: l.kind, weight: l.weight, x: l.x, y: l.y })),
      structures: JSON.parse(JSON.stringify(structures)), vehicles: JSON.parse(JSON.stringify(vehicles)),
      zombies: JSON.parse(JSON.stringify(zombies))
    };
  }

  function saveGame(manual) {
    if (!playing || dead) { if (manual) say('NOTHING TO SAVE'); return false; }
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot()));
      if (manual) say('SURVIVAL LOG SAVED');
      const btn = $('#continue-btn');
      if (btn) btn.classList.remove('hidden');
      return true;
    } catch (e) { if (manual) say('SAVE FAILED'); return false; }
  }

  function loadGame() {
    let data;
    try { data = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { data = null; }
    if (!data || data.v !== 3) { newGame(survivorsChoice); return; }
    worldSeconds = data.worldSeconds || 0;
    clock = data.clock || 7;
    day = data.day || 1;
    weather = data.weather || 'CLEAR';
    weatherTimer = data.weatherTimer || 150;
    Object.assign(stats, data.stats || {});
    noteSeen = data.noteSeen || {};
    Object.assign(player, data.player);
    player.driving = null;
    player.inventory = player.inventory || {};
    player.conditions = player.conditions || { bleeding: 0, poisoning: 0, cold: 0 };
    buildings.forEach((b, i) => { b.searches = data.buildings ? data.buildings[i] : b.searches; });
    if (data.loot) loot.forEach((l, i) => { if (data.loot[i]) { l.taken = data.loot[i].taken; } });
    structures = (data.structures || []).map(s => ({ ...s, items: s.items || {} }));
    vehicles = (data.vehicles || []).map((v, i) => ({ ...v, storage: v.storage || {} }));
    if (data.zombies) zombies = data.zombies;
    hideStart();
    playing = true; paused = false; dead = false;
    initAudio(); applyQuality(); updateUI();
    say('SURVIVAL LOG RESTORED');
  }

  /* ---------------- UI helpers ---------------- */

  function say(text) {
    const t = $('#toast'); if (!t) return;
    t.textContent = text; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
  }

  function hideStart() {
    const s = $('#start-screen'); if (s) s.classList.add('hidden');
  }

  const cap = () => player.capacity;
  function weight() {
    let w = 0;
    for (const [name, n] of Object.entries(player.inventory)) {
      const d = ITEMS[name]; w += (d ? d.w : .2) * n;
    }
    return w;
  }
  const count = name => player.inventory[name] || 0;
  const ammoCount = type => count(type);
  const countDrinks = () => count('Water bottle') + count('Purified water');
  const countFood = () => ['Canned beans', 'Canned peaches', 'Moldy bread', 'Cooked meat', 'Raw meat'].reduce((a, n) => a + count(n), 0);
  const countMeds = () => ['Bandage', 'Painkillers', 'Antibiotics', 'Vitamins', 'Charcoal tablets'].reduce((a, n) => a + count(n), 0);
  const addItem = (name, n, silent) => {
    n = n == null ? 1 : n;
    const d = ITEMS[name]; if (!d) return false;
    if (weight() + d.w * n > cap() + .001) { if (!silent) say('PACK FULL'); return false; }
    player.inventory[name] = (player.inventory[name] || 0) + n;
    stats.found += n;
    return true;
  };
  function removeItem(name, n) {
    n = n || 1;
    if (count(name) < n) return false;
    player.inventory[name] -= n;
    if (player.inventory[name] <= 0) delete player.inventory[name];
    return true;
  }
  const affordable = cost => Object.entries(cost).every(([name, n]) => count(name) >= n);
  function pay(cost) { for (const [name, n] of Object.entries(cost)) removeItem(name, n); }

  function setSlot(n) {
    selected = clamp(n, 0, 4);
    document.querySelectorAll('.slot').forEach((el, i) => el.classList.toggle('active', i === selected));
    updateUI();
  }

  function weaponCond(name) {
    if (!name) return 0;
    if (player.condition[name] == null) player.condition[name] = 100;
    return player.condition[name];
  }

  function completeNotes() { return NOTES.filter(n => noteSeen[n.id]).length; }
  function currentNote() { return NOTES.find(n => !noteSeen[n.id]); }

  function fmtClock() {
    const h = Math.floor(clock) % 24, m = Math.floor((clock % 1) * 60);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hh = h % 12 === 0 ? 12 : h % 12;
    return `${String(hh).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
  }

  function updateUI() {
    if (!playing) return;
    for (const [id, v] of [['health', player.hp], ['stamina', player.stamina], ['water', player.thirst], ['food', player.hunger]]) {
      const n = $(`#${id}-num`), b = $(`#${id}-bar`);
      if (n) n.textContent = Math.round(v);
      if (b) b.style.width = clamp(v, 0, 100) + '%';
    }
    $('#blood-num').textContent = Math.round(player.blood);
    $('#fatigue-num').textContent = Math.round(player.fatigue);
    $('#warmth-num').textContent = player.temp.toFixed(1) + '°';
    $('#temp').textContent = player.temp.toFixed(1) + '° C';
    $('#weight').textContent = `${weight().toFixed(1)} / ${cap()} kg`;

    const chips = [];
    if (player.conditions.bleeding > 0) chips.push(['BLEEDING', 'hot']);
    if (player.temp < 35) chips.push(['HYPOTHERMIA', 'cold']);
    if (player.infection > 8) chips.push([`INFECTION ${Math.round(player.infection)}%`, 'hot']);
    if (player.conditions.poisoning > 0) chips.push(['FOOD POISONING', 'hot']);
    if (player.conditions.cold > 0) chips.push(['COLD', 'cold']);
    if (player.wetness > 65) chips.push(['SOAKED', 'cold']);
    if (player.fatigue > 78) chips.push(['EXHAUSTED', '']);
    if (player.thirst < 18) chips.push(['DEHYDRATED', 'hot']);
    if (player.hunger < 18) chips.push(['STARVING', 'hot']);
    const condKey = chips.map(c => c[0]).join('|');
    if (condKey !== lastCondHTML) {
      lastCondHTML = condKey;
      $('#conditions').innerHTML = chips.map(c => `<span class="cond-chip ${c[1]}">${c[0]}</span>`).join('');
    }

    let cond = 'STABLE';
    if (player.conditions.bleeding > 0) cond = 'BLEEDING';
    else if (player.temp < 35) cond = 'HYPOTHERMIC';
    else if (player.infection > 55) cond = 'INFECTED';
    else if (player.conditions.poisoning > 0) cond = 'POISONED';
    else if (player.thirst < 18) cond = 'DEHYDRATED';
    else if (player.hunger < 18) cond = 'STARVING';
    else if (player.fatigue > 78) cond = 'EXHAUSTED';
    else if (player.conditions.cold > 0) cond = 'COLDSICK';
    $('#condition-text').textContent = cond;

    const drawnGun = selected === 1 && player.gun;
    const weapon = drawnGun ? player.gun : player.melee;
    $('#weapon-name').textContent = weapon ? weapon.toUpperCase() : 'UNARMED';
    $('#weapon-type').textContent = drawnGun ? 'FIREARM' : 'MELEE';
    const condv = weapon ? weaponCond(weapon) : 0;
    $('#weapon-cond').textContent = Math.round(condv) + '%';
    $('#weapon-bar').style.width = condv + '%';
    $('#weapon-ammo').textContent = drawnGun ? `${ammoCount(ITEMS[weapon].ammo)} RDS` : '—';

    const note = currentNote();
    const done = completeNotes();
    $('#objective-count').textContent = `${done} / ${NOTES.length} NOTES`;
    $('#objective-bar').style.width = (done / NOTES.length * 100) + '%';
    $('#objective-index').textContent = note ? String(done + 1).padStart(2, '0') : String(NOTES.length).padStart(2, '0');
    if (note) { $('#objective-title').textContent = note.title; $('#objective-text').textContent = note.text; }
    else { $('#objective-title').textContent = 'Write your own story.'; $('#objective-text').textContent = 'The county is open. Build a base, range further, and keep the generator running.'; }

    $('#slot-melee').textContent = (player.melee || 'UNARMED').toUpperCase();
    $('#slot-gun').textContent = player.gun ? player.gun.toUpperCase() : 'FIREARM';
    $('#slot-ammo').textContent = player.gun ? ammoCount(ITEMS[player.gun].ammo) : '0';
    $('#slot-bandage').textContent = 'BANDAGE ' + count('Bandage');
    $('#slot-water').textContent = 'WATER ' + countDrinks();
    $('#slot-food').textContent = 'FOOD ' + countFood();

    const near = zombies.filter(z => dist(z, player) < 260).length;
    const threat = near > 0 ? (near > 3 ? 'OVERRUN' : 'DETECTED') : zombies.some(z => dist(z, player) < 520) ? 'DISTANT' : 'QUIET';
    $('#threat-level').textContent = threat;
    document.querySelectorAll('.threat-pips i').forEach((e, i) => e.classList.toggle('on', near > 0 && i < Math.min(4, near)));
    $('#noise-label').textContent = player.noise > 1 ? 'GUNSHOT' : player.noise > .5 ? 'HIGH' : player.noise > .18 ? 'ELEVATED' : 'LOW';

    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const bearing = Math.atan2(player.y - 1200, player.x - 1400);
    $('#bearing').textContent = dirs[(Math.round((bearing + Math.PI / 2) / (Math.PI / 4)) + 8) % 8];
    $('#location-sub').textContent = `PINE RIDGE · ${fmtClock()}`;
  }

  /* ---------------- modals ---------------- */

  function openModal(kind, ctx) {
    if (!playing) return;
    paused = true; modalKind = kind; modalCtx = ctx || null;
    renderModal();
    $('#modal').classList.remove('hidden');
  }
  function closeModal() {
    if ($('#modal').classList.contains('hidden')) return;
    $('#modal').classList.add('hidden');
    if (playing && !dead) paused = false;
  }

  function costHTML(cost) {
    return Object.entries(cost).map(([n, q]) => `<span class="${count(n) >= q ? 'ok' : 'no'}">${esc(n)} ${count(n)}/${q}</span>`).join(' · ');
  }

  function itemRow(name, n, actions) {
    const d = ITEMS[name] || { w: .2, cat: 'misc' };
    const cond = d.cat === 'melee' || d.cat === 'gun' ? ` · ${Math.round(weaponCond(name))}%` : '';
    const btns = (actions || []).map(a => `<button class="mini-btn ${a.danger ? 'danger' : ''}" data-act="${a.act}" data-name="${esc(name)}">${a.label}</button>`).join('');
    return `<div class="inv-row${(player.melee === name || player.gun === name) ? ' equipped' : ''}"><div class="inv-name">${esc(name)} <small>×${n} · ${(d.w * n).toFixed(1)}kg${cond}</small></div><div class="inv-actions">${btns}</div></div>`;
  }

  function renderModal() {
    const body = $('#modal-body'), kicker = $('#modal-kicker'), title = $('#modal-title');
    if (!body) return;
    body.innerHTML = '';
    if (modalKind === 'inventory') {
      kicker.textContent = "SURVIVOR'S PACK";
      title.textContent = 'Inventory';
      const w = weight();
      body.innerHTML = `<div class="pack-line"><span>LOAD</span><div class="meter"><i style="width:${clamp(w / cap() * 100, 0, 100)}%"></i></div><b>${w.toFixed(1)} / ${cap()} kg</b></div>
        <div class="equip-grid">
          <div class="equip-slot"><span>MELEE</span><b>${player.melee || 'None'}</b><small>${player.melee ? Math.round(weaponCond(player.melee)) + '% condition' : 'Empty hands'}</small></div>
          <div class="equip-slot"><span>FIREARM</span><b>${player.gun || 'None'}</b><small>${player.gun ? ammoCount(ITEMS[player.gun].ammo) + ' rounds' : 'No weapon drawn'}</small></div>
          <div class="equip-slot"><span>BACKPACK</span><b>${cap()} kg</b><small>${player.survivor}</small></div>
        </div>
        <div class="modal-section">CARRIED SUPPLIES</div>`;
      const names = Object.keys(player.inventory).filter(n => player.inventory[n] > 0).sort((a, b) => {
        const order = { melee: 0, gun: 0, ammo: 1, med: 2, food: 3, drink: 4, tool: 5, material: 6, part: 7, gear: 8 };
        return (order[ITEMS[a]?.cat] ?? 9) - (order[ITEMS[b]?.cat] ?? 9);
      });
      if (!names.length) body.innerHTML += '<p class="empty-note">Your pack is empty. Search buildings and loot piles.</p>';
      const list = document.createElement('div'); list.className = 'inv-list';
      for (const name of names) {
        const d = ITEMS[name] || {};
        const acts = [];
        if (d.cat === 'melee' || d.cat === 'gun' || d.cat === 'gear' || d.cat === 'tool') acts.push({ act: 'equip', label: d.cat === 'tool' ? 'USE' : 'EQUIP' });
        else if (['food', 'drink', 'med'].includes(d.cat)) acts.push({ act: 'use', label: 'USE' });
        acts.push({ act: 'drop', label: 'DROP', danger: true });
        list.innerHTML += itemRow(name, player.inventory[name], acts);
      }
      body.append(list);
      const note = document.createElement('p'); note.className = 'inventory-note';
      note.textContent = 'Bandages stop bleeding. Antibiotics cure infection. Cook raw meat and boil water at a campfire. Weapons lose condition and can be repaired with a repair kit.';
      body.append(note);
      return;
    }
    if (modalKind === 'map') {
      kicker.textContent = 'CEDAR COUNTY · FIELD MAP';
      title.textContent = 'Pine Ridge';
      const c = drawMap();
      body.append(c);
      const key = document.createElement('div'); key.className = 'map-key';
      key.innerHTML = '<span>You</span><span>Structures</span><span>Medical</span><span>Water</span><span>Vehicle</span>';
      body.append(key);
      const note = document.createElement('p'); note.className = 'inventory-note';
      note.textContent = `Day ${day} · ${fmtClock()} · ${weather}. Your position is marked in green. The infected are not shown — listen before you move.`;
      body.append(note);
      return;
    }
    if (modalKind === 'build') {
      kicker.textContent = 'FIELD CONSTRUCTION';
      title.textContent = 'Build';
      const list = document.createElement('div'); list.className = 'build-list';
      for (const b of BUILDS) {
        const ok = affordable(b.cost) && !player.driving;
        list.innerHTML += `<div class="build-row"><div><b>${b.name}</b><small>${b.desc}</small><small class="cost">${costHTML(b.cost)}</small></div><button class="mini-btn" data-act="build" data-type="${b.type}" ${ok ? '' : 'disabled'}>BUILD</button></div>`;
      }
      body.append(list);
      const note = document.createElement('p'); note.className = 'inventory-note';
      note.textContent = 'Structures are placed directly in front of you. Gather wood from trees with E. Walls and crates block movement; campfires provide warmth, light and cooking.';
      body.append(note);
      return;
    }
    if (modalKind === 'craft') {
      kicker.textContent = nearFire() ? 'CAMPFIRE LIT · CRAFTING' : 'FIELD CRAFTING';
      title.textContent = 'Craft';
      const list = document.createElement('div'); list.className = 'recipe-list';
      for (const r of RECIPES) {
        const fireOk = !r.station || nearFire();
        const ok = affordable(r.cost) && fireOk;
        list.innerHTML += `<div class="recipe-row"><div><b>${r.name}</b><small>${r.desc}</small><small class="cost">${costHTML(r.cost)}${r.station && !fireOk ? ' · <span class="no">LIT FIRE REQUIRED</span>' : ''}</small></div><button class="mini-btn" data-act="craft" data-name="${r.name}" ${ok ? '' : 'disabled'}>CRAFT</button></div>`;
      }
      body.append(list);
      return;
    }
    if (modalKind === 'fire') {
      const s = modalCtx && modalCtx.s;
      if (!s) { closeModal(); return; }
      kicker.textContent = s.fuel > 0 ? 'FIRE · BURNING' : 'FIRE · COLD ASHES';
      title.textContent = 'Campfire';
      body.innerHTML = `<div class="pack-line"><span>FUEL</span><div class="meter"><i style="width:${clamp(s.fuel, 0, 100)}%"></i></div><b>${Math.round(s.fuel)}%</b></div>
        <div class="vehicle-actions">
          <button class="mini-btn" data-act="fire-cook" data-id="${s.id}" ${count('Raw meat') && s.fuel > 0 ? '' : 'disabled'}>COOK MEAT</button>
          <button class="mini-btn" data-act="fire-purify" data-id="${s.id}" ${count('Water bottle') && s.fuel > 0 ? '' : 'disabled'}>BOIL WATER</button>
          <button class="mini-btn" data-act="fire-refuel" data-id="${s.id}" ${count('Wood') ? '' : 'disabled'}>ADD WOOD</button>
          <button class="mini-btn" data-act="fire-warm" data-id="${s.id}" ${s.fuel > 0 ? '' : 'disabled'}>WARM UP</button>
        </div>
        <p class="inventory-note">The fire burns while you are away. Add wood to keep it alive. Boiling kills waterborne disease.</p>`;
      return;
    }
    if (modalKind === 'storage') {
      const s = modalCtx && modalCtx.s;
      if (!s) { closeModal(); return; }
      kicker.textContent = 'BASE STORAGE';
      title.textContent = 'Storage crate';
      const sw = storageWeight(s.items);
      body.innerHTML = `<div class="pack-line"><span>STORE</span><div class="meter"><i style="width:${clamp(sw / 40 * 100, 0, 100)}%"></i></div><b>${sw.toFixed(1)} / 40 kg</b></div>
        <div class="storage-cols">
          <div class="storage-col"><h4>YOUR PACK</h4><div class="inv-list">${storageRows(player.inventory, 'store', s.id)}</div></div>
          <div class="storage-col"><h4>CRATE</h4><div class="inv-list">${storageRows(s.items, 'take', s.id)}</div></div>
        </div>`;
      return;
    }
    if (modalKind === 'vehicle') {
      const v = modalCtx && modalCtx.v;
      if (!v) { closeModal(); return; }
      const ready = v.fuel > 0 && v.battery && v.spark && v.condition > 0;
      kicker.textContent = 'VEHICLE · ' + v.type.toUpperCase();
      title.textContent = ready ? 'Ready to roll' : 'Dead machine';
      body.innerHTML = `<div class="vehicle-grid">
          <div class="vehicle-stat">CONDITION<b>${Math.round(v.condition)}%</b></div>
          <div class="vehicle-stat">FUEL<b>${Math.round(v.fuel)}%</b></div>
          <div class="vehicle-stat">BATTERY<b>${v.battery ? 'INSTALLED' : 'MISSING'}</b></div>
          <div class="vehicle-stat">SPARK PLUG<b>${v.spark ? 'INSTALLED' : 'MISSING'}</b></div>
        </div>
        <div class="vehicle-actions">
          <button class="mini-btn" data-act="v-battery" data-id="${v.id}" ${!v.battery && count('Car battery') ? '' : 'disabled'}>INSTALL BATTERY</button>
          <button class="mini-btn" data-act="v-spark" data-id="${v.id}" ${!v.spark && count('Spark plug') ? '' : 'disabled'}>INSTALL PLUG</button>
          <button class="mini-btn" data-act="v-fuel" data-id="${v.id}" ${count('Fuel can') ? '' : 'disabled'}>ADD FUEL</button>
          <button class="mini-btn" data-act="v-repair" data-id="${v.id}" ${v.condition < 100 && count('Repair kit') ? '' : 'disabled'}>REPAIR</button>
          <button class="mini-btn on" data-act="v-drive" data-id="${v.id}" ${ready ? '' : 'disabled'}>DRIVE</button>
        </div>
        <div class="modal-section">VEHICLE STORAGE · ${storageWeight(v.storage).toFixed(1)} / 35 kg</div>
        <div class="storage-cols">
          <div class="storage-col"><h4>YOUR PACK</h4><div class="inv-list">${storageRows(player.inventory, 'vstore', v.id)}</div></div>
          <div class="storage-col"><h4>VEHICLE</h4><div class="inv-list">${storageRows(v.storage, 'vtake', v.id)}</div></div>
        </div>`;
      return;
    }
    if (modalKind === 'structure') {
      const s = modalCtx && modalCtx.s;
      if (!s) { closeModal(); return; }
      kicker.textContent = 'BASE STRUCTURE';
      title.textContent = s.type === 'wall' ? 'Wooden wall' : 'Spike barricade';
      body.innerHTML = `<div class="pack-line"><span>CONDITION</span><div class="meter"><i style="width:${clamp(s.hp / s.maxHp * 100, 0, 100)}%"></i></div><b>${Math.round(s.hp)} / ${s.maxHp}</b></div>
        <div class="vehicle-actions"><button class="mini-btn" data-act="s-repair" data-id="${s.id}" ${count('Wood') ? '' : 'disabled'}>REPAIR · 2 WOOD</button></div>
        <p class="inventory-note">The infected attack walls that block their path. Repair before they break through.</p>`;
      return;
    }
    if (modalKind === 'rest') {
      const s = modalCtx && modalCtx.s;
      if (!s) { closeModal(); return; }
      kicker.textContent = 'BEDROLL · SAFE REST';
      title.textContent = 'Sleep';
      body.innerHTML = `<p class="inventory-note">Sleeping restores fatigue and health, but advances time. Hunger and thirst will fall. The infected must be far away.</p>
        <div class="vehicle-actions" style="margin-top:14px"><button class="mini-btn on" data-act="sleep" data-id="${s.id}">SLEEP UNTIL RESTED</button></div>`;
      return;
    }
    if (modalKind === 'pause') {
      kicker.textContent = 'SURVIVAL PAUSED';
      title.textContent = 'Take a breath.';
      const done = completeNotes();
      body.innerHTML = `<div class="vehicle-grid">
          <div class="vehicle-stat">SURVIVED<b>${Math.floor(worldSeconds / 60)} min</b></div>
          <div class="vehicle-stat">DAY<b>${day}</b></div>
          <div class="vehicle-stat">INFECTED DOWN<b>${stats.kills}</b></div>
          <div class="vehicle-stat">SUPPLIES FOUND<b>${stats.found}</b></div>
        </div>
        <div class="modal-section">SETTINGS</div>
        <div class="settings-row"><span>GRAPHICS</span><div class="seg">
          ${['low', 'medium', 'high'].map(q => `<button class="mini-btn ${quality === q ? 'on' : ''}" data-act="quality" data-q="${q}">${q.toUpperCase()}</button>`).join('')}
        </div></div>
        <div class="settings-row"><span>VOLUME</span><input id="vol" type="range" min="0" max="1" step="0.05" value="${audioVolume}"></div>
        <div class="settings-row"><span>CAMERA SHAKE</span><button class="mini-btn ${shakeEnabled ? 'on' : ''}" data-act="shake">${shakeEnabled ? 'ON' : 'OFF'}</button></div>
        <div class="modal-section">SESSION</div>
        <div class="vehicle-actions">
          <button class="mini-btn on" data-act="resume">RESUME</button>
          <button class="mini-btn" data-act="save">SAVE NOW</button>
          <button class="mini-btn" data-act="newrun">NEW RUN</button>
        </div>
        <p class="settings-note">Field notes complete: ${done}/${NOTES.length}. Autosave runs every 20 seconds. Multiplayer is not simulated; this build exposes a snapshot-ready state layer for a future server.</p>
        <p class="settings-note">Controls · WASD move · Shift sprint · X crouch · E interact · F attack/fire · 1–5 quick slots · I pack · B build · C craft · M map · L flashlight · Esc pause.</p>`;
      return;
    }
    kicker.textContent = 'SURVIVAL';
    title.textContent = 'Field log';
    body.innerHTML = '<p class="inventory-note">The county is still out there.</p>';
  }

  function storageRows(obj, act, id) {
    const names = Object.keys(obj).filter(n => obj[n] > 0);
    if (!names.length) return '<p class="empty-note">Empty.</p>';
    return names.map(n => `<div class="inv-row"><div class="inv-name">${esc(n)} <small>×${obj[n]}</small></div><div class="inv-actions"><button class="mini-btn" data-act="${act}" data-name="${esc(n)}" data-id="${id}">${act === 'store' || act === 'vstore' ? '→' : '←'}</button></div></div>`).join('');
  }
  const storageWeight = items => Object.entries(items).reduce((a, [n, q]) => a + (ITEMS[n]?.w || .2) * q, 0);
  function nearFire() { return structures.some(s => s.type === 'campfire' && s.fuel > 0 && dist(s, player) < 110); }
  function findStructure(id) { return structures.find(s => s.id === id); }
  function findVehicle(id) { return vehicles.find(v => v.id === id); }

  /* ---------------- inventory actions ---------------- */

  let structureId = 1, nextStep = 0;

  function hurt(amount, reason, wound) {
    if (dead) return;
    player.hp = Math.max(0, player.hp - amount);
    if (reason) lastDamage = reason;
    if (wound) {
      if (chance(.42)) player.conditions.bleeding = Math.max(player.conditions.bleeding, 100);
      if (chance(.17)) player.infection = Math.max(player.infection, 22);
      player.blood = Math.max(0, player.blood - amount * .35);
    }
    shake = Math.min(14, shake + (wound ? 8 : 4));
    SFX.hit();
    particles.push({ x: player.x, y: player.y, vx: rnd(-30, 30), vy: rnd(-30, 30), life: .4, max: .4, color: '#9b3c32', size: 3 });
    if (player.hp <= 0) die(lastDamage || 'Your injuries were too severe.');
  }

  function die(reason) {
    if (dead) return;
    dead = true; playing = false; paused = true;
    player.driving = null;
    deathReason = reason;
    $('#modal').classList.add('hidden');
    $('#interaction-hint').classList.remove('show');
    $('#death-cause').textContent = reason + ' The county keeps its secrets.';
    const done = completeNotes();
    $('#death-stats').innerHTML = `
      <div><span>DAYS</span><b>${day}</b></div>
      <div><span>INFECTED</span><b>${stats.kills}</b></div>
      <div><span>SUPPLIES</span><b>${stats.found}</b></div>
      <div><span>DISTANCE</span><b>${Math.round(stats.distance / 10)}m</b></div>`;
    $('#dead-screen').classList.remove('hidden');
    $('#modal-body').innerHTML = `<p class="inventory-note">Field notes completed: ${done}/${NOTES.length}. Hardcore run — the save has been erased.</p>`;
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    SFX.zombie();
  }

  function useItem(name) {
    const d = ITEMS[name]; if (!d || count(name) < 1) return;
    if (name === 'Flashlight') { player.flashlight = !player.flashlight; say(player.flashlight ? 'FLASHLIGHT ON' : 'FLASHLIGHT OFF'); SFX.ui(); return; }
    if (name === 'Hiking backpack') {
      if (player.capacity >= 24) { say('YOU ALREADY CARRY A LARGE PACK'); return; }
      player.capacity = 24; removeItem(name, 1); say('HIKING PACK EQUIPPED · +8 KG CAPACITY'); updateUI(); if (modalKind === 'inventory') renderModal(); return;
    }
    if (name === 'Repair kit') {
      let fixed = 0;
      for (const w of [player.melee, player.gun].filter(Boolean)) {
        if (weaponCond(w) < 100) { player.condition[w] = Math.min(100, weaponCond(w) + 38); fixed++; }
      }
      removeItem(name, 1);
      say(fixed ? 'GEAR REPAIRED' : 'NOTHING NEEDED REPAIR');
      SFX.build(); updateUI(); if (modalKind === 'inventory') renderModal(); return;
    }
    if (name === 'Matches') { say('KEEP THEM DRY — NEEDED FOR A FIRE'); return; }
    if (d.cat === 'ammo' || d.cat === 'material' || d.cat === 'part') { say('THIS IS NOT USED DIRECTLY'); return; }
    const u = d.use || {};
    const wasBleeding = player.conditions.bleeding > 0;
    if (u.thirst) player.thirst = clamp(player.thirst + u.thirst, 0, 100);
    if (u.hunger) player.hunger = clamp(player.hunger + u.hunger, 0, 100);
    if (u.health) player.hp = clamp(player.hp + u.health, 0, 100);
    if (u.fatigue) player.fatigue = clamp(player.fatigue + u.fatigue, 0, 100);
    if (u.infection) player.infection = clamp(player.infection + u.infection, 0, 100);
    if (u.bleed) { player.conditions.bleeding = 0; if (wasBleeding) stats.bandaged++; }
    if (u.cure === 'infection') { player.infection = 0; say('ANTIBIOTICS · INFECTION CLEARED'); }
    if (u.cure === 'cold') { player.conditions.cold = 0; say('VITAMINS · COLD SUPPRESSED'); }
    if (u.cure === 'poisoning') { player.conditions.poisoning = 0; say('CHARCOAL · STOMACH SETTLED'); }
    if (u.poison && chance(u.poison)) { player.conditions.poisoning = Math.max(player.conditions.poisoning, 85); say('THAT DID NOT SIT RIGHT · FOOD POISONING'); }
    if (u.thirst) { stats.drank++; say(name === 'Water bottle' ? 'DRANK · RAW WATER' : 'DRANK · HYDRATION RESTORED'); SFX.drink(); }
    else if (u.hunger) { say('ATE · NOURISHMENT RESTORED'); SFX.pickup(); }
    else if (u.bleed) { say(wasBleeding ? 'BLEEDING STOPPED · WOUND DRESSED' : 'WOUND CLEANED'); }
    else if (!u.cure) { say('USED · ' + name.toUpperCase()); }
    removeItem(name, 1);
    updateUI();
    updateNotes();
    if (modalKind === 'inventory') renderModal();
  }

  function equipItem(name) {
    const d = ITEMS[name]; if (!d) return;
    if (d.cat === 'melee') { player.melee = name; setSlot(0); say(name.toUpperCase() + ' READY'); SFX.ui(); }
    else if (d.cat === 'gun') { player.gun = name; weaponCond(name); setSlot(1); say(name.toUpperCase() + ' EQUIPPED'); SFX.ui(); }
    else useItem(name);
    updateUI();
    if (modalKind === 'inventory') renderModal();
  }

  function dropItem(name) {
    if (!removeItem(name, 1)) return;
    loot.push({ x: player.x + rnd(-22, 22), y: player.y + rnd(-22, 22), item: name, kind: ITEMS[name]?.cat || 'misc', weight: ITEMS[name]?.w || .2, taken: false, dropped: true });
    say(name.toUpperCase() + ' DROPPED');
    updateUI();
    if (modalKind === 'inventory') renderModal();
  }

  function craftRecipe(name) {
    const r = RECIPES.find(x => x.name === name); if (!r) return;
    if (r.station === 'fire' && !nearFire()) { say('NEEDS A LIT CAMPFIRE'); return; }
    if (!affordable(r.cost)) { say('MISSING MATERIALS'); return; }
    const itemDef = ITEMS[name];
    if (itemDef && weight() - Object.entries(r.cost).reduce((a, [n, q]) => a + (ITEMS[n]?.w || .2) * q, 0) + itemDef.w > cap()) { say('PACK FULL'); return; }
    pay(r.cost);
    if (!addItem(name, 1)) { for (const [n, q] of Object.entries(r.cost)) addItem(n, q, true); say('PACK FULL'); return; }
    SFX.build(); say(name.toUpperCase() + ' CRAFTED');
    if (modalKind === 'craft') renderModal();
    updateUI();
  }

  /* ---------------- world interaction ---------------- */

  const RIVER = [[3060, -60], [3000, 400], [3130, 700], [3050, 1100], [3120, 1600], [3040, 2100], [3100, 2860]];

  function lakeAmount(x, y) { return Math.hypot((x - LAKE.x) / LAKE.rx, (y - LAKE.y) / LAKE.ry); }
  function nearWater() {
    const l = lakeAmount(player.x, player.y);
    if (l > .92 && l < 1.16) return true;
    for (let i = 0; i < RIVER.length - 1; i++) {
      const a = RIVER[i], b = RIVER[i + 1];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const t = clamp(((player.x - a[0]) * dx + (player.y - a[1]) * dy) / (dx * dx + dy * dy), 0, 1);
      if (Math.hypot(player.x - (a[0] + dx * t), player.y - (a[1] + dy * t)) < 38) return true;
    }
    return false;
  }

  function nearestInteraction() {
    if (player.driving) return { kind: 'vehicle-exit', text: 'Exit vehicle', d: 0 };
    const opts = [];
    for (const b of buildings) {
      if (b.searches <= 0) continue;
      const door = { x: b.x + b.w / 2, y: b.y + b.h + 24 };
      const d = dist(door, player);
      if (d < 92) opts.push({ kind: 'building', b, d, text: 'Search ' + b.name });
    }
    for (const l of loot) {
      if (l.taken) continue;
      const d = dist(l, player);
      if (d < 60) opts.push({ kind: 'loot', l, d, text: 'Search supplies' });
    }
    for (const t of trees) {
      if (t.chopped) continue;
      const d = dist(t, player);
      if (d < 54) opts.push({ kind: 'tree', t, d, text: 'Gather wood' });
    }
    for (const s of structures) {
      const d = dist(s, player);
      if (d > 94) continue;
      const text = s.type === 'campfire' ? 'Use campfire' : s.type === 'storage' ? 'Open storage' : s.type === 'bedroll' ? 'Rest on bedroll' : s.type === 'wall' ? 'Inspect wall' : 'Inspect barricade';
      opts.push({ kind: 'structure', s, d, text });
    }
    for (const v of vehicles) {
      const d = dist(v, player);
      if (d < 100) opts.push({ kind: 'vehicle', v, d, text: 'Inspect ' + v.type });
    }
    if (nearWater() && worldSeconds > waterCooldown) opts.push({ kind: 'water', d: 20, text: 'Fill water bottle' });
    return opts.sort((a, b) => a.d - b.d)[0] || null;
  }

  function interact() {
    if (!playing || paused || dead) return;
    if (player.driving) { exitVehicle(); return; }
    const n = nearestInteraction();
    if (!n) { say('NOTHING WITHIN REACH'); SFX.ui(); return; }
    if (n.kind === 'building') {
      const b = n.b;
      b.searches--;
      const drops = [];
      const num = 1 + (chance(.5) ? 1 : 0);
      for (let i = 0; i < num; i++) {
        const name = weightedPick(TABLES[b.table]);
        if (addItem(name)) drops.push(name);
      }
      player.noise = Math.max(player.noise, .3);
      SFX.pickup();
      if (drops.length) say('FOUND · ' + drops.join(' · '));
      else say('NOTHING ELSE USEFUL HERE');
      particles.push({ x: player.x, y: player.y, vx: 0, vy: -20, life: .5, max: .5, color: '#c8e27b', size: 2 });
      updateUI();
      return;
    }
    if (n.kind === 'loot') {
      if (addItem(n.l.item, 1)) {
        n.l.taken = true;
        SFX.pickup();
        say('+ ' + n.l.item.toUpperCase());
      }
      updateUI();
      return;
    }
    if (n.kind === 'tree') {
      if (!player.melee) { say('NEED A TOOL TO GATHER WOOD'); return; }
      if (addItem('Wood', 1)) {
        n.t.chopped = true; n.t.regrow = worldSeconds + 300;
        stats.wood++; player.noise = Math.max(player.noise, .3); SFX.swing();
        say('+ WOOD · 1');
      }
      updateUI();
      return;
    }
    if (n.kind === 'structure') {
      const s = n.s;
      if (s.type === 'campfire') openModal('fire', { s });
      else if (s.type === 'storage') openModal('storage', { s });
      else if (s.type === 'bedroll') openModal('rest', { s });
      else openModal('structure', { s });
      return;
    }
    if (n.kind === 'vehicle') { openModal('vehicle', { v: n.v }); return; }
    if (n.kind === 'water') {
      if (addItem('Water bottle', 1)) {
        waterCooldown = worldSeconds + 90;
        player.wetness = clamp(player.wetness + 6, 0, 100);
        SFX.drink(); say('+ WATER BOTTLE · UNPURIFIED');
      }
      updateUI();
    }
  }

  function weightedPick(table) {
    const total = table.reduce((a, row) => a + row[1], 0);
    let r = rand() * total;
    for (const [name, w] of table) { r -= w; if (r <= 0) return name; }
    return table[0][0];
  }

  /* ---------------- combat ---------------- */

  function findTarget(range, cone) {
    const list = [];
    for (const z of zombies) {
      const d = dist(z, player);
      if (d < range + z.r) list.push({ obj: z, kind: 'zombie', d, a: Math.atan2(z.y - player.y, z.x - player.x) });
    }
    for (const a of animals) {
      const d = dist(a, player);
      if (d < range + a.r) list.push({ obj: a, kind: 'animal', d, a: Math.atan2(a.y - player.y, a.x - player.x) });
    }
    return list.filter(t => Math.abs(angleDiff(t.a, player.face)) < cone).sort((a, b) => a.d - b.d)[0] || null;
  }

  function attack(aimAngle) {
    if (!playing || paused || dead) return;
    if (player.driving) { say('GET OUT OF THE VEHICLE FIRST'); return; }
    if (aimAngle != null) player.face = aimAngle;
    if (selected === 1 && player.gun) shoot();
    else melee();
  }

  function melee() {
    const name = player.melee;
    if (!name) { say('NO MELEE WEAPON'); return; }
    const d = ITEMS[name];
    const cond = weaponCond(name);
    if (cond <= 0) { say('WEAPON BROKEN · USE A REPAIR KIT'); return; }
    if (player.stamina < 7) { say('TOO EXHAUSTED TO SWING'); return; }
    player.stamina -= 7;
    player.noise = Math.max(player.noise, .58);
    player.condition[name] = Math.max(0, cond - .8);
    SFX.swing();
    particles.push({ x: player.x + Math.cos(player.face) * 28, y: player.y + Math.sin(player.face) * 28, vx: Math.cos(player.face) * 40, vy: Math.sin(player.face) * 40, life: .16, max: .16, color: '#e7e2c8', size: 2 });
    const target = findTarget(d.reach, 1.15);
    if (!target) { say('SWING · NOTHING IN REACH'); return; }
    let dmg = d.dmg * (cond < 30 ? .7 : 1);
    if (target.kind === 'zombie' && target.obj.variant === 'armored') dmg *= .55;
    if (target.kind === 'zombie') {
      const z = target.obj;
      z.hp -= dmg; z.alert = 6; z.state = 'chase'; z.tx = player.x; z.ty = player.y;
      shake = Math.min(12, shake + 5);
      particles.push({ x: z.x, y: z.y, vx: rnd(-40, 40), vy: rnd(-40, 40), life: .35, max: .35, color: '#9b3c32', size: 3 });
      SFX.hit();
      if (z.hp <= 0) killZombie(z);
      else say('HIT · INFECTED STAGGERS');
    } else {
      const a = target.obj;
      a.hp -= dmg; a.state = 'flee'; a.alert = 1;
      SFX.hit();
      if (a.hp <= 0) killAnimal(a);
      else say('HIT · ANIMAL WOUNDED');
    }
    updateUI();
  }

  function shoot() {
    const name = player.gun;
    const d = ITEMS[name];
    if (!d) { say('NO FIREARM EQUIPPED'); return; }
    const cond = weaponCond(name);
    if (cond <= 0) { say('WEAPON JAMMED · USE A REPAIR KIT'); return; }
    const ammo = d.ammo;
    if (ammoCount(ammo) <= 0) { say('NO ' + ammo.toUpperCase() + ' LEFT'); SFX.quietShot(); return; }
    removeItem(ammo, 1);
    player.condition[name] = Math.max(0, cond - .45);
    player.noise = d.noise;
    stats.shots++;
    const target = findTarget(d.range, .62);
    const endX = target ? target.obj.x : player.x + Math.cos(player.face) * d.range;
    const endY = target ? target.obj.y : player.y + Math.sin(player.face) * d.range;
    tracers.push({ x1: player.x, y1: player.y, x2: endX, y2: endY, life: .13 });
    particles.push({ x: player.x + Math.cos(player.face) * 20, y: player.y + Math.sin(player.face) * 20, vx: 0, vy: 0, life: .1, max: .1, color: '#ffe6a5', size: 6 });
    shake = Math.min(13, shake + 7);
    SFX.shot();
    alertZombies(950);
    if (target) {
      let dmg = d.dmg;
      if (target.kind === 'zombie') {
        const z = target.obj;
        if (z.variant === 'armored') dmg *= .75;
        z.hp -= dmg; z.state = 'chase'; z.tx = player.x; z.ty = player.y; z.alert = 6;
        particles.push({ x: z.x, y: z.y, vx: rnd(-60, 60), vy: rnd(-60, 60), life: .45, max: .45, color: '#9b3c32', size: 4 });
        if (z.hp <= 0) killZombie(z);
        else say('HIT · ' + Math.round(dmg) + ' DAMAGE');
      } else {
        target.obj.hp -= dmg;
        if (target.obj.hp <= 0) killAnimal(target.obj);
        else say('HIT · ANIMAL WOUNDED');
      }
    } else say('SHOT FIRED · NO CONTACT');
    updateUI();
  }

  function alertZombies(radius) {
    for (const z of zombies) {
      if (dist(z, player) < radius) {
        z.state = 'chase'; z.alert = 5; z.tx = player.x; z.ty = player.y;
      }
    }
  }

  function killZombie(z) {
    const i = zombies.indexOf(z);
    if (i < 0) return;
    zombies.splice(i, 1);
    stats.kills++;
    SFX.hit();
    for (let k = 0; k < 7; k++) particles.push({ x: z.x, y: z.y, vx: rnd(-70, 70), vy: rnd(-70, 70), life: rnd(.25, .6), max: .6, color: k % 2 ? '#8e3b31' : '#424b3a', size: rnd(2, 4) });
    if (chance(.42)) {
      const drop = pick(['Bandage', 'Cloth', '9mm rounds', 'Canned beans', 'Water bottle', 'Scrap metal']);
      loot.push({ x: z.x + rnd(-12, 12), y: z.y + rnd(-12, 12), item: drop, kind: ITEMS[drop]?.cat || 'misc', weight: ITEMS[drop]?.w || .2, taken: false, dropped: true });
    }
    say('INFECTED DOWN');
  }

  function killAnimal(a) {
    const i = animals.indexOf(a);
    if (i < 0) return;
    animals.splice(i, 1);
    const yields = { deer: 2, boar: 3, rabbit: 1, wolf: 1 }[a.type] || 1;
    let got = 0;
    for (let k = 0; k < yields; k++) if (addItem('Raw meat', 1, true)) got++;
    if (a.type === 'wolf') addItem('Cloth', 1, true);
    for (let k = 0; k < 5; k++) particles.push({ x: a.x, y: a.y, vx: rnd(-50, 50), vy: rnd(-50, 50), life: .4, max: .4, color: '#8c3a30', size: 3 });
    say(got ? `+ RAW MEAT · ${got}` : 'PACK FULL · MEAT LEFT BEHIND');
  }

  /* ---------------- building, fire, storage, vehicles ---------------- */

  function canPlace(x, y, w, h) {
    if (x - w / 2 < 60 || x + w / 2 > WORLD.w - 60 || y - h / 2 < 60 || y + h / 2 > WORLD.h - 60) return false;
    if (lakeAmount(x, y) < 1.2) return false;
    for (const b of buildings) if (x + w / 2 > b.x - 12 && x - w / 2 < b.x + b.w + 12 && y + h / 2 > b.y - 12 && y - h / 2 < b.y + b.h + 12) return false;
    for (const s of structures) if (Math.abs(x - s.x) < (w + s.w) / 2 + 12 && Math.abs(y - s.y) < (h + s.h) / 2 + 12) return false;
    for (const v of vehicles) if (Math.hypot(x - v.x, y - v.y) < 48) return false;
    return true;
  }

  function buildStructure(type) {
    const def = BUILDS.find(b => b.type === type); if (!def) return;
    if (player.driving) { say('PARK THE VEHICLE FIRST'); return; }
    if (!affordable(def.cost)) { say('NOT ENOUGH MATERIALS'); return; }
    const x = player.x + Math.cos(player.face) * 62;
    const y = player.y + Math.sin(player.face) * 62;
    let w = def.w || 60, h = def.h || 60;
    if (type === 'wall') {
      if (Math.abs(Math.cos(player.face)) > Math.abs(Math.sin(player.face))) { w = 18; h = 80; }
      else { w = 80; h = 18; }
    }
    if (!canPlace(x, y, w, h)) { say('CANNOT BUILD HERE'); return; }
    pay(def.cost);
    const hp = { campfire: 90, storage: 170, wall: 230, bedroll: 60, barricade: 130 }[type] || 100;
    structures.push({ id: 's' + (structureId++), type, x, y, w, h, hp, maxHp: hp, fuel: type === 'campfire' ? 100 : 0, items: {} });
    player.noise = Math.max(player.noise, .35);
    SFX.build();
    say(def.name.toUpperCase() + ' BUILT');
    closeModal();
    updateUI();
  }

  function fireAction(act, id) {
    const s = findStructure(id); if (!s || s.type !== 'campfire') return;
    if (act === 'fire-cook') {
      if (!removeItem('Raw meat', 1)) return;
      if (!addItem('Cooked meat', 1)) { addItem('Raw meat', 1, true); say('PACK FULL'); return; }
      say('MEAT COOKED OVER THE FIRE');
    } else if (act === 'fire-purify') {
      if (!removeItem('Water bottle', 1)) return;
      if (!addItem('Purified water', 1)) { addItem('Water bottle', 1, true); say('PACK FULL'); return; }
      say('WATER BOILED · SAFE TO DRINK');
    } else if (act === 'fire-refuel') {
      if (!removeItem('Wood', 1)) return;
      s.fuel = Math.min(100, s.fuel + 55);
      say('FIRE STOKED');
    } else if (act === 'fire-warm') {
      player.temp = Math.max(player.temp, 36.9);
      player.wetness = 0;
      player.fatigue = Math.max(0, player.fatigue - 6);
      say('WARMED BY THE FIRE');
    }
    SFX.build();
    renderModal(); updateUI();
  }

  function transferItem(direction, name, id) {
    if (direction === 'store' || direction === 'vstore') {
      const box = direction === 'store' ? findStructure(id) : findVehicle(id);
      if (!box || !box.items) return;
      const limit = direction === 'store' ? 40 : 35;
      const w = ITEMS[name]?.w || .2;
      if (storageWeight(box.items) + w > limit + .001) { say('STORAGE FULL'); return; }
      if (!removeItem(name, 1)) return;
      box.items[name] = (box.items[name] || 0) + 1;
      SFX.ui();
    } else {
      const box = direction === 'take' ? findStructure(id) : findVehicle(id);
      if (!box || !box.items || !box.items[name]) return;
      if (!addItem(name, 1)) return;
      box.items[name]--;
      if (box.items[name] <= 0) delete box.items[name];
      SFX.ui();
    }
    renderModal(); updateUI();
  }

  function vehicleAction(act, id) {
    const v = findVehicle(id); if (!v) return;
    if (act === 'v-battery') { if (!removeItem('Car battery', 1)) return; v.battery = true; say('BATTERY INSTALLED'); }
    else if (act === 'v-spark') { if (!removeItem('Spark plug', 1)) return; v.spark = true; say('SPARK PLUG INSTALLED'); }
    else if (act === 'v-fuel') { if (!removeItem('Fuel can', 1)) return; v.fuel = Math.min(100, v.fuel + 30); say('FUEL ADDED'); }
    else if (act === 'v-repair') { if (!removeItem('Repair kit', 1)) return; v.condition = Math.min(100, v.condition + 35); say('VEHICLE REPAIRED'); }
    else if (act === 'v-drive') {
      if (!(v.fuel > 0 && v.battery && v.spark && v.condition > 0)) { say('NOT ROADWORTHY'); return; }
      closeModal(); enterVehicle(v); return;
    }
    SFX.build(); renderModal(); updateUI();
  }

  function enterVehicle(v) {
    player.driving = v;
    player.x = v.x; player.y = v.y;
    player.crouch = false;
    player.noise = Math.max(player.noise, .7);
    if (v.fuel <= 0) { say('OUT OF FUEL'); return; }
    say('ENGINE RUNNING · E TO EXIT');
    SFX.build();
  }

  function exitVehicle() {
    const v = player.driving; if (!v) return;
    let ex = v.x + 40, ey = v.y;
    if (!canWalk(ex, ey)) { ex = v.x - 40; }
    if (!canWalk(ex, ey)) { ex = v.x; ey = v.y + 42; }
    player.driving = null;
    if (canWalk(ex, ey)) { player.x = ex; player.y = ey; }
    say('VEHICLE PARKED');
    SFX.ui();
  }

  function sleepAt() {
    if (zombies.some(z => dist(z, player) < 330 && z.state === 'chase')) { say('TOO DANGEROUS TO SLEEP'); return; }
    const sec = 70;
    advanceTime(sec);
    player.fatigue = 0;
    player.hp = Math.min(100, player.hp + 16);
    player.hunger = Math.max(0, player.hunger - 20);
    player.thirst = Math.max(0, player.thirst - 26);
    player.temp = 36.8;
    player.wetness = 0;
    player.conditions.cold = Math.max(0, player.conditions.cold - 40);
    player.conditions.bleeding = 0;
    stats.slept++;
    closeModal();
    say('YOU SLEPT · ' + fmtClock());
    updateUI();
  }

  function advanceTime(sec) {
    worldSeconds += sec;
    clock += sec / DAY_LENGTH * 24;
    while (clock >= 24) { clock -= 24; day++; }
    weatherTimer -= sec;
  }

  function repairStructure(id) {
    const s = findStructure(id); if (!s) return;
    if (s.hp >= s.maxHp) { say('STRUCTURE IS INTACT'); return; }
    if (!removeItem('Wood', 2)) { say('NEEDS 2 WOOD'); return; }
    s.hp = Math.min(s.maxHp, s.hp + 90);
    say('STRUCTURE REPAIRED'); SFX.build(); renderModal(); updateUI();
  }

  /* ---------------- collision & movement ---------------- */

  function inRect(x, y, r) { return x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h; }

  function canWalk(x, y) {
    if (x < 18 || x > WORLD.w - 18 || y < 18 || y > WORLD.h - 18) return false;
    for (const b of buildings) if (inRect(x, y, { x: b.x - 7, y: b.y - 7, w: b.w + 14, h: b.h + 14 })) return false;
    if (lakeAmount(x, y) < .93) return false;
    for (const s of structures) {
      if (s.type === 'bedroll' || s.type === 'barricade') continue;
      if (Math.abs(x - s.x) < s.w / 2 + 9 && Math.abs(y - s.y) < s.h / 2 + 9) return false;
    }
    if (!player.driving) for (const v of vehicles) if (Math.hypot(x - v.x, y - v.y) < 25) return false;
    return true;
  }

  function canZombieWalk(x, y, z) {
    if (x < 14 || x > WORLD.w - 14 || y < 14 || y > WORLD.h - 14) return false;
    for (const b of buildings) if (inRect(x, y, { x: b.x - 4, y: b.y - 4, w: b.w + 8, h: b.h + 8 })) return false;
    if (lakeAmount(x, y) < .95) return false;
    for (const s of structures) {
      if (s.type === 'bedroll') continue;
      if (Math.abs(x - s.x) < s.w / 2 + z.r && Math.abs(y - s.y) < s.h / 2 + z.r) return false;
    }
    for (const v of vehicles) if (Math.hypot(x - v.x, y - v.y) < 24 + z.r) return false;
    return true;
  }

  function updateMovement(dt) {
    if (player.driving) { player.moving = false; player.sprinting = false; return; }
    const kx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    const ky = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
    let dx = kx + joystick.x, dy = ky + joystick.y;
    const len = Math.hypot(dx, dy);
    player.moving = len > .14;
    player.sprinting = false;
    if (!player.moving) {
      player.noise = Math.max(0, player.noise - dt * .8);
      return;
    }
    dx /= Math.max(1, len); dy /= Math.max(1, len);
    player.face = Math.atan2(dy, dx);
    const wantSprint = (keys.ShiftLeft || keys.ShiftRight || joystick.run) && !player.crouch && player.stamina > 3;
    player.sprinting = wantSprint;
    let speed = 128;
    if (wantSprint) speed = 196;
    if (player.crouch) speed *= .52;
    if (weight() > cap() * .95) speed *= .9;
    if (player.temp < 35) speed *= .85;
    if (player.fatigue > 85) speed *= .92;
    const nx = player.x + dx * speed * dt, ny = player.y + dy * speed * dt;
    if (canWalk(nx, player.y)) player.x = nx;
    if (canWalk(player.x, ny)) player.y = ny;
    stats.distance += speed * dt;
    player.noise = Math.max(player.noise, player.crouch ? .035 : wantSprint ? .58 : .18);
    if (worldSeconds > nextStep) {
      SFX.step();
      nextStep = worldSeconds + (wantSprint ? .26 : .46);
    }
  }

  function toggleCrouch() {
    player.crouch = !player.crouch;
    say(player.crouch ? 'CROUCHED · QUIETER, SLOWER' : 'STANDING');
    SFX.ui();
  }

  /* ---------------- survival ---------------- */

  const heatNearby = () => structures.some(s => s.type === 'campfire' && s.fuel > 0 && dist(s, player) < 100);
  const nightNow = () => clock >= 20 || clock < 5.5;

  function updateSurvival(dt) {
    const heat = heatNearby();
    player.thirst = Math.max(0, player.thirst - dt * (.105 + (player.conditions.poisoning > 0 ? .045 : 0) + (player.temp > 37.6 ? .02 : 0)));
    player.hunger = Math.max(0, player.hunger - dt * .074);
    if (player.sprinting) player.stamina = Math.max(0, player.stamina - dt * 19);
    else {
      let rate = 11.5;
      if (player.fatigue > 70) rate *= .55;
      if (player.conditions.cold > 0) rate *= .72;
      if (player.infection > 50) rate *= .72;
      if (player.temp < 35) rate *= .55;
      if (player.hunger < 15 || player.thirst < 15) rate *= .65;
      player.stamina = clamp(player.stamina + dt * rate, 0, 100);
    }
    player.fatigue = clamp(player.fatigue + dt * (player.moving ? (player.sprinting ? .42 : .13) : -.04), 0, 100);

    if ((weather === 'RAIN' || weather === 'STORM') && !heat) player.wetness = clamp(player.wetness + dt * 1.5, 0, 100);
    player.wetness = clamp(player.wetness - dt * (heat ? 9 : .13), 0, 100);

    let target = 36.8;
    if (player.wetness > 25) target -= .75 * (player.wetness / 100);
    if (nightNow()) target -= .35;
    if (weather === 'RAIN' || weather === 'STORM') target -= .25;
    if (player.sprinting) target += .08;
    if (heat) target = 37.0;
    player.temp += (target - player.temp) * dt * .055;

    if (player.conditions.bleeding > 0) {
      player.blood = Math.max(0, player.blood - dt * 1.3);
      player.hp = Math.max(0, player.hp - dt * .34);
      if (chance(dt * .18)) particles.push({ x: player.x + rnd(-6, 6), y: player.y + rnd(-6, 6), vx: 0, vy: 15, life: .4, max: .4, color: '#8e3b31', size: 2 });
    } else player.blood = Math.min(100, player.blood + dt * .07);

    if (player.infection > 0) {
      player.infection = Math.min(100, player.infection + dt * .032);
      if (player.infection > 50) player.hp = Math.max(0, player.hp - dt * .055);
      if (player.infection > 50) player.temp = Math.max(player.temp, 37.6);
    }
    if (player.conditions.poisoning > 0) {
      player.conditions.poisoning = Math.max(0, player.conditions.poisoning - dt * .55);
      player.hp = Math.max(0, player.hp - dt * .06);
    }
    if (player.conditions.cold > 0) player.conditions.cold = Math.max(0, player.conditions.cold - dt * .22);
    if (player.temp < 35) player.hp = Math.max(0, player.hp - dt * .14);
    if (player.temp < 35.5 && player.conditions.cold <= 0 && player.wetness > 40 && chance(dt * .045)) {
      player.conditions.cold = 100;
      say('YOU HAVE CAUGHT A COLD');
    }
    if (player.thirst <= 0) player.hp = Math.max(0, player.hp - dt * .42);
    else if (player.thirst < 15) player.hp = Math.max(0, player.hp - dt * .07);
    if (player.hunger <= 0) player.hp = Math.max(0, player.hp - dt * .26);
    if (player.conditions.bleeding <= 0 && player.infection < 20 && player.hunger > 30 && player.thirst > 30 && player.hp > 0) {
      player.hp = Math.min(100, player.hp + dt * .1);
    }
    if (player.hp <= 0) {
      let cause = 'Your injuries were too severe.';
      if (player.thirst <= 0) cause = 'Dehydration finally took you.';
      else if (player.hunger <= 0) cause = 'Starvation finally took you.';
      else if (player.temp < 34) cause = 'Hypothermia stopped your heart.';
      else if (player.conditions.bleeding > 0) cause = 'You bled out in the quiet.';
      else if (player.infection > 70) cause = 'The infection claimed you.';
      die(cause);
    }
  }

  /* ---------------- zombies ---------------- */

  const ZTYPE = {
    walker: { hp: 55, speed: 36, sight: 300, hearing: 230, dmg: 8, r: 11, color: '#68775d' },
    runner: { hp: 36, speed: 92, sight: 380, hearing: 310, dmg: 6, r: 10, color: '#7a6a4f' },
    brute: { hp: 155, speed: 30, sight: 280, hearing: 220, dmg: 17, r: 15, color: '#5d5a4c' },
    armored: { hp: 110, speed: 33, sight: 300, hearing: 240, dmg: 10, r: 12, color: '#5b6458', resist: .45 },
    screamer: { hp: 46, speed: 46, sight: 350, hearing: 340, dmg: 5, r: 10, color: '#7d5a5f', screamer: true }
  };

  function spawnZombieAt(x, y, variant) {
    const t = ZTYPE[variant] || ZTYPE.walker;
    const z = {
      x, y, r: t.r, hp: t.hp, maxHp: t.hp, variant, speed: t.speed, sight: t.sight, hearing: t.hearing,
      dmg: t.dmg, resist: t.resist || 0, screamer: !!t.screamer, state: 'idle', angle: rand() * TAU,
      alert: 0, cd: 0, wanderT: rand() * 4, walking: false, wanderDir: rand() * TAU, screamCd: 0, anim: rand() * 6
    };
    zombies.push(z);
    return z;
  }

  function moveZombie(z, dx, dy) {
    const nx = z.x + dx, ny = z.y + dy;
    if (canZombieWalk(nx, ny, z)) { z.x = nx; z.y = ny; return; }
    if (canZombieWalk(nx, z.y, z)) { z.x = nx; return; }
    if (canZombieWalk(z.x, ny, z)) { z.y = ny; return; }
    if (z.state === 'chase' && z.cd <= 0) {
      const s = structures.filter(st => st.type !== 'bedroll' && Math.abs(player.x - st.x) < 260 && Math.abs(player.y - st.y) < 260)
        .sort((a, b) => dist(a, z) - dist(b, z))[0];
      if (s && dist(s, z) < 82) {
        s.hp -= 7; z.cd = .9;
        SFX.hit();
        particles.push({ x: s.x, y: s.y, vx: rnd(-40, 40), vy: rnd(-40, 40), life: .35, max: .35, color: '#7d6a4b', size: 3 });
        if (s.hp <= 0) {
          structures = structures.filter(x => x !== s);
          say((s.type === 'campfire' ? 'THE FIRE WAS KICKED APART' : 'A STRUCTURE COLLAPSED'));
        }
      }
    }
  }

  function attackPlayer(z) {
    z.cd = 1.15;
    player.noise = 1.2;
    const dmg = z.dmg * (player.crouch ? .9 : 1);
    hurt(dmg, 'The infected overwhelmed you.', true);
    SFX.zombie();
    say('THE INFECTED HIT YOU');
    if (z.variant === 'brute') shake = 14;
  }

  function updateZombies(dt) {
    for (let i = zombies.length - 1; i >= 0; i--) {
      const z = zombies[i];
      z.alert = Math.max(0, z.alert - dt);
      z.cd = Math.max(0, z.cd - dt);
      z.screamCd = Math.max(0, (z.screamCd || 0) - dt);
      z.anim += dt * (z.state === 'chase' ? 9 : 3);
      const d = dist(z, player);
      if (d > 1900) { zombies.splice(i, 1); continue; }
      if (player.driving) {
        if (d < 40) {
          const v = player.driving;
          z.hp -= 150 * dt;
          v.condition = Math.max(0, v.condition - dt * 1.5);
          if (z.hp <= 0) { killZombie(z); shake = Math.max(shake, 7); }
          continue;
        }
      }
      let sees = false;
      if (d < z.sight * (player.crouch ? .6 : 1) * (weather === 'FOG' ? .65 : 1)) {
        const toP = Math.atan2(player.y - z.y, player.x - z.x);
        if (Math.abs(angleDiff(toP, z.angle)) < 1.18 || d < 72) sees = true;
      }
      const hears = d < z.hearing * Math.min(2.3, player.noise) + 40 && player.noise > .12;
      if (sees || hears) {
        if (z.state !== 'chase') {
          z.alert = 5;
          if (z.screamer && z.screamCd <= 0) {
            z.screamCd = 11;
            tone(520, .5, .07, 'sawtooth'); tone(760, .5, .05, 'sawtooth');
            for (const o of zombies) if (o !== z && dist(o, z) < 640) { o.state = 'chase'; o.alert = 4; o.tx = player.x; o.ty = player.y; }
            say('A SCREAM ECHOES ACROSS THE COUNTY');
          }
        }
        z.state = 'chase'; z.tx = player.x; z.ty = player.y;
        z.alert = Math.max(z.alert, 1.4);
      }
      if (z.state === 'chase') {
        if (d > 760 && z.alert <= 0) { z.state = 'search'; z.searchT = 6; }
        else if (d > z.r + player.r + 7) {
          const a = Math.atan2(player.y - z.y, player.x - z.x);
          const sp = z.speed * (d < 90 ? 1.22 : 1);
          z.angle = a;
          moveZombie(z, Math.cos(a) * sp * dt, Math.sin(a) * sp * dt);
        }
        if (d < z.r + player.r + 9 && z.cd <= 0 && !player.driving) attackPlayer(z);
      } else if (z.state === 'search') {
        const sd = Math.hypot(z.tx - z.x, z.ty - z.y);
        if (sd > 30) {
          const a = Math.atan2(z.ty - z.y, z.tx - z.x);
          z.angle = a;
          moveZombie(z, Math.cos(a) * z.speed * .7 * dt, Math.sin(a) * z.speed * .7 * dt);
        } else {
          z.searchT -= dt; z.angle += dt * 1.7;
          if (z.searchT <= 0) z.state = 'idle';
        }
      } else {
        z.wanderT -= dt;
        if (z.wanderT <= 0) { z.wanderT = 2 + rand() * 6; z.wanderDir = rand() * TAU; z.walking = chance(.5); }
        if (z.walking) {
          z.angle = z.wanderDir;
          moveZombie(z, Math.cos(z.wanderDir) * z.speed * .32 * dt, Math.sin(z.wanderDir) * z.speed * .32 * dt);
        }
      }
    }
    for (let i = 0; i < zombies.length; i++) {
      for (let j = i + 1; j < zombies.length; j++) {
        const a = zombies[i], b = zombies[j];
        const d = dist(a, b), min = a.r + b.r - 2;
        if (d > 0 && d < min) {
          const push = (min - d) * .5;
          const ang = Math.atan2(b.y - a.y, b.x - a.x);
          a.x -= Math.cos(ang) * push; a.y -= Math.sin(ang) * push;
          b.x += Math.cos(ang) * push; b.y += Math.sin(ang) * push;
        }
      }
    }
  }

  /* ---------------- wildlife ---------------- */

  const ATYPE = {
    deer: { hp: 46, speed: 128, r: 12, dmg: 0, flee: 250, color: '#8a7156' },
    rabbit: { hp: 12, speed: 118, r: 5, dmg: 0, flee: 190, color: '#9a8f7a' },
    boar: { hp: 85, speed: 84, r: 13, dmg: 12, flee: 0, color: '#51453c' },
    wolf: { hp: 55, speed: 118, r: 10, dmg: 8, flee: 0, color: '#6f746c' }
  };

  function spawnAnimalAt(x, y, type) {
    const t = ATYPE[type] || ATYPE.deer;
    animals.push({ x, y, type, r: t.r, hp: t.hp, maxHp: t.hp, speed: t.speed, dmg: t.dmg, state: 'idle', angle: rand() * TAU, dir: rand() * TAU, wanderT: rand() * 4, cd: 0, anim: rand() * 5 });
  }

  function updateAnimals(dt) {
    for (let i = animals.length - 1; i >= 0; i--) {
      const a = animals[i];
      const d = dist(a, player);
      if (d > 1700 || a.hp <= 0) { animals.splice(i, 1); continue; }
      a.cd = Math.max(0, a.cd - dt);
      a.anim += dt * (a.state === 'idle' ? 2 : 7);
      const t = ATYPE[a.type];
      if (d < t.flee) a.state = 'flee';
      else if ((a.type === 'wolf' || a.type === 'boar') && d < (a.type === 'wolf' ? (nightNow() ? 330 : 230) : 170)) a.state = 'aggro';
      else if (d > (t.flee || 200) + 180) a.state = 'idle';
      if (a.state === 'flee') {
        a.angle = Math.atan2(a.y - player.y, a.x - player.x);
        a.x += Math.cos(a.angle) * a.speed * dt;
        a.y += Math.sin(a.angle) * a.speed * dt;
      } else if (a.state === 'aggro') {
        a.angle = Math.atan2(player.y - a.y, player.x - a.x);
        if (d > a.r + player.r + 4) {
          a.x += Math.cos(a.angle) * a.speed * dt;
          a.y += Math.sin(a.angle) * a.speed * dt;
        } else if (a.cd <= 0) {
          a.cd = 1.5;
          hurt(a.dmg, 'A wild animal mauled you.', true);
          SFX.zombie();
          say(a.type === 'wolf' ? 'THE WOLF BITES' : 'THE BOAR CHARGES');
        }
      } else {
        a.wanderT -= dt;
        if (a.wanderT <= 0) { a.wanderT = 2 + rand() * 5; a.dir = rand() * TAU; }
        a.angle = a.dir;
        a.x += Math.cos(a.dir) * 18 * dt;
        a.y += Math.sin(a.dir) * 18 * dt;
      }
      a.x = clamp(a.x, 30, WORLD.w - 30);
      a.y = clamp(a.y, 30, WORLD.h - 30);
    }
    if (animals.length < 14) {
      animalTimer -= dt;
      if (animalTimer <= 0) {
        animalTimer = 22;
        for (let tries = 0; tries < 14; tries++) {
          const x = rnd(80, WORLD.w - 80), y = rnd(80, WORLD.h - 80);
          if (lakeAmount(x, y) < 1.1 || buildings.some(b => inRect(x, y, b))) continue;
          if (Math.hypot(x - player.x, y - player.y) < 550) continue;
          spawnAnimalAt(x, y, pick(['deer', 'deer', 'rabbit', 'rabbit', 'boar', 'wolf']));
          break;
        }
      }
    }
  }

  /* ---------------- vehicles ---------------- */

  function driveBlocked(x, y) {
    if (x < 40 || x > WORLD.w - 40 || y < 40 || y > WORLD.h - 40) return true;
    if (lakeAmount(x, y) < 1.03) return true;
    for (const b of buildings) if (inRect(x, y, { x: b.x - 30, y: b.y - 30, w: b.w + 60, h: b.h + 60 })) return true;
    for (const s of structures) {
      if (s.type === 'bedroll' || s.type === 'barricade') continue;
      if (Math.abs(x - s.x) < s.w / 2 + 26 && Math.abs(y - s.y) < s.h / 2 + 26) return true;
    }
    return false;
  }

  function updateVehicles(dt) {
    for (const v of vehicles) {
      if (player.driving === v) {
        const kx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
        const ky = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
        let dx = kx + joystick.x, dy = ky + joystick.y;
        const len = Math.hypot(dx, dy);
        const moving = len > .14;
        if (moving) {
          dx /= Math.max(1, len); dy /= Math.max(1, len);
          v.angle = Math.atan2(dy, dx);
        }
        const speed = (v.fuel > 0 ? 205 : 0) * (.55 + v.condition / 200);
        if (moving && v.fuel > 0) {
          const nx = v.x + dx * speed * dt, ny = v.y + dy * speed * dt;
          if (!driveBlocked(nx, ny)) {
            v.x = nx; v.y = ny;
            stats.distance += speed * dt;
            stats.drove += speed * dt;
          } else {
            v.condition = Math.max(0, v.condition - dt * 5);
            shake = Math.max(shake, 8);
          }
          v.fuel = Math.max(0, v.fuel - dt * .74);
          player.noise = Math.max(player.noise, .95);
          if (v.fuel <= 0) say('THE ENGINE COUGHS AND DIES');
        } else if (!moving) {
          v.fuel = Math.max(0, v.fuel - dt * .04);
        }
        player.x = v.x; player.y = v.y;
        player.face = v.angle;
        player.moving = moving;
        player.sprinting = false;
        if (v.condition <= 0) { say('THE VEHICLE IS WRECKED'); exitVehicle(); }
      } else {
        v.angle = v.angle || 0;
      }
    }
  }

  /* ---------------- structures / weather / notes ---------------- */

  function updateStructures(dt) {
    for (let i = structures.length - 1; i >= 0; i--) {
      const s = structures[i];
      if (s.type === 'campfire') {
        if (s.fuel > 0) s.fuel = Math.max(0, s.fuel - dt * .33);
      }
      if (s.type === 'barricade') {
        for (let j = zombies.length - 1; j >= 0; j--) {
          const z = zombies[j];
          if (dist(z, s) < 50) {
            z.hp -= dt * 16;
            if (z.hp <= 0) killZombie(z);
          }
        }
      }
      if (s.hp <= 0) {
        structures.splice(i, 1);
        say('A STRUCTURE WAS DESTROYED');
      }
    }
  }

  function updateWeather(dt) {
    weatherTimer -= dt;
    if (weatherTimer <= 0) {
      const next = pick(['CLEAR', 'CLEAR', 'OVERCAST', 'RAIN', 'RAIN', 'FOG', 'STORM']);
      if (next !== weather) {
        weather = next;
        weatherTimer = 100 + rand() * 130;
        say('WEATHER · ' + weather);
        setRainAudio();
        if (weather === 'STORM') thunderTimer = 3;
      } else weatherTimer = 80;
    }
    if (weather === 'STORM') {
      thunderTimer -= dt;
      if (thunderTimer <= 0) { thunderTimer = 11 + rand() * 18; flash = 1; SFX.thunder(); }
    }
    flash = Math.max(0, flash - dt * 2.4);
  }

  function updateNotes() {
    for (const n of NOTES) {
      if (!noteSeen[n.id] && n.check()) {
        noteSeen[n.id] = true;
        say('FIELD NOTE COMPLETE · ' + n.title.replace('.', ''));
        SFX.pickup();
      }
    }
  }

  function update(dt) {
    if (!playing || paused || dead) return;
    worldSeconds += dt;
    const prevClock = clock;
    clock += dt * (24 / DAY_LENGTH);
    if (clock >= 24) { clock -= 24; day++; say('DAY ' + day); }
    const night = nightNow();
    if (night) wasNight = true;
    if (!night && wasNight && clock >= 5.5 && clock < 12) { wasNight = false; stats.survivedNight = true; }
    updateMovement(dt);
    updateVehicles(dt);
    updateSurvival(dt);
    updateZombies(dt);
    updateAnimals(dt);
    updateStructures(dt);
    updateWeather(dt);
    if (!dead) {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]; p.life -= dt;
        p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt;
        if (p.life <= 0) particles.splice(i, 1);
      }
      for (let i = tracers.length - 1; i >= 0; i--) { tracers[i].life -= dt; if (tracers[i].life <= 0) tracers.splice(i, 1); }
      for (const t of trees) if (t.chopped && t.regrow <= worldSeconds) t.chopped = false;
      updateNotes();
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawnTimer = 8;
        const capZ = night ? 36 : 30;
        if (zombies.length < capZ) {
          for (let tries = 0; tries < 12; tries++) {
            const x = rnd(80, WORLD.w - 80), y = rnd(80, WORLD.h - 80);
            if (lakeAmount(x, y) < 1.08) continue;
            if (buildings.some(b => inRect(x, y, b))) continue;
            const d = Math.hypot(x - player.x, y - player.y);
            if (d < 620 || d > 1150) continue;
            const roll = rand();
            const variant = roll < .55 ? 'walker' : roll < .8 ? 'runner' : roll < .88 ? 'brute' : roll < .97 ? 'armored' : 'screamer';
            spawnZombieAt(x, y, variant);
            break;
          }
        }
      }
      uiTimer += dt;
      if (uiTimer > .12) { uiTimer = 0; updateUI(); updateHint(); }
      saveTimer += dt;
      if (saveTimer > 20) { saveTimer = 0; saveGame(false); }
    }
  }

  function updateHint() {
    const hint = $('#interaction-hint');
    if (!hint) return;
    if (!playing || paused || dead) { hint.classList.remove('show'); return; }
    const n = nearestInteraction();
    hint.classList.toggle('show', !!n);
    hint.classList.toggle('vehicle', !!n && (n.kind === 'vehicle' || n.kind === 'vehicle-exit'));
    $('#hint-key').textContent = n && n.kind === 'vehicle-exit' ? 'E' : 'E';
    if (n) $('#hint-text').textContent = n.text.toUpperCase();
  }

  /* ============================================================
     RENDERING
     ============================================================ */

  const canvas = $('#world'), ctx = canvas.getContext('2d');
  const FIELDS = { x: 690, y: 700, w: 330, h: 300 };
  const ROADS = [
    { pts: [[-100, 1280], [400, 1262], [900, 1252], [1400, 1240], [1900, 1230], [2400, 1200], [2900, 1120], [3700, 1075]], w: 80, main: true },
    { pts: [[1480, -80], [1462, 400], [1422, 800], [1400, 1240], [1382, 1600], [1360, 2100], [1340, 2880]], w: 58, main: true },
    { pts: [[1400, 1240], [1150, 1120], [950, 1010], [760, 980]], w: 44 },
    { pts: [[1380, 1500], [1750, 1620], [2150, 1720], [2560, 1780], [2900, 1900]], w: 48 },
    { pts: [[2900, 1900], [2900, 2090]], w: 40 }
  ];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, quality === 'low' ? 1 : quality === 'medium' ? 1.5 : 2);
    W = canvas.clientWidth || window.innerWidth;
    H = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lightCanvas = document.createElement('canvas');
    lightCanvas.width = Math.max(1, Math.floor(W));
    lightCanvas.height = Math.max(1, Math.floor(H));
    lightCtx = lightCanvas.getContext('2d');
  }

  function applyQuality() {
    document.body.classList.toggle('q-low', quality === 'low');
    resize();
  }

  function pathLine(points, color, width, dash) {
    ctx.beginPath();
    points.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (dash) ctx.setLineDash(dash);
    ctx.stroke();
    if (dash) ctx.setLineDash([]);
  }

  function drawGround() {
    ctx.fillStyle = '#3f4a39';
    ctx.fillRect(0, 0, WORLD.w, WORLD.h);
    for (const d of decor) {
      if (d.x < cam.x - 200 || d.x > cam.x + W / zoom + 200 || d.y < cam.y - 200 || d.y > cam.y + H / zoom + 200) continue;
      if (d.kind === 'patch') {
        ctx.fillStyle = d.tone > .5 ? '#5c684733' : '#1c2a2033';
        ctx.beginPath(); ctx.ellipse(d.x, d.y, d.rx, d.ry, d.rot, 0, TAU); ctx.fill();
      } else if (d.kind === 'rock') {
        ctx.fillStyle = '#00000033'; ctx.beginPath(); ctx.ellipse(d.x + 3, d.y + 4, d.rx, d.ry * .6, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#737565'; ctx.beginPath(); ctx.ellipse(d.x, d.y, d.rx, d.ry, d.rot, 0, TAU); ctx.fill();
        ctx.fillStyle = '#8b8d7b66'; ctx.beginPath(); ctx.ellipse(d.x - d.rx * .25, d.y - d.ry * .3, d.rx * .45, d.ry * .4, d.rot, 0, TAU); ctx.fill();
      }
    }
  }

  function drawWater() {
    // beach ring
    ctx.fillStyle = '#8b8064';
    ctx.beginPath(); ctx.ellipse(LAKE.x, LAKE.y, LAKE.rx + 28, LAKE.ry + 25, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#93885f';
    ctx.beginPath(); ctx.ellipse(LAKE.x, LAKE.y, LAKE.rx + 12, LAKE.ry + 10, 0, 0, TAU); ctx.fill();
    pathLine(RIVER, '#2e4b48', 34);
    pathLine(RIVER, '#3a5955', 26);
    ctx.fillStyle = '#31504d';
    ctx.beginPath(); ctx.ellipse(LAKE.x, LAKE.y, LAKE.rx, LAKE.ry, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3a5b57';
    ctx.beginPath(); ctx.ellipse(LAKE.x - 24, LAKE.y - 18, LAKE.rx * .8, LAKE.ry * .78, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#9db5a955'; ctx.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      const rx = LAKE.rx * (.3 + i * .1), ry = LAKE.ry * (.3 + i * .1);
      ctx.beginPath();
      ctx.ellipse(LAKE.x + Math.sin(gameTime * .3 + i) * 5, LAKE.y + Math.cos(gameTime * .25 + i) * 4, rx, ry * .12, i, 0, Math.PI * 1.1);
      ctx.stroke();
    }
  }

  function drawFields() {
    ctx.fillStyle = '#5b563c';
    ctx.fillRect(FIELDS.x, FIELDS.y, FIELDS.w, FIELDS.h);
    ctx.strokeStyle = '#6f6845'; ctx.lineWidth = 1;
    for (let y = FIELDS.y + 12; y < FIELDS.y + FIELDS.h; y += 13) {
      ctx.beginPath(); ctx.moveTo(FIELDS.x + 6, y); ctx.lineTo(FIELDS.x + FIELDS.w - 6, y); ctx.stroke();
    }
    ctx.strokeStyle = '#3f4a2e';
    for (let x = FIELDS.x + 10; x < FIELDS.x + FIELDS.w; x += 26) {
      for (let y = FIELDS.y + 14; y < FIELDS.y + FIELDS.h; y += 13) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 5, y - 7); ctx.stroke();
      }
    }
    ctx.strokeStyle = '#a0946b55'; ctx.lineWidth = 3;
    ctx.strokeRect(FIELDS.x + 2, FIELDS.y + 2, FIELDS.w - 4, FIELDS.h - 4);
  }

  function drawRoads() {
    for (const r of ROADS) {
      pathLine(r.pts, '#6f6853', r.w + 8);
      pathLine(r.pts, '#a49a7b', r.w);
      if (r.main) pathLine(r.pts, '#d8cfa966', 2, [12, 16]);
    }
  }

  const BCOL = {
    market: '#8a8068', store: '#847d69', pharmacy: '#7c887c', police: '#6f7a78', clinic: '#7a8478',
    house: '#827d69', barn: '#8b6a52', industrial: '#77756a', military: '#706d58', bunker: '#666b5e',
    cabin: '#7d6a52', gas: '#7a7c6c'
  };

  function drawBuilding(b) {
    if (b.x > cam.x + W / zoom + 100 || b.x + b.w < cam.x - 100 || b.y > cam.y + H / zoom + 100 || b.y + b.h < cam.y - 100) return;
    const wall = BCOL[b.type] || '#827d69';
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.fillStyle = '#00000044'; ctx.fillRect(10, 14, b.w, b.h);
    ctx.fillStyle = '#252c25'; ctx.fillRect(0, 0, b.w, b.h);
    ctx.fillStyle = wall; ctx.fillRect(5, 5, b.w - 10, b.h - 10);
    ctx.fillStyle = '#ffffff12'; ctx.fillRect(8, 8, b.w - 16, 14);
    ctx.fillStyle = '#00000030'; ctx.fillRect(8, b.h - 22, b.w - 16, 14);
    ctx.strokeStyle = '#00000026'; ctx.lineWidth = 1;
    for (let x = 18; x < b.w - 8; x += 22) { ctx.beginPath(); ctx.moveTo(x, 10); ctx.lineTo(x, b.h - 10); ctx.stroke(); }
    // roof fixtures
    ctx.fillStyle = '#5b6659'; ctx.fillRect(b.w * .18, b.h * .22, 26, 18);
    ctx.fillStyle = '#495447'; ctx.fillRect(b.w * .18 + 3, b.h * .22 + 3, 20, 12);
    ctx.fillStyle = '#6b7566'; ctx.fillRect(b.w * .68, b.h * .55, 34, 22);
    ctx.fillStyle = '#3e483e'; ctx.fillRect(b.w * .68 + 4, b.h * .55 + 4, 26, 14);
    // door
    ctx.fillStyle = '#2d3228'; ctx.fillRect(b.w / 2 - 15, b.h - 26, 30, 26);
    ctx.fillStyle = '#4b4a38'; ctx.fillRect(b.w / 2 - 12, b.h - 23, 24, 23);
    ctx.fillStyle = '#c8e27b'; ctx.fillRect(b.w / 2 + 7, b.h - 15, 2, 2);
    // search crate marker
    if (b.searches > 0) {
      const pulse = 1 + Math.sin(gameTime * 3 + b.x) * .12;
      ctx.fillStyle = '#1e261c'; ctx.fillRect(b.w / 2 - 26, b.h + 4, 11, 8);
      ctx.strokeStyle = '#c8e27b'; ctx.lineWidth = 1; ctx.strokeRect(b.w / 2 - 26, b.h + 4, 11, 8);
      ctx.fillStyle = '#c8e27b' + '66';
      ctx.beginPath(); ctx.arc(b.w / 2 - 20.5, b.h + 8, 9 * pulse, 0, TAU); ctx.stroke();
    } else {
      ctx.fillStyle = '#30362e'; ctx.fillRect(b.w / 2 - 26, b.h + 4, 11, 8);
    }
    ctx.restore();
    if (dist({ x: b.x + b.w / 2, y: b.y + b.h / 2 }, player) < 560) {
      ctx.font = '9px "DM Mono", monospace'; ctx.textAlign = 'center';
      ctx.fillStyle = '#ebe6d2aa';
      ctx.fillText(b.name, b.x + b.w / 2, b.y - 10);
    }
  }

  function drawTree(t) {
    if (t.chopped) {
      ctx.fillStyle = '#3b3328'; ctx.beginPath(); ctx.arc(t.x, t.y, 5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#6b5a42'; ctx.beginPath(); ctx.arc(t.x, t.y - 1, 4, 0, TAU); ctx.fill();
      return;
    }
    const sway = Math.sin(gameTime * 1.2 + t.x * .012) * 2;
    ctx.fillStyle = '#00000044';
    ctx.beginPath(); ctx.ellipse(t.x + 5, t.y + 8, t.r * 1.1, t.r * .62, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#554f3d'; ctx.fillRect(t.x - 2, t.y - 1, 4, 11);
    ctx.fillStyle = t.tone > .5 ? '#293b2b' : '#34442d';
    ctx.beginPath(); ctx.arc(t.x + sway, t.y - 3, t.r, 0, TAU); ctx.fill();
    ctx.fillStyle = t.tone > .5 ? '#3c5137' : '#415237';
    ctx.beginPath(); ctx.arc(t.x - t.r * .26 + sway, t.y - t.r * .3, t.r * .6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#72805144';
    ctx.beginPath(); ctx.arc(t.x - t.r * .3 + sway, t.y - t.r * .32, t.r * .36, 0, TAU); ctx.fill();
  }

  function drawLoot(l) {
    if (l.taken) return;
    const pulse = 1 + Math.sin(gameTime * 3 + l.x) * .18;
    if (l.dropped) {
      ctx.fillStyle = '#6d5a3f'; ctx.fillRect(l.x - 4, l.y - 3, 8, 7);
      ctx.fillStyle = '#a58a5e'; ctx.fillRect(l.x - 4, l.y - 3, 8, 2);
      ctx.strokeStyle = '#d8c99b88'; ctx.strokeRect(l.x - 4, l.y - 3, 8, 7);
    } else {
      ctx.fillStyle = '#c8e27b';
      ctx.beginPath(); ctx.arc(l.x, l.y, 3, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#c8e27b77'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(l.x, l.y, 8 * pulse, 0, TAU); ctx.stroke();
    }
  }

  function drawStructure(s) {
    ctx.save(); ctx.translate(s.x, s.y);
    if (s.type === 'wall') {
      ctx.fillStyle = '#00000044'; ctx.fillRect(-s.w / 2 + 3, -s.h / 2 + 4, s.w, s.h);
      ctx.fillStyle = '#5d4a33'; ctx.fillRect(-s.w / 2, -s.h / 2, s.w, s.h);
      ctx.strokeStyle = '#3f3222'; ctx.lineWidth = 2;
      if (s.w > s.h) { for (let x = -s.w / 2 + 8; x < s.w / 2; x += 14) { ctx.beginPath(); ctx.moveTo(x, -s.h / 2); ctx.lineTo(x, s.h / 2); ctx.stroke(); } }
      else { for (let y = -s.h / 2 + 8; y < s.h / 2; y += 14) { ctx.beginPath(); ctx.moveTo(-s.w / 2, y); ctx.lineTo(s.w / 2, y); ctx.stroke(); } }
      ctx.fillStyle = '#8a806b'; ctx.fillRect(-s.w / 2, -s.h / 2, s.w, 3);
    } else if (s.type === 'storage') {
      ctx.fillStyle = '#00000044'; ctx.fillRect(-s.w / 2 + 3, -s.h / 2 + 4, s.w, s.h);
      ctx.fillStyle = '#6d5638'; ctx.fillRect(-s.w / 2, -s.h / 2, s.w, s.h);
      ctx.strokeStyle = '#43341f'; ctx.lineWidth = 3; ctx.strokeRect(-s.w / 2 + 2, -s.h / 2 + 2, s.w - 4, s.h - 4);
      ctx.beginPath(); ctx.moveTo(-s.w / 2 + 4, -s.h / 2 + 4); ctx.lineTo(s.w / 2 - 4, s.h / 2 - 4); ctx.moveTo(s.w / 2 - 4, -s.h / 2 + 4); ctx.lineTo(-s.w / 2 + 4, s.h / 2 - 4); ctx.stroke();
      ctx.fillStyle = '#c8e27b'; ctx.fillRect(-2, -2, 4, 4);
    } else if (s.type === 'campfire') {
      ctx.fillStyle = '#2f2a22'; ctx.beginPath(); ctx.arc(0, 0, 19, 0, TAU); ctx.fill();
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * TAU;
        ctx.fillStyle = i % 2 ? '#79796a' : '#62655a';
        ctx.beginPath(); ctx.arc(Math.cos(a) * 17, Math.sin(a) * 17, 4, 0, TAU); ctx.fill();
      }
      ctx.strokeStyle = '#4a3826'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(-9, 5); ctx.lineTo(9, -5); ctx.moveTo(-9, -5); ctx.lineTo(9, 5); ctx.stroke();
      if (s.fuel > 0) {
        const f = .75 + Math.sin(gameTime * 9) * .25;
        ctx.fillStyle = '#e08a3c'; ctx.beginPath(); ctx.moveTo(0, -13 * f); ctx.quadraticCurveTo(9, -2, 0, 6); ctx.quadraticCurveTo(-9, -2, 0, -13 * f); ctx.fill();
        ctx.fillStyle = '#f4d477'; ctx.beginPath(); ctx.moveTo(0, -7 * f); ctx.quadraticCurveTo(4, -1, 0, 4); ctx.quadraticCurveTo(-4, -1, 0, -7 * f); ctx.fill();
      } else {
        ctx.fillStyle = '#3a3a34'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill();
      }
    } else if (s.type === 'bedroll') {
      ctx.fillStyle = '#00000033'; ctx.fillRect(-s.w / 2 + 2, -s.h / 2 + 3, s.w, s.h);
      ctx.fillStyle = '#6b604c'; ctx.fillRect(-s.w / 2, -s.h / 2, s.w, s.h);
      ctx.fillStyle = '#8a7b60'; ctx.fillRect(-s.w / 2 + 4, -s.h / 2 + 4, s.w - 8, 6);
      ctx.fillStyle = '#b3a180'; ctx.fillRect(-s.w / 2 + 4, s.h / 2 - 9, s.w - 8, 5);
    } else if (s.type === 'barricade') {
      ctx.fillStyle = '#00000033'; ctx.fillRect(-s.w / 2 + 3, -s.h / 2 + 4, s.w, s.h);
      ctx.fillStyle = '#5d4a33'; ctx.fillRect(-s.w / 2, -s.h / 2 + 4, s.w, 9);
      for (let i = -s.w / 2 + 4; i < s.w / 2; i += 10) {
        ctx.fillStyle = '#8c7a5c';
        ctx.beginPath(); ctx.moveTo(i, s.h / 2 + 2); ctx.lineTo(i + 5, -s.h / 2 - 8); ctx.lineTo(i + 8, s.h / 2 + 2); ctx.fill();
      }
    }
    if (s.hp < s.maxHp) {
      ctx.fillStyle = '#00000099'; ctx.fillRect(-s.w / 2, -s.h / 2 - 9, s.w, 3);
      ctx.fillStyle = '#c8e27b'; ctx.fillRect(-s.w / 2, -s.h / 2 - 9, s.w * (s.hp / s.maxHp), 3);
    }
    ctx.restore();
  }

  function drawVehicle(v) {
    const dims = v.type === 'motorcycle' ? [24, 11] : v.type === 'pickup' ? [52, 27] : v.type === 'offroad' ? [50, 29] : [46, 23];
    ctx.save(); ctx.translate(v.x, v.y); ctx.rotate(v.angle || 0);
    ctx.fillStyle = '#00000055'; ctx.beginPath(); ctx.ellipse(2, 5, dims[0] * .55, dims[1] * .55, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#171b17';
    const wy = dims[1] / 2 - 1, wx = dims[0] / 2 - 7;
    ctx.fillRect(-wx - 4, -wy - 3, 10, 5); ctx.fillRect(wx - 5, -wy - 3, 10, 5);
    ctx.fillRect(-wx - 4, wy - 2, 10, 5); ctx.fillRect(wx - 5, wy - 2, 10, 5);
    const colors = { pickup: '#6d5844', sedan: '#5c6258', motorcycle: '#4f4639', offroad: '#5c6647' };
    ctx.fillStyle = colors[v.type] || '#5c6258';
    ctx.fillRect(-dims[0] / 2, -dims[1] / 2, dims[0], dims[1]);
    ctx.fillStyle = '#2b3f3e';
    if (v.type === 'motorcycle') {
      ctx.fillRect(-2, -3, 8, 6);
    } else {
      ctx.fillRect(dims[0] * .08, -dims[1] / 2 + 4, dims[0] * .18, dims[1] - 8);
      ctx.fillRect(-dims[0] * .34, -dims[1] / 2 + 4, dims[0] * .2, dims[1] - 8);
      ctx.fillStyle = '#39423a'; ctx.fillRect(-dims[0] * .16, -dims[1] / 2 + 4, dims[0] * .2, dims[1] - 8);
    }
    ctx.fillStyle = '#e2ddb8';
    ctx.fillRect(dims[0] / 2 - 3, -dims[1] / 2 + 3, 3, 4);
    ctx.fillRect(dims[0] / 2 - 3, dims[1] / 2 - 7, 3, 4);
    if (player.driving === v) {
      ctx.fillStyle = '#ffe6a5';
      ctx.fillRect(dims[0] / 2, -dims[1] / 2 + 2, 5, 3); ctx.fillRect(dims[0] / 2, dims[1] / 2 - 5, 5, 3);
    }
    if (v.condition < 55) { ctx.fillStyle = '#2b2721'; ctx.fillRect(-dims[0] * .1, -dims[1] * .2, 9, 7); }
    ctx.restore();
  }

  function drawZombie(z) {
    const t = ZTYPE[z.variant] || ZTYPE.walker;
    ctx.save(); ctx.translate(z.x, z.y); ctx.rotate(z.angle);
    ctx.fillStyle = '#00000055'; ctx.beginPath(); ctx.ellipse(2, 6, z.r * .9, z.r * .55, 0, 0, TAU); ctx.fill();
    const stride = Math.sin(z.anim) * 3;
    ctx.strokeStyle = '#2d3329'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(-7, 7 + stride); ctx.moveTo(-2, 0); ctx.lineTo(-9, -6 - stride); ctx.stroke();
    ctx.fillStyle = t.color;
    ctx.beginPath(); ctx.ellipse(0, 0, z.r * .78, z.r, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#9b7866';
    ctx.beginPath(); ctx.arc(z.r * .55, -2, z.r * .38, 0, TAU); ctx.fill();
    ctx.fillStyle = '#c64436'; ctx.fillRect(z.r * .82, -3, 2, 1.6);
    ctx.strokeStyle = t.color; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(1, -3); ctx.lineTo(z.r * .9, -8 + stride * .5); ctx.moveTo(1, 4); ctx.lineTo(z.r * .85, 9 - stride * .5); ctx.stroke();
    if (z.variant === 'armored') {
      ctx.fillStyle = '#7a8277'; ctx.fillRect(-z.r * .55, -z.r * .7, z.r * .7, z.r * 1.3);
      ctx.strokeStyle = '#3d443d'; ctx.lineWidth = 1; ctx.strokeRect(-z.r * .55, -z.r * .7, z.r * .7, z.r * 1.3);
    }
    if (z.variant === 'brute') { ctx.fillStyle = '#433f34'; ctx.fillRect(-z.r, -z.r * .45, z.r * .7, z.r * .9); }
    if (z.variant === 'screamer') { ctx.fillStyle = '#4a3035'; ctx.beginPath(); ctx.arc(z.r * .2, 0, z.r * .35, 0, TAU); ctx.fill(); }
    ctx.restore();
    if (z.alert > 0) {
      ctx.strokeStyle = '#e07f6b77'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(z.x, z.y, z.r + 8 + Math.sin(gameTime * 5) * 2, 0, TAU); ctx.stroke();
    }
    if (z.hp < z.maxHp) {
      ctx.fillStyle = '#000000aa'; ctx.fillRect(z.x - z.r, z.y - z.r - 10, z.r * 2, 3);
      ctx.fillStyle = '#b85446'; ctx.fillRect(z.x - z.r, z.y - z.r - 10, z.r * 2 * (z.hp / z.maxHp), 3);
    }
  }

  function drawAnimal(a) {
    ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.angle);
    ctx.fillStyle = '#00000044'; ctx.beginPath(); ctx.ellipse(2, 4, a.r, a.r * .5, 0, 0, TAU); ctx.fill();
    const t = ATYPE[a.type], stride = Math.sin(a.anim) * 3;
    ctx.strokeStyle = '#2f2c24'; ctx.lineWidth = 2;
    if (a.type !== 'rabbit') {
      ctx.beginPath(); ctx.moveTo(-2, 2); ctx.lineTo(-6, 9 + stride); ctx.moveTo(-2, -2); ctx.lineTo(-6, -9 - stride); ctx.stroke();
    }
    ctx.fillStyle = t.color;
    if (a.type === 'rabbit') {
      ctx.beginPath(); ctx.ellipse(0, 0, 6, 4.5, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(5, -1, 2.6, 0, TAU); ctx.fill();
      ctx.strokeStyle = t.color; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(4, -3); ctx.lineTo(3, -10); ctx.moveTo(5, -3); ctx.lineTo(6, -10); ctx.stroke();
    } else if (a.type === 'deer') {
      ctx.beginPath(); ctx.ellipse(0, 0, 11, 6, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(10, -2, 4, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#6f5a43'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(11, -5); ctx.lineTo(13, -11); ctx.moveTo(11, -5); ctx.lineTo(9, -11); ctx.stroke();
      ctx.fillStyle = '#c9bda3'; ctx.fillRect(-3, -2, 2, 2);
    } else if (a.type === 'boar') {
      ctx.beginPath(); ctx.ellipse(0, 0, 12, 8, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(10, 0, 5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#d8d1b8'; ctx.fillRect(13, 1, 3, 1.5);
    } else {
      ctx.beginPath(); ctx.ellipse(0, 0, 10, 5.5, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(9, -1, 4, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-8, -2); ctx.lineTo(-15, -7); ctx.lineTo(-9, 1); ctx.fill();
      ctx.fillStyle = '#c7bfa5'; ctx.fillRect(11, -2, 2, 2);
    }
    ctx.restore();
  }

  function drawPlayer() {
    ctx.save(); ctx.translate(player.x, player.y); ctx.rotate(player.face);
    const s = player.crouch ? .86 : 1;
    ctx.scale(s, s);
    ctx.fillStyle = '#00000066'; ctx.beginPath(); ctx.ellipse(2, 7, 11, 6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3b4a3c'; ctx.fillRect(-11, -6, 8, 12);
    ctx.fillStyle = '#27332d'; ctx.beginPath(); ctx.ellipse(0, 1, 9, 12, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#b8aa8a'; ctx.beginPath(); ctx.arc(0, -6, 5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#799071'; ctx.fillRect(-6, 0, 12, 8);
    ctx.fillStyle = '#c8e27b'; ctx.beginPath(); ctx.arc(3, -7, 1.4, 0, TAU); ctx.fill();
    const w = (selected === 1 && player.gun) ? player.gun : player.melee;
    if (w) {
      const d = ITEMS[w] || {};
      ctx.strokeStyle = '#b9b29a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(5, 5); ctx.lineTo(d.cat === 'gun' ? 22 : 16, 8); ctx.stroke();
      if (d.cat === 'gun') { ctx.fillStyle = '#4a4438'; ctx.fillRect(12, 6, 12, 3); }
      else { ctx.fillStyle = '#8c8776'; ctx.fillRect(14, 4, 5, 7); }
    }
    ctx.restore();
    if (player.flashlight) {
      ctx.save(); ctx.translate(player.x, player.y); ctx.rotate(player.face);
      ctx.fillStyle = '#ffe8a51a'; ctx.beginPath(); ctx.moveTo(8, -6); ctx.lineTo(120, -40); ctx.lineTo(120, 40); ctx.lineTo(8, 6); ctx.fill();
      ctx.restore();
    }
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size || 2, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const t of tracers) {
      ctx.globalAlpha = clamp(t.life / .13, 0, 1);
      ctx.strokeStyle = '#ffe6a5'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(t.x1, t.y1); ctx.lineTo(t.x2, t.y2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function dayLightLevel() {
    const h = clock;
    if (h >= 7 && h < 17.5) return 1;
    if (h >= 17.5 && h < 20) { const t = (h - 17.5) / 2.5; return 1 - t * t * (3 - 2 * t); }
    if (h >= 4.5 && h < 7) { const t = (h - 4.5) / 2.5; return t * t * (3 - 2 * t); }
    return 0;
  }

  function drawLighting() {
    const dayLight = dayLightLevel();
    let darkness = (1 - dayLight) * .56;
    if (weather === 'STORM' || weather === 'RAIN') darkness += .06;
    if (weather === 'FOG') darkness += .04;
    darkness = clamp(darkness, 0, .72);
    if (darkness <= .02) return;
    const l = lightCtx;
    l.clearRect(0, 0, W, H);
    l.fillStyle = `rgba(5,10,13,${darkness})`;
    l.fillRect(0, 0, W, H);
    l.globalCompositeOperation = 'destination-out';
    const sx = x => (x - cam.x) * zoom, sy = y => (y - cam.y) * zoom;
    const hole = (x, y, r) => {
      const g = l.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(0,0,0,.95)');
      g.addColorStop(.55, 'rgba(0,0,0,.55)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      l.fillStyle = g;
      l.beginPath(); l.arc(x, y, r, 0, TAU); l.fill();
    };
    hole(sx(player.x), sy(player.y), player.flashlight ? 270 * zoom : 155 * zoom);
    for (const s of structures) if (s.type === 'campfire' && s.fuel > 0) hole(sx(s.x), sy(s.y), (180 + Math.sin(gameTime * 8) * 8) * zoom);
    if (player.driving) {
      const v = player.driving;
      hole(sx(v.x + Math.cos(v.angle) * 110), sy(v.y + Math.sin(v.angle) * 110), 150 * zoom);
    }
    l.globalCompositeOperation = 'source-over';
    ctx.drawImage(lightCanvas, 0, 0, W, H);
  }

  function drawWeather() {
    if (weather === 'RAIN' || weather === 'STORM') {
      const n = quality === 'low' ? 35 : 85;
      ctx.strokeStyle = 'rgba(185,213,216,.22)'; ctx.lineWidth = 1;
      for (let i = 0; i < n; i++) {
        const x = (i * 97 + gameTime * 190) % (W + 40) - 20;
        const y = (i * 131 + gameTime * 310) % (H + 40) - 20;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 15); ctx.stroke();
      }
    }
    if (weather === 'FOG') {
      ctx.fillStyle = `rgba(163,178,168,${nightNow() ? .14 : .09})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (flash > 0) {
      ctx.fillStyle = `rgba(220,235,230,${flash * .28})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawVignette() {
    const danger = clamp((45 - player.hp) / 45, 0, 1) + (player.conditions.bleeding > 0 ? .22 : 0);
    if (danger > .02) {
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .28, W / 2, H / 2, Math.max(W, H) * .7);
      g.addColorStop(0, 'rgba(100,18,12,0)');
      g.addColorStop(1, `rgba(105,20,14,${clamp(danger * .6, 0, .55)})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    if (player.fatigue > 72) {
      ctx.fillStyle = `rgba(6,9,8,${(player.fatigue - 72) / 28 * .18})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawWorld(dt) {
    const targetZoom = (player.driving ? .82 : player.crouch ? 1.06 : 1) * zoomBias;
    zoom += (targetZoom - zoom) * Math.min(1, (dt || .016) * 4);
    const viewW = W / zoom, viewH = H / zoom;
    cam.x = clamp(player.x - viewW / 2, 0, Math.max(0, WORLD.w - viewW));
    cam.y = clamp(player.y - viewH / 2, 0, Math.max(0, WORLD.h - viewH));
    if (WORLD.w < viewW) cam.x = (WORLD.w - viewW) / 2;
    if (WORLD.h < viewH) cam.y = (WORLD.h - viewH) / 2;

    ctx.clearRect(0, 0, W, H);
    const sx = shake > 0 ? (rand() - .5) * shake : 0, sy = shake > 0 ? (rand() - .5) * shake : 0;
    shake = Math.max(0, shake - .5);
    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(-cam.x + sx, -cam.y + sy);

    drawGround();
    drawRoads();
    drawFields();
    drawWater();
    for (const b of buildings) drawBuilding(b);

    const view = { x0: cam.x - 120, y0: cam.y - 120, x1: cam.x + viewW + 120, y1: cam.y + viewH + 120 };
    const items = [];
    for (const t of trees) if (t.x > view.x0 && t.x < view.x1 && t.y > view.y0 && t.y < view.y1) items.push({ y: t.y, k: 'tree', o: t });
    for (const l of loot) if (!l.taken && l.x > view.x0 && l.x < view.x1 && l.y > view.y0 && l.y < view.y1) items.push({ y: l.y, k: 'loot', o: l });
    for (const s of structures) if (s.x > view.x0 && s.x < view.x1 && s.y > view.y0 && s.y < view.y1) items.push({ y: s.y, k: 'structure', o: s });
    for (const v of vehicles) if (v.x > view.x0 && v.x < view.x1 && v.y > view.y0 && v.y < view.y1) items.push({ y: v.y, k: 'vehicle', o: v });
    for (const z of zombies) if (z.x > view.x0 && z.x < view.x1 && z.y > view.y0 && z.y < view.y1) items.push({ y: z.y, k: 'zombie', o: z });
    for (const a of animals) if (a.x > view.x0 && a.x < view.x1 && a.y > view.y0 && a.y < view.y1) items.push({ y: a.y, k: 'animal', o: a });
    items.push({ y: player.y, k: 'player', o: player });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) {
      if (it.k === 'tree') drawTree(it.o);
      else if (it.k === 'loot') drawLoot(it.o);
      else if (it.k === 'structure') drawStructure(it.o);
      else if (it.k === 'vehicle') drawVehicle(it.o);
      else if (it.k === 'zombie') drawZombie(it.o);
      else if (it.k === 'animal') drawAnimal(it.o);
      else if (it.k === 'player' && !player.driving) drawPlayer();
    }
    drawParticles();
    ctx.restore();

    drawLighting();
    drawWeather();
    drawVignette();

    // screen-space location banner tint at night
    if (nightNow()) {
      ctx.fillStyle = 'rgba(10,18,30,.08)';
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawMap() {
    const c = document.createElement('canvas');
    c.width = 640; c.height = 430; c.className = 'map-canvas';
    const q = c.getContext('2d');
    const scX = 640 / WORLD.w, scY = 430 / WORLD.h;
    q.fillStyle = '#3b4637'; q.fillRect(0, 0, 640, 430);
    q.strokeStyle = '#ffffff08';
    for (let x = 0; x < 640; x += 40) { q.beginPath(); q.moveTo(x, 0); q.lineTo(x, 430); q.stroke(); }
    for (let y = 0; y < 430; y += 40) { q.beginPath(); q.moveTo(0, y); q.lineTo(640, y); q.stroke(); }
    q.fillStyle = '#8b8064';
    q.beginPath(); q.ellipse(LAKE.x * scX, LAKE.y * scY, (LAKE.rx + 20) * scX, (LAKE.ry + 18) * scY, 0, 0, TAU); q.fill();
    q.fillStyle = '#31504d';
    q.beginPath(); q.ellipse(LAKE.x * scX, LAKE.y * scY, LAKE.rx * scX, LAKE.ry * scY, 0, 0, TAU); q.fill();
    q.strokeStyle = '#3d5a56'; q.lineWidth = 5;
    q.beginPath(); RIVER.forEach((p, i) => i ? q.lineTo(p[0] * scX, p[1] * scY) : q.moveTo(p[0] * scX, p[1] * scY)); q.stroke();
    for (const r of ROADS) {
      q.strokeStyle = '#a49a7b'; q.lineWidth = Math.max(3, r.w * scX);
      q.beginPath(); r.pts.forEach((p, i) => i ? q.lineTo(p[0] * scX, p[1] * scY) : q.moveTo(p[0] * scX, p[1] * scY)); q.stroke();
    }
    q.fillStyle = '#5b563c'; q.fillRect(FIELDS.x * scX, FIELDS.y * scY, FIELDS.w * scX, FIELDS.h * scY);
    for (const b of buildings) {
      q.fillStyle = b.type === 'clinic' || b.type === 'pharmacy' ? '#86aaa1' : '#c98c75';
      q.fillRect(b.x * scX, b.y * scY, Math.max(5, b.w * scX), Math.max(4, b.h * scY));
    }
    for (const s of structures) {
      q.fillStyle = s.type === 'campfire' ? '#e0a253' : '#c8e27b';
      q.fillRect(s.x * scX - 2, s.y * scY - 2, 5, 5);
    }
    for (const v of vehicles) {
      q.fillStyle = '#d8c78a'; q.fillRect(v.x * scX - 3, v.y * scY - 2, 6, 4);
    }
    q.save();
    q.translate(player.x * scX, player.y * scY); q.rotate(player.face + Math.PI / 2);
    q.fillStyle = '#e8f7a8'; q.beginPath(); q.moveTo(0, -8); q.lineTo(5, 5); q.lineTo(-5, 5); q.closePath(); q.fill();
    q.restore();
    q.fillStyle = '#e8ecdf'; q.font = '9px "DM Mono", monospace';
    q.fillText('PINE RIDGE', 1430 * scX, 1000 * scY);
    q.fillText('HOLLOW FARM', 420 * scX, 600 * scY);
    q.fillText('CHECKPOINT KILO', 2580 * scX, 1745 * scY);
    q.fillText('CEDAR LAKE', (LAKE.x - 60) * scX, (LAKE.y - 20) * scY);
    return c;
  }

  /* ============================================================
     WORLD GENERATION & GAME START
     ============================================================ */

  function distToPolyline(x, y, pts) {
    let best = Infinity;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1), 0, 1);
      best = Math.min(best, Math.hypot(x - (a[0] + dx * t), y - (a[1] + dy * t)));
    }
    return best;
  }

  function generateWorld() {
    seed = 7331;
    buildings = BUILDINGS.map(b => ({ ...b }));
    trees = []; loot = []; zombies = []; animals = []; vehicles = []; structures = []; particles = []; tracers = []; decor = [];
    player.driving = null;
    structureId = 1;

    for (let i = 0; i < 95; i++) {
      decor.push({ kind: 'patch', x: rnd(0, WORLD.w), y: rnd(0, WORLD.h), rx: rnd(55, 150), ry: rnd(28, 75), rot: rnd(0, TAU), tone: rand() });
    }
    for (let i = 0; i < 28; i++) {
      decor.push({ kind: 'rock', x: rnd(40, WORLD.w - 40), y: rnd(40, WORLD.h - 40), rx: rnd(3, 8), ry: rnd(2, 6), rot: rnd(0, TAU) });
    }

    let tries = 0;
    while (trees.length < 520 && tries < 9000) {
      tries++;
      const x = rnd(30, WORLD.w - 30), y = rnd(30, WORLD.h - 30);
      if (lakeAmount(x, y) < 1.12) continue;
      if (buildings.some(b => x > b.x - 46 && x < b.x + b.w + 46 && y > b.y - 46 && y < b.y + b.h + 46)) continue;
      if (x > FIELDS.x - 18 && x < FIELDS.x + FIELDS.w + 18 && y > FIELDS.y - 18 && y < FIELDS.y + FIELDS.h + 18) continue;
      if (ROADS.some(r => distToPolyline(x, y, r.pts) < r.w / 2 + 17)) continue;
      if (Math.hypot(x - 1400, y - 1230) < 250) continue;
      if (trees.some(t => Math.hypot(t.x - x, t.y - y) < 13)) continue;
      trees.push({ x, y, r: rnd(10, 23), tone: rand(), chopped: false, regrow: 0 });
    }

    const starter = [
      ['Water bottle', 1436, 1234], ['Canned beans', 1406, 1272], ['Bandage', 1366, 1254]
    ];
    for (const [item, x, y] of starter) loot.push({ x, y, item, kind: ITEMS[item].cat, weight: ITEMS[item].w, taken: false });
    for (let i = 0; i < 46; i++) {
      for (let k = 0; k < 20; k++) {
        const x = rnd(60, WORLD.w - 60), y = rnd(60, WORLD.h - 60);
        if (lakeAmount(x, y) < 1.15) continue;
        if (Math.hypot(x - 1400, y - 1230) < 190) continue;
        if (buildings.some(b => x > b.x - 20 && x < b.x + b.w + 20 && y > b.y - 20 && y < b.y + b.h + 20)) continue;
        const item = weightedPick(TABLES.generic);
        loot.push({ x, y, item, kind: ITEMS[item].cat, weight: ITEMS[item].w, taken: false });
        break;
      }
    }

    const zones = [[1520, 1160, 400], [900, 830, 320], [2550, 1800, 360], [2540, 720, 330], [720, 1940, 300], [1420, 1540, 350], [2180, 1120, 380]];
    for (let i = 0; i < 28; i++) {
      let x = 0, y = 0, ok = false;
      for (let k = 0; k < 30; k++) {
        const z = pick(zones), a = rand() * TAU, rr = Math.sqrt(rand()) * z[2];
        x = z[0] + Math.cos(a) * rr; y = z[1] + Math.sin(a) * rr;
        if (x < 40 || x > WORLD.w - 40 || y < 40 || y > WORLD.h - 40) continue;
        if (lakeAmount(x, y) < 1.12) continue;
        if (buildings.some(b => inRect(x, y, b))) continue;
        if (Math.hypot(x - player.x, y - player.y) < 380) continue;
        ok = true; break;
      }
      if (!ok) continue;
      const roll = rand();
      spawnZombieAt(x, y, roll < .62 ? 'walker' : roll < .85 ? 'runner' : roll < .92 ? 'brute' : roll < .98 ? 'armored' : 'screamer');
    }

    for (let i = 0; i < 16; i++) {
      for (let k = 0; k < 20; k++) {
        const x = rnd(80, WORLD.w - 80), y = rnd(80, WORLD.h - 80);
        if (lakeAmount(x, y) < 1.1 || buildings.some(b => inRect(x, y, b))) continue;
        if (Math.hypot(x - player.x, y - player.y) < 480) continue;
        spawnAnimalAt(x, y, pick(['deer', 'deer', 'rabbit', 'rabbit', 'boar', 'wolf']));
        break;
      }
    }

    vehicles = [
      { id: 'v1', type: 'pickup', x: 1772, y: 1212, angle: -0.15, fuel: 24, battery: false, spark: true, condition: 72, storage: {} },
      { id: 'v2', type: 'sedan', x: 1444, y: 1472, angle: 1.55, fuel: 12, battery: true, spark: false, condition: 58, storage: {} },
      { id: 'v3', type: 'motorcycle', x: 858, y: 1058, angle: .4, fuel: 8, battery: false, spark: true, condition: 44, storage: {} },
      { id: 'v4', type: 'offroad', x: 2500, y: 1700, angle: .9, fuel: 40, battery: true, spark: true, condition: 86, storage: {} }
    ];

    spawnTimer = 8; animalTimer = 12; waterCooldown = 0;
  }

  function newGame(survivor) {
    generateWorld();
    const marcus = survivor === 'marcus';
    Object.assign(player, {
      x: 1400, y: 1230, r: 11, face: 0, hp: 100, blood: 100, stamina: 100, hunger: 78, thirst: 74,
      temp: 36.8, fatigue: 12, wetness: 0, infection: 0, noise: 0, crouch: false, flashlight: false,
      capacity: 16, melee: marcus ? 'Crowbar' : 'Hatchet', gun: null, driving: null,
      survivor: marcus ? 'Marcus Cole' : 'Ava Reyes',
      conditions: { bleeding: 0, poisoning: 0, cold: 0 },
      condition: { Hatchet: 100, Crowbar: 100, Pistol: 100, 'Hunting rifle': 100 },
      inventory: marcus
        ? { 'Bandage': 1, 'Water bottle': 1, 'Canned beans': 2, 'Crowbar': 1, 'Wood': 2, 'Matches': 1 }
        : { 'Bandage': 3, 'Water bottle': 2, 'Canned beans': 1, 'Hatchet': 1, 'Cloth': 2, 'Matches': 1 }
    });
    Object.assign(stats, { kills: 0, found: 0, drank: 0, bandaged: 0, wood: 0, drove: 0, distance: 0, shots: 0, notes: 0, slept: 0, survivedNight: false });
    noteSeen = {}; wasNight = false; lastDamage = ''; deathReason = '';
    clock = 7; day = 1; worldSeconds = 0; gameTime = 0; weather = 'CLEAR'; weatherTimer = 150; flash = 0;
    selected = 0; zoom = 1; zoomBias = 1; shake = 0; paused = false; dead = false; playing = true;
    hideStart();
    $('#dead-screen').classList.add('hidden');
    $('#modal').classList.add('hidden');
    setSlot(0);
    initAudio(); applyQuality();
    updateUI(); updateHint();
    setRainAudio();
    say('STAY QUIET · SEARCH THE SETTLEMENT');
  }

  const firstItemOf = list => list.find(n => count(n) > 0);

  function useConsumableSlot(slot) {
    if (slot === 2) {
      if (!count('Bandage')) { say('NO BANDAGES'); return false; }
      useItem('Bandage'); return true;
    }
    if (slot === 3) {
      const drink = firstItemOf(['Purified water', 'Water bottle']);
      if (!drink) { say('NO WATER'); return false; }
      useItem(drink); return true;
    }
    if (slot === 4) {
      const food = firstItemOf(['Cooked meat', 'Canned beans', 'Canned peaches', 'Moldy bread', 'Raw meat']);
      if (!food) { say('NO FOOD'); return false; }
      useItem(food); return true;
    }
    return false;
  }

  function useQuickSelected() {
    if (selected <= 1) { attack(); return; }
    useConsumableSlot(selected);
  }

  function quickBandage() {
    if (!count('Bandage')) { say('NO BANDAGES'); return; }
    if (player.conditions.bleeding > 0 || player.hp < 75) useItem('Bandage');
    else say('NO WOUNDS TO DRESS');
  }

  /* ============================================================
     INPUT & INITIALISATION
     ============================================================ */

  function init() {
    try {
      quality = localStorage.getItem('afterlight.quality') || 'high';
      if (!['low', 'medium', 'high'].includes(quality)) quality = 'high';
      const savedShake = localStorage.getItem('afterlight.shake');
      if (savedShake != null) shakeEnabled = savedShake !== '0';
    } catch (e) {}
    generateWorld();
    applyQuality();

    $('#start-btn').addEventListener('click', () => {
      const active = document.querySelector('.survivor-card.active');
      survivorsChoice = active ? active.dataset.survivor : 'ava';
      initAudio();
      newGame(survivorsChoice);
    });
    $('#continue-btn').addEventListener('click', () => { initAudio(); loadGame(); });
    $('#restart-btn').addEventListener('click', () => location.reload());
    $('#survivor-select').addEventListener('click', e => {
      const card = e.target.closest('.survivor-card'); if (!card) return;
      survivorsChoice = card.dataset.survivor;
      document.querySelectorAll('.survivor-card').forEach(c => c.classList.toggle('active', c === card));
      SFX.ui();
    });

    $('#pause-btn').addEventListener('click', () => playing && !dead && openModal('pause'));
    $('#bag-btn').addEventListener('click', () => playing && !dead && openModal('inventory'));
    $('#map-btn').addEventListener('click', () => playing && !dead && openModal('map'));
    $('#build-btn').addEventListener('click', () => playing && !dead && openModal('build'));
    $('#craft-btn').addEventListener('click', () => playing && !dead && openModal('craft'));
    $('#modal-close').addEventListener('click', closeModal);
    $('#modal').addEventListener('click', e => { if (e.target === $('#modal')) closeModal(); });

    document.querySelectorAll('.slot').forEach(el => el.addEventListener('click', () => { setSlot(Number(el.dataset.slot)); SFX.ui(); }));

    $('#modal-body').addEventListener('click', e => {
      const btn = e.target.closest('button[data-act]'); if (!btn) return;
      const act = btn.dataset.act, name = btn.dataset.name, id = btn.dataset.id, type = btn.dataset.type, q = btn.dataset.q;
      SFX.ui();
      if (act === 'use') useItem(name);
      else if (act === 'equip') equipItem(name);
      else if (act === 'drop') dropItem(name);
      else if (act === 'store' || act === 'take' || act === 'vstore' || act === 'vtake') transferItem(act, name, id);
      else if (act === 'build') buildStructure(type);
      else if (act === 'craft') craftRecipe(name);
      else if (act === 'fire-cook' || act === 'fire-purify' || act === 'fire-refuel' || act === 'fire-warm') fireAction(act, id);
      else if (act === 'v-battery' || act === 'v-spark' || act === 'v-fuel' || act === 'v-repair' || act === 'v-drive') vehicleAction(act, id);
      else if (act === 's-repair') repairStructure(id);
      else if (act === 'sleep') sleepAt();
      else if (act === 'resume') closeModal();
      else if (act === 'save') saveGame(true);
      else if (act === 'quality') { quality = q; try { localStorage.setItem('afterlight.quality', q); } catch (err) {} applyQuality(); renderModal(); }
      else if (act === 'shake') { shakeEnabled = !shakeEnabled; try { localStorage.setItem('afterlight.shake', shakeEnabled ? '1' : '0'); } catch (err) {} renderModal(); }
      else if (act === 'newrun') { if (confirm('Start a new run? Current progress will be erased.')) { try { localStorage.removeItem(SAVE_KEY); } catch (err) {} location.reload(); } }
    });
    $('#modal-body').addEventListener('input', e => {
      if (e.target.id !== 'vol') return;
      audioVolume = Number(e.target.value);
      try { localStorage.setItem('afterlight.volume', String(audioVolume)); } catch (err) {}
      if (audio) audio.master.gain.value = audioVolume;
    });

    addEventListener('keydown', e => {
      if (e.code === 'Escape') {
        e.preventDefault();
        if (!$('#modal').classList.contains('hidden')) closeModal();
        else if (playing && !dead) openModal('pause');
        return;
      }
      if (!playing || paused || dead) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      keys[e.code] = true;
      if (e.repeat) return;
      if (e.code === 'KeyE') interact();
      else if (e.code === 'KeyF' || e.code === 'Space') attack();
      else if (e.code === 'KeyI') openModal('inventory');
      else if (e.code === 'KeyM') openModal('map');
      else if (e.code === 'KeyB') openModal('build');
      else if (e.code === 'KeyC') openModal('craft');
      else if (e.code === 'KeyX') toggleCrouch();
      else if (e.code === 'KeyQ') quickBandage();
      else if (e.code === 'KeyL') {
        if (count('Flashlight') || player.flashlight) { player.flashlight = !player.flashlight; say(player.flashlight ? 'FLASHLIGHT ON' : 'FLASHLIGHT OFF'); }
        else say('NO FLASHLIGHT');
      }
      else if (e.code === 'Digit1') setSlot(0);
      else if (e.code === 'Digit2') setSlot(1);
      else if (e.code === 'Digit3') setSlot(2);
      else if (e.code === 'Digit4') setSlot(3);
      else if (e.code === 'Digit5') setSlot(4);
    });
    addEventListener('keyup', e => { keys[e.code] = false; });

    $('#touch-hit').addEventListener('pointerdown', e => { e.preventDefault(); attack(); });
    $('#touch-use').addEventListener('pointerdown', e => { e.preventDefault(); if (nearestInteraction()) interact(); else useQuickSelected(); });
    $('#touch-crouch').addEventListener('pointerdown', e => { e.preventDefault(); toggleCrouch(); });
    $('#touch-run').addEventListener('pointerdown', e => { e.preventDefault(); joystick.run = true; });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(evt => $('#touch-run').addEventListener(evt, () => { joystick.run = false; }));

    const joy = $('#joystick'), knob = $('#joy-knob');
    function joyMove(e) {
      if (joyPointer !== e.pointerId) return;
      const r = joy.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
      const m = Math.min(34, Math.hypot(x, y)), a = Math.atan2(y, x);
      joystick.x = Math.cos(a) * m / 34; joystick.y = Math.sin(a) * m / 34;
      knob.style.transform = `translate(${joystick.x * 34}px,${joystick.y * 34}px)`;
    }
    joy.addEventListener('pointerdown', e => {
      e.preventDefault(); joyPointer = e.pointerId;
      try { joy.setPointerCapture(e.pointerId); } catch (err) {}
      joyMove(e);
    });
    joy.addEventListener('pointermove', joyMove);
    function joyEnd(e) {
      if (joyPointer !== e.pointerId) return;
      joyPointer = null; joystick.x = joystick.y = 0; knob.style.transform = '';
    }
    joy.addEventListener('pointerup', joyEnd);
    joy.addEventListener('pointercancel', joyEnd);

    canvas.addEventListener('pointerdown', e => {
      if (!playing || paused || dead) return;
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      e.preventDefault();
      const wx = cam.x + e.offsetX / zoom, wy = cam.y + e.offsetY / zoom;
      attack(Math.atan2(wy - player.y, wx - player.x));
    });
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      zoomBias = clamp(zoomBias - e.deltaY * .0007, .82, 1.32);
    }, { passive: false });

    addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && playing && !paused && !dead) openModal('pause');
    });

    try { if (localStorage.getItem(SAVE_KEY)) $('#continue-btn').classList.remove('hidden'); } catch (e) {}

    requestAnimationFrame(frame);
  }

  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000 || 0);
    last = now;
    gameTime += dt;
    if (playing && !paused && !dead) update(dt);
    drawWorld(dt);
    requestAnimationFrame(frame);
  }

  /* ---------------- debug / test surface ---------------- */

  window.Afterlight = {
    get state() {
      return { player, stats, zombies, animals, vehicles, structures, buildings, loot, trees, worldSeconds, clock, day, weather, playing, paused, dead, selected, noteSeen: { ...noteSeen }, cam, zoom, weight: weight(), cap: cap() };
    },
    start: id => { initAudio(); newGame(id || 'ava'); },
    load: () => loadGame(),
    save: () => saveGame(true),
    teleport: (x, y) => { player.x = x; player.y = y; },
    give: (name, n) => { const ok = addItem(name, n || 1); updateUI(); return ok; },
    use: name => useItem(name),
    attack: a => attack(a),
    interact: () => interact(),
    build: t => buildStructure(t),
    open: (k, ctx) => openModal(k, ctx),
    close: () => closeModal(),
    spawnZombie: (x, y, v) => spawnZombieAt(x, y, v || 'walker'),
    setHour: h => { clock = h; },
    setPaused: v => { paused = !!v; },
    tick: sec => { const n = Math.min(900, Math.ceil(sec * 30)); for (let i = 0; i < n; i++) { if (!dead) update(1 / 30); } updateUI(); },
    damage: n => hurt(n, 'Debug damage.', false),
    nearest: () => nearestInteraction(),
    enterVehicle: id => { const v = vehicles.find(v => v.id === id); if (v) enterVehicle(v); },
    fire: () => shoot(),
    note: id => !!noteSeen[id]
  };

  init();
})();
