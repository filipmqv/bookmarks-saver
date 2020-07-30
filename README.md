# Bookmarks-saver

This script downloads all bookmarked pages as PDFs and downloads videos from pages that are supported by `youtube-dl` tool (eg. Youtube, Vimeo, Facebook etc.) - to check full list of supported pages run `youtube-dl --list-extractors`.

Any page or video that failed to be downloaded, will be listed in `errors.json` file in root directory after the script finishes.

### Install
Install npm and nodejs first (example command for Ubuntu):
```
sudo apt install nodejs npm
```
Then install node modules
```
npm i
```
make sure that `nodejs -v` is at least `v12.18.2`

Also install `youtube-dl` library - http://ytdl-org.github.io/youtube-dl/download.html

### Run
Place file with bookmarks in root directory of this app. Name should be `bookmarks.html`

To run the script:
```
node -r esm main.js
```
