/// <reference types="chrome" />
import {
  calculateImport,
  paketosOutsidePrishtinaEur,
  paketosQuote,
} from "./import-charges"
import type { Currency, ImportResult } from "./import-charges"
import type { ListedProduct, ProductDetails } from "./amazon"
import { loadSettings, send } from "./messages"
import type { Classification, WeightResolution } from "./messages"
import type { TariffRow } from "./tariff"
import type { WeightInput } from "./weight"

const styles = `
:host { all: initial; }
.panel {
  --bg: #171b20; --field: #1d2228; --fg: #e8ebee; --muted: #a1a9b3; --subtle: #747d88;
  --border: #2a3038; --input: #363e48; --primary: #3168e0; --link: #8fb1ff;
  --profit: #4fc58c; --loss: #f2766c; --warning: #e9b44c;
  box-sizing: border-box; width: 360px; max-height: min(640px, calc(100vh - 24px)); overflow: auto;
  padding: 16px; border: 1px solid var(--border); border-radius: 12px; background: var(--bg);
  color: var(--fg); font: 13px/1.4 "IBM Plex Sans", -apple-system, system-ui, sans-serif;
  box-shadow: 0 16px 40px rgb(0 0 0 / 0.45);
}
* { box-sizing: border-box; }
header { display: flex; gap: 8px; align-items: start; justify-content: space-between; }
h2 { margin: 0; font-size: 14px; font-weight: 600; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
button { font: inherit; color: inherit; cursor: pointer; }
.close { flex: none; width: 24px; height: 24px; border: 0; border-radius: 6px; background: transparent; color: var(--muted); font-size: 16px; }
.close:hover { background: var(--field); }
.category { margin-top: 12px; padding: 10px; border-radius: 8px; background: var(--field); }
.category-row { display: flex; justify-content: space-between; gap: 8px; }
.code { font-variant-numeric: tabular-nums; font-weight: 600; }
.desc { margin-top: 2px; color: var(--muted); font-size: 12px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.source { margin-top: 4px; color: var(--subtle); font-size: 11px; }
.link { border: 0; padding: 0; background: none; color: var(--link); font-size: 12px; }
.search { margin-top: 8px; }
.results { margin: 6px 0 0; padding: 0; list-style: none; max-height: 180px; overflow: auto; }
.results button { display: block; width: 100%; text-align: left; padding: 6px; border: 0; border-radius: 6px; background: none; font-size: 12px; }
.results button:hover { background: var(--bg); }
.results .rates { color: var(--subtle); }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }
.label-row { display: flex; justify-content: space-between; align-items: baseline; gap: 6px; }
.label-row .link { font-size: 11px; }
.label-row .link:disabled { opacity: 0.55; cursor: default; }
label { display: block; color: var(--muted); font-size: 12px; }
.field { display: flex; align-items: center; margin-top: 4px; border: 1px solid var(--input); border-radius: 8px; background: var(--field); }
.field:focus-within { outline: 2px solid var(--link); outline-offset: -1px; }
input, select { width: 100%; min-width: 0; height: 32px; padding: 0 8px; border: 0; background: transparent; color: var(--fg); font: inherit; outline: none; }
.field span { padding-right: 8px; color: var(--subtle); font-size: 12px; }
.check { display: flex; gap: 6px; align-items: center; margin-top: 10px; color: var(--muted); font-size: 12px; }
.check input { width: auto; height: auto; }
.hint { margin-top: 3px; color: var(--subtle); font-size: 11px; }
dl { margin: 14px 0 0; padding-top: 10px; border-top: 1px solid var(--border); display: grid; grid-template-columns: 1fr auto; gap: 4px 12px; }
dt { color: var(--muted); }
dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; }
.total { font-weight: 600; color: var(--fg); font-size: 14px; }
.profit { color: var(--profit); } .loss { color: var(--loss); }
.warning { margin-top: 10px; color: var(--warning); font-size: 12px; }
.error { margin-top: 10px; color: var(--loss); font-size: 12px; }
[hidden] { display: none !important; }
`

