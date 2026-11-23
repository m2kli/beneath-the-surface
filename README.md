# 海面之下 · Beneath the Surface

A fishing village on a floating cut-away island, and the reef it lives on. You run the village season by season from the shore, and dive into the sea to see, and fix, what the village is doing to it. Built with three.js; UI in Chinese.

> **Status: in development (v0.1.0-dev).** Balance, content and visuals are still changing, and saves from an older version may not load.

**在线试玩 / Play:** https://m2kli.github.io/beneath-the-surface/

Runs in a desktop browser with WebGL 2 (recent Chrome, Edge or Firefox). Publishing steps are in `DEPLOY.md`.

## Run it

Any static file server works. From this folder:

```bash
python -m http.server 8771
```

Then open http://localhost:8771/. Useful URL flags:
- `?mute=1`: no sound.
- `?nocoach=1`: skip the first-season tips.
- `?q=low`: lighter rendering.

## Layout

| Path | What it is |
|---|---|
| `index.html` | Markup only (HUD, panels, menus). |
| `src/style.css` | All styles. |
| `src/boot.js` | Loads three.js, fetches the files below and runs them **joined as one script**, in this order. |
| `src/core.js` | Helpers, terrain, renderer, shared GLSL. |
| `src/seafloor.js` | Seafloor, reef, marine snow, currents, jellyfish. |
| `src/fish.js` | Fish schools (boids). |
| `src/creatures.js` | Manta, ghost nets, turtle, bottom life, open-sea animals, trawler. |
| `src/avatars.js` | The animals you can become, steering, bursts, the whale. |
| `src/post.js` | Post-processing, audio bed, input. |
| `src/village.js`, `src/town.js` | The island, the town and how it grows. |
| `src/weather.js` | Clock, weather, sky. |
| `src/state.js` | Game state and policies. |
| `src/model.js` | **The season model**: one season of the village and the sea as a pure function. |
| `src/season.js` | Applying a season, random events. |
| `src/dive.js` | Underwater jobs: surveys, starfish, rubbish, hidden events, shore markers. |
| `src/flow.js` | Game flow, village UI, forecast, report, surfacing. |
| `src/saves.js` | Saves, play log, menus. |
| `src/main.js` | Frame loop, the window into the sea, diving in, building focus. |

The source files share one scope (they were one file). Boot keeps that by running them together, so a function in a later file can be called from an earlier one. Errors report `game.js:<line>`; in the console, `__srcMap(line)` gives `file:line`.

## Balance tools

`tools/` runs the real `src/model.js` in Node.

```bash
bash tools/suite.sh
```

The suite takes a few minutes. It covers:
- stuck states × every policy;
- recovery strategies;
- mid-game rescue;
- 4000 random players;
- six bot players, never diving and diving every season.

Compare the output with `tools/baseline.txt` before committing a balance change. To compare against an older copy of the model, set `GAME_SRC=<dir>`. `node tools/explain_pol.mjs` prints what each fishing and tourism option returns.

`tools/playbot.mjs` plays a whole game through the real UI inside the browser:

```js
const bot = await import('/tools/playbot.mjs?' + Date.now());
await bot.playGame({ dive: 0.5, plan: 'balanced' });
```

It reports stuck states, overlapping cards, panels off screen and errors.

## Log

`PLAYTEST_LOG.md` records each polishing round: what was found, what changed, and what still needs a human to judge.
