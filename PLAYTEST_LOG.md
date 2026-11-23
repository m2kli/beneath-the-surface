# Playtest log

One entry per round. Each entry says what was looked at, what was found, what changed and why, and what still needs a human to judge.

---

## Round 1: project skeleton (2026-11-18)

- Moved the prototype into `F:\ocean` under git.
- `index.html` now holds markup only. Styles are in `src/style.css`; code is split into 16 files under `src/`, in load order.
- `src/boot.js` loads three.js, fetches the source files and runs them **joined as one script**. The code relies on one shared scope and on functions hoisting across what are now separate files, so this keeps behaviour identical to the single file.
- Error messages come back as `game.js:<line>`. `window.__srcMap(line)` turns that into `file:line`, and the early error hook in `index.html` does this automatically.
- `src/model.js` is the pure season model. The balance tools in `tools/` read it directly through `tools/lib.mjs`.
- `bash tools/suite.sh` runs the whole balance regression. `tools/baseline.txt` holds the output it is compared against.

## Round 2: switching to a school in the shallows (bug the user reported)

**Found:**
- Fish only avoided the seabed when below y = 26. In the shallows near the beach the seabed is far above that, so a school swimming there sank straight into the sand: at one point 80 of 81 fish were underground.
- The chase camera clamps its height between "1.2 above the sand" and "0.8 below the surface". Over the beach those two limits cross, and the clamp let the camera rise about 3 units out of the water. The view suddenly jumped above the sea.

**Changed:**
- `fish.js`: the seabed push now applies everywhere, and each fish's new position is clamped between the sand and the surface.
- `main.js`: when the camera's spot behind the animal would be over the shallows or the beach, it first swings sideways toward deeper water, and only then moves in closer. Its eased position is also clamped to stay in the water. It now looks at the animal from wherever it ended up, so the animal stays in frame.

**Checked:**
- Drove a school straight at the beach for about 9 seconds and captured frames along the way.
- The camera never went above −0.8 relative to the surface.
- No fish went below the sand (maximum penetration 0).
- No errors.

## Round 3: full playthrough bot

- `tools/playbot.mjs` plays a whole game through the real buttons (title → 16 seasons → ending) in the page, advancing time with `__g.step` so it works in a hidden tab.
- It flags stuck waits, a dim overlay with no card on it, two cards open at once, panels off screen, and errors.
- First run (balanced plan, diving half the seasons): 16 seasons, 7 dives, 35 underwater tasks done, ending "两边都撑过来了". **No issues found.**
- It did show that report notes repeat every season (spillover, new villagers, the short-staffed advice). Fixed in round 4.

## Round 4: the user's feedback list (items 1–7)

1. **Policy income (explained, numbers unchanged).**
   - Fishing income does rise with catch: industrial +73 / quota +61 / hand-line +43 / ban +31 treasury per season in a mid-game village. It looks flat because the treasury only taxes fish that is *sold*, and villagers eat first.
   - Tourism: open and limited earn the same on a healthy reef (limited is a premium price). Open wins only once the reef is damaged.
   - I tried giving open a clear money edge. Every version cut the careful bot's good endings from 80% to 50–67%, so the numbers stay. The descriptions now say exactly what each option does.
2. **Markers through the UI.** `#marks` sat above the panels. The village layer and HUD are now on top, and markers (and building hover) hide wherever a panel covers them.
3. **Option order.** Left = free or profitable but risky; right = costs something, safe. Changed: tax row (now high → low), and storm, heatwave, poachers, petition and the underwater finds (now "do nothing" left, "pay to fix" right).
4. **Text.**
   - Policy descriptions now state thresholds, rates and live costs.
   - Warnings and report notes are cut down to the fact plus its number.
   - New forecast line: stock + catch → eaten, sold × price, kept, spoiled.
   - The stored-fish tooltip gives consumption, carry-over, price, spoilage and the import price.
5. **One change-arrow language.**
   - Village books (money, fish, people, morale, reputation): exact numbers.
   - The sea: arrows only (1–3 by size, green up, red down). A `?` means the season hasn't been surveyed.
   - The report shows measured arrows plus the exact change.
   - The hatched ghost bars are gone.
6. **Underwater jobs from the shore.** Markers on the water for surveys, starfish, rubbish, ghost nets, and `?` for unexplained activity. Click one to dive straight to it.
7. **Night underwater.** A dive keeps the shore's time of day. At night: fluorescent coral, glowing jellyfish, bioluminescent plankton, a shimmering wake.

**Needs a human eye:** whether the arrow sizes (thresholds 0.4% / 1.5% / 4% per season) feel right, and whether the night is dark enough.

## Round 5: sweep after the feedback changes

