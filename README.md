# Abomination Arena

2D browser survival game on an endless industrial map, with a player-following camera, six enemy types, telegraphed magic and rush attacks, progressively harder 60-second survival waves, dropped coins, an item shop and item combinations, keyboard/mouse and touch controls. Built with Canvas and plain JavaScript; no runtime dependencies or external assets.

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

Survive 60 seconds in each wave to open the shop. Collect golden coin drops by moving near defeated enemies; spend the money on items and healing between waves. The countdown and progress bar show time remaining; the last 10 seconds turn pink. Pause, tab switching and shopping freeze the clock. Faster and tougher enemy types appear as waves progress. Your best score is stored in your browser. Sound is optional and off by default. The game pauses when the tab loses focus.

Enemies keep spawning during the minute, up to 80 living opponents at once. Their spawn interval decreases with the wave number, down to 0.25 seconds. Kills award score and combat statistics. Surviving the time limit dismisses remaining enemies and attacks without counting them as kills, awards 500 × wave points plus 40 survival coins, and opens the shop. The next wave starts with a fresh minute. A lethal hit in the final combat tick ends the run before a survival bonus is granted.

Travel in any direction without map borders. Only visible 640-unit sectors are generated, and revisiting coordinates recreates the same floor decoration. Enemies spawn outside the current view; colored edge arrows point toward off-screen enemies. Pursuers left more than 2560 units away are repositioned beyond the current view with their remaining health, maintaining pressure during travel. Shots and particles expire normally in world coordinates.

## Weapons

All three weapons are available during combat, with unlimited ammunition:

| Weapon | Base damage | Shot interval | Role |
| --- | --- | --- | --- |
| Rifle (1) | 25 | 0.17 s | Accurate, long range |
| Automatic (2) | 11 | 0.075 s | Fast fire, slight spread, medium range |
| Shotgun (3) | 7 × 9 | 0.65 s | Wide cone, short range |

Switching takes at least 0.12 seconds and preserves any longer recovery from the previous shot. Item effects and combinations apply to all weapons for the current run, with individual minimum firing intervals. Restart restores the default rifle and base stats.

## Coins, shop and combinations

Kills drop 14 / 18 / 28 / 24 / 26 / 30 coins for crawler / runner / tank / mage / charger / shaman. Drops attract within 65 world units and collect within 24 units. Uncollected drops disappear after 20 active seconds or wave completion. Surviving a wave pays 40 coins separately from score. Money carries across waves and resets on a new run.

The shop always offers eight passive items, each up to rank 3. Buy several items, buy another rank or skip shopping. The next rank costs the base price × (1 + 0.65 × owned rank), rounded up to the next multiple of 5. All owned items work together; there are no equipment slots, selling or rerolls.

| Item | Base price | Effect per rank |
| --- | --- | --- |
| Plasma core | 70 | +20% base weapon damage |
| Accelerator | 80 | 12% shorter firing interval |
| Nano armor | 85 | +25 max health, heal 25 on purchase, −8% incoming damage |
| Impulse boots | 75 | +8% movement, 10% shorter dash cooldown |
| Critical lens | 100 | +10% critical chance; critical projectiles deal ×1.75 damage |
| Blood siphon | 90 | Heal 1 per kill |
| Magnet module | 70 | +70 attraction radius, +10% pickup value (rounded) |
| Piercing round | 110 | One additional target per projectile; retain 80% damage after each target |

A medkit costs 40 coins and immediately heals up to 40 health. It is disabled at full health. Starting the next wave gives no free healing.

Owning both ingredients activates a combination once, at any rank:

- Core + accelerator: an extra +10% base damage.
- Armor + siphon: an extra 2 healing per kill.
- Lens + piercing: retain 100% damage after each target.
- Boots + magnet: collecting a coin grants 20% movement speed for 2 active seconds; further pickups refresh the timer.

The shop shows owned ingredients and active recipes. The inventory below the arena and the death report retain item ranks and combinations for the current run. See `src/items.js` for the shared catalog and balance constants.

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

The report includes completed minutes/waves, time survived in the current wave, actual damage dealt/taken, restored health, shots, projectile accuracy, successful dashes, kills by enemy type, each weapon's shots/accuracy/damage/kills, item ranks, active combinations, collected/survival/earned/spent/remaining coins, medkit purchases, critical hits, maximum health and the enemy/attack responsible for the lethal hit.

Accuracy is projectiles that hit at least one target divided by fired projectiles; piercing contacts are counted separately and cannot raise accuracy above 100%; a shotgun blast is one shot and seven projectiles. Projectiles still in flight at death count as fired. Damage excludes overkill and invulnerability-blocked hits; healing excludes health that was already full. Counters span the entire run, freeze on death and reset for the next run. Detailed reports are shown for the current run; only the existing best score is stored across page reloads.

## Test

```sh
npm test
```

The 71 tests exercise unrestricted movement, camera and targeting transforms, sector generation, off-screen spawning, distant pursuers, weapon cadence/spread/range, switching, shared item effects, combat, enemy unlocks, magic collision, curse slowing, committed rushes, dash protection, pause, hazard cleanup, time-based progression, continued spawning and its active cap, slow-frame timing, death at expiry, game-over behavior and run statistics (pellet accuracy, overkill, weapon attribution, all death causes, healing and reset), coin drops and collection, purchase validation, rank limits, money conservation, healing purchases, critical shots, piercing and all four item combinations. The interface is in Bulgarian.
