const videoDownloader = require('./video-downloader.js')
const config = require('config');

const { Cluster } = require('puppeteer-cluster');
const scrollPageToBottom = require('puppeteer-autoscroll-down');
import { PuppeteerBlocker } from '@cliqz/adblocker-puppeteer';
import fetch from 'cross-fetch'; // 'fetch' required for @cliqz/adblocker-puppeteer
const getFile = require("async-get-file");
const fs = require('fs');
const EXTRA_MARGIN = 31; // additional margin in px added to bootom of page due to some error in browser resulting in webpage not fitting perfectly into pdf page

var errorUrls = []
var errorUrlsToSkipGlobal = []
var running = false

function pdfFileName(filePath, fileName) {
  return `${filePath}/${fileName}.pdf`
}

async function _handleYoutubePage(page) {
  // for youtube pages wait for comments section to load
  await page.waitForSelector('#comments');

  let div_selector_to_remove = "ytd-popup-container > paper-dialog.ytd-popup-container";
  await page.evaluate((sel) => {
    let element = document.querySelector(sel);
    if (element) {
      element.parentNode.removeChild(element);
    }
  }, div_selector_to_remove);
  return page;
}

async function _savePageAsPdf(page, url, fullFileName) {
  // console.log(new Date().toString(), "beginning");
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 })
  const response = await page.goto(url, { timeout: config.get('taskTimeout'), waitUntil: 'networkidle2' });
  // console.log(new Date().toString(), "got page");
  if (response._status < 400) {
    await page.emulateMediaType('screen');
    await scrollPageToBottom(page);
    // console.log(new Date().toString(), "scrolled");

    if (videoDownloader.isUrlYoutubeVideo(url)) {
      page = await _handleYoutubePage(page)
    }

    await page.waitFor(3000);
    // console.log(new Date().toString(), "passed extra wait");

    let _height = await page.evaluate(() => document.documentElement.offsetHeight);
    let height = _height > 1080 ? _height : 1080
    let width = await page.evaluate(() => document.documentElement.offsetWidth);

    await page.pdf({
      path: fullFileName,
      printBackground: true,
      margin: 'none',
      height: `${height + EXTRA_MARGIN}px`,
      width: `${width}px`
    });
    // console.log(new Date().toString(), "pdf done");
  }
  return url;
}

async function savePageAsPdf(page, url, filePath, title, originalUrl = undefined) {
  const fullFileName = pdfFileName(filePath, title)
  try {
    if (fs.existsSync(fullFileName)) {
      return
    }
    return await _savePageAsPdf(page, url, fullFileName)
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

async function initUblock() {
  let blocker = await PuppeteerBlocker.fromPrebuiltAdsAndTracking(fetch)

  const filtersList = fs.readFileSync("config/adblock/filters-list.txt", 'utf8').split("\n").filter(Boolean) // filter removes empty lines
  blocker = await PuppeteerBlocker.fromLists(fetch, filtersList);

  blocker = PuppeteerBlocker.parse(fs.readFileSync('config/adblock/custom-filters.txt', 'utf-8'));
  return blocker
}

async function initCluster() {
  const cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_BROWSER,
    maxConcurrency: config.get('concurrency'),
    timeout: config.get('taskTimeout'),
    monitor: true, // provides info about downloading progress
    puppeteerOptions: {
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

async function initClusterTask(cluster, blocker, errorUrlsToSkip) {
  await cluster.task(async ({ page, data }) => {
    if (blocker) {
      await blocker.enableBlockingInPage(page);
    }
    const { url, dir, title, originalUrl } = data;

    if (url.includes("file://")) {
      // skip
    } else if (errorUrlsToSkip.simple.includes(url)) {
      // skip
    } else if (url.endsWith(".pdf")) {
      await downloadPdf(url, dir, title)
    } else {
      await savePageAsPdf(page, url, dir, title, originalUrl);
    }
  });
}

async function downloadPages(pages, errorUrlsToSkip, useAdblock) {
  running = true
  errorUrls = []
  errorUrlsToSkipGlobal = errorUrlsToSkip
  const cluster = await initCluster()
  const blocker = useAdblock ? await initUblock() : undefined
  await initClusterTask(cluster, blocker, errorUrlsToSkip)

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