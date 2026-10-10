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
- P or Escape: pause
- Touch: drag the joystick to move; shooting and aiming are automatic; tap ↯ to dash

Defeat every monster in a wave to choose an upgrade and recover health. Faster and tougher enemy types appear as waves progress. Your best score is stored in your browser. Sound is optional and off by default. The game pauses when the tab loses focus.

Travel in any direction without map borders. Only visible 640-unit sectors are generated, and revisiting coordinates recreates the same floor decoration. Enemies spawn outside the current view; colored edge arrows point toward off-screen enemies. Pursuers left more than 2560 units away are repositioned beyond the current view with their remaining health, keeping the current wave reachable. Shots and particles expire normally in world coordinates.

## Test

```sh
npm test
```

The 15 tests exercise unrestricted movement, camera and targeting transforms, sector generation, off-screen spawning, distant pursuers, combat, dash protection, wave progression and game-over behavior. The interface is in Bulgarian.
