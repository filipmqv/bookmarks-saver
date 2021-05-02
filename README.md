# Bookmarks-saver

## Description

This script downloads all bookmarked pages as PDFs and downloads videos from pages that are supported by `youtube-dl` tool (eg. Youtube, Vimeo, Facebook etc.) - to check full list of supported pages run `youtube-dl --list-extractors`. All content will be saved in directory `dist`.

Script logs errors in `log` directory - more in [Logs](#logs) section.

## Install

Install npm and nodejs first - instructions here https://github.com/nodesource/distributions/blob/master/README.md
Make sure that `node -v` is at least `v15.0.1`

Then install node modules
```
npm i
```

Also install `youtube-dl` library - http://ytdl-org.github.io/youtube-dl/download.html

## Run

First, export bookmarks from your browser to HTML file. Put file with bookmarks in `config` directory of this app. Name of the file by default should be `bookmarks.html` (can be customized).

To run the script:
```
node index.js
```

You will find saved bookmarks (PDF, videos) and logs in `output` directory.

## Customize

You can customize the script using `config/default.json` file (permanent changes or defaults) or use commandline args per script execution. For available options run:
```
node index.js --help
``` 

### Bookmarks file

You can change bookmarks file name.

### Page downloader

You can change number of pages that are downloaded concurrently - check `concurrency` option. For best performance set it to number of CPU cores.

### Adblock

`config/adblock` directory contains 2 files:
- `custom-filters.txt` is for providing your own rules for adblock https://help.eyeo.com/adblockplus/how-to-write-filters
- `filters-list.txt` is a list of URLs from where filters will be downloaded. By default it contains some filters from https://majkiit.github.io/polish-ads-filter/

### Cookies

You can export cookies from your browser to a Netscape format file (e.g. using Firefox extension https://addons.mozilla.org/pl/firefox/addon/cookies-txt/) and put this file to `config` directory. Name of this file is customizable (`cookies.txt` by default). With this file, the script will be able to act as logged in user (as you) and gain access to your personal data on websites (e.g. your favourite songs playlist on Spotify).

## Logs

Any page or video that failed to be downloaded, will be listed in `log-{timestamp}.json` file in `log/page` or `log/video` directories after the script finishes. Newest file is also used as a list to skip urls in future script executions. Additionally script collects urls that were found in archive, so that they are re-checked every time.

## Custom page downloaders

For those pages downloader has some special behaviour:
- youtube video page - slower scroll do obtain comments (max 20 seconds of scrolling)
- spotify playlists and favourite songs - generate additional JSON file with song titles, artists, albums. 