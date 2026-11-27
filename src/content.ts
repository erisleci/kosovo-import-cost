/// <reference types="chrome" />
import { findProducts, readDetails } from "./amazon"
import type { ListedProduct, ProductDetails } from "./amazon"
import { watchForRebuilds } from "./dev-reload"
import { openPanel } from "./panel"

const marker = "data-landed-button"
const detailsCache = new Map<string, Promise<ProductDetails>>()

function details(product: ListedProduct): Promise<ProductDetails> {
  if (document.querySelector("#productTitle")) {
    return Promise.resolve(readDetails(document))
  }
  if (!product.asin) {
    return Promise.resolve({
      weightLb: null,
      weightKind: null,
      weightSource: null,
      itemWeightLb: null,
      packageWeightLb: null,
      packageDimensions: null,
      productDimensions: null,
      inTheBox: [],
      breadcrumbs: [],
    })
  }
  let cached = detailsCache.get(product.asin)
  if (!cached) {
    // Search and cart pages show no weight, so read it from the product page.
    cached = fetch(`/dp/${product.asin}`, { credentials: "include" })
      .then((response) => {
        if (!response.ok) throw new Error(`Amazon returned ${response.status}`)
        return response.text()
      })
      .then((html) =>
        readDetails(new DOMParser().parseFromString(html, "text/html"))
      )
    cached.catch(() => detailsCache.delete(product.asin ?? ""))
    detailsCache.set(product.asin, cached)
  }
  return cached
}

function button(product: ListedProduct) {
  const element = document.createElement("button")
  element.type = "button"
  element.textContent = "Kosovo cost"
  element.title = "Estimate shipping, customs and VAT to Kosovo"
  Object.assign(element.style, {
    display: "inline-flex",
    alignItems: "center",
    margin: "4px 0",
    padding: "2px 10px",
    border: "1px solid #3168e0",
    borderRadius: "999px",
    background: "#ffffff",
    color: "#3168e0",
    font: "600 12px/18px system-ui, sans-serif",
    cursor: "pointer",
  })
  element.addEventListener("click", (event) => {
    // Search result titles sit inside links to the product page.
    event.preventDefault()
    event.stopPropagation()
    void openPanel(product, element, details(product))
  })
  return element
}

function addButtons() {
  for (const product of findProducts(document)) {
    if (product.container.hasAttribute(marker)) continue
    product.container.setAttribute(marker, "")
    const wrapper = document.createElement("div")
    wrapper.append(button(product))
    product.anchor.after(wrapper)
  }
}

let scheduled = false
new MutationObserver(() => {
  if (scheduled) return
  scheduled = true
  setTimeout(() => {
    scheduled = false
    addButtons()
  }, 300)
}).observe(document.body, { childList: true, subtree: true })
addButtons()

if (__DEV__) watchForRebuilds()
