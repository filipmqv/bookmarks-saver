const fileUtils = require('./src/file-utils.js')
const videoDownloader = require('./src/video-downloader.js')
const pageDownloader = require('./src/page-downloader.js')
const bookmarkUtils = require('./src/bookmark-utils.js')
const errorFileUtils = require('./src/error-file-utils.js')

import puppeteer from 'puppeteer';
const { Cluster } = require('puppeteer-cluster');
const scrollPageToBottom = require('puppeteer-autoscroll-down');
import { PuppeteerBlocker } from '@cliqz/adblocker-puppeteer';
import fetch from 'cross-fetch'; // 'fetch' required for @cliqz/adblocker-puppeteer

import parse from "node-bookmarks-parser";
const fs = require('fs');
const getFile = require("async-get-file");
var errorUrls = []
var ytUrls = []

const BOOKMARK_FILE = 'bookmarks.html'
const CONCURRENCY = 4  // set number of concurrent tasks

function pdfFileName(filePath, fileName) {
  return `${filePath}/${fileName}.pdf`
}

async function _savePageAsPdf(page, url, fullFileName, idx, total) {
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1})
  const response = await page.goto(url, {timeout: 25000, waitUntil: 'networkidle2'});
  if (response._status < 400) {
    await page.emulateMediaType('screen');
    await scrollPageToBottom(page);

    if (await videoDownloader.isUrlYoutubeVideo(url)) {
      // for youtube pages wait for comments section to load
      await page.waitForSelector('#comments');
      let div_selector_to_remove= "ytd-popup-container > paper-dialog.ytd-popup-container";
      await page.evaluate((sel) => {
        let element = document.querySelector(sel);
        element.parentNode.removeChild(element);
      }, div_selector_to_remove);
    }

    await page.waitFor(3000);

    let _height = await page.evaluate(() => document.documentElement.offsetHeight);
    let height = _height > 1080 ? _height : 1080
    let width = await page.evaluate(() => document.documentElement.offsetWidth);

    await page.pdf({
      path: fullFileName,
      printBackground: true,
      margin: 'none',
      height: `${height+31}px`,
      width: `${width}px`
    });
  }
  return url;
}

async function savePageAsPdf(page, url, filePath, idx, total, title) {
  const fullFileName = pdfFileName(filePath, title)
  try {
    if (fs.existsSync(fullFileName)) {
      return
    }
    return await _savePageAsPdf(page, url, fullFileName, idx, total)
  } catch(err) {
    errorUrls.push({url: url, path: filePath, error: err, message: err.message, name: err.name});
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
    errorUrls.push({url: url, path: fullFileName, error: err});
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
    maxConcurrency: CONCURRENCY,
    timeout: 60000,
    monitor: true,
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
    await blocker.enableBlockingInPage(page);
    const { url, dir, idx, total, title } = data;


    if (await videoDownloader.isUrlSupported(url)) {
      ytUrls.push({url:url, dir:dir, title:title})
    }

    if (url.includes("file://")) {
      // skip
    } else if (errorUrlsToSkip.includes(url)) {
      // skip
    } else if (url.endsWith(".pdf")) {
      await downloadPdf(url, dir, title)
    } else {
      await savePageAsPdf(page, url, dir, idx, total, title);
    }
  });
}

(async () => {
  const errorUrlsToSkip = errorFileUtils.readErrorFile()

  await videoDownloader.initYoutubeDl()
  var html = fs.readFileSync(BOOKMARK_FILE, 'utf8');
  const bookmarks = parse(html);
  const urls = bookmarkUtils.flatBookmarks(bookmarks, [], [])
  // todo you can debug this script with custom urls; provide them in following way:
  // const urls = [
  //   {url: "https://www.youtube.com/watch?v=OHT-UPqprbs", title: "yt", path: ["a"]},
  //   {url: 'http://poznan.carpediem.cd/', title: "34gffsdf", path: ["a"]},
  // ]

  const cluster = await initCluster()
  const blocker = await initUblock()
  await initClusterTask(cluster, blocker, errorUrlsToSkip)

  const urlsLength = urls.length
  console.log("found " + urlsLength + " bookmarks")
  console.log("scrapping pages and preparing list of videos to download");
  for (const [idx, item] of urls.entries()) {
    var dir = bookmarkUtils.directoryFromBookmarks(item.path)
    cluster.queue({
      url: item.url,
      dir: dir,
      idx: idx,
      total: urlsLength,
      title: bookmarkUtils.cleanTitle(item.title),
    });
  }

  await cluster.idle();
  await cluster.close();

  errorUrls = await videoDownloader.downloadVideoList(ytUrls, errorUrls)

  errorFileUtils.saveErrorFile(errorUrls, errorUrlsToSkip)
})();
