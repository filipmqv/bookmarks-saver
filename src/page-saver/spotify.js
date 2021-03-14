const random = require('random');
const fs = require('fs');
const { GenericPageSaver } = require('./generic');

var results = []
var currIndex = 0

function isUrlSpotifyPlaylist(url) {
  return (url.includes("https://open.spotify.com/playlist/") || url.includes("https://open.spotify.com/collection/tracks"))
}

class SpotifyPageSaver extends GenericPageSaver {
  async scrollPage() {
    // overrides default scrolling with custom one that also collects tracks to JSON file
    await checkPlaylistScrollForNewSongs(this.page)
    this.dumpSongsToFile()
  }

  dumpSongsToFile() {
    let data = JSON.stringify(results);
    const name = this.fullFileName.replace(".pdf", ".json")
    fs.writeFileSync(name, data);
  }
}

async function checkPlaylistScrollForNewSongs(page) {
  await page.focus('body');
  // click just above the album art area in y-position and anywhere along the middle of the x position
  // in line where they would meet
  await page.mouse.click(random.int(242, 1200), random.int(65, 85), {
    delay: random.int(50, 250)
  });

  let lastAriaRowindex = -1, currentAriaRowindex = 0
  while (lastAriaRowindex !== currentAriaRowindex) {
    const tempCurrentAriaRowindex = await scrollSpotifyPageToBottom(page);
    // console.log(tempCurrentAriaRowindex, lastAriaRowindex, currentAriaRowindex, currentAriaRowindex-lastAriaRowindex);
    // await page.waitForTimeout(random.int(500, 2000));

    if (lastAriaRowindex === -1) {
      lastAriaRowindex = tempCurrentAriaRowindex
    } else {
      lastAriaRowindex = currentAriaRowindex
      currentAriaRowindex = tempCurrentAriaRowindex
    }
  }
}

async function getInnerText(elementHandle) {
  if (!elementHandle) {
    return null
  }
  let elementProperty = await elementHandle.getProperty('innerText')
  const innerText = await elementProperty.jsonValue()
  return innerText
}

async function getSong(elementHandle) {
  let number = await getInnerText(await elementHandle.$('div > div[aria-colindex="1"] > div > span'))
  if (!number) {
    return null
  }
  let title = await getInnerText(await elementHandle.$('div > div[aria-colindex="2"] > div > div > span > span'))
  let artist = await getInnerText(await elementHandle.$('div > div[aria-colindex="2"] > div > span > a > span > span'))
  let album = await getInnerText(await elementHandle.$('div > div[aria-colindex="3"] > a > span > span'))
  return {number: number, title: title, artist: artist, album: album}
}

async function getRows(page) {
  let selector = 'div[role="row"]'
  return await page.$$(selector)
}

async function getRowIndex(row) {
  return await row.evaluate(e => e.getAttribute("aria-rowindex"))
}

async function scrollSpotifyPageToBottom(page) {
  for (let j = 0; j < 2; j++) {
    await page.keyboard.press('PageDown');
    await page.keyboard.press('ArrowDown');
  }
  var rows = await getRows(page)
  const lastAriaRowindex = await getRowIndex(rows[rows.length-1])

  for (let row of rows) {
    let res = await getSong(row)
    if (res && res.number > currIndex) {
      results.push(res)
      currIndex++
    }
  }
  await page.waitForTimeout(random.int(1,100));
  return lastAriaRowindex
}

module.exports = { isUrlSpotifyPlaylist, SpotifyPageSaver }