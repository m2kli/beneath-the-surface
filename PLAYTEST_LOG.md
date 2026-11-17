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
