const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src');

const iconNameFixes = {
    'alerttriangle': 'warning',
    'slidershorizontal': 'tune',
    'gitfork': 'alt_route',
    'terminalsquare': 'terminal',
    'rotatecw': 'refresh',
    'bookopen': 'book',
    'arrowupright': 'open_in_new',
    'messagesquare': 'chat',
    'link2': 'link',
    'sparkles': 'auto_awesome',
    'award': 'emoji_events',
    'listfilter': 'filter_list',
    'helpcircle': 'help',
    'arrowright': 'arrow_forward',
    'clock': 'schedule',
    'calendar': 'calendar_today',
    'rocket': 'rocket_launch',
    'chevronsupdown': 'unfold_more',
    'userplus': 'person_add',
    'package': 'inventory_2',
    'bot': 'smart_toy',
    'copy': 'content_copy',
    'morevertical': 'more_vert',
    'morehorizontal': 'more_horiz',
    'zap': 'bolt'
};

function processDirectory(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDirectory(fullPath);
        } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.tsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let updated = false;

            for (const [oldName, newName] of Object.entries(iconNameFixes)) {
                const regex = new RegExp(`name="${oldName}"`, 'g');
                if (regex.test(content)) {
                    content = content.replace(regex, `name="${newName}"`);
                    updated = true;
                }
            }

            if (updated) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Fixed icons in ${fullPath}`);
            }
        }
    }
}

processDirectory(srcDir);
console.log('Finished fixing icon names!');
