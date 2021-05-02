let { CookieMap } = require('./utils/cookiefile/http-cookiefile.js')
const { options } = require('./config-utils')
const cookiesFilePath = options.cookiesFilePath

function transformCookie(record) {
  // maps cookie's fields to format readable by puppeteer
  const transformed = {
    name: record.cookieName,
    value: record.value,
    domain: record.domain,
    path: record.path,
    httpOnly: record.httpOnly,
    secure: record.https,
    session: false
  }
  if (record.expire > 0) {
    transformed["expires"] = record.expire
  }
  return transformed
}

async function cookiesForDomain(cookiesList, domain) {
  // returns cookies matching given domain. Transforms cookies to form that is accepted by puppeteer
  if (!cookiesList || !cookiesList.length) {
    return []
  }
  const domainCookies = cookiesList.filter(a => a.domain.includes(domain))
  const puppeteerCookies = domainCookies.map(a => transformCookie(a))
  return puppeteerCookies
}

function allCookies() {
  // reads cookie file and returns cookies as list
  try {
    const cookiesMap = new CookieMap(cookiesFilePath);
    return [...cookiesMap.values()]
  } catch (error) {
    console.log("could not read cookies file - proceeding without cookies")
    return []
  }
}

module.exports = { allCookies, cookiesForDomain }