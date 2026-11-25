'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const modules = [
  '10-util',
  '20-studio',
  '30-campus',
  '40-cleanroom',
  '50-litho',
  '60-micro',
  '70-data',
  '80-post',
  '85-director',
  '90-boot'
];
const vendor = read('vendor/three-r160.min.js');
if (!vendor.includes('"160"') || !vendor.includes('window.THREE='))
  throw new Error('Expected standalone Three.js r160');
const source = [
  vendor,
  ...modules.map((name) => '\n/* ' + name + ' */\n' + read('src/' + name + '.js'))
].join('\n;\n');
const html = read('src/shell.html')
  .replace('<!-- LICENSE -->', () => '<!--\n' + read('vendor/LICENSE-three.txt') + '\n-->')
  .replace(
    '<!-- SCRIPTS -->',
    () => '<script>\n' + source.replace(/<\/script/gi, '<\\/script') + '\n</script>'
  );
const output = path.join(root, 'chip-fab-3d.html');
fs.writeFileSync(output, html);
console.log(
  'chip-fab-3d.html · ' +
    Buffer.byteLength(html).toLocaleString('en-US') +
    ' bytes · Three.js r160 · ' +
    modules.length +
    ' modules'
);
if (Buffer.byteLength(html) >= 2500000) process.exitCode = 1;
