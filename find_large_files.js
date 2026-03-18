const fs = require('fs');
const path = require('path');

function getFiles(dir, files = []) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (!fullPath.includes('node_modules') && !fullPath.includes('.git') && !fullPath.includes('.next') && !fullPath.includes('public')) {
        getFiles(fullPath, files);
      }
    } else {
      if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx') || fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
         files.push({ path: fullPath, size: fs.statSync(fullPath).size });
      }
    }
  }
  return files;
}

const allFiles = getFiles('c:/Users/priya/Desktop/biolift');
allFiles.sort((a, b) => b.size - a.size);
fs.writeFileSync('large_files.json', JSON.stringify(allFiles.slice(0, 30), null, 2));
