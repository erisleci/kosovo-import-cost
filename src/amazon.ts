import type { Currency } from "./import-charges"

export type ListedProduct = {
  asin: string | null
  title: string
  price: { amount: string; currency: Currency } | null
  /** The element the calculator button goes after. */
  anchor: Element
  /** The product card or page section; marked once a button is added. */
  container: Element
}

export type WeightKind = "package" | "item"

export type ProductDetails = {
  /** Best weight found on Amazon (package weight preferred over item weight). */
  weightLb: number | null
  /** Whether weightLb is a package/shipping weight or a bare item weight. */
  weightKind: WeightKind | null
  /** The detail row the weight came from, such as "Package Dimensions" or "Item Weight". */
  weightSource: string | null
  /** Bare item weight in lb, if listed on Amazon. */
  itemWeightLb: number | null
  /** Package/shipping weight in lb, if listed on Amazon. */
  packageWeightLb: number | null
  /** Package dimensions text (e.g. "10.67 x 9.33 x 4.02 inches"), if listed. */
  packageDimensions: string | null
  /** Product dimensions text (e.g. "6.1 x 2.9 x 0.3 inches"), if listed. */
  productDimensions: string | null
  /** Items listed in Amazon's "What's in the box" or "Included Components". */
  inTheBox: string[]
  breadcrumbs: string[]
}

const currencySymbols: Record<string, Currency> = { $: "USD", "€": "EUR" }

