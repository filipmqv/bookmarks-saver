const scrollPageToBottom = require('./scroll-to-bottom.js');
const EXTRA_MARGIN = 31; // additional margin in px added to bootom of page due to some error in browser resulting in webpage not fitting perfectly into pdf page


class GenericPageSaver {
  constructor(page, timeout, fullFileName) {
    this.page = page
    this.timeout = timeout
    this.fullFileName = fullFileName
  }

  async savePageAsPdf(url, cookies) {
    await this.handleCookies(cookies)
    const response = await this.openPage(url)

    if (response._status >= 400) {
      throw {message: response._status, name: response._statusText}
    }
    
    await this.page.emulateMediaType('screen');

    await this.beforeScroll()
    await this.scrollPage()
    await this.afterScroll()

    await this.beforeGenerate()
    await this.generatePDF()
    return url;
  }

  async handleCookies(cookies) {
    if (cookies) {
      await this.page.setCookie(...cookies)
    }
  }

  async openPage(url) {
    await this.page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 })
    return await this.page.goto(url, { timeout: this.timeout, waitUntil: 'networkidle2' })
  }

  async beforeScroll() {
    // can have custom action before scroll
  }

  async scrollPage() {
    await scrollPageToBottom(this.page);
  }

  async afterScroll() {
    // can have custom action after scroll
  }

  async beforeGenerate() {
    await this.page.waitForTimeout(3000);
  }

  async generatePDF() {
    let _height = await this.page.evaluate(() => document.documentElement.offsetHeight);
    let height = _height > 1080 ? _height : 1080
    let width = await this.page.evaluate(() => document.documentElement.offsetWidth);

    await this.page.pdf({
      path: this.fullFileName,
      printBackground: true,
      margin: 'none',
      height: `${height + EXTRA_MARGIN}px`,
      width: `${width}px`
    });
  }
}

module.exports = { GenericPageSaver }
