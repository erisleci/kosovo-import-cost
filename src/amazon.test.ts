// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import {
  findProducts,
  parseDimensions,
  parsePrice,
  parseWeightLb,
  readDetails,
} from "./amazon"

function page(path: string, body: string) {
  window.history.replaceState(null, "", path)
  document.body.innerHTML = body
  return document
}

describe("parsePrice", () => {
  it("reads dollar amounts with thousands separators", () => {
    expect(parsePrice(" $1,099.99 ")).toEqual({
      amount: "1099.99",
      currency: "USD",
    })
  })

  it("rejects text without a price", () => {
    expect(parsePrice("Currently unavailable")).toBeNull()
    expect(parsePrice("$0.00")).toBeNull()
  })
})

describe("parseWeightLb", () => {
  it.each([
    ["1.2 Pounds", 1.2],
    ["7.8 ounces", 0.49],
    ["6.1 x 2.9 x 0.3 inches; 6.7 Ounces", 0.42],
    ["1.5 Kilograms", 3.31],
    ["450 g", 0.99],
    ["450g", 0.99],
    ["1,200 grams", 2.65],
    ["1,200 g", 2.65],
    ["1 lb 8 oz", 1.5],
    ["2 pounds, 4 ounces", 2.25],
    ["1 kg 500 g", 3.31],
    ["1.5 Pounds (680 Grams)", 1.5],
    ["2.4G / 5G Wi-Fi; 450g", 0.99],
    ["2 grams", 0.01],
  ])("converts %s", (input, pounds) => {
    expect(parseWeightLb(input)).toBe(pounds)
  })

  it("returns null without a valid weight", () => {
    expect(parseWeightLb("6.1 x 2.9 x 0.3 inches")).toBeNull()
    expect(parseWeightLb("5G")).toBeNull()
    expect(parseWeightLb("128GB")).toBeNull()
    expect(parseWeightLb("0 ounces")).toBeNull()
  })
})

describe("parseDimensions", () => {
  it("extracts dimensions before the weight", () => {
    expect(parseDimensions("10.67 x 9.33 x 4.02 inches; 1.85 Pounds")).toBe(
      "10.67 x 9.33 x 4.02 inches"
    )
    expect(parseDimensions("6.1 × 2.9 × 0.3 cm")).toBe("6.1 × 2.9 × 0.3 cm")
  })

  it("returns null when no dimensions are present", () => {
    expect(parseDimensions("1.85 Pounds")).toBeNull()
  })
})

