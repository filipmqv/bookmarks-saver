const videoDownloader = require('./src/video-downloader.js');
const pageDownloader = require('./src/page-downloader.js');
const bookmarkUtils = require('./src/bookmark-utils.js');
const fileUtils = require('./src/file-utils.js');
const archiveUtils = require('./src/archive-utils.js');
const configUtils = require('./src/config-utils.js');

async function runPages(pages, options) {
  const useAdblock = !options.noadblock;
  const pageUrlsToSkip = fileUtils.readFile("page")
  const pageUrlErrors = await pageDownloader.downloadPages(pages, pageUrlsToSkip, useAdblock)
  fileUtils.saveFile("page", fileUtils.joinErrorUrls(pageUrlErrors, pageUrlsToSkip))
}

(async () => {
  const options = configUtils.options
  if (options.help) {
    console.log(configUtils.usage);
    return;
  }

  if (options.runVideos) {
    await videoDownloader.initYoutubeDl()
  }

  var pages = []
  if (options.url) {
    pages = [{ url: options.url, title: options.name || "my Page", path: [""] }]
  } else {
    try {
      pages = bookmarkUtils.getPages(options.bookmarksFileName)
    } catch {
      console.error(`Cannot find file ${options.bookmarksFileName}`);
      return 
    }

    console.log(`found bookmarks: ${pages.length}`)
    // todo you can debug this script with custom urls; provide them in following way:
    // pages = [{url: "https://www.youtube.com/watch?v=OHT-UPqprbs", title: "yt", path: ["a", "b"]}]
  }

  if (options.runPages) {
    await runPages(pages, options)
  }

  if (options.runArchive) {
    const failedUrls = fileUtils.readFile("page")
    const alreadyChecked = fileUtils.readFile("archive")
    const archivePages = await archiveUtils.checkPagesInArchive(pages, failedUrls, alreadyChecked)
    fileUtils.saveFile("archive", fileUtils.joinErrorUrls(archivePages, failedUrls))
    if (archivePages.length > 0) {
      console.log(`found pages in archive: ${archivePages.length}`);
      await runPages(archivePages, options)
    }
  }

  if (options.runVideos) {
    const videoUrlsToSkip = fileUtils.readFile("video")
    const videoErrorUrls = await videoDownloader.downloadVideoList(pages, videoUrlsToSkip)
    fileUtils.saveFile("video", fileUtils.joinErrorUrls(videoErrorUrls, videoUrlsToSkip))
  }
})();
