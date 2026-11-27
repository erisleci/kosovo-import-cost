/// <reference types="chrome" />
import { getLatestUsdEurRate } from "./rates"
import type { ReferenceRate } from "./rates"
import { categories, guessCategory } from "./categories"
import {
  candidateLines,
  categoryRequest,
  codeRequest,
  isOther,
  jevEndpoint,
  parseChoice,
} from "./jev"
import type { Product } from "./jev"
import { refreshAmazonTabsAfterReload, reloadIfRebuilt } from "./dev-reload"
import { loadSettings } from "./messages"
import type { Classification, Request, WeightResolution } from "./messages"
import { parseTariff, searchTariff } from "./tariff"
import type { Tariff } from "./tariff"
import {
  openRouterChatEndpoint,
  parseWeightEstimate,
  weightRequest,
} from "./weight"
import type { WeightInput } from "./weight"

// Below this confidence the first pass's product type is not trusted, and jev
// is asked again to choose among the tariff lines of its likeliest types.
const minimumConfidence = 0.5
const rateMaxAgeMs = 6 * 60 * 60 * 1000
const classificationVersion = 3
const weightVersion = 3

let tariffPromise: Promise<Tariff> | null = null
function tariff() {
  tariffPromise ??= fetch(chrome.runtime.getURL("tariff.json"))
    .then(
      (response) =>
        response.json() as Promise<Parameters<typeof parseTariff>[0]>
    )
    .then(parseTariff)
  return tariffPromise
}

async function askJev(apiKey: string, body: object) {
  const response = await fetch(jevEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
  return parseChoice(await response.json())
}

async function classifyWithJev(
  apiKey: string,
  product: Product,
  table: Tariff
) {
  const first = await askJev(apiKey, categoryRequest(product))
  const category = categories.find((c) => c.id === first.choice)
  if (category && !isOther(first) && first.confidence >= minimumConfidence) {
    return {
      row: table.byCode.get(category.code),
      confidence: first.confidence,
    }
  }
  const candidates = candidateLines(table, first)
  if (candidates.length === 0) return null
  if (candidates.length === 1) {
    return { row: candidates[0], confidence: first.confidence }
  }
  const second = await askJev(apiKey, codeRequest(product, candidates))
  return { row: table.byCode.get(second.choice), confidence: second.confidence }
}

// Saved per product (ASIN) in chrome.storage.local, so jev is called once per
// product. Only the code is stored; rates are read from the bundled tariff,
// so a tariff update applies to saved products too.
type SavedClassification = {
  code: string
  source: "jev" | "manual"
  confidence: number | null
}
const savedPrefix = `classification:${classificationVersion}:`

async function save(key: string, saved: SavedClassification) {
  await chrome.storage.local.set({ [savedPrefix + key]: saved })
}

async function loadSaved(key: string, table: Tariff) {
  const saved = (await chrome.storage.local.get(savedPrefix + key))[
    savedPrefix + key
  ] as SavedClassification | undefined
  const row = saved && table.byCode.get(saved.code)
  if (!saved || !row) return null
  return { ...saved, row, note: null, saved: true } satisfies Classification
}

async function classifyNew(
  key: string,
  product: Product,
  table: Tariff
): Promise<Classification | null> {
  const guess = guessCategory(
    `${product.title} ${product.breadcrumbs.join(" ")}`
  )
  const fromKeywords = (note: string): Classification | null => {
    const row = guess && table.byCode.get(guess.code)
    return row
      ? { row, source: "keywords", confidence: null, note, saved: false }
      : null
  }

  const { openRouterKey } = await loadSettings()
  if (!openRouterKey) {
    return fromKeywords(
      "Add an OpenRouter key in the extension options to classify with jev."
    )
  }
  try {
    const answer = await classifyWithJev(openRouterKey, product, table)
    if (!answer?.row) {
      return fromKeywords(
        "jev says this is none of the common product types. Check the line or pick one with Change."
      )
    }
    await save(key, {
      code: answer.row.code,
      source: "jev",
      confidence: answer.confidence,
    })
    return {
      row: answer.row,
      source: "jev",
      confidence: answer.confidence,
      note: null,
      saved: false,
    }
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause)
    return fromKeywords(`jev failed: ${message}`)
  }
}

// Opening the panel twice for the same product while jev is still answering
// shares one call.
const pending = new Map<string, Promise<Classification | null>>()

async function classify(key: string, product: Product) {
  const table = await tariff()
  const saved = await loadSaved(key, table)
  if (saved) return saved
  let call = pending.get(key)
  if (!call) {
    call = classifyNew(key, product, table).finally(() => pending.delete(key))
    pending.set(key, call)
  }
  return call
}

