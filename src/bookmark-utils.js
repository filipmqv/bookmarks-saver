const fileUtils = require('./file-utils.js')
const fs = require('fs');

function cleanTitle(title) {
  // replace non-asci chars with `_`
  return title.replace(/[^a-z0-9_\-ąćęłńóśźż]/gi, '_');
}

function directoryFromBookmarks(pathList) {
  const dir = 'dist/' + pathList.join('/');
  fileUtils.ensureDirectory(dir);
  return dir;
}

function flatBookmarks(bookmarks, flatList, root) {
  // Flattens tree structure of bookmarks into list. Recursive function.
  bookmarks.forEach(function (item, index) {
    if (item.type == 'bookmark') {
      flatList.push({'url': item.url, 'title': item.title, 'path': root})
    } else {
      var newRoot = root.concat(item.title)
      flatList = flatBookmarks(item.children, flatList, newRoot)
    }
  });
  return flatList;
}

module.exports = {cleanTitle, directoryFromBookmarks, flatBookmarks}
