# Kosovo import cost

[![CI](https://github.com/erisleci/kosovo-import-cost/actions/workflows/ci.yml/badge.svg)](https://github.com/erisleci/kosovo-import-cost/actions/workflows/ci.yml)

This Chrome extension adds a "Kosovo cost" button to Amazon.com product pages, search results, and the shopping cart. Clicking the button opens a floating calculator prefilled with the product price, Paketos air shipping, Kosovo customs duty, VAT, and landed cost in EUR.

Ordering from Amazon.com to Kosovo through a US freight forwarder such as Paketos involves costs that never appear on the listing. Shipping depends on the parcel weight, rounded up to whole pounds. Customs duty depends on which of 10,610 Kosovo tariff lines applies. VAT applies to the customs value plus duty, and a discount lowers what you pay without lowering the customs value. The extension reads what Amazon provides, calls two models through OpenRouter to fill in the missing tariff line and shipped package weight, and computes the full landed cost on the page. The two model calls cost about $0.0003 per product.

<!-- screenshot: calculator panel open on an Amazon.com product page showing the tariff line, estimated package weight, and landed cost breakdown -->

## Two-step tariff classification

The extension bundles a trimmed copy of Kosovo's 10,610-line customs tariff from `dogana.rks-gov.net/CustomsFee` and classifies products in up to two steps using [jev](https://openrouter.ai/docs/guides/community/jev-tutorial) (`typesafe/jev-1.13`) through OpenRouter. jev answers a multiple-choice question with a probability for each option.

1. First, jev picks from 26 common product types, or `"other"`, using the product title and Amazon category breadcrumbs. If jev chooses one of the 26 types with at least 50% confidence, the extension uses its default tariff code directly.
2. If confidence is below 50% and jev did not answer `"other"`, the extension takes up to three product types that scored at least 10% and collects the tariff lines in their six-digit subheadings. jev then picks the exact line in a second request, unless only one candidate exists.

The extension saves the chosen tariff code per product in `chrome.storage.local`, keyed by ASIN with a fallback to the product title, so it calls jev once per product. Manual changes replace the saved choice. Without an OpenRouter key, when jev fails, or when jev answers `"other"`, the extension falls back to keyword matching against the same 26 categories and opens tariff search automatically if nothing matches.

## Package weight estimation

Paketos bills by shipped parcel weight, while Amazon listings often show only bare item weight or omit weight altogether. When Amazon lists a package weight that is at least as heavy as the listed item weight, the extension uses it directly.

Otherwise, the service worker asks `openai/gpt-4.1-mini` through OpenRouter to estimate the total shipped parcel weight, including retail packaging, accessories, and Amazon's outer shipping box. It sends the title, category breadcrumbs, listed weights, dimensions, and box contents when present. The extension saves estimates and manual edits per product in `chrome.storage.local` so each product costs one estimate. Without an OpenRouter key, it falls back to Amazon's listed weight when available.

## Cost per product

Classifying a product and estimating its weight costs about $0.0003, so one dollar covers roughly 3,000 products. The extension saves both answers, so opening the same product again costs nothing.

| Call                                                | Model          | Tokens per call             | Cost per call |
| --------------------------------------------------- | -------------- | --------------------------- | ------------- |
| Tariff line, first pass                             | jev            | 930 to 1,010 in             | $0.00004      |
| Tariff line, second pass, only below 50% confidence | jev            | 1,410 to 1,530 in           | $0.00006      |
| Package weight                                      | `gpt-4.1-mini` | 430 to 500 in, 30 to 60 out | $0.00026      |

These figures are measured, from OpenRouter's activity log. The extension made 35 calls between 22 and 27 November 2026, and they cost $0.004 in total. jev bills $0.042 per million input tokens and its output is free. `gpt-4.1-mini` bills $0.40 per million input tokens and $1.60 per million output tokens.

## Import cost calculation

The calculator runs currency and tax arithmetic with `decimal.js` and half-up rounding to two decimal places:

- Customs value is the listed price before any discount, converted to EUR, plus Paketos freight and insurance. A discount lowers what you pay for the product, not the customs value.
- Customs duty is the tariff line's duty percentage of the customs value.
- VAT is the tariff line's VAT percentage of the customs value plus duty.
- Optional delivery outside Prishtina (€2.40) applies after tax, and an optional selling price in EUR computes profit or loss against the landed cost.

Paketos rounds parcel weight up to whole pounds, with a 1 lb minimum and a 30 lb limit, and adds insurance. Above 30 lb, the panel leaves shipping blank and prompts you to ask Paketos for a quote. The service worker fetches the USD/EUR exchange rate from the European Central Bank daily XML feed and caches it in `chrome.storage.local` for six hours.

## Stack

This Manifest V3 extension uses TypeScript, esbuild, and Vitest with no UI framework. It renders the calculator inside an open Shadow DOM so Amazon's stylesheets do not affect the panel layout. It requests only the `storage` permission and host access to `www.amazon.com`, `openrouter.ai`, and `www.ecb.europa.eu`, and keeps your OpenRouter API key in `chrome.storage.local`.

## Installing locally

```sh
npm install
npm run build
```

Open `chrome://extensions`, turn on Developer mode, choose "Load unpacked", and select the `dist` folder. Click the extension's toolbar icon to open the options page, where you can add an OpenRouter API key, set delivery outside Prishtina as the default, or clear saved products.

## Development

- `npm run watch` rebuilds `dist` on edits and reloads the extension while an Amazon.com tab is open.
- `npm test` runs the Vitest suite.
- `npm run typecheck` runs the type checker.
- `npm run check` runs the formatter check.
- `npm run tariff` refreshes the bundled `public/tariff.json` table from Kosovo Customs.
