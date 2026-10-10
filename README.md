# Abomination Arena

2D browser survival game on an endless industrial map, with a player-following camera, six enemy types, telegraphed magic and rush attacks, progressively harder waves, upgrades, keyboard/mouse and touch controls. Built with Canvas and plain JavaScript; no runtime dependencies or external assets.

For the complete project description, visual direction, gameplay balance and guidance for continuing development, read the [Bulgarian project guide](docs/PROJECT_GUIDE.bg.md).

## Run

Requires Node.js 20 or newer.

```sh
npm run dev
```

The server listens on port 3000. Set `PORT` to use another port. There is no dependency installation or build step. For static hosting, publish `index.html`, `styles.css` and `src/` at the site root.

## GitHub Pages

The repository includes [a Pages workflow](.github/workflows/pages.yml). It runs the tests, uploads only the static game files and deploys them after game changes reach `main`. No personal token, package installation or backend server is needed on the host. Relative asset and home links support both a site root and the `/AbominationArena/` project path.

One-time setup by a repository administrator:

1. Open [Settings → Pages](https://github.com/XxFireBoomxX/AbominationArena/settings/pages).
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Open [Actions → Deploy game to GitHub Pages](https://github.com/XxFireBoomxX/AbominationArena/actions/workflows/pages.yml) and choose **Run workflow → main**. This also retries deployment if the first automatic run happened before Pages was enabled.
4. Wait for the deployment to succeed. The `github-pages` environment in the run shows the published address.

The expected default address is **https://xxfireboomxx.github.io/AbominationArena/**. Adding the workflow alone does not establish that the site is live; Pages must be enabled and the deployment must complete. For free Pages hosting, the repository must be public unless the account's plan supports private-repository Pages.

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

## Enemies and abilities

| Enemy | First wave | Behavior |
| --- | --- | --- |
| Crawler | 1 | Chases and deals contact damage |
| Runner | 2 | Fast, fragile pursuer |
| Tank | 3 | High health; 22 contact damage |
| Mage | 4 | Keeps distance; locks aim, warns for 0.7 s, then fires a dodgeable bolt for 16 damage |
| Charger | 5 | Warns for 0.85 s, rushes in a fixed direction for 24 damage, then rests |
| Shaman | 6 | Marks your position; after casting and a 1.1 s ground warning, a curse lasts 2.4 s, slows movement by 35% and deals 10 damage per hit |

Enemies are selected randomly from the unlocked pool. The first three waves keep their original mix. Later waves add weighted chances for each new type; the existing health and movement scaling still applies. Spell damage, timings and rush speed stay fixed.

Dashed lines and ground circles warn before attacks; move sideways, leave the circle or dash. All damage shares the 0.8-second protection after a hit, including overlapping curses. Dash prevents magic damage and keeps its full speed inside curses. Killing a caster during windup cancels its cast; already deployed spells last until expiry or wave completion. Pause freezes attacks, and restart clears them. Expand the Bulgarian enemy dossier below the arena for attack descriptions and unlock waves.

## Death report

Every death shows the score, reached wave, combat time and kills, with a detailed report directly below the arena. Use “ПОДРОБНА СТАТИСТИКА” to jump to it, or restart from either button.

The report includes completed waves, actual damage dealt/taken, restored health, shots, projectile accuracy, successful dashes, kills by enemy type, each weapon's shots/accuracy/damage/kills, upgrade selections, maximum health and the enemy/attack responsible for the lethal hit.

Accuracy is hits divided by fired projectiles; a shotgun blast is one shot and seven projectiles. Projectiles still in flight at death count as fired. Damage excludes overkill and invulnerability-blocked hits; healing excludes health that was already full. Counters span the entire run, freeze on death and reset for the next run. Detailed reports are shown for the current run; only the existing best score is stored across page reloads.

## Test

```sh
npm test
```

The 45 tests exercise unrestricted movement, camera and targeting transforms, sector generation, off-screen spawning, distant pursuers, weapon cadence/spread/range, switching, shared upgrades, combat, enemy unlocks, magic collision, curse slowing, committed rushes, dash protection, pause, hazard cleanup, wave progression, game-over behavior and run statistics (pellet accuracy, overkill, weapon attribution, all death causes, healing and reset). The interface is in Bulgarian.