describe("readDetails", () => {
  it("prefers package weight over item weight and reads breadcrumbs", () => {
    page(
      "/dp/B0TEST0001",
      `<div id="wayfinding-breadcrumbs_feature_div"><ul>
        <li><a>Electronics</a></li><li>›</li><li><a> Headphones </a></li>
      </ul></div>
      <table id="productDetails_techSpec_section_1">
        <tr><th>Item Weight</th><td>8 ounces</td></tr>
        <tr><th>Package Weight</th><td>0.8 Pounds</td></tr>
      </table>`
    )
    expect(readDetails(document)).toEqual({
      weightLb: 0.8,
      weightKind: "package",
      weightSource: "Package Weight",
      itemWeightLb: 0.5,
      packageWeightLb: 0.8,
      packageDimensions: null,
      productDimensions: null,
      inTheBox: [],
      breadcrumbs: ["Electronics", "Headphones"],
    })
  })

  it("prefers Package Dimensions weight over bare Item Weight", () => {
    page(
      "/dp/B0TEST0001",
      `<table id="productDetails_techSpec_section_1">
        <tr><th>Item Weight</th><td>8.8 ounces</td></tr>
        <tr><th>Product Dimensions</th><td>7.3 x 3.0 x 10.0 inches</td></tr>
      </table>
      <table id="productDetails_detailBullets_sections1">
        <tr><th>Package Dimensions</th><td>10.67 x 9.33 x 4.02 inches; 1.85 Pounds</td></tr>
      </table>`
    )
    expect(readDetails(document)).toEqual({
      weightLb: 1.85,
      weightKind: "package",
      weightSource: "Package Dimensions",
      itemWeightLb: 0.55,
      packageWeightLb: 1.85,
      packageDimensions: "10.67 x 9.33 x 4.02 inches",
      productDimensions: "7.3 x 3.0 x 10.0 inches",
      inTheBox: [],
      breadcrumbs: [],
    })
  })

  it("reads What's in the box items for package weight estimation", () => {
    page(
      "/dp/B0GR1JK9W3",
      `<table id="productDetails_techSpec_section_1">
        <tr><th>Product Dimensions</th><td>\u200E8.71 x 0.61 x 12.31 inches</td></tr>
        <tr><th>Item Weight</th><td>\u200E3.52 pounds</td></tr>
      </table>
      <dl id="witb-content-list">
        <li><span>14-inch MacBook Pro</span></li>
        <li><span>USB-C to MagSafe 3 Cable (2 m)</span></li>
        <li><span>70W USB-C Power Adapter</span></li>
      </dl>`
    )
    expect(readDetails(document)).toEqual({
      weightLb: 3.52,
      weightKind: "item",
      weightSource: "Item Weight",
      itemWeightLb: 3.52,
      packageWeightLb: null,
      packageDimensions: null,
      productDimensions: "8.71 x 0.61 x 12.31 inches",
      inTheBox: [
        "14-inch MacBook Pro",
        "USB-C to MagSafe 3 Cable (2 m)",
        "70W USB-C Power Adapter",
      ],
      breadcrumbs: [],
    })
  })

  it("marks weight as item when Package Dimensions lists an impossibly small weight", () => {
    page(
      "/dp/B0TEST0001",
      `<table id="productDetails_techSpec_section_1">
        <tr><th>Item Weight</th><td>3.4 pounds</td></tr>
        <tr><th>Package Dimensions</th><td>14 x 10 x 3 inches; 0.5 pounds</td></tr>
      </table>`
    )
    expect(readDetails(document)).toMatchObject({
      weightLb: 3.4,
      weightKind: "item",
      weightSource: "Item Weight",
      itemWeightLb: 3.4,
      packageWeightLb: 0.5,
      packageDimensions: "14 x 10 x 3 inches",
    })
  })

  it("reads the weight from detail bullets and strips invisible bidi marks", () => {
    page(
      "/dp/B0TEST0001",
      `<div id="detailBullets_feature_div"><ul>
        <li>Package Dimensions \u200F : \u200E 7 x 5 x 2 inches; 1.1 Pounds</li>
      </ul></div>`
    )
    expect(readDetails(document)).toMatchObject({
      weightLb: 1.1,
      weightKind: "package",
      weightSource: "Package Dimensions",
      packageDimensions: "7 x 5 x 2 inches",
    })
  })

  it("reads td-only rows in productOverview_feature_div", () => {
    page(
      "/dp/B0TEST0001",
      `<div id="productOverview_feature_div"><table>
        <tr><td>Item Weight</td><td>2.7 Pounds</td></tr>
      </table></div>`
    )
    expect(readDetails(document)).toMatchObject({
      weightLb: 2.7,
      weightKind: "item",
      weightSource: "Item Weight",
      itemWeightLb: 2.7,
    })
  })
})

describe("findProducts", () => {
  it("finds the product on a product page", () => {
    const doc = page(
      "/Apple-iPhone/dp/B0TEST0001",
      `<span id="productTitle"> Apple iPhone 16 </span>
       <div id="corePrice_feature_div"><span class="a-price"><span class="a-offscreen">$799.00</span></span></div>`
    )
    expect(findProducts(doc)).toMatchObject([
      {
        asin: "B0TEST0001",
        title: "Apple iPhone 16",
        price: { amount: "799.00" },
      },
    ])
  })

  it("finds search results and skips ad slots without an ASIN", () => {
    const doc = page(
      "/s",
      `<div data-component-type="s-search-result" data-asin="B0TEST0002">
         <h2><span>Sony</span></h2>
         <a href="/dp/B0TEST0002"><h2 aria-label="Sony WH-1000XM5"><span>Sony WH-1000XM5</span></h2></a>
         <span class="a-price a-text-price"><span class="a-offscreen">$399.99</span></span>
         <span class="a-price"><span class="a-offscreen">$328.00</span></span>
       </div>
       <div data-component-type="s-search-result" data-asin=""><h2>Ad</h2></div>`
    )
    expect(findProducts(doc)).toMatchObject([
      {
        asin: "B0TEST0002",
        title: "Sony WH-1000XM5",
        price: { amount: "328.00" },
      },
    ])
  })

  it("finds cart items and reads their price attribute", () => {
    const doc = page(
      "/gp/cart/view.html",
      `<div id="sc-active-cart">
         <div class="sc-list-item" data-asin="B0TEST0003" data-price="49.5">
           <span class="sc-product-title">Anker Power Bank</span>
         </div>
       </div>`
    )
    expect(findProducts(doc)).toMatchObject([
      { asin: "B0TEST0003", price: { amount: "49.5", currency: "USD" } },
    ])
  })
})
