/// <reference types="chrome" />
import { loadSettings } from "./messages"

const key = document.querySelector<HTMLInputElement>("#key")!
const outside = document.querySelector<HTMLInputElement>("#outside")!
const estimate = document.querySelector<HTMLInputElement>("#estimate")!
const status = document.querySelector<HTMLElement>("#status")!

function show(message: string) {
  status.textContent = message
  setTimeout(() => (status.textContent = ""), 2000)
}

void loadSettings().then((settings) => {
  key.value = settings.openRouterKey
  outside.checked = settings.outsidePrishtina
  estimate.checked = settings.estimateWeight
})

void fetch(chrome.runtime.getURL("tariff.json"))
  .then(
    (response) =>
      response.json() as Promise<{ fetchedAt: string; rows: unknown[] }>
  )
  .then((file) => {
    document.querySelector("#tariff")!.textContent =
      `Tariff: ${file.rows.length} lines from dogana.rks-gov.net, downloaded ${file.fetchedAt}.`
  })

document.querySelector("#save")!.addEventListener("click", async () => {
  await chrome.storage.local.set({
    openRouterKey: key.value.trim(),
    outsidePrishtina: outside.checked,
    estimateWeight: estimate.checked,
  })
  show("Saved")
})

async function savedKeys() {
  const stored = await chrome.storage.local.get(null)
  return Object.keys(stored).filter(
    (name) => name.startsWith("classification:") || name.startsWith("weight:")
  )
}

async function showSavedCount() {
  const keys = await savedKeys()
  const classifications = keys.filter((k) =>
    k.startsWith("classification:")
  ).length
  const weights = keys.filter((k) => k.startsWith("weight:")).length
  document.querySelector("#saved")!.textContent =
    `${classifications} saved ${classifications === 1 ? "tariff line" : "tariff lines"} and ${weights} saved package ${weights === 1 ? "weight" : "weights"}. OpenRouter is not called again for them.`
}
void showSavedCount()

document.querySelector("#clear")!.addEventListener("click", async () => {
  await chrome.storage.local.remove(await savedKeys())
  await showSavedCount()
  show("Cleared")
})
