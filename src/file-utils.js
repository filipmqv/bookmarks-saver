const fs = require('fs');
const MAIN_DIR = 'log'
const FILENAME_PREFIX = 'log'

function ensureDirectory(dir) {
  // creates directory if it does not exist
  if (!fs.existsSync(dir)){
    fs.mkdirSync(dir, { recursive: true });
  }
}

function joinErrorUrls(errorUrls, errorUrlsToSkip) {
  return errorUrls.concat(errorUrlsToSkip.detailed)
}

function readFile(folder) {
  // ensures that directory for log files exists and tries to read single, most recent file (by name)
  const directory = `${MAIN_DIR}/${folder}`
  ensureDirectory(directory);
  const newestErrorFile = fs.readdirSync(directory).sort().pop();
  var urlsToSkip = {detailed: [], simple: []}
  const fullPath = `${directory}/${newestErrorFile}`
  if (newestErrorFile && fs.lstatSync(fullPath).isFile()) {
    urlsToSkip.detailed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    urlsToSkip.simple = urlsToSkip.detailed.map(entry => entry.url)
  }
  return urlsToSkip
}

function saveFile(folder, content) {
  // save to file all current errors and urls skipped because of errors in previous executions
  const directory = `${MAIN_DIR}/${folder}`
  ensureDirectory(directory);
  let data = JSON.stringify(content);
  var date = new Date().toISOString();
  fs.writeFileSync(`${directory}/${FILENAME_PREFIX}-${date}.json`, data);
}

module.exports = { readFile, saveFile, joinErrorUrls, ensureDirectory }
