// Copies the camera list from the web app (src/app.js) into the iPhone app (ios/GrainClub/looks.json),
// so both apps always share the same looks. Run: node tools/export_looks.js
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
const a = src.indexOf('const LOOKS=['), b = src.indexOf('\n];', a);
if (a < 0 || b < 0) throw new Error('LOOKS not found in src/app.js');
const DSEG = {on: true, style: 'seg', color: 'amber'};   // referenced by the looks
const LOOKS = eval(src.slice(a + 'const LOOKS='.length, b + 2));
const out = path.join(__dirname, '../ios/GrainClub/looks.json');
fs.writeFileSync(out, JSON.stringify(LOOKS, null, 1) + '\n');
console.log(LOOKS.length + ' looks written to ' + out);
