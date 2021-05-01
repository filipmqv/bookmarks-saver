const YoutubeDlWrap = require("youtube-dl-wrap");
const youtubeDlWrap = new YoutubeDlWrap();
const fs = require('fs');
var supportedYoutubeDlSitesRegexes = [];

const cliProgress = require('cli-progress');
const progressBar = new cliProgress.SingleBar({
  forceRedraw: true,
  format: '{percentage}% | {value}/{total} | ETA: {eta_formatted} | {currentURL}'
}, cliProgress.Presets.shades_classic);

var running = false
var errorUrls = []
var videoUrlsToSkipGlobal = []


async function verifyYoutubeDlIsInstalled() {
  try {
    await youtubeDlWrap.execPromise(["--version"])
  } catch (e) {
    throw "YoutubeDl is not installed or there is some problem with it"
  }
}

function videoFileName(dir, fileName) {
  // dir should already contain OUTPUT dir
  return dir ? `${dir}/${fileName}.mp4` : `${fileName}.mp4`
}

function isUrlYoutube(url) {
  return (url.includes("youtube.com") || url.includes("youtu.be"))
}

function isUrlYoutubeVideo(url) {
  // checks if URL is youtube video page (not channel, playlist or whole user page)
  return isUrlYoutube(url) && url.includes("/watch") && (!(url.includes("/channel") || url.includes("/playlist") || url.includes("/user")))
}

function isUrlVimeo(url) {
  return url.includes("vimeo")
}

function isUrlVimeoVideo(url) {
  // checks if URL is video. Such URLs contain only digits as identifier - opposed to users who also have letters
  return isUrlVimeo(url) && url.match(/vimeo.com\/[^a-zA-Z][0-9]*/)
}

async function listOfSupportedYoutubeDlSites() {
  var extractors = (await youtubeDlWrap.execPromise(["--list-extractors"])).split("\n")
  var domains = []
  for (var i = 0; i < extractors.length; i++) {
    var el = extractors[i].split(":")[0]
    if (el.includes("(") || el.includes(")") || el === "") {
      continue;
    }
    domains.push(el.toLowerCase())
  }
  return [...new Set(domains)]
}

async function supportedSitesRegexes() {
  const supportedYoutubeDlSites = (await listOfSupportedYoutubeDlSites()).concat(["youtu.be"])
  const regexes = []
  for (var i = 0; i < supportedYoutubeDlSites.length; i++) {
    regexes.push(new RegExp("https?:\/\/(www\.)?" + supportedYoutubeDlSites[i] + "[^a-zA-Z0-9][\/\.]?", "g"))
  }
  return regexes
}

async function isUrlSupported(url) {
  // check if given URL is supported (if video can be downloaded)
  if (supportedYoutubeDlSitesRegexes.some(v => url.match(v))) {
    if (isUrlYoutube(url)) {
      if (isUrlYoutubeVideo(url)) {
        return true
      }
    } else if (isUrlVimeo(url)) {
      if (isUrlVimeoVideo(url)) {
        return true
      }
    } else {
      return true
    }
  }
  return false
}

async function downloadVideo(url, dir, fileName) {
  const filepath = videoFileName(dir, fileName)
  if (fs.existsSync(filepath)) {
    return
  }
  await youtubeDlWrap.execPromise([url,
    "-f", "best",
    "-o", filepath,
    // todo uncomment "--download-archive", "config/downloaded-videos-archive.txt"
  ]),
    "--no-playlist"
}

async function initYoutubeDl() {
  verifyYoutubeDlIsInstalled()
  supportedYoutubeDlSitesRegexes = await supportedSitesRegexes()
}

async function downloadVideoList(pages, videoUrlsToSkip) {
  running = true
  videoUrlsToSkipGlobal = videoUrlsToSkip
  console.log("\nchecking videos to download");
  var videoUrls = []
  errorUrls = []
  for (const page of pages) {
    if (videoUrlsToSkip.simple.includes(page.url)) {
      // skip
    } else if (await isUrlSupported(page.url)) {
      videoUrls.push(page)
    }
  }

  const videosNumber = videoUrls.length;
  console.log("downloading " + videosNumber + " videos");
  progressBar.start(videosNumber, 0);
  for (const page of videoUrls) {
    const { url, path, title } = page;
    try {
      progressBar.update({ currentURL: url })
      await downloadVideo(url, path, title)
    } catch (e) {
      errorUrls.push({ timestamp: new Date().toISOString(), url: url, error: e.stderr });
    }
    progressBar.increment();
  }
  progressBar.stop();
  running = false
  return errorUrls
}

function kill() {
  return {running: running, current:errorUrls, previous:videoUrlsToSkipGlobal}
}

module.exports = { initYoutubeDl, isUrlYoutubeVideo, downloadVideoList, videoFileName, kill }
