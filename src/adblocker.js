import { PuppeteerBlocker, parseFilters, fullLists } from '@cliqz/adblocker-puppeteer';
import fetch from 'cross-fetch'; // 'fetch' required for @cliqz/adblocker-puppeteer
const fs = require('fs');

const ADBLOCK_FILTERS_LIST = "config/adblock/filters-list.txt"
const ADBLOCK_CUSTOM_FILTERS = 'config/adblock/custom-filters.txt'

async function initUblock() {
    const filtersList = fs.readFileSync(ADBLOCK_FILTERS_LIST, 'utf8').split("\n").filter(Boolean) // filter removes empty lines
    const prebuildAndOwnList = filtersList.concat(fullLists)
    let blocker = await PuppeteerBlocker.fromLists(fetch, prebuildAndOwnList);
  
    const customFiltersList = fs.readFileSync(ADBLOCK_CUSTOM_FILTERS, 'utf-8')
    const { networkFilters, cosmeticFilters } = parseFilters(customFiltersList, blocker.config)
    blocker.update({newCosmeticFilters: cosmeticFilters, newNetworkFilters: networkFilters});
    return blocker
  }

module.exports = { initUblock }