const markup = `
<div class="panel" role="dialog" aria-label="Kosovo import cost">
  <header><h2 data-title></h2><button class="close" data-close aria-label="Close">×</button></header>
  <div class="category">
    <div class="category-row"><span class="code" data-code>Classifying…</span><button class="link" data-change>Change</button></div>
    <div class="desc" data-desc></div>
    <div class="source" data-source></div>
    <div class="search" data-search hidden>
      <div class="field"><input data-query placeholder="Search the tariff, e.g. headphones or 8518"></div>
      <ul class="results" data-results></ul>
    </div>
  </div>
  <div class="grid">
    <div><label for="price">Price</label><div class="field"><input id="price" data-input="price" type="number" min="0" step="any"><select data-input="currency" aria-label="Currency"><option>USD</option><option>EUR</option></select></div></div>
    <div><label for="discount">Discount</label><div class="field"><input id="discount" data-input="discount" type="number" min="0" max="100" step="any" placeholder="0"><span>%</span></div><div class="hint">Customs and VAT use the price before it.</div></div>
    <div><div class="label-row"><label for="weight">Package weight</label><button type="button" class="link" data-estimate-weight hidden>Estimate</button></div><div class="field"><input id="weight" data-input="weight" type="number" min="0" step="any" placeholder="Loading…"><span>lb</span></div><div class="hint" data-weight-hint></div></div>
    <div><label for="shipping">Paketos shipping</label><div class="field"><input id="shipping" data-input="shipping" type="number" min="0" step="any"><span>EUR</span></div><div class="hint" data-shipping-hint></div></div>
    <div><label for="duty">Customs duty</label><div class="field"><input id="duty" data-input="duty" type="number" min="0" step="any"><span>%</span></div></div>
    <div><label for="vat">VAT</label><div class="field"><input id="vat" data-input="vat" type="number" min="0" step="any"><span>%</span></div></div>
    <div><label for="sale">Selling price</label><div class="field"><input id="sale" data-input="sale" type="number" min="0" step="any" placeholder="Optional"><span>EUR</span></div></div>
    <div><label for="rate">USD for 1 EUR</label><div class="field"><input id="rate" data-input="rate" type="number" min="0" step="any"></div><div class="hint" data-rate-hint></div></div>
  </div>
  <label class="check"><input type="checkbox" data-input="outside"> Delivery outside Prishtina (+€${paketosOutsidePrishtinaEur})</label>
  <div class="warning" data-excise hidden></div>
  <dl data-summary hidden>
    <dt>Product</dt><dd data-out="productEur"></dd>
    <dt>Shipping</dt><dd data-out="shippingEur"></dd>
    <dt>Customs duty</dt><dd data-out="dutyEur"></dd>
    <dt>VAT</dt><dd data-out="vatEur"></dd>
    <dt data-local-label>Local delivery</dt><dd data-out="localDeliveryEur"></dd>
    <dt class="total">Landed cost</dt><dd class="total" data-out="landedCostEur"></dd>
    <dt data-profit-label>Profit</dt><dd data-out="profitEur"></dd>
  </dl>
  <div class="error" data-error hidden></div>
</div>
`

let open: { host: HTMLElement; close: () => void } | null = null

export function closePanel() {
  open?.close()
}

const euro = (amount: string) => `€${amount}`

