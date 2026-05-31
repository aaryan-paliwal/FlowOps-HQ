const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src');

// Map Lucide icons to Material Symbols
const iconMap = {
    'LayoutDashboard': 'dashboard',
    'Key': 'key',
    'Activity': 'monitoring',
    'BarChart3': 'bar_chart',
    'Users': 'group',
    'Settings': 'settings',
    'LogOut': 'logout',
    'Menu': 'menu',
    'X': 'close',
    'Search': 'search',
    'Plus': 'add',
    'Trash2': 'delete',
    'Edit': 'edit',
    'Copy': 'content_copy',
    'CheckCircle2': 'check_circle',
    'XCircle': 'cancel',
    'AlertCircle': 'error',
    'Info': 'info',
    'ChevronDown': 'expand_more',
    'ChevronUp': 'expand_less',
    'ChevronRight': 'chevron_right',
    'ChevronLeft': 'chevron_left',
    'Shield': 'shield',
    'CreditCard': 'credit_card',
    'User': 'person',
    'Mail': 'mail',
    'Lock': 'lock',
    'Loader2': 'autorenew',
    'KeyRound': 'key',
    'Building2': 'business',
    'ArrowRight': 'arrow_forward',
    'Check': 'check',
    'Box': 'inventory_2',
    'Cpu': 'memory',
    'Database': 'database',
    'Globe': 'language',
    'Zap': 'bolt',
    'Terminal': 'terminal',
    'Eye': 'visibility',
    'EyeOff': 'visibility_off',
    'Clock': 'schedule',
    'Calendar': 'calendar_today',
    'Filter': 'filter_alt',
    'Download': 'download',
    'Upload': 'upload',
    'RefreshCw': 'refresh',
    'ExternalLink': 'open_in_new',
    'MoreVertical': 'more_vert',
    'MoreHorizontal': 'more_horiz',
    'Play': 'play_arrow',
    'Pause': 'pause',
    'StopCircle': 'stop_circle',
    'Wifi': 'wifi',
    'WifiOff': 'wifi_off',
    'Server': 'dns'
};

function processDirectory(dir) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDirectory(fullPath);
        } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.tsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let originalContent = content;
            
            // Extract all imports from lucide-react
            const importRegex = /import\s+\{([^}]+)\}\s+from\s+['"]lucide-react['"];?/g;
            let match;
            let importedIcons = [];
            
            while ((match = importRegex.exec(content)) !== null) {
                const icons = match[1].split(',').map(i => i.trim()).filter(i => i);
                importedIcons.push(...icons);
            }
            
            if (importedIcons.length > 0) {
                // Replace the import with Icon import
                // Calculate relative path to ui/Icon
                const relativePath = path.relative(path.dirname(fullPath), path.join(srcDir, 'ui/Icon'));
                let importPath = relativePath.replace(/\\/g, '/');
                if (!importPath.startsWith('.')) importPath = './' + importPath;
                
                content = content.replace(importRegex, `import Icon from '${importPath}';`);
                
                // Replace all icon component usages
                for (const icon of importedIcons) {
                    const materialName = iconMap[icon] || icon.toLowerCase();
                    
                    // Regex to match <IconName ... /> or <IconName ...>...</IconName>
                    const tagRegex = new RegExp(`<${icon}(\\s+[^>]*?)?\\/>`, 'g');
                    content = content.replace(tagRegex, (match, attrs) => {
                        return `<Icon name="${materialName}"${attrs || ''} />`;
                    });
                    
                    // Also check for ones with children (rare for icons but possible)
                    const openTagRegex = new RegExp(`<${icon}(\\s+[^>]*?)?>`, 'g');
                    content = content.replace(openTagRegex, (match, attrs) => {
                        return `<Icon name="${materialName}"${attrs || ''}>`;
                    });
                    const closeTagRegex = new RegExp(`<\\/${icon}>`, 'g');
                    content = content.replace(closeTagRegex, `</Icon>`);
                }
                
                if (content !== originalContent) {
                    fs.writeFileSync(fullPath, content, 'utf8');
                    console.log(`Updated ${fullPath}`);
                }
            }
        }
    }
}

console.log('Replacing Lucide icons with Material Symbols...');
processDirectory(srcDir);
console.log('Done!');
