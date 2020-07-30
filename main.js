// how to run it: `node -r esm main.js`

import puppeteer from 'puppeteer';
const { Cluster } = require('puppeteer-cluster');
const scrollPageToBottom = require('puppeteer-autoscroll-down');
import { PuppeteerBlocker } from '@cliqz/adblocker-puppeteer';
import fetch from 'cross-fetch'; // required 'fetch' for @cliqz/adblocker-puppeteer

import parse from "node-bookmarks-parser";
const fs = require('fs');
const getFile = require("async-get-file");
const YoutubeDlWrap = require("youtube-dl-wrap");
const youtubeDlWrap = new YoutubeDlWrap();
var supportedYoutubeDlSitesRegexes = [];
const cliProgress = require('cli-progress');
var errorUrls = []
var ytCount = 0
var ytUrls = []
const bar1 = new cliProgress.SingleBar({
  forceRedraw:true,
  format: '{bar} | {percentage}% | ETA: {eta}s | {value}/{total} | {currentURL}'
}, cliProgress.Presets.shades_classic);

const BOOKMARK_FILE = 'bookmarks-ff3.html'
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
  await page.goto(url, {waitUntil: 'networkidle0'});
  await page.emulateMediaType('screen');
  await scrollPageToBottom(page);

  let height = await page.evaluate(() => document.documentElement.offsetHeight);
  let width = await page.evaluate(() => document.documentElement.offsetWidth);

  try {
    await page.addStyleTag({
      content: `@page { size:${width}px ${height+30}px;}`
    })
  } catch(err) {
    console.log('\n\nproblem with addStyleTag ' + url)
    throw err;
  }

  await page.pdf({
    path: fullFileName,
    printBackground: true,
    margin: 'none',
    height: `${height+31}px`,
    width: `${width}px`
  });
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

function updateProgressBar(url) {
  bar1.increment();
  bar1.update({currentURL:url})
}

async function downloadYoutube(url, dir, fileName) {
  try {
    updateProgressBar(url)
    await youtubeDlWrap.execPromise([url, "-f", "best", "-o", `${dir}/${fileName}.mp4`, "--download-archive", "downloaded-videos-archive.txt"])
  } catch (e) {
    errorUrls.push({url: url, error: e.stderr});
  }
}

async function listOfSupportedYoutubeDlSites() {
  var extractors = (await youtubeDlWrap.execPromise(["--list-extractors"])).split("\n")
  var domains = []
  for (var i = 0; i < extractors.length; i++) {
    var el = extractors[i].split(":")[0]
    if (el.includes("(") || el.includes(")") || el === ""){
      continue;
    }
    domains.push(el.toLowerCase())
  }
  return [...new Set(domains)]
}

async function supportedSitesRegexes() {
  const supportedYoutubeDlSites = (await listOfSupportedYoutubeDlSites()).concat(["youtu.be"])
  const regexes = []
  for (var i = 0; i < supportedYoutubeDlSites.length; i++) {
    regexes.push(new RegExp("https?:\/\/(www\.)?" + supportedYoutubeDlSites[i] + "[^a-zA-Z0-9][\/\.]?", "g"))
  }
  return regexes
}

async function downloadPdf(url, dir, title) {
  const fullFileName = pdfFileName(dir, title)
  if (fs.existsSync(fullFileName)) {
    console.log(fullFileName + " already exists");
    return
  }
  var options = {
    directory: `${dir}/`,
    filename: `${title}.pdf`
  }
  await getFile(url, options).catch(err => {
    console.log(err);
  });
}

async function initUblock() {
  let blocker = PuppeteerBlocker.fromPrebuiltAdsAndTracking(fetch).
  blocker = await PuppeteerBlocker.fromLists(fetch, [
    'https://raw.githubusercontent.com/MajkiIT/polish-ads-filter/master/cookies_filters/adblock_cookies.txt',
    'https://raw.githubusercontent.com/MajkiIT/polish-ads-filter/master/polish-adblock-filters/adblock.txt',
    'https://raw.githubusercontent.com/olegwukr/polish-privacy-filters/master/anti-adblock.txt',
    'https://raw.githubusercontent.com/olegwukr/polish-privacy-filters/master/adblock.txt',
    'https://raw.githubusercontent.com/MajkiIT/polish-ads-filter/master/cookies_filters/adblock_cookies.txt',
    'https://raw.githubusercontent.com/PolishFiltersTeam/PolishAnnoyanceFilters/master/PPB.txt',
    'https://www.fanboy.co.nz/fanboy-cookiemonster.txt'
  ]);
  return blocker
}

async function initCluster() {
  const cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_BROWSER,
    maxConcurrency: CONCURRENCY,
    monitor: true,
    puppeteerOptions: {
      pipe: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ]
    },
  });
  return cluster
}

async function initClusterTask(cluster, blocker) {
  await cluster.task(async ({ page, data }) => {
    await blocker.enableBlockingInPage(page);
    const { url, dir, idx, total, title } = data;

    // for pages that contain video - download both: the page and the video
    if (supportedYoutubeDlSitesRegexes.some(v => url.match(v))) {
        if (url.includes("youtube.com") || url.includes("youtu.be") || url.includes("youtube.pl")) {
          // make sure not to download channels, playlists or whole user for youtube
          if (!(url.includes("/channel") || url.includes("/playlist") || url.includes("/user"))) {
            ytUrls.push({url:url, dir:dir, title:title})
          }
       } else if (url.includes("vimeo")) {
         // video URLs contain only digits as identifier (users have also letters) - do not download users
         if (url.match(/vimeo.com\/[^a-zA-Z][0-9]*/)) {
           ytUrls.push({url:url, dir:dir, title:title})
         }
       } else {
         ytUrls.push({url:url, dir:dir, title:title})
       }
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
  supportedYoutubeDlSitesRegexes = await supportedSitesRegexes()
  var html = fs.readFileSync(BOOKMARK_FILE, 'utf8');
  const bookmarks = parse(html);
  const urls = flatBookmarks(bookmarks, [], [])

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
    await downloadYoutube(url, dir, title)
  }
  bar1.stop();

  // save all errors to file
  let data = JSON.stringify(errorUrls);
  fs.writeFileSync('errors.json', data);
})();
