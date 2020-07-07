import puppeteer from 'puppeteer';
import { PuppeteerBlocker } from '@cliqz/adblocker-puppeteer';
import fetch from 'cross-fetch'; // required 'fetch'
import parse from "node-bookmarks-parser";
var fs = require('fs');
import PromisePool from '@mixmaxhq/promise-pool';

function ensureDirectory(dir) {
  if (!fs.existsSync(dir)){
    fs.mkdirSync(dir, { recursive: true });
  }
}

function directoryFromBookmarks(pathList) {
  const dir = 'dist/' + pathList.join('/');
  console.log(dir);
  ensureDirectory(dir);
  return dir;
}

async function dwnld(url, filePath) {
  console.log(url);
  const browser = await puppeteer.launch({headless: true});
  const page = await browser.newPage();

  PuppeteerBlocker.fromPrebuiltAdsAndTracking(fetch).then((blocker) => {
    blocker.enableBlockingInPage(page);
  });
  // todo więcej filtrów np na rodo i ciasteczka
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1})
  await page.goto(url, {waitUntil: 'networkidle0'});
  let height = await page.evaluate(() => document.documentElement.offsetHeight);
  let width = await page.evaluate(() => document.documentElement.offsetWidth);
  var arr = url.split("/");
  var fileName = arr[2]
  await page.addStyleTag({
    content: `@page { size:${width}px ${height}px;}`
  })
  await page.pdf({
    path: `${filePath}/${fileName}.pdf`,
    printBackground: true,
    margin: "none",
    height: height + 'px',
    width: width + 'px'
  });
  await browser.close();
  return url;
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

(async () => {
  var html = fs.readFileSync('bookmarks.html', 'utf8');
  const bookmarks = parse(html);
  const res = flatBookmarks(bookmarks, [], [])
  // console.log(res);
  const urls = res.slice(0,15)
  async function getTodos() {
    const pool = new PromisePool({numConcurrent: 10});
    for (const [idx, item] of urls.entries()) {

      await pool.start(async (idx, item) => {
        // await sendResult(await getResult(i));
        var dir = directoryFromBookmarks(item.path)
        const todo = await dwnld(item.url, dir);
        console.log(`Received Todo ${idx+1}:`, todo);
      }, idx, item);

    }
    const errors = await pool.flush();
    if (errors.length) {
      console.log('done with errors', errors);
    } else {
      console.log('done');
    }

    console.log('Finished!');
  }

  getTodos();
})();
