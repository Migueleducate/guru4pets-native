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
const outDir = path.join(root, 'www', 'js');
fs.mkdirSync(outDir, { recursive: true });

// Files to copy from src/ -> www/js/
var files = ['main.js', 'google-auth.js'];
files.forEach(function (name) {
  var srcFile = path.join(root, 'src', name);
  var outFile = path.join(outDir, name);
  fs.copyFileSync(srcFile, outFile);
  console.log('[build] Copied', path.relative(root, srcFile), '->', path.relative(root, outFile));
});
