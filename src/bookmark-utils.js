const fileUtils = require('./file-utils.js')
const fs = require('fs');
const MAIN_DIST_DIR = 'dist'
import parse from "node-bookmarks-parser";

function cleanTitle(title) {
  // replace chars not allowed in file name with `_`
  return title.replace(/[^a-z0-9_\-ąćęłńóśźż]/gi, '_');
}

function directoryFromBookmarks(pathList) {
  // creates path from list of folders. Ensures that all directories along the path exist
  const dir = MAIN_DIST_DIR + '/' + pathList.join('/');
  fileUtils.ensureDirectory(dir);
  return dir;
}

function flatBookmarks(bookmarks, flatList, root) {
  // Flattens tree structure of bookmarks into list. Recursive function.
  bookmarks.forEach(function (item, index) {
    if (item.type == 'bookmark') {
      flatList.push({ 'url': item.url, 'title': item.title, 'path': root })
    } else {
      var newRoot = root.concat(item.title)
      flatList = flatBookmarks(item.children, flatList, newRoot)
    }
  });
  return flatList;
}

function cleanPages(pages) {
  // cleans title and makes sure that directory exists
  var result = []
  for (const page of pages) {
    result.push({
      url: page.url,
      title: cleanTitle(page.title),
      path: directoryFromBookmarks(page.path)
    })
  }
  return result
}

function getPages(bookmarksFileName) {
  // reads bookmarks file and returns list of objects containing URL, title and path
  var html = fs.readFileSync(bookmarksFileName, 'utf8');
  const bookmarks = parse(html);
  const pages = flatBookmarks(bookmarks, [], [])
  return cleanPages(pages)
}

module.exports = { directoryFromBookmarks, getPages }
