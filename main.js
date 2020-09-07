const videoDownloader = require('./src/video-downloader.js');
const pageDownloader = require('./src/page-downloader.js');
const bookmarkUtils = require('./src/bookmark-utils.js');
const errorFileUtils = require('./src/error-file-utils.js');

const config = require('config');
const commandLineArgs = require('command-line-args');
const commandLineUsage = require('command-line-usage');

const optionDefinitions = [
    { name: 'help', alias: 'h', type: Boolean, description: 'Show options' },
    { name: 'bookmarks', alias: 'b', type: String, description: 'Name of the file with bookmarks. Default is `bookmarks.html`' },
    { name: 'concurrency', alias: 'c', type: Number, description: 'Number of concurrent processes when downloading pages.' },
    { name: 'noadblock', type: Boolean, description: 'Do not block ads (disable adblock).' },
    // Can download single URL instead of parsing bookmarks file
    { name: 'url', alias: 'u', type: String, description: 'Provide single URL to download' },
    { name: 'name', alias: 'n', type: String, description: 'Provide filename for single URL to download' },
    // following are script parts. If you add another separate script part, add it to `scriptParts` array below.
    { name: 'pages', alias: 'p', type: Boolean, description: 'Only download pages.' },
    { name: 'videos', alias: 'v', type: Boolean, description: 'Only download videos.' },
];
const options = commandLineArgs(optionDefinitions);
const scriptParts = [options.pages, options.videos];

const sections = [
    { header: 'Bookmarks-saver', content: 'Archives pages and videos from your bookmarks.' },
    { header: 'Options', optionList: optionDefinitions }
];
const usage = commandLineUsage(sections);

(async () => {
    if (options.help) {
        console.log(usage);
        return;
    }

    const allScript = scriptParts.every(Boolean) || !scriptParts.some(Boolean)

    if (options.videos || allScript) {
        await videoDownloader.initYoutubeDl()
    }

    var pages = []
    if (options.url) {
        pages = [{url: options.url, title: options.name || "my Page", path: [""]}]
    } else {
        const bookmarksFileName = options.bookmarks || config.get('bookmarks.fileName');
        pages = bookmarkUtils.getPages(bookmarksFileName)
        console.log(`found bookmarks: ${pages.length}`)
        // todo you can debug this script with custom urls; provide them in following way:
        // const pages = [
        //   {url: "https://www.youtube.com/watch?v=OHT-UPqprbs", title: "yt", path: ["a"]},
        // //   {url: 'http://poznan.carpediem.cd/', title: "34gffsdf", path: ["a"]},
        // ]
    }

    if (options.pages || allScript) {
        const concurrency = options.concurrency || config.get('concurrency');
        const useAdblock = !options.noadblock;
        const pageUrlsToSkip = errorFileUtils.readErrorFile("page")
        const pageUrlErrors = await pageDownloader.downloadPages(pages, pageUrlsToSkip, concurrency, useAdblock)
        errorFileUtils.saveErrorFile("page", pageUrlErrors, pageUrlsToSkip)
    }

    if (options.videos || allScript) {
        const videoUrlsToSkip = errorFileUtils.readErrorFile("video")
        const videoErrorUrls = await videoDownloader.downloadVideoList(pages, videoUrlsToSkip)
        errorFileUtils.saveErrorFile("video", videoErrorUrls, videoUrlsToSkip)
    }
})();
