// how to run it: node -r esm main.js

import puppeteer from 'puppeteer';
const { Cluster } = require('puppeteer-cluster');
import { PuppeteerBlocker } from '@cliqz/adblocker-puppeteer';
import fetch from 'cross-fetch'; // required 'fetch' for @cliqz/adblocker-puppeteer
import parse from "node-bookmarks-parser";
const fs = require('fs');
const getFile = require("async-get-file");
const youtubedl = require('youtube-dl');
const scrollPageToBottom = require('puppeteer-autoscroll-down')
var errorUrls = []
var ytCount = 0
var ytUrls = []


function cleanTitle(title){
  return title.replace(/[^a-z0-9_\-ąćęłńóśźż]/gi, '_');
}

function ensureDirectory(dir) {
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
  bookmarks.forEach(function (item, index) {
    if (item.type == 'bookmark') {
      flatList.push({'url': item.url, 'title': item.title, 'path': root})
    } else {
      var newRoot = root.concat(item.title)
      // console.log(item.title, newRoot);
      flatList = flatBookmarks(item.children, flatList, newRoot)
    }
  });
  return flatList;
}

async function _savePageAsPdf(page, url, filePath, idx, total, title) {
  // console.log(idx, total, url, filePath, title);
  // const browser = await puppeteer.launch({headless: true});
  // const page = await browser.newPage();

  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1})
  await page.goto(url, {waitUntil: 'networkidle0'});

  var arr = url.split("/");
  var fileName = arr[2]
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
    path: `${filePath}/${title}.pdf`,
    printBackground: true,
    margin: 'none',
    height: `${height+31}px`,
    width: `${width}px`
  });
  // await browser.close();
  return url;
}

async function savePageAsPdf(page, url, filePath, idx, total, title) {
  try {
    return await _savePageAsPdf(page, url, filePath, idx, total, title)
  } catch(err) {
    // console.log(err)
    errorUrls.push({url: url, error: err, message: err.message, name: err.name});
    throw err;
    // if (err.name == 'TimeoutError') {
    //   console.log('\n\ntimeout for ' + url)
    // } else {
    //   console.log('\n\n' + url)
    //   console.log(err)
    //   throw err;
    // }
  }
}

async function downloadYoutube(url, dir, fileName) {
  const video = youtubedl(url,
    // Optional arguments passed to youtube-dl.
    ['--format=18'],
    // Additional options can be given for calling `child_process.execFile()`.
    { cwd: __dirname })

  // Will be called when the download starts.
  video.on('info', function(info) {
    console.log('Download started ' + info._filename)
  })

  video.on('end', function() {
    ytCount -= 1
    console.log(ytCount + 'finished downloading')
  })

  video.on('error', function error(err) {
    var urlRegex = /^http[s]?:\/\/.*?\/([a-zA-Z-_]+).*$/;
    var url = 'unknown'
    const urls = input.match(urlRegex);
    if (urls.length > 0) {
      url = urls[0];
    }
    errorUrls.push({url: url, error: err});
    console.log('error from ytdownloader:', err)
  })

  function wait() {
    return new Promise(resolve => setTimeout(resolve, 5000));
  }

  while (ytCount > 2) {
    await wait()
  }
  ytCount += 1
  video.pipe(fs.createWriteStream(`${dir}/${fileName}.mp4`))
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
    maxConcurrency: 8,
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

async function downloadPdf(url, dir, title) {
  // console.log(url)
  // var newTitle = title.replace('\/','');
  // console.log(newTitle)
  var options = {
    directory: `${dir}/`,
    filename: `${title}.pdf`
  }
  await getFile(url, options).catch(err => {
    console.log(err);
  });
}


(async () => {
  var html = fs.readFileSync('bookmarks.html', 'utf8');
  const bookmarks = parse(html);
  const res = flatBookmarks(bookmarks, [], [])
  // const urls = res.slice(0,9999999999)
  const urls = [{
    url: 'https://sekurak.pl/kilka-slow-o-wdrozeniu-ssl-i-tls-cz-i/', title: 't3', path: ['a']
  }]

  const cluster = await initCluster()
  const blocker = await initUblock()

  await cluster.task(async ({ page, data }) => {
    await blocker.enableBlockingInPage(page);
    const { url, dir, idx, total, title } = data;
    var skipped = []
    // skipped = [
    //   'https://medium.com/tensorflow/introducing-tensorflow-hub-a-library-for-reusable-machine-learning-modules-in-tensorflow-cdee41fa18f9',
    //   'https://www.privacytools.io/#pw',
    // ]
    // console.log(url)
    if (url.includes("youtube.com") || url.includes("youtu.be") || url.includes("youtube.pl")){
      // ytUrls.push({url:url, dir:dir, title:title})
    } else if (url.includes("file://") || skipped.includes(url)) {
      // console.log('\nskip ' + url)
    } else if (url.endsWith(".pdf")) {
      // await downloadPdf(url, dir, title)
    } else {
      await savePageAsPdf(page, url, dir, idx, total, title);
    }
  });

  const l = urls.length
  for (const [idx, item] of urls.entries()) {
    var dir = directoryFromBookmarks(item.path)
    cluster.queue({
      url: item.url,
      dir: dir,
      idx: idx,
      total: l,
      title: cleanTitle(item.title),
    });
  }

  await cluster.idle();

  // console.log(errorUrls);
  let data = JSON.stringify(errorUrls);
  fs.writeFileSync('errors.json', data);
  await cluster.close();

  // for (const a of ytUrls) {
  //   const { url, dir, title } = a;
  //   await downloadYoutube(url, dir, title)
  // }
// });
})();

// function main() {
//   const path = directoryFromBookmarks(['a'])
//   const urls = [{
//     url: 'https://www.youtube.com/watch?v=Qz8KsxGnznQ', title: 't3', path: path
//   }]
//   ytUrls.push({url:'https://www.youtube.com/watch?v=Qz8KsxGnznQ', dir:path, title:'t3'})
//   for (const a of ytUrls) {
//     console.log(a)
//     const { url, dir, title } = a;
//     await downloadYoutube(url, dir, title)
//   }
// }

// main()

// todo PDF - zapis
// todo youtube downloader
// todo sprawdzić PDFy czy się dobrze generują






















//
