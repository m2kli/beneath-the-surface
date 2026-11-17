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
