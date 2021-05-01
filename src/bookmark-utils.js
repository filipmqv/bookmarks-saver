const fileUtils = require('./file-utils.js')
const fs = require('fs');
const MAIN_DIST_DIR = 'dist'
import parse from "node-bookmarks-parser";
const configUtils = require('./config-utils.js');
const OUTPUT_DIR = configUtils.options.outputDirectory

function getDistDir(directory) {
  return `${OUTPUT_DIR}/${MAIN_DIST_DIR}/${directory}`
}

function cleanTitle(title) {
  // replace chars not allowed in file name with `_`
  return title.replace(/[^a-z0-9_\-ąćęłńóśźż]/gi, '_');
}

function cleanPath(title) {
  // replace "/" sign so that node is not interpreted as new node in path
  return title.replace(/[\/]/gi, '_');
}

function directoryFromPathList(pathList) {
  // creates path from list of folders. Ensures that all directories along the path exist
  const dir = getDistDir(pathList.join('/'))
  fileUtils.ensureDirectory(dir);
  return dir;
}

function flatBookmarks(bookmarks, flatList, root) {
  // Flattens tree structure of bookmarks into list. Recursive function.
  bookmarks.forEach(function (item, index) {
    if (item.type == 'bookmark') {
      flatList.push({ 'url': item.url, 'title': item.title, 'path': root })
    } else { // item is a directory - recursively search it
      var newRoot = root.concat(cleanPath(item.title))
      flatList = flatBookmarks(item.children, flatList, newRoot)
    }
  });
  return flatList;
}

function cleanPages(pages) {
  // cleans title and makes sure that directory exists
  var result = []
  for (const page of pages) {
    const title = cleanTitle(page.title || page.url.substring(0,100))
    result.push({
      url: page.url,
      title: title,
      path: directoryFromPathList(page.path)
    })
  }
  return result
}

function getPages(bookmarksFilePath) {
  // reads bookmarks file and returns list of objects containing URL, title and path
  var html = fs.readFileSync(bookmarksFilePath, 'utf8');
  const bookmarks = parse(html);
  const pages = flatBookmarks(bookmarks, [], [])
  return cleanPages(pages)
}

module.exports = { getPages }
