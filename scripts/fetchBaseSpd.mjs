import { readFileSync, writeFileSync } from 'fs';

const chars = JSON.parse(readFileSync('src/data/characters.json', 'utf-8'));
const cids = chars.characters.map(c => c.cid);

const BASE = 'https://static.nanoka.cc/hsr/4.3.56/en/character';
const result = {};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

for (const cid of cids) {
  try {
    const url = `${BASE}/${cid}.json`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`[${cid}] HTTP ${res.status}`);
      continue;
    }
    const data = await res.json();
    // speed_base appears per ascension level, but all values are identical
    const spd = data.stats?.["1"]?.speed_base;
    if (spd !== undefined) {
      result[cid] = spd;
      console.log(`[${cid}] Base SPD = ${spd}`);
    } else {
      console.error(`[${cid}] speed_base not found`);
    }
  } catch (e) {
    console.error(`[${cid}] ERROR: ${e.message}`);
  }
  // small delay to avoid hammering the server
  await sleep(100);
}

writeFileSync('src/data/baseSpd.json', JSON.stringify(result, null, 2), 'utf-8');
console.log(`\nDone! ${Object.keys(result).length}/${cids.length} characters written to src/data/baseSpd.json`);
