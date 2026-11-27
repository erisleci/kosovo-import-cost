# Kosovo import cost extension

A Chrome extension that adds a "Kosovo cost" button to Amazon.com product pages, search results and the cart. The button opens a calculator with the price, Paketos shipping, customs duty and VAT filled in.

## Install

```sh
npm install
npm run build
```

Open `chrome://extensions`, turn on Developer mode, choose "Load unpacked" and pick the `dist` folder. Click the extension's toolbar icon to open its options and add an OpenRouter API key.

You only load the folder once. Chrome remembers it across restarts, and the build overwrites `dist` in place.

While you work on the extension, run `npm run watch` instead. It rebuilds on every save, and the dev build reloads itself: the content script on an open Amazon tab checks `dist/build-id.txt` every second, and when the id changes the extension reloads and refreshes your Amazon tabs. This needs an Amazon tab open. Edits to `manifest.json` are copied on the next rebuild, but Chrome may still ask you to press reload on the extension card for them.

`npm run build` makes a build without the reload code.

## How the numbers are worked out

The calculation is `calculateImport` in `src/import-charges.ts`:

- Customs value is the listed price before any discount, converted to EUR, plus Paketos freight and insurance. A discount lowers what you pay but not the customs value.
- Duty is the tariff line's duty percentage of the customs value.
- VAT is the tariff line's VAT percentage of the customs value plus duty.
- Delivery outside Prishtina (€2.40) is added after tax.

Paketos bills whole pounds at the rate of the tier the parcel falls in, plus €2.70 insurance. Rates come from paketos.io/cmimorja and are hard-coded in `paketosQuote`. Update them there when Paketos changes its prices.

The weight comes from the product page's details table, preferring `Package Weight`, `Shipping Weight`, `Gross Weight`, and weights inside `Package Dimensions` over bare `Item Weight`. Search and cart pages don't show a weight, so the extension fetches the product page when you open the calculator. When Amazon only lists bare item weight (or omits weight altogether), the extension asks OpenRouter (`openai/gpt-4.1-mini`) to estimate the total shipped package weight — including retail packaging, accessories, and Amazon's outer shipping box — using the title, category, listed item weight, and dimensions. You can also click "Estimate" next to the weight field to request an estimate on demand. Estimates and manual edits are saved per ASIN in `chrome.storage.local`.

The exchange rate is the ECB reference rate, cached for six hours.

## Classification

The tariff (`public/tariff.json`) is a trimmed copy of the table behind dogana.rks-gov.net/CustomsFee. Refresh it with `npm run tariff`.

The background worker picks a tariff line in up to two steps:

1. [jev](https://openrouter.ai/docs/guides/community/jev-tutorial), an OpenRouter model that answers multiple-choice questions with a probability per option, chooses one of the common product kinds in `src/categories.ts`, each tied to a tariff code.
2. If jev is less than 50% confident, it is asked again. The options are every tariff line in the same subheading (first six digits) as the codes of its three likeliest product types, without civil aircraft lines. For headphones that is all of 8518 30, so jev chooses between the 0% and 10% duty lines. If jev answers "other", there is no second request. The panel falls back to keywords or asks you to pick a line with "Change".

The chosen line is saved per ASIN in `chrome.storage.local`, so jev is called once per product. A line you pick with "Change" in the panel is saved the same way and replaces jev's choice. Only the code is saved, so rates come from the current tariff. The options page shows how many products are saved and can forget them. Without an OpenRouter key, or when jev fails, the extension falls back to keyword matching against the same categories. You can always change the line with "Change" in the panel.

Tariff chapter 98 holds simplified categories (for example "IT and telecommunication equipment" at 10% duty and 18% VAT). The search skips them because they overlap the normal chapters. Search by code (`98`) to see them.
