# Bookmarks-saver

## Description

This script downloads all bookmarked pages as PDFs and downloads videos from pages that are supported by `youtube-dl` tool (eg. Youtube, Vimeo, Facebook etc.) - to check full list of supported pages run `youtube-dl --list-extractors`.

Any page or video that failed to be downloaded, will be listed in `errors-{timestamp}.json` file in `errors` directory after the script finishes. Newest file is also a list to skip those urls in future script executions.

## Install

Install npm and nodejs first (example command for Ubuntu):
```
sudo apt install nodejs npm
```
Make sure that `nodejs -v` is at least `v12.18.2`

Then install node modules
```
npm i
```

Also install `youtube-dl` library - http://ytdl-org.github.io/youtube-dl/download.html

## Run

First, export bookmarks from your browser to HTML file. Put file with bookmarks in root directory of this app. Name of the file should be `bookmarks.html`

To run the script:
```
node index.js
```
or
```
node -r esm main.js
```

## Customize

### Page downloader

You can change number of pages that are downloaded concurrently - change `CONCURRENCY` const in `main.js` file.

### Video downloader

`config/downloaded-videos-archive.txt` is a an output file of `youtube-dl` script and contains list of successfully downloaded videos. Those will be ommited during next script execution. For more info check https://github.com/ytdl-org/youtube-dl -> `--download-archive FILE` param.

### Adblock

`config/adblock` directory contains 2 files:
- `custom-filters.txt` is for providing your own rules for adblock https://help.eyeo.com/adblockplus/how-to-write-filters
- `filters-list.txt` is a list of URLs from where filters will be downloaded. By default it contains some filters from https://majkiit.github.io/polish-ads-filter/