const invisibleMarks = /[\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g

function clean(value: string | null | undefined) {
  return value?.replace(invisibleMarks, "").replace(/\s+/g, " ").trim() ?? ""
}

export function parsePrice(text: string | null | undefined) {
  const match = text?.trim().match(/^(\$|€)\s*([\d,]+(?:\.\d+)?)/)
  if (!match) return null
  const amount = match[2].replace(/,/g, "")
  if (!Number(amount)) return null
  return { amount, currency: currencySymbols[match[1]] }
}

const poundsPer: Record<string, number> = {
  pound: 1,
  pounds: 1,
  lb: 1,
  lbs: 1,
  ounce: 1 / 16,
  ounces: 1 / 16,
  oz: 1 / 16,
  kilogram: 2.20462,
  kilograms: 2.20462,
  kg: 2.20462,
  kgs: 2.20462,
  gram: 0.00220462,
  grams: 0.00220462,
  g: 0.00220462,
}

const numberPattern = "(?:\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:[.,]\\d+)?)"

const compoundLbOz = new RegExp(
  `(?<![\\w.])(${numberPattern})\\s*(?:pounds?|lbs?)\\.?(?:\\s*,?\\s*|\\s+and\\s+)(${numberPattern})\\s*(?:ounces?|oz)\\.?\\b`,
  "i"
)

const compoundKgG = new RegExp(
  `(?<![\\w.])(${numberPattern})\\s*(?:kilograms?|kgs?)\\.?(?:\\s*,?\\s*|\\s+and\\s+)(${numberPattern})\\s*(?:grams?|g)\\.?\\b`,
  "i"
)

const singleWeight = new RegExp(
  `(?<![\\w.])(${numberPattern})(\\s*)(pounds?|lbs?|ounces?|oz|kilograms?|kgs?|grams?|g)\\b`,
  "gi"
)

function parseNumber(raw: string) {
  if (/^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(raw)) {
    return Number(raw.replace(/,/g, ""))
  }
  return Number(raw.replace(",", "."))
}

function roundLb(pounds: number) {
  if (!Number.isFinite(pounds) || pounds <= 0) return null
  return Math.max(0.01, Math.round(pounds * 100) / 100)
}

export function parseWeightLb(text: string): number | null {
  const lbOz = text.match(compoundLbOz)
  if (lbOz) {
    const pounds = parseNumber(lbOz[1]) + parseNumber(lbOz[2]) / 16
    const rounded = roundLb(pounds)
    if (rounded !== null) return rounded
  }
  const kgG = text.match(compoundKgG)
  if (kgG) {
    const pounds =
      parseNumber(kgG[1]) * poundsPer.kg + parseNumber(kgG[2]) * poundsPer.g
    const rounded = roundLb(pounds)
    if (rounded !== null) return rounded
  }
  for (const match of text.matchAll(singleWeight)) {
    const space = match[2]
    const rawUnit = match[3]
    // Skip radio/network labels like "5G" or "2.4G" (uppercase G with no space).
    if (rawUnit === "G" && space === "") continue
    const value = parseNumber(match[1])
    const rounded = roundLb(value * poundsPer[rawUnit.toLowerCase()])
    if (rounded !== null) return rounded
  }
  return null
}

export function parseDimensions(value: string): string | null {
  const beforeSemicolon = clean(value.split(";")[0])
  if (!/\d+(?:\.\d+)?\s*[x×]\s*\d+/i.test(beforeSemicolon)) return null
  return beforeSemicolon
}

// Package/shipping rows include the retail box, which is much closer to what
// the forwarder weighs than bare Item Weight.
const packageWeightLabels = [
  /package\s*weight/i,
  /shipping\s*weight/i,
  /gross\s*weight/i,
  /package\s*dimensions/i,
]

const itemWeightLabels = [
  /item\s*weight/i,
  /product\s*weight/i,
  /net\s*weight/i,
  /product\s*dimensions/i,
  /^weight$/i,
]

function detailRows(doc: ParentNode) {
  const rows: Array<{ label: string; value: string }> = []
  for (const row of doc.querySelectorAll(
    "#productDetails_techSpec_section_1 tr, #productDetails_techSpec_section_2 tr, #productDetails_detailBullets_sections1 tr, #productDetails_db_sections tr, #prodDetails tr, #tech tr, #technicalSpecifications_section_1 tr, table.prodDetTable tr, #productOverview_feature_div tr"
  )) {
    const th = row.querySelector("th")
    if (th) {
      rows.push({
        label: clean(th.textContent),
        value: clean(row.querySelector("td")?.textContent),
      })
      continue
    }
    const cells = row.querySelectorAll("td")
    if (cells.length >= 2) {
      rows.push({
        label: clean(cells[0].textContent),
        value: clean(cells[1].textContent),
      })
    }
  }
  for (const item of doc.querySelectorAll(
    "#detailBullets_feature_div li:not(li li), #detailBulletsWrapper_feature_div li:not(li li)"
  )) {
    const cleaned = clean(item.textContent)
    const colon = cleaned.indexOf(":")
    if (colon === -1) continue
    rows.push({
      label: clean(cleaned.slice(0, colon)),
      value: clean(cleaned.slice(colon + 1)),
    })
  }
  return rows
}

function firstWeight(
  rows: Array<{ label: string; value: string }>,
  labels: RegExp[]
) {
  for (const label of labels) {
    for (const row of rows) {
      if (!label.test(row.label)) continue
      const lb = parseWeightLb(row.value)
      if (lb !== null) return { lb, source: row.label }
    }
  }
  return null
}

function firstDimensions(
  rows: Array<{ label: string; value: string }>,
  label: RegExp
) {
  for (const row of rows) {
    if (!label.test(row.label)) continue
    const dims = parseDimensions(row.value)
    if (dims) return dims
  }
  return null
}

export function readDetails(doc: ParentNode): ProductDetails {
  const rows = detailRows(doc)
  const packageWeight = firstWeight(rows, packageWeightLabels)
  const itemWeight = firstWeight(rows, itemWeightLabels)
  const packageDimensions = firstDimensions(rows, /package\s*dimensions/i)
  const productDimensions = firstDimensions(
    rows,
    /(?:product|item)\s*dimensions/i
  )

  // A package weight smaller than the listed item weight is a listing error.
  const packageTrusted =
    packageWeight !== null &&
    (itemWeight === null || packageWeight.lb >= itemWeight.lb)

  let weightLb: number | null = null
  let weightKind: WeightKind | null = null
  let weightSource: string | null = null
  if (packageTrusted) {
    weightLb = packageWeight.lb
    weightKind = "package"
    weightSource = packageWeight.source
  } else if (itemWeight !== null) {
    weightLb = itemWeight.lb
    weightKind = "item"
    weightSource = itemWeight.source
  }

  const breadcrumbs = [
    ...doc.querySelectorAll("#wayfinding-breadcrumbs_feature_div li a"),
  ]
    .map((a) => clean(a.textContent))
    .filter(Boolean)

  let inTheBox = [
    ...doc.querySelectorAll("#witb-content-list li, #witb-content-list dd"),
  ]
    .map((el) => clean(el.textContent))
    .filter(Boolean)
  if (inTheBox.length === 0) {
    const included = rows.find(
      (r) => /included\s*components/i.test(r.label) && r.value
    )
    if (included) inTheBox = [included.value]
  }

  return {
    weightLb,
    weightKind,
    weightSource,
    itemWeightLb: itemWeight?.lb ?? null,
    packageWeightLb: packageWeight?.lb ?? null,
    packageDimensions,
    productDimensions,
    inTheBox,
    breadcrumbs,
  }
}

const text = (element: Element | null | undefined) =>
  clean(element?.textContent)

function productPage(doc: Document): ListedProduct[] {
  const title = doc.querySelector("#productTitle")
  if (!title) return []
  const anchor = title.closest("#title") ?? title
  const price = parsePrice(
    text(
      doc.querySelector(
        "#corePrice_feature_div .a-price .a-offscreen, #corePriceDisplay_desktop_feature_div .priceToPay .a-offscreen, #corePriceDisplay_desktop_feature_div .a-price .a-offscreen, #apex_desktop .a-price .a-offscreen, #price_inside_buybox"
      )
    )
  )
  const asin =
    doc.querySelector<HTMLInputElement>("input#ASIN")?.value ??
    doc.location.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i)?.[1] ??
    null
  return [{ asin, title: text(title), price, anchor, container: anchor }]
}