// Saved per product (ASIN) in chrome.storage.local so OpenRouter is called once
// per product, and manual overrides persist across visits.
type SavedWeight = {
  weightLb: number
  source: "openrouter" | "manual"
  reason: string | null
}
const savedWeightPrefix = `weight:${weightVersion}:`

async function saveWeight(key: string, saved: SavedWeight) {
  await chrome.storage.local.set({ [savedWeightPrefix + key]: saved })
}

async function loadSavedWeight(key: string): Promise<SavedWeight | null> {
  const saved = (await chrome.storage.local.get(savedWeightPrefix + key))[
    savedWeightPrefix + key
  ] as SavedWeight | undefined
  if (
    !saved ||
    typeof saved.weightLb !== "number" ||
    !Number.isFinite(saved.weightLb) ||
    saved.weightLb <= 0
  ) {
    return null
  }
  return saved
}

async function estimateWeightNew(
  key: string,
  product: WeightInput
): Promise<WeightResolution> {
  const { openRouterKey } = await loadSettings()
  if (!openRouterKey) {
    return {
      weightLb: null,
      source: null,
      saved: false,
      reason: null,
      note: "Add an OpenRouter key in the extension options to estimate package weight.",
    }
  }
  try {
    const response = await fetch(openRouterChatEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openRouterKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(weightRequest(product)),
    })
    let body: unknown
    try {
      body = await response.json()
    } catch {
      throw new Error(`OpenRouter returned ${response.status}`)
    }
    const estimate = parseWeightEstimate(body)
    await saveWeight(key, {
      weightLb: estimate.weightLb,
      source: "openrouter",
      reason: estimate.reason,
    })
    return {
      weightLb: estimate.weightLb,
      source: "openrouter",
      saved: false,
      reason: estimate.reason,
      note: null,
    }
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause)
    return {
      weightLb: null,
      source: null,
      saved: false,
      reason: null,
      note: `Weight estimate failed: ${message}`,
    }
  }
}

const pendingWeight = new Map<string, Promise<WeightResolution>>()

async function resolveWeight(
  key: string,
  product: WeightInput,
  forceEstimate = false
): Promise<WeightResolution> {
  if (!forceEstimate) {
    const saved = await loadSavedWeight(key)
    if (saved) {
      return {
        weightLb: saved.weightLb,
        source: saved.source,
        saved: true,
        reason: saved.reason,
        note: null,
      }
    }
    const amazonPackageTrusted =
      product.packageWeightLb !== null &&
      (product.itemWeightLb === null ||
        product.packageWeightLb >= product.itemWeightLb)
    if (amazonPackageTrusted) {
      return {
        weightLb: product.packageWeightLb,
        source: "amazon",
        saved: false,
        reason: null,
        note: null,
      }
    }
  }
  let call = pendingWeight.get(key)
  if (!call) {
    call = estimateWeightNew(key, product).finally(() =>
      pendingWeight.delete(key)
    )
    pendingWeight.set(key, call)
  }
  return call
}

async function rate(): Promise<ReferenceRate | null> {
  const stored = (await chrome.storage.local.get("rate")).rate as
    { value: ReferenceRate; at: number } | undefined
  if (stored && Date.now() - stored.at < rateMaxAgeMs) return stored.value
  try {
    const value = await getLatestUsdEurRate()
    await chrome.storage.local.set({ rate: { value, at: Date.now() } })
    return value
  } catch {
    return stored?.value ?? null
  }
}

async function handle(request: Request) {
  switch (request.type) {
    case "classify":
      return classify(request.key, request.product)
    case "remember":
      await save(request.key, {
        code: request.code,
        source: "manual",
        confidence: null,
      })
      return null
    case "weight":
      return resolveWeight(request.key, request.product, request.forceEstimate)
    case "rememberWeight":
      if (Number.isFinite(request.weightLb) && request.weightLb > 0) {
        await saveWeight(request.key, {
          weightLb: Math.round(request.weightLb * 100) / 100,
          source: "manual",
          reason: null,
        })
      }
      return null
    case "search":
      return searchTariff(await tariff(), request.query)
    case "row":
      return (await tariff()).byCode.get(request.code) ?? null
    case "rate":
      return rate()
    case "dev-check":
      if (__DEV__) await reloadIfRebuilt()
      return null
  }
}

chrome.runtime.onMessage.addListener((request: Request, _sender, reply) => {
  handle(request).then(
    (value) => reply({ ok: true, value }),
    (cause: unknown) =>
      reply({
        ok: false,
        error: cause instanceof Error ? cause.message : String(cause),
      })
  )
  return true
})

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage())

if (__DEV__) refreshAmazonTabsAfterReload()
