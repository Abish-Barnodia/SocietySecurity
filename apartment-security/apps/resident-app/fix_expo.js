const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src', 'screens');

// Fix SafeAreaView
const files = fs.readdirSync(srcDir);
files.forEach(file => {
  if (file.endsWith('.tsx')) {
    const filePath = path.join(srcDir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // Remove SafeAreaView from react-native imports (multi-line supported)
    const regex = /import\s+{([\s\S]*?)}\s+from\s+['"]react-native['"];/g;
    let modified = false;
    content = content.replace(regex, (match, p1) => {
      if (p1.includes('SafeAreaView')) {
        modified = true;
        const newImports = p1.split(',').map(s => s.trim().replace(/\n/g, '')).filter(s => s !== 'SafeAreaView' && s !== '');
        return `import { ${newImports.join(', ')} } from 'react-native';\nimport { SafeAreaView } from 'react-native-safe-area-context';`;
      }
      return match;
    });

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated ${file}`);
    }
  }
});
