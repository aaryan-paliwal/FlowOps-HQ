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
    if (!filePath.match(/\.(jsx|js|html|md)$/)) return;
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace FlowOps HQ with FlowOps HQ, but ignore:
    // - FlowOpsClient
    // - FlowOpsLogo
    // - FlowOps HQ (already replaced)
    // - flowops (lowercase)
    // We use a regular expression to find "FlowOps HQ" that isn't followed by "Client", "Logo", or " HQ".
    
    const regex = /FlowOps HQ(?!\s*(Client|Logo|HQ))/g;
    
    if (regex.test(content)) {
        let newContent = content.replace(regex, 'FlowOps HQ');
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`Updated: ${filePath}`);
    }
}

const frontendDir = path.join(__dirname);
walkDir(frontendDir, (filePath) => {
    // Ignore node_modules, dist, etc
    if (filePath.includes('node_modules') || filePath.includes('.git') || filePath.includes('dist')) return;
    processFile(filePath);
});

console.log("Done renaming FlowOps HQ to FlowOps HQ.");