function searchResults(doc: Document): ListedProduct[] {
  return [
    ...doc.querySelectorAll(
      '[data-component-type="s-search-result"][data-asin]'
    ),
  ].flatMap((card) => {
    const asin = card.getAttribute("data-asin")
    // Cards can have a brand line in an h2 above the title's h2.
    const heading =
      card.querySelector('[data-cy="title-recipe"] h2[aria-label]') ??
      card.querySelector("h2[aria-label]") ??
      card.querySelector("h2")
    if (!asin || !heading) return []
    // Put the button after the title link, not inside it.
    const anchor = heading.closest("a") ?? heading
    const price = parsePrice(
      text(card.querySelector(".a-price:not(.a-text-price) .a-offscreen"))
    )
    return [{ asin, title: text(heading), price, anchor, container: card }]
  })
}

function cartItems(doc: Document): ListedProduct[] {
  return [
    ...doc.querySelectorAll(
      '#sc-active-cart [data-asin].sc-list-item, [data-name="Active Items"] [data-asin]'
    ),
  ].flatMap((item) => {
    const asin = item.getAttribute("data-asin")
    const anchor = item.querySelector(
      ".sc-product-title, .sc-item-product-title-cont, .a-truncate-full"
    )
    if (!asin || !anchor) return []
    const fromAttribute = item.getAttribute("data-price")
    const price = fromAttribute
      ? parsePrice(`$${fromAttribute}`)
      : parsePrice(
          text(item.querySelector(".sc-product-price, .a-price .a-offscreen"))
        )
    return [{ asin, title: text(anchor), price, anchor, container: item }]
  })
}

/** Finds products on a product page, search results page or cart. */
export function findProducts(doc: Document): ListedProduct[] {
  const path = doc.location.pathname
  if (/^\/(gp\/cart|cart)/.test(path)) return cartItems(doc)
  if (doc.querySelector("#productTitle")) return productPage(doc)
  return searchResults(doc)
}
