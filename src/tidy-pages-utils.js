const fs = require('fs');
const fileUtils = require('./file-utils.js');
const bookmarkUtils = require('./bookmark-utils.js');
const pageDownloader = require('./page-downloader.js');
const videoDownloader = require('./video-downloader.js');
const BOOKMARKS_DIR = "bookmarks"

async function differenceInner(arr1, arr2) {
  var keys2 = {};
  var deleted = [];

  arr2.forEach(function (item) {
    const key = item.path
    if (key in keys2) {
      keys2[key].push(item)
    } else {
      keys2[key] = [item];
    }
  });

  for (const item1 of arr1) {
    var itemList2 = keys2[item1.path]
    if (!itemList2) {
      deleted.push(item1);
    }
  };
  return deleted
}

async function difference(arr1, arr2) {
  var keys1 = {};
  var keys2 = {};

  var inserted = [];
  var updated = [];
  var deleted = [];
  var multiple = {};

  arr1.forEach(function (item) {
    const key = item.url
    if (key in keys1) {
      keys1[key].push(item)
    } else {
      keys1[key] = [item];
    }
  });

  arr2.forEach(function (item) {
    const key = item.url
    if (key in keys2) {
      keys2[key].push(item)
    } else {
      keys2[key] = [item];
    }
  });

  for (const item1 of arr1) {
    const itemList1 = keys1[item1.url]
    const itemList2 = keys2[item1.url]
    if (!itemList2) {
      deleted.push(item1);
    } else {
      if (itemList2.length === 1 && itemList1.length === 1) {
        const item2 = itemList2[0]
        if (item2.title !== item1.title || item2.path !== item1.path) {
          updated.push({ old: item1, new: item2 });
        }
      } else {
        const deletedInner = await differenceInner(itemList1, itemList2)
        deletedInner.forEach(function (item) {
          deleted.push(item)
        })
        if (!(item1.url in multiple)) {
          multiple[item1.url] = { old: itemList1, new: itemList2 }
        }
      }
    }
  };

  arr2.forEach(function (item) {
    if (!keys1[item.url]) {
      inserted.push(item);
    }
  });
  return { inserted: inserted, updated: updated, deleted: deleted, multiple: multiple }
}

async function tidyPages(old_pages, pages) {
  const { inserted, updated, deleted, multiple } = await difference(old_pages, pages)

  for (const item in multiple) {
    const old = multiple[item].old
    var found = old.find(function (element) { 
      const fileName = pageDownloader.pdfFileName(element.path, element.title)
      return fs.existsSync(fileName)
    }); 
    if (found) {
      const foundFileName = pageDownloader.pdfFileName(found.path, found.title)
      for (const copyTo of multiple[item].new) {
        const copyToFileName = pageDownloader.pdfFileName(copyTo.path, copyTo.title)
        fileUtils.copyFile(foundFileName, copyToFileName)
      }
    }

    var foundVideo = old.find(function (element) { 
      const fileName = videoDownloader.videoFileName(element.path, element.title)
      return fs.existsSync(fileName)
    }); 
    if (foundVideo) {
      const foundVideoFileName = videoDownloader.videoFileName(foundVideo.path, found.title)
      for (const copyTo of multiple[item].new) {
        const copyToFileName = videoDownloader.videoFileName(copyTo.path, copyTo.title)
        fileUtils.copyFile(foundVideoFileName, copyToFileName)
      }
    }
  }

  for (const item of deleted) {
    const oldFileName = pageDownloader.pdfFileName(item.path, item.title)
    await fileUtils.moveToTrash(oldFileName)
    const videoOldFileName = videoDownloader.videoFileName(item.path, item.title)
    await fileUtils.moveToTrash(videoOldFileName)
  }

  for (const item of updated) {
    const oldFileName = pageDownloader.pdfFileName(item.old.path, item.old.title)
    const newFileName = pageDownloader.pdfFileName(item.new.path, item.new.title)
    fileUtils.moveFile(oldFileName, newFileName)
    const videoOldFileName = videoDownloader.videoFileName(item.old.path, item.old.title)
    const videoNewFileName = videoDownloader.videoFileName(item.new.path, item.new.title)
    fileUtils.moveFile(videoOldFileName, videoNewFileName)
  }
}

async function runTidyPages(pages, pagesFileName) {
  console.log(`\ntidying directories (moved, updated, deleted pages and videos)`);

  const oldPagesFilePath = fileUtils.newestFileName(BOOKMARKS_DIR)
  if (oldPagesFilePath) {
    const oldPages = bookmarkUtils.getPages(oldPagesFilePath)
    await tidyPages(oldPages, pages)
  }
  const date = new Date().toISOString();
  fileUtils.copyFile(pagesFileName, `${BOOKMARKS_DIR}/bookmarks-${date}.html`)
}

module.exports = { runTidyPages }
