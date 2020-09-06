const fileUtils = require('./file-utils.js')
const fs = require('fs');

function readErrorFile() {
  fileUtils.ensureDirectory("errors");
  var newestErrorFile = fs.readdirSync("errors").sort().pop();
  var errorUrlsToSkip = []
  if (newestErrorFile) {
    errorUrlsToSkip = JSON.parse(fs.readFileSync(`errors/${newestErrorFile}`, 'utf8')).map(a => a.url);
  }
  return errorUrlsToSkip
}

function saveErrorFile(errorUrls, errorUrlsToSkip) {
  // save all current errors and urls skipped because of errors in previous executions to file
  let data = JSON.stringify(errorUrls.concat(errorUrlsToSkip.map(url => ({url}))));
  var date = new Date().toISOString();
  fs.writeFileSync(`errors/errors-${date}.json`, data);
}

module.exports = {readErrorFile, saveErrorFile}
