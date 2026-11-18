// Entry point: load three.js as modules, hand it to the game, then run the game's source files.
// The source files are parts of one program that share a single scope: boot fetches them all and runs them
// joined together as one classic script, so declarations hoist across files exactly as they did in one file.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

Object.assign(window, { THREE, EffectComposer, ShaderPass, UnrealBloomPass, FullScreenQuad, mergeGeometries, OrbitControls });
// in load order
const FILES = ['core.js', 'seafloor.js', 'fish.js', 'creatures.js', 'avatars.js', 'post.js', 'village.js', 'town.js', 'weather.js',
  'state.js', 'model.js', 'season.js', 'dive.js', 'flow.js', 'saves.js', 'main.js'];
const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
const bust = local || new URLSearchParams(location.search).has('nocache') ? '?t=' + Date.now() : '';
if(bust){ const css = document.querySelector('link[href="src/style.css"]'); if(css) css.href = 'src/style.css' + bust; } // dev: pick up style edits without a hard reload
const texts = await Promise.all(FILES.map(f => fetch('src/' + f + bust).then(r => { if(!r.ok) throw new Error('could not load src/' + f); return r.text(); })));
// errors report a line in "game.js"; __srcMap turns it back into file:line
const map = []; let line = 1;
texts.forEach((t, i) => { map.push([line, FILES[i]]); line += t.split('\n').length; });
window.__srcMap = n => { let f = map[0]; for(const m of map) if(m[0] <= n) f = m; return f[1] + ':' + (n - f[0] + 1); };
const s = document.createElement('script');
s.textContent = texts.join('\n') + '\n//# sourceURL=game.js';
document.body.appendChild(s);
