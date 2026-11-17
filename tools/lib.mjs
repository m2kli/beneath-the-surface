// shared by the balance tools: the game's own season model, read straight from src/
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// model.js (REC .. the pure simulateSeason) followed by season.js (seasonStep, EVENTS): the tools slice what they need out of this
export const gameSource = () => ['model.js', 'season.js'].map(f => fs.readFileSync(path.join(ROOT, 'src', f), 'utf8')).join('\n');
