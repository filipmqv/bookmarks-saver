var yt = require('./src/yt.js')

import puppeteer from 'puppeteer';
const { Cluster } = require('puppeteer-cluster');
const scrollPageToBottom = require('puppeteer-autoscroll-down');
import { PuppeteerBlocker } from '@cliqz/adblocker-puppeteer';
import fetch from 'cross-fetch'; // required 'fetch' for @cliqz/adblocker-puppeteer

import parse from "node-bookmarks-parser";
const fs = require('fs');
const getFile = require("async-get-file");
var supportedYoutubeDlSitesRegexes = [];
const cliProgress = require('cli-progress');
var errorUrls = []
var ytCount = 0
var ytUrls = []
const bar1 = new cliProgress.SingleBar({
  forceRedraw:true,
  format: '{bar} | {percentage}% | ETA: {eta}s | {value}/{total} | {currentURL}'
}, cliProgress.Presets.shades_classic);

const BOOKMARK_FILE = 'bookmarks.html'
const CONCURRENCY = 4  // set number of concurrent tasks

function cleanTitle(title) {
  // replace non-asci chars with `_`
  return title.replace(/[^a-z0-9_\-ąćęłńóśźż]/gi, '_');
}

function ensureDirectory(dir) {
  // creates directory if it does not exist
  if (!fs.existsSync(dir)){
    fs.mkdirSync(dir, { recursive: true });
  }
}

function directoryFromBookmarks(pathList) {
  const dir = 'dist/' + pathList.join('/');
  ensureDirectory(dir);
  return dir;
}

function flatBookmarks(bookmarks, flatList, root) {
  // Flattens tree structure of bookmarks into list
  bookmarks.forEach(function (item, index) {
    if (item.type == 'bookmark') {
      flatList.push({'url': item.url, 'title': item.title, 'path': root})
    } else {
      var newRoot = root.concat(item.title)
      flatList = flatBookmarks(item.children, flatList, newRoot)
    }
  });
  return flatList;
}

function pdfFileName(filePath, fileName) {
  return `${filePath}/${fileName}.pdf`
}

async function _savePageAsPdf(page, url, fullFileName, idx, total) {
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1})
  const response = await page.goto(url, {timeout: 25000, waitUntil: 'networkidle2'});
  if (response._status < 400) {
    await page.waitFor(3000);
    await page.emulateMediaType('screen');
    await scrollPageToBottom(page);

    let height = await page.evaluate(() => document.documentElement.offsetHeight);
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
  // todo custom file blocker = PuppeteerBlocker.parse(fs.readFileSync('ublock-statyczne-filtry_2020-08-02_22.58.04.txt', 'utf-8'));
  blocker = await PuppeteerBlocker.fromLists(fetch, [
    'https://raw.githubusercontent.com/MajkiIT/polish-ads-filter/master/polish-adblock-filters/adblock_ublock.txt',
    'https://raw.githubusercontent.com/MajkiIT/polish-ads-filter/master/adblock_social_filters/adblock_social_list.txt',
    'https://raw.githubusercontent.com/MajkiIT/polish-ads-filter/master/cookies_filters/adblock_cookies.txt',
    'https://raw.githubusercontent.com/MajkiIT/polish-ads-filter/master/cookies_filters/cookies_uB_AG.txt',
    'https://raw.githubusercontent.com/MajkiIT/polish-ads-filter/master/polish-adblock-filters/adblock.txt',
    'https://raw.githubusercontent.com/olegwukr/polish-privacy-filters/master/anti-adblock.txt',
    'https://raw.githubusercontent.com/olegwukr/polish-privacy-filters/master/anti-adblock-suplement.txt',
    'https://raw.githubusercontent.com/olegwukr/polish-privacy-filters/master/adblock.txt',
    'https://raw.githubusercontent.com/PolishFiltersTeam/PolishAnnoyanceFilters/master/PPB.txt',
    'https://raw.githubusercontent.com/PolishFiltersTeam/PolishAnnoyanceFilters/master/PAF_supp.txt',
    'https://raw.githubusercontent.com/PolishFiltersTeam/PolishAntiAnnoyingSpecialSupplement/master/polish_rss_filters.txt',
    'https://www.fanboy.co.nz/fanboy-cookiemonster.txt',
    'https://www.i-dont-care-about-cookies.eu/abp/',
  ]);
  return blocker
}

async function initCluster() {
  const cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_BROWSER,
    maxConcurrency: CONCURRENCY,
    monitor: true,
    puppeteerOptions: {
      // headless: false,
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

async function initClusterTask(cluster, blocker) {
  await cluster.task(async ({ page, data }) => {
    await blocker.enableBlockingInPage(page);
    const { url, dir, idx, total, title } = data;

    if (yt.isUrlSupported(url)) {
      ytUrls.push({url:url, dir:dir, title:title})
    }

    if (url.includes("file://")) {
      // skip
    } else if (url.endsWith(".pdf")) {
      await downloadPdf(url, dir, title)
    } else {
      await savePageAsPdf(page, url, dir, idx, total, title);
    }
  });
}

(async () => {
  yt.initYoutubeDl()
  var html = fs.readFileSync(BOOKMARK_FILE, 'utf8');
  const bookmarks = parse(html);
  const urls = flatBookmarks(bookmarks, [], [])
  // todo you can debug this script with custom urls; provide them in following way:
  // const urls = [
  //   {url: "https://www.youtube.com/watch?v=j8PDTJNaPc0", title: "yt", path: ["a"]},
  // ]

  const cluster = await initCluster()
  const blocker = await initUblock()
  await initClusterTask(cluster, blocker)

  const urlsLength = urls.length
  console.log("found " + urlsLength + " bookmarks")
  console.log("scrapping pages and preparing list of videos to download");
  for (const [idx, item] of urls.entries()) {
    var dir = directoryFromBookmarks(item.path)
    cluster.queue({
      url: item.url,
      dir: dir,
      idx: idx,
      total: urlsLength,
      title: cleanTitle(item.title),
    });
  }

  await cluster.idle();
  await cluster.close();

  const ytVideosNumber = ytUrls.length;
  console.log("downloading " + ytVideosNumber + " videos");
  bar1.start(ytVideosNumber, 0);
  for (const a of ytUrls) {
    const { url, dir, title } = a;
    try {
      await yt.downloadYoutube(url, dir, title, bar1)
    } catch (e) {
      errorUrls.push({url: url, error: e.stderr});
    }
  }
  bar1.stop();

  // save all errors to file
  let data = JSON.stringify(errorUrls);
  fs.writeFileSync('errors.json', data);
})();
