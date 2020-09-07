const bookmarkUtils = require('./bookmark-utils.js')
const videoDownloader = require('./video-downloader.js')

const { Cluster } = require('puppeteer-cluster');
const scrollPageToBottom = require('puppeteer-autoscroll-down');
import { PuppeteerBlocker } from '@cliqz/adblocker-puppeteer';
import fetch from 'cross-fetch'; // 'fetch' required for @cliqz/adblocker-puppeteer
const getFile = require("async-get-file");
const fs = require('fs');

var errorUrls = []

function pdfFileName(filePath, fileName) {
    return `${filePath}/${fileName}.pdf`
}

async function _savePageAsPdf(page, url, fullFileName) {
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 })
    const response = await page.goto(url, { timeout: 25000, waitUntil: 'networkidle2' });
    if (response._status < 400) {
        await page.emulateMediaType('screen');
        await scrollPageToBottom(page);

        if (await videoDownloader.isUrlYoutubeVideo(url)) {
            // for youtube pages wait for comments section to load
            await page.waitForSelector('#comments');
            let div_selector_to_remove = "ytd-popup-container > paper-dialog.ytd-popup-container";
            await page.evaluate((sel) => {
                let element = document.querySelector(sel);
                if (element) {
                    element.parentNode.removeChild(element);
                }
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
            height: `${height + 31}px`,
            width: `${width}px`
        });
    }
    return url;
}

async function savePageAsPdf(page, url, filePath, title) {
    const fullFileName = pdfFileName(filePath, title)
    try {
        if (fs.existsSync(fullFileName)) {
            return
        }
        return await _savePageAsPdf(page, url, fullFileName)
    } catch (err) {
        errorUrls.push({ url: url, path: filePath, error: err, message: err.message, name: err.name });
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
        errorUrls.push({ url: url, path: fullFileName, error: err });
    });
}


async function initUblock() {
    let blocker = await PuppeteerBlocker.fromPrebuiltAdsAndTracking(fetch)

    const filtersList = fs.readFileSync("config/adblock/filters-list.txt", 'utf8').split("\n").filter(Boolean) // filter removes empty lines
    blocker = await PuppeteerBlocker.fromLists(fetch, filtersList);

    blocker = PuppeteerBlocker.parse(fs.readFileSync('config/adblock/custom-filters.txt', 'utf-8'));
    return blocker
}

async function initCluster(concurrency) {
    const cluster = await Cluster.launch({
        concurrency: Cluster.CONCURRENCY_BROWSER,
        maxConcurrency: concurrency,
        timeout: 60000,
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
        const { url, dir, title } = data;

        if (url.includes("file://")) {
            // skip
        } else if (errorUrlsToSkip.includes(url)) {
            // skip
        } else if (url.endsWith(".pdf")) {
            await downloadPdf(url, dir, title)
        } else {
            await savePageAsPdf(page, url, dir, title);
        }
    });
}

async function downloadPages(pages, errorUrlsToSkip, concurrency, useAdblock) {
    const cluster = await initCluster(concurrency)
    const blocker = useAdblock ? await initUblock() : undefined
    await initClusterTask(cluster, blocker, errorUrlsToSkip)

    for (const page of pages) {
        var dir = bookmarkUtils.directoryFromBookmarks(page.path)
        cluster.queue({
            url: page.url,
            dir: dir,
            title: bookmarkUtils.cleanTitle(page.title),
        });
    }

    await cluster.idle();
    await cluster.close();
    return errorUrls;
}

module.exports = { downloadPages }