# Kosovo import cost

[![CI](https://github.com/erisleci/kosovo-import-cost/actions/workflows/ci.yml/badge.svg)](https://github.com/erisleci/kosovo-import-cost/actions/workflows/ci.yml)

A Chrome extension that adds a "Kosovo cost" button to Amazon.com product pages, search results, and the shopping cart. Clicking the button opens a floating calculator prefilled with the product price, Paketos air shipping, Kosovo customs duty, VAT, and landed cost in EUR.

Ordering from Amazon.com to Kosovo through a US freight forwarder such as Paketos involves costs that never appear on the listing. Shipping depends on the parcel weight, rounded up to whole pounds. Customs duty depends on which of 10,610 Kosovo tariff lines applies. VAT applies to the customs value plus duty, and a discount lowers what you pay without lowering the customs value. The extension reads what Amazon provides, calls two models through OpenRouter to fill in the missing tariff line and shipped package weight, and computes the full landed cost on the page.

<!-- screenshot: calculator panel open on an Amazon.com product page showing the tariff line, estimated package weight, and landed cost breakdown -->

## Architecture

This Manifest V3 extension uses TypeScript and esbuild with no frontend framework. It requests only the `storage` permission and host access to `www.amazon.com`, `openrouter.ai`, and `www.ecb.europa.eu`. Your OpenRouter API key stays in `chrome.storage.local` in the browser.

- `src/content.ts` and `src/amazon.ts` inject buttons on product, search, and cart pages, observe DOM updates with a debounced `MutationObserver`, and parse prices, breadcrumbs, box contents, dimensions, and weights from Amazon's detail tables and bullet lists.
- `src/panel.ts` renders the calculator inside an open Shadow DOM so Amazon's stylesheets do not affect the panel layout. It updates totals live as you edit fields, supports optional discount and selling price inputs for checking profit, and warns when a tariff line carries an excise tax, which the calculator excludes from the total.
- `src/background.ts` and `src/messages.ts` run a typed request handler in the service worker. The worker loads the bundled tariff once, fetches and caches the ECB USD/EUR rate, deduplicates concurrent OpenRouter calls for the same product, and caches classifications and weights in `chrome.storage.local`.
- `src/import-charges.ts` runs all currency and tax arithmetic with `decimal.js` and half-up rounding to two decimal places.
- `src/jev.ts`, `src/categories.ts`, `src/tariff.ts`, and `src/weight.ts` handle tariff classification, tariff search, keyword fallback, and package weight estimation.

## Two-step tariff classification

Kosovo's customs tariff has 10,610 ten-digit lines, and the duty rate depends on the exact line. The extension bundles a trimmed copy of the official table from `dogana.rks-gov.net/CustomsFee` in `public/tariff.json` and classifies products in the background worker in up to two steps using [jev](https://openrouter.ai/docs/guides/community/jev-tutorial) (`typesafe/jev-1.13`) through OpenRouter's `/api/alpha/decisions` endpoint. jev answers a multiple-choice question with a probability for each option.

1. The first pass asks jev to pick one of 26 common product types defined in `src/categories.ts`, or `"other"`, using the product title and Amazon category breadcrumbs. Each product type maps to a default tariff code. If jev chooses one of the 26 types with at least 50% confidence, the extension uses that code directly.
2. If confidence is below 50%, the extension takes up to three product types that scored at least 10% probability and collects every tariff line in their six-digit subheadings, excluding civil aircraft lines. For headphones, that expands to all lines under `8518 30`, so jev chooses between the 0% and 10% duty lines in a second request. If only one candidate line exists, the extension uses it without a second request. If jev answered `"other"`, there is no second request.

The extension saves the chosen tariff code per product in `chrome.storage.local`, keyed by ASIN with a fallback to the product title, so it calls jev once per product. It stores only the code, so tariff updates apply to previously saved products. Picking a different line with "Change" in the panel replaces the saved choice. Without an OpenRouter key, when jev fails, or when jev answers `"other"`, the extension falls back to keyword matching against the same 26 categories, ignoring text after "for", "compatible with", or "works with" during keyword lookup so accessories do not match the device they fit. When nothing matches, the panel opens the tariff search box automatically.

Tariff search matches code prefixes for numeric queries and ranks text queries by word matches, giving extra weight to the row's own final heading. Text search skips chapter 98 because it holds broad simplified categories (for example, "IT and telecommunication equipment" at 10% duty and 18% VAT) that overlap the normal chapters. Searching by code (`98`) still shows them.

## Package weight estimation

Paketos bills by shipped parcel weight, while Amazon listings often show only bare item weight or omit weight altogether. The parser in `src/amazon.ts` reads both detail tables and bullet lists, strips invisible Unicode bidirectional marks, handles pounds, ounces, kilograms, grams, and compound weights such as `1 lb 8 oz`, and prefers `Package Weight`, `Shipping Weight`, `Gross Weight`, and weights inside `Package Dimensions` over bare `Item Weight`. Search and cart pages do not include product details, so the content script fetches the product page when you open the calculator. It keeps that parsed Amazon page in memory until the tab reloads. The model answers are saved separately and permanently, as described below.

When Amazon lists a package weight that is at least as heavy as the listed item weight, the extension uses it directly. When Amazon omits package weight, lists only bare item weight, or lists a package weight smaller than the item weight, the worker asks `openai/gpt-4.1-mini` through OpenRouter with a strict JSON schema to estimate the total shipped parcel weight, including retail packaging, accessories, and Amazon's outer shipping box. The request sends the title, category breadcrumbs, listed weights, package and product dimensions, and items from "What's in the box" or "Included Components" when present.

The panel displays the model's one-sentence weight breakdown as a tooltip on the weight hint. You can click "Estimate" next to the weight field to request a new estimate on demand, or type a weight manually. The extension saves estimates and manual edits per product in `chrome.storage.local`. Without an OpenRouter key, it falls back to Amazon's listed weight when available.

## Import cost calculation

The calculation lives in `calculateImport` and `paketosQuote` in `src/import-charges.ts`:

- Customs value is the listed price before any discount, converted to EUR, plus Paketos freight and insurance. A discount lowers what you pay for the product, not the customs value.
- Customs duty is the tariff line's duty percentage of the customs value.
- VAT is the tariff line's VAT percentage of the customs value plus duty.
- The calculator adds delivery outside Prishtina (€2.40) after tax. You can toggle it per calculation or set it as a default in options.
- Entering an optional selling price in EUR computes profit or loss against the landed cost. Hovering over the VAT amount shows duty and VAT together as a percentage of the listed price.

Paketos rounds parcel weight up to whole pounds, with a 1 lb minimum and a 30 lb limit, applying the tier rate to the whole weight (€9.95/lb for 1 lb down to €7.90/lb for 26 to 30 lb), plus €2.70 insurance. Above 30 lb, the panel leaves shipping blank and prompts you to ask Paketos for a quote. `src/import-charges.ts` hard-codes the air rates from `paketos.io/cmimorja`, so update them there when Paketos changes its prices.

The service worker fetches the USD/EUR exchange rate from the European Central Bank daily XML feed and caches it in `chrome.storage.local` for six hours. If a refresh fails, it falls back to the last cached rate.

## Installing locally

```sh
npm install
npm run build
```

Open `chrome://extensions`, turn on Developer mode, choose "Load unpacked", and select the `dist` folder. Click the extension's toolbar icon to open the options page, where you can add an OpenRouter API key, set delivery outside Prishtina as the default, check how many tariff lines and package weights are saved, or clear saved products.

You only need to load the `dist` folder once. Chrome remembers it across restarts, and builds overwrite `dist` in place rather than deleting it.

## Development

Run the test suite, type checker, and formatter check with these commands:

```sh
npm test
npm run typecheck
npm run check
```

Tests use Vitest and jsdom to cover Amazon DOM parsing, import and Paketos calculations, ECB XML parsing, tariff search, jev candidate selection, and OpenRouter weight requests.

While editing the extension, run `npm run watch` instead of `npm run build`. On every rebuild, esbuild writes a new build ID to `dist/build-id.txt` and stamps it into `dist/background.js`. In dev builds, the content script on an open Amazon tab sends a `dev-check` message to the background worker every second, which also keeps the Manifest V3 service worker awake past Chrome's 30-second idle timeout. When the worker sees a new ID in `build-id.txt`, it reloads the extension and refreshes open Amazon tabs. This loop requires at least one open Amazon.com tab. The build copies edits to `manifest.json` on the next rebuild, though Chrome may still require clicking reload on the extension card. Running `npm run build` sets `__DEV__` to `false` and omits all reload code.

To refresh the bundled tariff table (`public/tariff.json`) from Kosovo Customs, run `npm run tariff`. The script downloads both the Albanian and English tables from `dogana.rks-gov.net/CustomsFee/GetAll`, strips internal markup tags, falls back to Albanian for rows without English text, builds full heading paths, and writes all 10-digit tariff lines.
