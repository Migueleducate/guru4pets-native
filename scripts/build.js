/**
 * Minimal build step for the Guru4pets native shell.
 *
 * Since the UI is loaded remotely (server.url), there is no bundler/framework.
 * This script just ensures the placeholder www/ directory contains the
 * OneSignal entry point at www/js/main.js. The GitHub Actions workflow calls
 * `npm run build` before `npx cap sync ios`.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const srcFile = path.join(root, 'src', 'main.js');
const outDir = path.join(root, 'www', 'js');
const outFile = path.join(outDir, 'main.js');

fs.mkdirSync(outDir, { recursive: true });
fs.copyFileSync(srcFile, outFile);

console.log('[build] Copied', path.relative(root, srcFile), '->', path.relative(root, outFile));
