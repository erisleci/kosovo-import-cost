/// <reference types="chrome" />
// Reloads the extension during `npm run watch`. Only dev builds call
// these; plain builds drop them because __DEV__ is false.

declare global {
  const __DEV__: boolean
  const __BUILD_ID__: string
}

/** Background: reload when dist/build-id.txt no longer matches this build. */
export async function reloadIfRebuilt() {
  const response = await fetch(chrome.runtime.getURL("build-id.txt"), {
    cache: "no-store",
  })
  const latest = (await response.text()).trim()
  if (latest && latest !== __BUILD_ID__) chrome.runtime.reload()
}

/** Background: after a reload, refresh Amazon tabs so they get the new code. */
export function refreshAmazonTabsAfterReload() {
  chrome.runtime.onInstalled.addListener(({ reason }) => {
    if (reason !== chrome.runtime.OnInstalledReason.UPDATE) return
    void chrome.tabs.query({ url: "https://www.amazon.com/*" }).then((tabs) => {
      for (const tab of tabs) if (tab.id) void chrome.tabs.reload(tab.id)
    })
  })
}

/**
 * Content script: ask the background worker every second. The message also
 * wakes the worker, which Chrome stops after 30 seconds of quiet. Stops once
 * the extension has reloaded and this script is orphaned.
 */
export function watchForRebuilds() {
  const timer = setInterval(() => {
    try {
      chrome.runtime
        .sendMessage({ type: "dev-check" })
        .catch(() => clearInterval(timer))
    } catch {
      clearInterval(timer)
    }
  }, 1000)
}
