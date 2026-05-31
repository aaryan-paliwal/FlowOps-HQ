const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        if (isDirectory) {
            walkDir(dirPath, callback);
        } else {
            callback(path.join(dir, f));
        }
    });
}

function processFile(filePath) {
    if (!filePath.match(/\.(jsx|js|html|md|cjs)$/)) return;
    if (filePath.includes('rename-hq')) return; // skip self
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    const regex = /FlowOps(?!\s*(Client|Logo|HQ))/g;
    
    if (regex.test(content)) {
        let newContent = content.replace(regex, 'FlowOps HQ');
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`Updated: ${filePath}`);
    }
}

const projectDir = path.join(__dirname, '..');
walkDir(projectDir, (filePath) => {
    // Ignore node_modules, dist, etc
    if (filePath.includes('node_modules') || filePath.includes('.git') || filePath.includes('dist') || filePath.includes('logos')) return;
    processFile(filePath);
});

console.log("Done renaming FlowOps to FlowOps HQ.");
