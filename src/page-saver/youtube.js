const { GenericPageSaver } = require('./generic');

class YoutubePageSaver extends GenericPageSaver {
  async beforeScroll() {
    // for youtube pages wait for comments section to load
    await this.page.waitForSelector('#comments');
    await this.page.focus('body');
  }

  async scrollPage() {
    // overrides default scrolling with custom one - slower and based only on time, not comparing height of page before and after scroll
    await this.scrollYoutubePageToBottom();
  }

  async scrollYoutubePageToBottom(scrollStep = 250, scrollDelay = 500, timeout = 20) {
    const start = Date.now();
    await this.page.evaluate(
      async (step, delay, start, timeout) => {
        await new Promise((resolve) => {
          const intervalId = setInterval(() => {
            window.scrollBy(0, step)

            const now = Date.now();
            if (now - start > timeout * 1000) {
              clearInterval(intervalId)
              resolve()
            }
          }, delay)
        })
      },
      scrollStep,
      scrollDelay,
      start,
      timeout
    )
  }
}

module.exports = { YoutubePageSaver }