export async function openPanel(
  product: ListedProduct,
  button: Element,
  details: Promise<ProductDetails>
) {
  closePanel()
  const host = document.createElement("div")
  const root = host.attachShadow({ mode: "open" })
  root.innerHTML = `<style>${styles}</style>${markup}`
  const $ = <T extends Element = HTMLElement>(selector: string) =>
    root.querySelector(selector) as T
  const input = (name: string) => $<HTMLInputElement>(`[data-input="${name}"]`)

  const rect = button.getBoundingClientRect()
  Object.assign(host.style, {
    position: "absolute",
    zIndex: "2147483647",
    top: `${rect.bottom + window.scrollY + 6}px`,
    left: `${Math.max(8, Math.min(rect.left + window.scrollX, window.scrollX + document.documentElement.clientWidth - 368))}px`,
  })
  document.body.append(host)

  const onKey = (event: KeyboardEvent) => event.key === "Escape" && close()
  const onClick = (event: MouseEvent) => {
    if (
      !event.composedPath().includes(host) &&
      !event.composedPath().includes(button)
    )
      close()
  }
  let saveWeightTimer: ReturnType<typeof setTimeout> | null = null
  function close() {
    if (saveWeightTimer !== null) clearTimeout(saveWeightTimer)
    host.remove()
    document.removeEventListener("keydown", onKey)
    document.removeEventListener("mousedown", onClick)
    open = null
  }
  document.addEventListener("keydown", onKey)
  document.addEventListener("mousedown", onClick)
  open = { host, close }
  $("[data-close]").addEventListener("click", close)

  $("[data-title]").textContent = product.title
  input("price").value = product.price?.amount ?? ""
  $<HTMLSelectElement>('[data-input="currency"]').value =
    product.price?.currency ?? "USD"

  let shippingEdited = false
  let weightEdited = false
  let loadedDetails: ProductDetails | null = null
  let detailsFailed = false
  let weightRequestId = 0
  const productKey = product.asin ?? product.title

  function setRow(next: TariffRow, classification?: Classification) {
    $("[data-code]").textContent = next.code.replace(
      /^(\d{4})(\d{2})(\d{4})$/,
      "$1 $2 $3"
    )
    $("[data-desc]").textContent = next.description
      .split(" > ")
      .slice(-2)
      .join(" › ")
    $("[data-desc]").title = next.description
    input("duty").value = String(next.dutyPercent)
    input("vat").value = String(next.vatPercent)
    const source = $("[data-source]")
    if (!classification || classification.source === "manual") {
      source.textContent = "Chosen by you. Saved for this product."
    } else if (classification.source === "jev") {
      const confidence = Math.round((classification.confidence ?? 0) * 100)
      source.textContent = classification.saved
        ? `Chosen by jev earlier, ${confidence}% confident. Saved for this product.`
        : `Chosen by jev, ${confidence}% confident. Check before you rely on it.`
    } else {
      source.textContent = `Guessed from the title. ${classification.note ?? ""}`
    }
    const excise = $("[data-excise]")
    excise.hidden = !next.excise
    excise.textContent = `This tariff line has an excise of ${next.excise}, which is not included below.`
    recalculate()
  }

  function updateShipping() {
    if (shippingEdited) return
    const weight = input("weight").value.trim()
    const hint = $("[data-shipping-hint]")
    if (!weight) {
      hint.textContent = "Enter a weight to price shipping."
      return
    }
    try {
      const quote = paketosQuote(weight)
      if (!quote) {
        input("shipping").value = ""
        hint.textContent = "Over 30 lb: ask Paketos for a price."
        return
      }
      input("shipping").value = quote.totalEur
      hint.textContent = `${quote.billedLb} lb × €${quote.eurPerLb} + €${quote.insuranceEur} insurance`
    } catch {
      hint.textContent = "Check the weight."
    }
  }

  function recalculate() {
    const summary = $("[data-summary]")
    const error = $("[data-error]")
    let result: ImportResult
    try {
      if (!input("price").value.trim())
        throw new Error("Enter the product price.")
      result = calculateImport({
        price: {
          amount: input("price").value,
          currency: $<HTMLSelectElement>('[data-input="currency"]')
            .value as Currency,
        },
        discountPercent: input("discount").value,
        shippingEur: input("shipping").value,
        localDeliveryEur: input("outside").checked
          ? paketosOutsidePrishtinaEur
          : "0",
        dutyPercent: input("duty").value,
        vatPercent: input("vat").value,
        sellingPriceEur: input("sale").value,
        usdPerEur: input("rate").value,
      })
    } catch (cause) {
      summary.hidden = true
      error.hidden = false
      error.textContent =
        cause instanceof Error ? cause.message : "Check the amounts entered."
      return
    }
    summary.hidden = false
    error.hidden = true
    for (const key of [
      "productEur",
      "shippingEur",
      "dutyEur",
      "vatEur",
      "localDeliveryEur",
      "landedCostEur",
    ] as const) {
      $(`[data-out="${key}"]`).textContent = euro(result[key])
    }
    const local = result.localDeliveryEur !== "0.00"
    $("[data-local-label]").hidden = !local
    $('[data-out="localDeliveryEur"]').hidden = !local
    if (result.effectiveTaxPercent) {
      $('[data-out="vatEur"]').title =
        `Duty and VAT are ${result.effectiveTaxPercent}% of the product price.`
    }
    const profit = $('[data-out="profitEur"]')
    $("[data-profit-label]").hidden = profit.hidden = result.profitEur === null
    if (result.profitEur !== null) {
      profit.textContent = euro(result.profitEur)
      profit.className = result.profitEur.startsWith("-") ? "loss" : "profit"
    }
  }

  function saveManualWeight() {
    if (saveWeightTimer !== null) {
      clearTimeout(saveWeightTimer)
      saveWeightTimer = null
    }
    const parsed = Number(input("weight").value)
    if (!Number.isFinite(parsed) || parsed <= 0) return
    void send({ type: "rememberWeight", key: productKey, weightLb: parsed })
    const hint = $("[data-weight-hint]")
    hint.textContent = "Entered by you. Saved for this product."
    hint.title = ""
  }

  function weightInputFromDetails(found: ProductDetails | null): WeightInput {
    return {
      title: product.title,
      breadcrumbs: found?.breadcrumbs ?? [],
      itemWeightLb: found?.itemWeightLb ?? null,
      packageWeightLb: found?.packageWeightLb ?? null,
      packageDimensions: found?.packageDimensions ?? null,
      productDimensions: found?.productDimensions ?? null,
      inTheBox: found?.inTheBox ?? [],
    }
  }

  function applyWeightResolution(
    resolution: WeightResolution,
    found: ProductDetails | null
  ) {
    const hint = $("[data-weight-hint]")
    hint.title = ""
    if (resolution.weightLb !== null) {
      input("weight").value = String(resolution.weightLb)
      if (resolution.source === "manual") {
        hint.textContent = "Saved for this product."
      } else if (resolution.source === "amazon") {
        hint.textContent = `From ${found?.weightSource ?? "Amazon"}.`
      } else {
        hint.title = resolution.reason ?? ""
        if (found?.itemWeightLb !== null && found?.itemWeightLb !== undefined) {
          hint.textContent = `Estimated package weight (Amazon item: ${found.itemWeightLb} lb).`
        } else if (
          found?.packageWeightLb !== null &&
          found?.packageWeightLb !== undefined
        ) {
          hint.textContent = `Estimated package weight (Amazon listed: ${found.packageWeightLb} lb).`
        } else {
          hint.textContent = "Estimated package weight."
        }
      }
      return
    }
    if (found?.weightLb !== null && found?.weightLb !== undefined) {
      input("weight").value = String(found.weightLb)
      hint.textContent =
        found.weightKind === "item"
          ? `Item weight, without the box.${resolution.note ? ` ${resolution.note}` : ""}`
          : `From ${found.weightSource ?? "Amazon"}.${resolution.note ? ` ${resolution.note}` : ""}`
    } else if (detailsFailed) {
      hint.textContent = resolution.note
        ? `Could not load details. ${resolution.note}`
        : "Could not load. Enter it."
    } else {
      hint.textContent = resolution.note
        ? `Not listed. ${resolution.note}`
        : "Not listed. Enter it."
    }
  }

  // Set from the options before the first weight request.
  let autoEstimate = true

  async function resolvePackageWeight(forceEstimate: boolean) {
    const id = ++weightRequestId
    const estimateButton = $<HTMLButtonElement>("[data-estimate-weight]")
    const hint = $("[data-weight-hint]")
    const found = loadedDetails
    const willEstimate =
      forceEstimate || (autoEstimate && found?.weightKind !== "package")

    if (forceEstimate) {
      weightEdited = false
      estimateButton.disabled = true
      estimateButton.textContent = "Estimating…"
    }
    if (willEstimate && !weightEdited) {
      input("weight").placeholder = "Estimating…"
      hint.title = ""
      hint.textContent =
        found?.itemWeightLb !== null && found?.itemWeightLb !== undefined
          ? `Amazon item: ${found.itemWeightLb} lb. Estimating package weight…`
          : "Estimating package weight…"
    }

    try {
      const resolution = await send({
        type: "weight",
        key: productKey,
        product: weightInputFromDetails(found),
        forceEstimate,
      })
      if (!open || open.host !== host || id !== weightRequestId) return
      if (!weightEdited) {
        applyWeightResolution(resolution, found)
        updateShipping()
        recalculate()
      }
    } catch (cause: unknown) {
      if (!open || open.host !== host || id !== weightRequestId) return
      if (!weightEdited) {
        const message = cause instanceof Error ? cause.message : String(cause)
        applyWeightResolution(
          {
            weightLb: null,
            source: null,
            saved: false,
            reason: null,
            note: message,
          },
          found
        )
        updateShipping()
        recalculate()
      }
    } finally {
      if (open && open.host === host && id === weightRequestId) {
        input("weight").placeholder = ""
        estimateButton.hidden = false
        estimateButton.disabled = false
        estimateButton.textContent = "Estimate"
      }
    }
  }

  $("[data-estimate-weight]").addEventListener("click", () => {
    void resolvePackageWeight(true)
  })

  for (const element of root.querySelectorAll<HTMLInputElement>(
    "[data-input]"
  )) {
    element.addEventListener("input", () => {
      if (element === input("shipping")) {
        shippingEdited = true
        $("[data-shipping-hint]").textContent = "Entered by you."
      }
      if (element === input("weight")) {
        weightEdited = true
        updateShipping()
        if (saveWeightTimer !== null) clearTimeout(saveWeightTimer)
        const value = input("weight").value.trim()
        if (value) {
          saveWeightTimer = setTimeout(saveManualWeight, 500)
        } else {
          $("[data-weight-hint]").textContent = ""
          $("[data-weight-hint]").title = ""
        }
      }
      recalculate()
    })
  }
  input("weight").addEventListener("change", () => {
    if (weightEdited) saveManualWeight()
  })

  $("[data-change]").addEventListener("click", () => {
    const search = $("[data-search]")
    search.hidden = !search.hidden
    if (!search.hidden) $<HTMLInputElement>("[data-query]").focus()
  })
  let searchId = 0
  $<HTMLInputElement>("[data-query]").addEventListener(
    "input",
    async (event) => {
      const id = ++searchId
      const query = (event.target as HTMLInputElement).value
      const rows =
        query.trim().length < 2 ? [] : await send({ type: "search", query })
      if (id !== searchId) return
      const list = $("[data-results]")
      list.replaceChildren(
        ...rows.map((result) => {
          const item = document.createElement("li")
          const pick = document.createElement("button")
          pick.title = result.description
          pick.append(
            `${result.code} · ${result.description.split(" > ").slice(-2).join(" › ")} `
          )
          const rates = document.createElement("span")
          rates.className = "rates"
          rates.textContent = `(${result.dutyPercent}% + ${result.vatPercent}% VAT)`
          pick.append(rates)
          pick.addEventListener("click", () => {
            setRow(result)
            $("[data-search]").hidden = true
            void send({ type: "remember", key: productKey, code: result.code })
          })
          item.append(pick)
          return item
        })
      )
    }
  )

  const settings = await loadSettings()
  input("outside").checked = settings.outsidePrishtina
  autoEstimate = settings.estimateWeight
  recalculate()

  send({ type: "rate" }).then((rate) => {
    if (!rate || input("rate").value) return
    input("rate").value = rate.usdPerEur
    $("[data-rate-hint]").textContent = `ECB, ${rate.date}`
    recalculate()
  })

  details
    .then(
      (found) => {
        if (!open || open.host !== host) return null
        loadedDetails = found
        void resolvePackageWeight(false)
        return send({
          type: "classify",
          key: productKey,
          product: { title: product.title, breadcrumbs: found.breadcrumbs },
        })
      },
      () => {
        if (!open || open.host !== host) return null
        detailsFailed = true
        void resolvePackageWeight(false)
        return send({
          type: "classify",
          key: productKey,
          product: { title: product.title, breadcrumbs: [] },
        })
      }
    )
    .then(
      (classification) => {
        if (!open || open.host !== host) return
        if (classification) {
          // Keep rates the user typed while classification was running.
          const duty = input("duty").value
          const vat = input("vat").value
          setRow(classification.row, classification)
          if (duty) input("duty").value = duty
          if (vat) input("vat").value = vat
          recalculate()
        } else {
          $("[data-code]").textContent = "Not classified"
          $("[data-source]").textContent = "Search the tariff to pick a code."
          $("[data-search]").hidden = false
        }
      },
      (cause: unknown) => {
        $("[data-code]").textContent = "Not classified"
        $("[data-source]").textContent =
          cause instanceof Error ? cause.message : String(cause)
      }
    )
}
