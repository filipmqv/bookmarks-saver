const YoutubeDlWrap = require("youtube-dl-wrap");
const youtubeDlWrap = new YoutubeDlWrap();
var supportedYoutubeDlSitesRegexes = [];

async function verifyYoutubeDlIsInstalled() {
  try {
    const v = await youtubeDlWrap.execPromise(["--version"])
  } catch (e) {
    throw "YoutubeDl is not installed or there is some problem with it"
  }
}

async function listOfSupportedYoutubeDlSites() {
  var extractors = (await youtubeDlWrap.execPromise(["--list-extractors"])).split("\n")
  var domains = []
  for (var i = 0; i < extractors.length; i++) {
    var el = extractors[i].split(":")[0]
    if (el.includes("(") || el.includes(")") || el === ""){
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
      if (url.includes("youtube.com") || url.includes("youtu.be") || url.includes("youtube.pl")) {
        // make sure not to download channels, playlists or whole user for youtube
        if (!(url.includes("/channel") || url.includes("/playlist") || url.includes("/user"))) {
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

function updateProgressBar(bar, url) {
  bar.increment();
  bar.update({currentURL:url})
}

async function downloadYoutube(url, dir, fileName, bar) {
  updateProgressBar(bar, url)
  await youtubeDlWrap.execPromise([url,
    "-f", "best",
    "-o", `${dir}/${fileName}.mp4`,
    "--download-archive", "downloaded-videos-archive.txt"])
}

async function initYoutubeDl() {
  verifyYoutubeDlIsInstalled()
  supportedYoutubeDlSitesRegexes = await supportedSitesRegexes()
}

module.exports = {initYoutubeDl, isUrlSupported, downloadYoutube}
