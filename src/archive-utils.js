const axios = require('axios');

const BASE_URL = 'http://archive.org/wayback/available?url='

const cliProgress = require('cli-progress');
const progressBar = new cliProgress.SingleBar({
  forceRedraw: true,
  format: '{percentage}% | {value}/{total}',
}, cliProgress.Presets.shades_classic);

var running = false
var archivePages = []
var failedUrlsGlobal = []

async function checkArchive(urlToCheck) {
  // check if archive.org contains snapshot of page with given url
  // returns url to retrieve that page from archive.org
  try {
    const response = await axios.get(`${BASE_URL}${urlToCheck}`)
    if (response && response.data && response.data.archived_snapshots && response.data.archived_snapshots.closest && response.data.archived_snapshots.closest.url) {
      return response.data.archived_snapshots.closest.url
    }
  } catch (error) {
    console.log(urlToCheck);
    if (error.response && error.response.body) {
      console.log(error.response.body);
    } else {
      console.log(error);
    }
  }
  return null
}

async function checkPagesInArchive(pages, failedUrls, alreadyChecked) { 
  running = true
  failedUrlsGlobal = failedUrls
  const pagesNumber = pages.length;
  console.log(`\nchecking archive for ${pagesNumber} pages`);
  progressBar.start(pagesNumber, 0);

  archivePages = []
  for (const page of pages) {
    progressBar.increment();
    if (failedUrls.simple.includes(page.url)) {
      alreadyCheckedUrl = alreadyChecked.detailed.find(obj => {return obj.originalUrl === page.url})
      const archiveUrl = alreadyCheckedUrl ? alreadyCheckedUrl.url : await checkArchive(page.url)
      if (archiveUrl) {
        page.originalUrl = page.url
        page.url = archiveUrl
        page.timestamp = new Date().toISOString()
        archivePages.push(page)
      }
    }
  }
  progressBar.stop();
  running = false
  return archivePages
}

function kill() {
  return {running: running, current:archivePages, previous:failedUrlsGlobal}
}

module.exports = { checkPagesInArchive, kill }