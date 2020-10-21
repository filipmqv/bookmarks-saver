const YoutubeDlWrap = require("youtube-dl-wrap");
const youtubeDlWrap = new YoutubeDlWrap();
var supportedYoutubeDlSitesRegexes = [];

const cliProgress = require('cli-progress');
const progressBar = new cliProgress.SingleBar({
  forceRedraw: true,
  format: '{percentage}% | {value}/{total} | ETA: {eta_formatted} | {currentURL}'
}, cliProgress.Presets.shades_classic);

async function verifyYoutubeDlIsInstalled() {
  try {
    const v = await youtubeDlWrap.execPromise(["--version"])
  } catch (e) {
    throw "YoutubeDl is not installed or there is some problem with it"
  }
}

async function isUrlYoutube(url) {
  return (url.includes("youtube.com") || url.includes("youtu.be"))
}

async function isUrlYoutubeVideo(url) {
  // checks if URL is youtube video page (not channel, playlist or whole user page)
  return await isUrlYoutube(url) && url.includes("/watch") && (!(url.includes("/channel") || url.includes("/playlist") || url.includes("/user")))
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
  // for pages that contain video - download both: the page and the video
  if (supportedYoutubeDlSitesRegexes.some(v => url.match(v))) {
    if (await isUrlYoutube(url)) {
      if (await isUrlYoutubeVideo(url)) {
        return true
      }
    } else if (url.includes("vimeo")) {
      // video URLs contain only digits as identifier (users have also letters) - do not download users
      if (url.match(/vimeo.com\/[^a-zA-Z][0-9]*/)) {
        return true
      }
    } else {
      return true
    }
  }
  return false
}

async function downloadVideo(url, dir, fileName) {
  const filepath = dir ? `${dir}/${fileName}.mp4` : `${fileName}.mp4`
  await youtubeDlWrap.execPromise([url,
    "-f", "best",
    "-o", filepath,
    "--download-archive", "config/downloaded-videos-archive.txt"]),
    "--no-playlist"
}

async function initYoutubeDl() {
  verifyYoutubeDlIsInstalled()
  supportedYoutubeDlSitesRegexes = await supportedSitesRegexes()
}

async function downloadVideoList(pages, videoUrlsToSkip) {
  console.log("\nchecking videos to download");
  var videoUrls = []
  var errorUrls = []
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
    const { url, dir, title } = page;
    try {
      progressBar.update({ currentURL: url })
      await downloadVideo(url, dir, title)
    } catch (e) {
      errorUrls.push({ timestamp: new Date().toISOString(), url: url, error: e.stderr });
    }
    progressBar.increment();
  }
  progressBar.stop();
  return errorUrls
}

module.exports = { initYoutubeDl, isUrlYoutubeVideo, downloadVideoList }