- **Greedy-plan bot:** played to an early "村子空了" (overtime and high tax wreck morale), as expected for that plan. No UI issues.
- **Screen sizes:** 1280×720 plan and report screens have no overlaps and nothing off screen.
  - Found and fixed: the ocean tile in the report wrapped its labels ("珊/瑚") after the arrow column was added.
- **Found and fixed:** underwater task markers showed on the title screen, because the village sits behind it in plan state. Both marker types now wait for the game to start, and hide while the menu is open.
- **Event cards:** options now sit side by side (risky or free on the left, paid and safe on the right), matching the policy rows.
- **Save/load:** the season's hidden sea (surveys, cleared starfish) survives a reload and "继续游戏". The arrows lose their `?` after surveying. Hovering a policy option previews the ocean arrows (highlighted).
- **Performance:** the village frame was 24 ms. `updateMarks` raycast the dense water meshes once per "tap to become" marker (38 × 0.4 ms). It now uses a ray-box test against the water block: the village frame is ~9 ms, the dive ~6 ms.
- **Balance baseline regenerated** (model numbers unchanged; the suite gained the goal-aware `careful` bot): careful bot 82% good endings without diving, 87% diving every season.
- **Green plan, diving every season:** 16 seasons, 16 dives, 73 underwater tasks, ending "两边都撑过来了". No issues.

## Round 6: flows not covered yet, guidance, and "why is it dropping"

- **Swept:** trawl dive (prompt → dive → report), ending dive (end screen → swim → surface → end screen), the menu and the play log. All clean, no errors.
- **Play log:** each season now records the underwater side: dived or not, surveys, starfish cleared, rubbish picked up, event status (handled / found but left / missed), and the season's extra coral and fish change.
- **First-season tips** explain the arrows and `?`, the risky-left option order, and the underwater markers (new step on the dive button). Tips are kept on screen.
- **Random events:** options now state their effects ("珊瑚会被打碎一些" → "珊瑚 −6%，渔获 −30%…").
- **Sea meter tooltips:** hovering coral, fish or water lists this season's causes as arrows (e.g. 游客踩踏 ▼▼　污水 ▼). The season's luck appears only after it has been surveyed.
- **Performance:** a fully built tier-4 town runs at 13.3 ms per frame (was 16.5).
- **Balanced-plan bot:** 16 seasons, ending "村子富了。只富了一次。" (coral finished at 53%, just under the line), no UI issues.
- **Balance suite:** identical to the baseline.
- **Note for testing:** with the app window minimized, CSS transitions freeze. The HUD then reads as sitting on top of the village card, which looks like an overlap but isn't one.

## Round 7: smaller screens (1024×640)

- **Bots at 1024×640:** green plan (dive 30%) ended "两边都撑过来了"; balanced (dive 60%) ended "两边都撑过来了"; greedy ended early with "村子空了" as expected. No real UI issues.
- **Found and fixed (short screens):** the forecast took half the right panel, so the policy list showed about one card at a time. Below 760 px tall, its detail rows (catch, tourists, fish stock line) fold away and open when you hover the forecast. The policy list goes from 158 to 288 px. Taller screens are unchanged.
- **Found and fixed (narrower than 1400 px):** the first-dive tip ran under the animal card and the controls card, with "浮上水面" on top of its text. Dive tips now sit above both cards.
- **Found and fixed:** shore tips started behind the 海洋 panel. They are now centred in the gap between the left panels and the right panel, at every width.
- **Report note:** "村民 −3。" now gives the cause ("吃不饱" or "民心低于 30"), matching the forecast's warning.
- **Playbot:** it now measures where panels come to rest. A hidden tab freezes CSS transitions mid-way, which had reported the report card as off screen when it wasn't.
- **Dev server:** the stylesheet is cache-busted on localhost like the scripts.
- **Balance suite:** identical to the baseline.

## Round 8: the user's look feedback (clear water, markers, winter, village)

- **Water too murky.** From the shore, the water block doubled the haze path (×2.4), and healthy water still scattered a lot. Now the path is ×1.2, healthy scattering is about half, and the current ribbons are fainter from the shore. Clean water is clear down to the reef. Half-polluted water still looks good, and only badly polluted water goes murky green-brown. Underwater exposure is lower in clear water, so the sand isn't blown out.
- **Markers overlapping.** The creature pick reached 70 px from the cursor, so pointing at a job marker also lit up a creature ring. Job markers were flat labels that slid away from their spot when they stacked. Now:
  - job markers are pins with a stem down to the exact spot (stacked pins get longer stems);
  - creature rings stay off while the cursor is on a pin, and the pick radius is 46 px;
  - the first-season hint flashes at most 4 well-spaced rings instead of all ~25.
