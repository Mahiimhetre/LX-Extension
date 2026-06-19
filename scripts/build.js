const fs = require('fs');
const path = require('path');

// Target directories
const BUILD_DIR = path.join(__dirname, '../dist');
const TARGETS = ['chrome', 'firefox', 'safari'];

// Helper to copy directory recursively
function copyDirSync(src, dest) {
    if (!fs.existsSync(src)) return;
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (let entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDirSync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// Clean and create dist folders
console.log('Cleaning dist directory...');
if (fs.existsSync(BUILD_DIR)) {
    fs.rmSync(BUILD_DIR, { recursive: true, force: true });
}
fs.mkdirSync(BUILD_DIR, { recursive: true });

// Read base manifest
const baseManifestPath = path.join(__dirname, '../manifest.json');
if (!fs.existsSync(baseManifestPath)) {
    console.error('Base manifest.json not found!');
    process.exit(1);
}
const baseManifest = JSON.parse(fs.readFileSync(baseManifestPath, 'utf8'));

// Build each target
for (const target of TARGETS) {
    const targetDir = path.join(BUILD_DIR, target);
    console.log(`Building target: ${target} inside ${targetDir}...`);
    
    // Copy base directories
    copyDirSync(path.join(__dirname, '../src'), path.join(targetDir, 'src'));
    copyDirSync(path.join(__dirname, '../assets'), path.join(targetDir, 'assets'));
    copyDirSync(path.join(__dirname, '../styles'), path.join(targetDir, 'styles'));
    
    // Process manifest.json specific to target
    const targetManifest = JSON.parse(JSON.stringify(baseManifest)); // Deep clone
    
    if (target === 'chrome') {
        // Chrome manifest matches base manifest
    } else if (target === 'firefox') {
        // Adjust for Firefox
        delete targetManifest.side_panel;
        if (targetManifest.permissions) {
            targetManifest.permissions = targetManifest.permissions.filter(p => p !== 'sidePanel');
        }
        
        targetManifest.sidebar_action = {
            default_title: "Locator-X",
            default_icon: "assets/icons/icon48.png",
            default_panel: "src/ui/sidepanel/panel.html"
        };
        
        targetManifest.background = {
            scripts: ["src/background/background.js"]
        };
        
        targetManifest.browser_specific_settings = {
            gecko: {
                id: "locatorx@mahiimhetre.com",
                strict_min_version: "109.0"
            }
        };
    } else if (target === 'safari') {
        // Adjust for Safari (uses Popup as sidebar fallback, supports standard Elements panel devtools)
        delete targetManifest.side_panel;
        if (targetManifest.permissions) {
            targetManifest.permissions = targetManifest.permissions.filter(p => p !== 'sidePanel');
        }
        
        targetManifest.action = {
            default_title: "Locator-X",
            default_popup: "src/ui/sidepanel/panel.html",
            default_icon: {
                "16": "assets/icons/icon16.png",
                "48": "assets/icons/icon48.png",
                "128": "assets/icons/icon128.png"
            }
        };
    }
    
    // Write modified manifest.json
    fs.writeFileSync(
        path.join(targetDir, 'manifest.json'),
        JSON.stringify(targetManifest, null, 2),
        'utf8'
    );
    console.log(`Successfully built target: ${target}`);
}

console.log('Locator-X multi-browser build complete!');
