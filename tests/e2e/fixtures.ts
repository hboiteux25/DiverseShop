import { expect, test as base } from "@playwright/test"
import type { ConsoleMessage, Page } from "@playwright/test"

type ConsoleIssue = {
  type: string
  text: string
  location: string
}

function formatLocation(message: ConsoleMessage) {
  const location = message.location()

  if (!location.url) {
    return ""
  }

  return `${location.url}:${location.lineNumber}:${location.columnNumber}`
}

function isRelevantConsoleError(text: string) {
  const ignoredFragments = [
    "Download the React DevTools",
    "favicon.ico",
  ]

  return !ignoredFragments.some((fragment) => text.includes(fragment))
}

function collectConsoleIssues(page: Page) {
  const issues: ConsoleIssue[] = []

  page.on("console", (message) => {
    if (message.type() !== "error") {
      return
    }

    const text = message.text()

    if (!isRelevantConsoleError(text)) {
      return
    }

    issues.push({
      type: message.type(),
      text,
      location: formatLocation(message),
    })
  })

  page.on("pageerror", (error) => {
    issues.push({
      type: "pageerror",
      text: error.message,
      location: "",
    })
  })

  return issues
}

export const test = base.extend<{ consoleIssues: ConsoleIssue[] }>({
  consoleIssues: async ({ page }, run) => {
    const issues = collectConsoleIssues(page)

    await run(issues)

    expect(issues).toEqual([])
  },
})

export { expect }
