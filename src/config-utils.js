const config = require('config');
const commandLineArgs = require('command-line-args');
const commandLineUsage = require('command-line-usage');

const optionDefinitions = [
  { name: 'help', alias: 'h', type: Boolean, description: 'Show options' },
  { name: 'bookmarks', alias: 'b', type: String, description: 'Name of the file with bookmarks. Default is `bookmarks.html`' },
  { name: 'noadblock', type: Boolean, description: 'Do not block ads (disable adblock).' },
  // Can download single URL instead of parsing bookmarks file
  { name: 'url', alias: 'u', type: String, description: 'Provide single URL to download' },
  { name: 'name', alias: 'n', type: String, description: 'Provide filename for single URL to download' },
  // following are script parts. If you add another separate script part, add it to `scriptParts` array below.
  { name: 'pages', alias: 'p', type: Boolean, description: 'Only download pages.' },
  { name: 'archive', alias: 'a', type: Boolean, description: 'Only download pages from webarchive.' },
  { name: 'videos', alias: 'v', type: Boolean, description: 'Only download videos.' },
];
const options = commandLineArgs(optionDefinitions);
const scriptParts = [options.pages, options.archive, options.videos];
options.allScript = scriptParts.every(Boolean) || !scriptParts.some(Boolean)
options.runPages = options.pages || options.allScript
options.runVideos = options.videos || options.allScript
options.runArchive = options.archive || options.allScript
options.bookmarksFileName = options.bookmarks || config.get('bookmarks.fileName');

const sections = [
  { header: 'Bookmarks-saver', content: 'Archives pages and videos from your bookmarks.' },
  { header: 'Options', optionList: optionDefinitions }
];
const usage = commandLineUsage(sections);

module.exports = { options, usage }