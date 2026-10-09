# Abomination Arena

2D browser survival game with progressively harder monster waves, upgrades, keyboard/mouse and touch controls. Built with Canvas and plain JavaScript; no runtime dependencies or external assets.

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

## Test

```sh
npm test
```

Tests exercise movement, combat, dash protection, wave progression and game-over behavior. The interface is in Bulgarian.
