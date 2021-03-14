async function scrollPageToBottom(page, scrollStep = 250, scrollDelay = 100, timeout = 20) {
  const start = Date.now();
  const lastPosition = await page.evaluate(
    async (step, delay, start, timeout) => {
      const getScrollHeight = (element) => {
        if (!element) return 0

        const { scrollHeight, offsetHeight, clientHeight } = element
        return Math.max(scrollHeight, offsetHeight, clientHeight)
      }

      const position = await new Promise((resolve) => {
        let count = 0
        const intervalId = setInterval(() => {
          const { body } = document
          const availableScrollHeight = getScrollHeight(body)

          window.scrollBy(0, step)
          count += step

          const now = Date.now();
          if (count >= availableScrollHeight || now - start > timeout * 1000) {
            clearInterval(intervalId)
            resolve(count)
          }
        }, delay)
      })

      return position
    },
    scrollStep,
    scrollDelay,
    start,
    timeout
  )
  return lastPosition
}

module.exports = scrollPageToBottom