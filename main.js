const videoDownloader = require('./src/video-downloader.js');
const pageDownloader = require('./src/page-downloader.js');
const bookmarkUtils = require('./src/bookmark-utils.js');
const errorFileUtils = require('./src/error-file-utils.js');

const optionDefinitions = [
    { name: 'help', alias: 'h', type: Boolean },
    { name: 'bookmarks', alias: 'b', type: String },
    { name: 'verbose', alias: 'v', type: Boolean },
    { name: 'src', type: String, multiple: true, defaultOption: true },
    { name: 'timeout', alias: 't', type: Number }
];
const commandLineArgs = require('command-line-args');
const options = commandLineArgs(optionDefinitions);
const commandLineUsage = require('command-line-usage');
const sections = [
    {
        header: 'Bookmarks-saver',
        content: 'Archives pages and videos from your bookmarks.'
    },
    {
        header: 'Options',
        optionList: optionDefinitions
    }
];
const usage = commandLineUsage(sections);

(async () => {
    if (options.help) {
        console.log(usage);
        return;
    }
    const pageUrlsToSkip = errorFileUtils.readErrorFile("page")
    const videoUrlsToSkip = errorFileUtils.readErrorFile("video")

    await videoDownloader.initYoutubeDl()
    const pages = bookmarkUtils.getPages()
    // todo you can debug this script with custom urls; provide them in following way:
    // const pages = [
    //   {url: "https://www.youtube.com/watch?v=OHT-UPqprbs", title: "yt", path: ["a"]},
    //   {url: 'http://poznan.carpediem.cd/', title: "34gffsdf", path: ["a"]},
    // ]

    const pageUrlErrors = await pageDownloader.downloadPages(pages, pageUrlsToSkip)
    errorFileUtils.saveErrorFile("page", pageUrlErrors, pageUrlsToSkip)

    const videoErrorUrls = await videoDownloader.downloadVideoList(pages, videoUrlsToSkip)
    errorFileUtils.saveErrorFile("video", videoErrorUrls, videoUrlsToSkip)
})();
