const videoDownloader = require('./src/video-downloader.js');
const pageDownloader = require('./src/page-downloader.js');
const bookmarkUtils = require('./src/bookmark-utils.js');
const fileUtils = require('./src/file-utils.js');
const archiveUtils = require('./src/archive-utils.js');
const configUtils = require('./src/config-utils.js');
const tidyPagesUtils = require('./src/tidy-pages-utils.js');

var ON_DEATH = require('death');

ON_DEATH(function(signal, err) {
  // clean up code here
  handleKill(pageDownloader.kill(), "page")
  handleKill(archiveUtils.kill(), "archive")
  handleKill(videoDownloader.kill(), "video")
})

function handleKill(data, fileDirectory) {
  const {running, current, previous} = data
  if (running) {
    console.log(`\n\n\n\n\n\n\n\n\n\n\n\n\n\n! early exit from script !\nsaved partial log for ${fileDirectory} task`);
    fileUtils.saveFile(fileDirectory, fileUtils.joinErrorUrls(current, previous))
  }
}

async function runPages(pages, options) {
  const useAdblock = !options.noadblock;
  const pageUrlsToSkip = fileUtils.readFile("page")
  const pageUrlErrors = await pageDownloader.downloadPages(pages, pageUrlsToSkip, useAdblock)
  if (pageUrlErrors.length>0) {
    fileUtils.saveFile("page", fileUtils.joinErrorUrls(pageUrlErrors, pageUrlsToSkip))
  }
}

function manualUrl(options) {
  return [{ url: options.url, title: options.name || "my Page", path: bookmarkUtils.directoryFromPathList() }]
}

function pagesFromBookmarks(options) {
  var pages = []
  try {
    pages = bookmarkUtils.getPages(options.bookmarksFilePath)
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw `Cannot find file ${options.bookmarksFilePath}`
    } else {
      throw error;
    }
  }
  console.log(`found bookmarks: ${pages.length}`)
  return pages
}

function getPages(options) {
  try {
    return options.url ? manualUrl(options) : pagesFromBookmarks(options)
  } catch (error) {
    console.log(error)
  }
}

(async () => {
  const options = configUtils.options
  if (options.help) {
    console.log(configUtils.usage);
    return
  }

  if (options.runVideos) {
    await videoDownloader.initYoutubeDl()
  }

  const pages = getPages(options)
  if (!pages) {
    return
  }

  if (options.runTidyPages) {
    await tidyPagesUtils.runTidyPages(pages, options.bookmarksFilePath)
  }

  if (options.runPages) {
    console.log(`\ndownloading pages`);
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
