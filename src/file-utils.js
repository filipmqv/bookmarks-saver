const fs = require('fs');
const MAIN_LOG_DIR = 'log'
const FILENAME_PREFIX = 'log'
const TRASHBIN_DIR = 'dist-deleted'

function ensureDirectory(dir) {
  // creates directory if it does not exist
  if (!fs.existsSync(dir)){
    fs.mkdirSync(dir, { recursive: true });
  }
}

function joinErrorUrls(errorUrls, errorUrlsToSkip) {
  return errorUrls.concat(errorUrlsToSkip.detailed)
}

function newestFileName(directory) {
  ensureDirectory(directory);
  const newestFileName = fs.readdirSync(directory).sort().pop();
  const fullPath = `${directory}/${newestFileName}`
  if (newestFileName && fs.lstatSync(fullPath).isFile()) {
    return fullPath
  }
  return null
}

function readFile(folder) {
  // ensures that directory for log files exists and tries to read single, most recent file (by name)
  const directory = `${MAIN_LOG_DIR}/${folder}`
  var urlsToSkip = {detailed: [], simple: []}
  const newestErrorFile = newestFileName(directory)
  if (newestErrorFile) {
    urlsToSkip.detailed = JSON.parse(fs.readFileSync(newestErrorFile, 'utf8'));
    urlsToSkip.simple = urlsToSkip.detailed.map(entry => entry.url)
  }
  return urlsToSkip
}

function saveFile(folder, content) {
  // save to file all current errors and urls skipped because of errors in previous executions
  const directory = `${MAIN_LOG_DIR}/${folder}`
  ensureDirectory(directory);
  let data = JSON.stringify(content);
  var date = new Date().toISOString();
  fs.writeFileSync(`${directory}/${FILENAME_PREFIX}-${date}.json`, data);
}

function moveFile(oldFileName, newFileName) {
  if (fs.existsSync(oldFileName)) {
    fs.renameSync(oldFileName, newFileName)
  }
}

function copyFile(oldFileName, newFileName) {
  if (fs.existsSync(oldFileName)) {
    fs.copyFileSync(oldFileName, newFileName)
  }
}

function moveToTrash(oldFileName) {
  const trashbin_filename = `${TRASHBIN_DIR}/${oldFileName}`
  const trashbin_dir = trashbin_filename.substring(0, trashbin_filename.lastIndexOf('/'));
  ensureDirectory(trashbin_dir)
  moveFile(oldFileName, trashbin_filename)
}

module.exports = { readFile, saveFile, copyFile, moveToTrash, moveFile, joinErrorUrls, ensureDirectory, newestFileName }