- **Winter.** Trees turned grey-sage (palms too) while the grass stayed bright green. It's now a subtropical year: the grass takes the season's tint (golden in autumn, dry khaki in winter), only some broadleaf trees turn amber in autumn, winter is olive, palms stay green, and there are no wildflowers in winter.
- **Village, first pass.** Canopies have baked light (darker underneath, lighter on top), so trees read as rounded masses. The lawns have grass tufts, wildflowers and pebbles. Village frame ~12 ms.
- **Found and fixed:** the marine-snow shader used `uNight` without declaring it, so since round 4 it never compiled: no marine snow, no night plankton. It renders again.
- **Still open:** houses, docks and the bigger town tiers could use a proper modelling pass.

## Round 9: modelling pass on the village and town

- **What made it look cheap:** the models were reasonably detailed. But everything was lit flat, buildings floated on the grass, the grass was one neon green, and from the default camera you mostly see the bare side walls of the bigger buildings.
- **Whole village:**
  - building parts get baked light (darker toward the ground, a slight tone per part);
  - every building and tree has a soft contact shadow under it;
  - windows and glass reflect a baked sky, and walls pick up a little of its colour (all fading out at night);
  - the grass is a deeper green with large warm patches.
- **Guesthouses (tier 2–3):** pastel plaster, framed window pairs on both sides and on the back, a band at every floor, a coloured cap on the parapet.
- **Resort:** rebuilt. Three storeys of rooms with balconies and alternating teal/terracotta pilasters, a set-back penthouse floor, a lobby canopy, a roof pergola, and a pool deck with loungers, umbrellas and planters. The upgrade wing matches it.
- **Dive shop (tier 2):** timber-clad sides, side and back windows, a railed roof deck with a dive flag.
- **Fishing boats:** a white hull stripe, a life ring on the cabin, fish crates and a pile of net on deck, a buoy on the bow.
- **Checked:** close-ups at tiers 0, 1 and 3, the mid and default views, and night and dusk. No errors. A full tier-3 town runs at ~14 ms per frame.
- **Not changed:** stilt huts and tiled cottages (already the most detailed), roads, the harbour quay.

## Round 10: huts, cottages, dock, roads, boats and fish

- **Stilt huts:** walls of individual boards in six tones with dark gaps and rails, a shaggy two-tone thatch fringe over the eaves, cross-braced stilts, and a dugout canoe and two fish traps under the floor.
- **Tiled cottages:** stone quoins on the front corners, bargeboards along the gables, a banded chimney with two pots, a bench by the door and plant pots on the step.
- **Wooden dock:** planks of uneven tone and length on two stringers, post caps, mooring cleats, coiled rope and a ladder down to the water.
- **Concrete pier:** expansion joints, tyre fenders along both sides, life-ring stands.
- **Asphalt roads:** white edge lines, paving joints in the pavements.
- **Fishing boats and trawlers:** framed cabin windows on the front and sides, a door at the back, an overhanging roof with a dark rim, a searchlight and antenna, a radar bar on trawlers, and an orange net heap with floats instead of the green blob.
- **Tour boats:** deck rails, a bench, a life ring, a blue stripe on the canopy.
- **Offshore longliners:** bridge wings and a radar, portholes, orange buoys racked on the rail, a red waterline, a liferaft canister.
- **Fish:**
  - every species shares a new, smoother mesh with a forked tail fanned out to swept lobes, a dorsal fin that peaks behind the head, a shaped anal fin, and pectoral and pelvic fins on both sides;
  - fins are lighter than the body, with fine rays, and there's a gill line behind the eye;
  - silver fish (barracuda, tuna, sardines) reflect less, so they no longer blow out to white.
- **Checked:** close-ups of each, underwater shots of five species. No errors; tier-3 town ~12 ms, dive ~14 ms per frame.

## Round 11: quieter, softer sound (v0.1.1-dev)

- **Found:** the bed was a brown-noise roar low-passed at 420 Hz at high gain, plus five sine drones from 98 Hz up. That's the constant "rumbling" the user disliked.
- **Changed:**
  - the roar is gone; soft surf now swells and draws back every 8–12 s, mid and high frequencies only (high-passed at 320 Hz), muffled and quieter underwater;
  - the drones are replaced by a slow pentatonic pad (three soft voices, chords change every ~9 s) and an occasional quiet bell;
  - master 0.55 → 0.4; event chimes softened to match.
- **Measured** (signal read before the master, page muted): about 18 dB quieter overall, energy below 150 Hz down 46 dB (was 45% of the old bed, now ~0%).
- **Needs a human ear:** whether the new mix is pleasant and the levels feel right.
