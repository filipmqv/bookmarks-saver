# Bookmarks-saver

## Description

This script downloads all bookmarked pages as PDFs and downloads videos from pages that are supported by `youtube-dl` tool (eg. Youtube, Vimeo, Facebook etc.) - to check full list of supported pages run `youtube-dl --list-extractors`. All content will be saved in directory `dist`.

Any page or video that failed to be downloaded, will be listed in `errors-{timestamp}.json` file in `errors/page` or `errors/video` directories after the script finishes. Newest file is also used as a list to skip urls in future script executions.

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

First, export bookmarks from your browser to HTML file. Put file with bookmarks in root directory of this app. Name of the file by default should be `bookmarks.html` (can be customized).

To run the script:
```
node index.js
```

## Customize

You can customize the script using `config/default.json` file (permanent changes or defaults) or use commandline args per script execution. For available options run:
```
node index.js --help
``` 

### Bookmarks file

You can change bookmarks file name.

### Page downloader

You can change number of pages that are downloaded concurrently - check `concurrency` option. For best performance set it to number of CPU cores.

### Video downloader

`config/downloaded-videos-archive.txt` is a an output file of `youtube-dl` script and contains list of successfully downloaded videos. Those will be ommited during next script execution. For more info check https://github.com/ytdl-org/youtube-dl -> `--download-archive FILE` param.

### Adblock

`config/adblock` directory contains 2 files:
- `custom-filters.txt` is for providing your own rules for adblock https://help.eyeo.com/adblockplus/how-to-write-filters
- `filters-list.txt` is a list of URLs from where filters will be downloaded. By default it contains some filters from https://majkiit.github.io/polish-ads-filter/
