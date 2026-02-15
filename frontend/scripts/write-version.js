const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const version = packageJson.version || '0.0.0';
const builtAt = new Date().toISOString();

const payload = {
  version,
  builtAt,
};

const outputPath = path.join(__dirname, '..', 'public', 'version.json');
fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));

console.log(`Wrote version.json: ${version} @ ${builtAt}`);