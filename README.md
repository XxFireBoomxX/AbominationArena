# Abomination Arena

2D browser survival game on an endless industrial map, with a player-following camera, progressively harder monster waves, upgrades, keyboard/mouse and touch controls. Built with Canvas and plain JavaScript; no runtime dependencies or external assets.

For the complete project description, visual direction, gameplay balance and guidance for continuing development, read the [Bulgarian project guide](docs/PROJECT_GUIDE.bg.md).

## Run

Requires Node.js 20 or newer.

```sh
npm run dev
```

The server listens on port 3000. Set `PORT` to use another port. There is no dependency installation or build step. For static hosting, publish `index.html`, `styles.css` and `src/` at the site root.

## Controls

- WASD or arrows: move
- Mouse: aim; hold left mouse button: shoot
- Space: dash (2.8-second cooldown; briefly prevents damage)
- 1 / 2 / 3 or the equipment buttons: rifle / automatic weapon / shotgun
- P or Escape: pause
- Touch: drag the joystick to move; shooting and aiming are automatic; tap ↯ to dash; tap an equipment button to change weapons

Defeat every monster in a wave to choose an upgrade and recover health. Faster and tougher enemy types appear as waves progress. Your best score is stored in your browser. Sound is optional and off by default. The game pauses when the tab loses focus.

Travel in any direction without map borders. Only visible 640-unit sectors are generated, and revisiting coordinates recreates the same floor decoration. Enemies spawn outside the current view; colored edge arrows point toward off-screen enemies. Pursuers left more than 2560 units away are repositioned beyond the current view with their remaining health, keeping the current wave reachable. Shots and particles expire normally in world coordinates.

## Weapons

All three weapons are available during combat, with unlimited ammunition:

| Weapon | Base damage | Shot interval | Role |
| --- | --- | --- | --- |
| Rifle (1) | 25 | 0.17 s | Accurate, long range |
| Automatic (2) | 11 | 0.075 s | Fast fire, slight spread, medium range |
| Shotgun (3) | 7 × 9 | 0.65 s | Wide cone, short range |

Switching takes at least 0.12 seconds and preserves any longer recovery from the previous shot. Power upgrades add 40% of each weapon's base damage per selection; speed upgrades reduce each weapon's shot interval by 18%, with individual minimum intervals. Upgrades apply to all weapons for the current run. Restart restores the default rifle and base stats.

## Test

```sh
npm test
```

The 23 tests exercise unrestricted movement, camera and targeting transforms, sector generation, off-screen spawning, distant pursuers, weapon cadence/spread/range, switching, shared upgrades, combat, dash protection, wave progression and game-over behavior. The interface is in Bulgarian.
