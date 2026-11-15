# AFTERLIGHT — North Cascade

A playable open-world zombie survival sandbox for desktop and Android/mobile browsers, inspired by the hardcore rhythms of DayZ. Built with a vendored Three.js renderer and a vanilla JS/HTML/CSS interface — no build step, no external game assets.

## Play

```bash
python3 -m http.server 3000
# open http://localhost:3000
```

Or use the project preview. Choose a survivor, then click **ENTER THE CASCADE**.

## Controls

| Action | Desktop | Mobile |
| --- | --- | --- |
| Move | WASD / arrows | Left joystick |
| Look | Click to capture mouse, then move | Drag anywhere on the world |
| Sprint | Shift | Push joystick fully |
| Attack | Left click / F | HIT |
| Aim | Hold right mouse | AIM toggle |
| Jump / crouch | Space / X | ↑ / ▼ |
| Interact / search | E | USE |
| Reload | R | R button |
| Torch | T | ☼ button |
| Inventory | I | PACK |
| Crafting | C | CRAFT |
| Build | B | ⚒ button |
| Map / Help | M / H | MAP / ? |
| First / third person | V | CAM |
| Quick items | 1 / 2 / 3 | quick slots |

## Systems

- **World** — 1.8 × 1.8 km seamless terrain with lake, river, forests, hills/mountain ridges, villages, a ruined city, farm, clinic/hospital, industrial mill, ranger camp, military quarantine blacksite, bunker, crashed convoy, hunting stands and backcountry cabins.
- **Survival** — hunger, thirst, body temperature, stamina, energy/fatigue, blood, bleeding, infection, fever, cold, food poisoning, dehydration, hypothermia and sleep.
- **Scavenging** — location-specific loot, weight/backpack capacity, equipment slots, weapon/clothing condition, medical supplies, ammunition, materials and batteries.
- **Infected** — walkers, runners, brutes, armoured dead and screechers with vision cones, hearing, patrol/investigate/chase/search states and noise reactions to footsteps, sprinting, melee and gunfire.
- **Combat** — melee and five firearms (pistol, revolver, shotgun, hunting rifle, assault rifle) with magazines, reloads, recoil, spread, aim-down-sights, durability and head/limb ray hits.
- **Base building** — walls, metal walls, window walls, doors, gates, spike barricades, floors, watchtowers, lean-to shelter, roof canopy, storage crate, campfire and sleeping bag. Structures can be damaged by the dead and repaired; doors lock when closed; storage holds 80 kg.
- **Environment** — 24-hour day/night cycle, sun/moon/stars, clear/overcast/rain/storm/fog weather, rain particles, lightning and thunder, dynamic fog and temperature.
- **Audio** — fully synthesised WebAudio wind, rain, gunshots, footsteps, growls, screams, thunder, heartbeat, torch/campfire and pickup sounds.

## Assumptions

- Single-player, session-based sandbox; there is no server persistence.
- Presentation is deliberately stylised low-poly 3D rather than photoreal, to stay lightweight and asset-free.
- "Climbing" is represented by jumping/slope traversal; water is waded rather than swum. The bunker is an enterable fortified structure rather than a separate underground level.
- Mobile layout is designed for phones in portrait, with a touch-control fallback added for tablets/large touch screens.

## Source

- `game.js` — gameplay, rendering, survival simulation, AI, UI wiring and audio.
- `world.js` — procedural terrain, settlements, props, collision and loot placement.
- `style.css` / `index.html` — responsive HUD, modals and start screen.
- `vendor/three.module.min.js` — Three.js r160 (MIT).

---

<!-- omgithub:readme:start -->
## 🚀 Build, play, and remix with OMGithub

**Created using [OMGithub.com](https://go.ondev.store/).**

[![OMGithub](https://img.shields.io/badge/OMGithub-Open%20project-orange?style=for-the-badge)](https://go.ondev.store/rawdney37-ctrl/PlayGround)
[![GitHub](https://img.shields.io/badge/GitHub-Source-181717?logo=github&style=for-the-badge)](https://github.com/rawdney37-ctrl/PlayGround)

- 🎮 [Open the project](https://go.ondev.store/rawdney37-ctrl/PlayGround).
- ✨ [Remix this project](https://go.ondev.store/rawdney37-ctrl/PlayGround?remix=1).
- 💻 [Explore the source](https://github.com/rawdney37-ctrl/PlayGround).
- 🛠️ [Check build runs](https://github.com/rawdney37-ctrl/PlayGround/actions).
- 🐛 [Report an issue](https://github.com/rawdney37-ctrl/PlayGround/issues).
- 👤 [Explore the creator's projects](https://go.ondev.store/rawdney37-ctrl).
- 🌍 [Create with OMGithub](https://go.ondev.store/).
<!-- omgithub:readme:end -->
