const videoDownloader = require('./video-downloader.js')
const adblocker = require('./adblocker.js')
const cookiesManager = require('./cookie.js')
const { GenericPageSaver } = require('./page-saver/generic.js');
const { isUrlSpotifyPlaylist, SpotifyPageSaver } = require('./page-saver/spotify.js')
const { YoutubePageSaver } = require('./page-saver/youtube.js')
const config = require('config');
const fs = require('fs');
const { Cluster } = require('puppeteer-cluster');
const getFile = require("async-get-file");

// global variables for handling errors and killing process
var errorUrls = []
var errorUrlsToSkipGlobal = []
var running = false

function pdfFileName(filePath, fileName) {
  // filePath should already contain OUTPUT dir
  return `${filePath}/${fileName}.pdf`
}

function domainFromURL(url) {
  // returns domain with dot at the beginning. Used for filtering cookies.
  let urlObject = new URL(url);
  const cookieDomain = urlObject.hostname.split(".").slice(-2).join(".")
  return `.${cookieDomain}`
}

async function chooseSaver(url, page, fullFileName) {
  const taskTimeout = config.get('taskTimeout')
  args = [page, taskTimeout, fullFileName]
  if (videoDownloader.isUrlYoutubeVideo(url)) {
    return new YoutubePageSaver(...args)
  }
  if (isUrlSpotifyPlaylist(url)) {
    return new SpotifyPageSaver(...args)
  }
  return new GenericPageSaver(...args)
}

async function savePageAsPdf(page, url, filePath, title, cookies, originalUrl = undefined) {
  const fullFileName = pdfFileName(filePath, title)
  if (fs.existsSync(fullFileName)) {
    return
  }

  try {
    const domainCookies = await cookiesManager.cookiesForDomain(cookies, domainFromURL(url))
    const saver = await chooseSaver(url, page, fullFileName)
    return await saver.savePageAsPdf(url, domainCookies)
  } catch (err) {
    var errorObject = { timestamp: new Date().toISOString(), url: url, title: title, path: filePath, error: err, message: err.message, name: err.name }
    if (originalUrl) {
      errorObject.originalUrl = originalUrl
    }
    errorUrls.push(errorObject);
    throw err;
  }
}

async function downloadPdf(url, dir, title) {
  // url already points to PDF file, just download it
  const fullFileName = pdfFileName(dir, title)
  if (fs.existsSync(fullFileName)) {
    return
  }
  var options = {
    directory: `${dir}/`,
    filename: `${title}.pdf`
  }
  await getFile(url, options).catch(err => {
    errorUrls.push({ timestamp: new Date().toISOString(), url: url, title: title, path: fullFileName, error: err });
  });
}

async function initClusterTask(cluster, blocker, errorUrlsToSkip, cookies) {
  await cluster.task(async ({ page, data }) => {
    const { url, dir, title, originalUrl } = data;

    if (url.includes("file://")) {
      // skip
    } else if (errorUrlsToSkip.simple.includes(url)) {
      // skip
    } else if (url.endsWith(".pdf")) {
      await downloadPdf(url, dir, title)
    } else {
      if (blocker) {
        await blocker.enableBlockingInPage(page);
      }
      await savePageAsPdf(page, url, dir, title, cookies, originalUrl);
    }
  });
}

async function initCluster() {
  const cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_BROWSER,
    maxConcurrency: config.get('concurrency'),
    timeout: config.get('taskTimeout'),
    monitor: true, // provides info about downloading progress
    puppeteerOptions: {
      executablePath: './node_modules/chromium/lib/chromium/chrome-linux/chrome',
      // headless: false, // with false, you can see the page content, but cannot save PDF...
      pipe: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920x1080',
      ]
    },
  });
  return cluster
}

async function downloadPages(pages, errorUrlsToSkip, useAdblock) {
  running = true
  errorUrls = []
  errorUrlsToSkipGlobal = errorUrlsToSkip

  const cookies = cookiesManager.allCookies()
  const cluster = await initCluster()
  const blocker = useAdblock ? await adblocker.initUblock() : undefined
  await initClusterTask(cluster, blocker, errorUrlsToSkip, cookies)

  for (const page of pages) {
    const data = {
      url: page.url,
      dir: page.path,
      title: page.title,
      originalUrl: page.originalUrl
    }
    cluster.queue(data);
  }

  await cluster.idle();
  await cluster.close();
  running = false
  return errorUrls;
}

function kill() {
  return {running: running, current:errorUrls, previous:errorUrlsToSkipGlobal}
}

module.exports = { downloadPages, pdfFileName, kill }