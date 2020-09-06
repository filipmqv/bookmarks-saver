const fs = require('fs');

function ensureDirectory(dir) {
  // creates directory if it does not exist
  if (!fs.existsSync(dir)){
    fs.mkdirSync(dir, { recursive: true });
  }
}

module.exports = {ensureDirectory}
