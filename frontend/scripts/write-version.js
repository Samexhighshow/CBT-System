const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const version = packageJson.version || '0.0.0';
const builtAt = new Date().toISOString();
const cacheVersion = `v${version}-${Date.now()}`; // Unique cache version

const payload = {
  version,
  builtAt,
  cacheVersion, // For cache busting
  buildId: Math.random().toString(36).substring(7), // Unique build identifier
};

const outputPath = path.join(__dirname, '..', 'public', 'version.json');
fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));

console.log(`Wrote version.json: ${version} @ ${builtAt}`);
console.log(`Cache version: ${cacheVersion}`);
