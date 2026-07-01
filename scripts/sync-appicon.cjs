const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const sourceIcon = path.join(rootDir, "appicon.png");
const buildDir = path.join(rootDir, "build");
const buildIcon = path.join(buildDir, "appicon.png");
const windowsIcon = path.join(buildDir, "windows", "icon.ico");

if (!fs.existsSync(sourceIcon)) {
	throw new Error(`Source icon not found: ${sourceIcon}`);
}

fs.mkdirSync(path.dirname(buildIcon), { recursive: true });
fs.mkdirSync(path.dirname(windowsIcon), { recursive: true });
fs.copyFileSync(sourceIcon, buildIcon);

if (fs.existsSync(windowsIcon)) {
	fs.rmSync(windowsIcon);
}

console.log(`Synced app icon to ${path.relative(rootDir, buildIcon)}`);
console.log(`Removed stale ${path.relative(rootDir, windowsIcon)} for regeneration`);
