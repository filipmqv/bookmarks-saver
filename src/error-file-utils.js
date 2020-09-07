const fileUtils = require('./file-utils.js')
const fs = require('fs');

function readErrorFile(folder) {
    const dir = `errors/${folder}`
    fileUtils.ensureDirectory(dir);
    const newestErrorFile = fs.readdirSync(dir).sort().pop();
    var errorUrlsToSkip = []
    if (newestErrorFile) {
        errorUrlsToSkip = JSON.parse(fs.readFileSync(`${dir}/${newestErrorFile}`, 'utf8')).map(a => a.url);
    }
    return errorUrlsToSkip
}

function saveErrorFile(folder, errorUrls, errorUrlsToSkip) {
    // save all current errors and urls skipped because of errors in previous executions to file
    let data = JSON.stringify(errorUrls.concat(errorUrlsToSkip.map(url => ({ url }))));
    var date = new Date().toISOString();
    fs.writeFileSync(`errors/${folder}/errors-${date}.json`, data);
}

module.exports = { readErrorFile, saveErrorFile }
