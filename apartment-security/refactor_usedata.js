const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'apps/resident-app/src');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    if (fs.statSync(dirPath).isDirectory()) walkDir(dirPath, callback);
    else if (dirPath.endsWith('.tsx') || dirPath.endsWith('.ts')) callback(dirPath);
  });
}

const contextMap = {
  passes: 'usePasses',
  fetchPasses: 'usePasses',
  addPass: 'usePasses',
  updatePassStatus: 'usePasses',
  createPass: 'usePasses',

  entries: 'useEntries',
  fetchEntries: 'useEntries',
  addEntry: 'useEntries',

  alerts: 'useAlerts',
  fetchAlerts: 'useAlerts',
  addAlert: 'useAlerts',
  markAlertRead: 'useAlerts',

  scanRequests: 'useGuardState',
  addScanRequest: 'useGuardState',
  updateScanRequestStatus: 'useGuardState',

  members: 'useHousehold',
  addMember: 'useHousehold',
  deleteMember: 'useHousehold',
  emergencyContacts: 'useHousehold',
  addEmergencyContact: 'useHousehold',
  removeEmergencyContact: 'useHousehold',
  alertPreferences: 'useHousehold',
  updateAlertPreferences: 'useHousehold'
};

walkDir(srcDir, (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes('useData')) return;

  // Replace import
  let newImports = new Set();
  
  // Find variables destructured from useData
  const useDataRegex = /const\s+\{([^}]+)\}\s*=\s*useData\(\);/g;
  let match;
  while ((match = useDataRegex.exec(content)) !== null) {
    const varsStr = match[1];
    const vars = varsStr.split(',').map(v => v.trim()).filter(v => v);
    
    // Group by hook
    const hookGroups = {};
    vars.forEach(v => {
      const hookName = contextMap[v];
      if (hookName) {
        if (!hookGroups[hookName]) hookGroups[hookName] = [];
        hookGroups[hookName].push(v);
        newImports.add(hookName);
      }
    });

    let replacement = '';
    for (const [hook, groupedVars] of Object.entries(hookGroups)) {
      replacement += `const { ${groupedVars.join(', ')} } = ${hook}();\n  `;
    }
    
    content = content.replace(match[0], replacement.trimEnd());
  }

  // Handle direct usage: useData().entries
  if (content.includes('useData().entries')) {
    content = content.replace(/useData\(\)\.entries/g, 'useEntries().entries');
    newImports.add('useEntries');
  }

  // Replace import statement
  if (newImports.size > 0) {
    // We need to fix relative paths for DomainContexts
    const depth = filePath.replace(srcDir, '').split(path.sep).length - 2;
    const relPrefix = depth === 0 ? './' : '../'.repeat(depth);
    const domainContextPath = `${relPrefix}context/DomainContexts`;
    const finalImportStr = `import { ${Array.from(newImports).join(', ')} } from '${domainContextPath}';`;

    // Remove old useData import
    content = content.replace(/import\s+\{[^}]*useData[^}]*\}\s+from\s+['"][^'"]*DataContext['"];?\n?/g, '');
    
    // Insert new import after React import or at top
    content = finalImportStr + '\n' + content;
  }

  fs.writeFileSync(filePath, content);
  console.log(`Updated ${filePath}`);
});
