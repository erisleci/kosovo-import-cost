import Decimal from "decimal.js"
export type Currency = "USD" | "EUR"

// Paketos air rates from Miami, in EUR per pound. The rate of the tier a
// parcel falls in applies to its whole weight. Source: paketos.io/cmimorja.
const paketosTiers: Array<{ upToLb: number; eurPerLb: string }> = [
  { upToLb: 1, eurPerLb: "9.95" },
  { upToLb: 5, eurPerLb: "9.50" },
  { upToLb: 10, eurPerLb: "9.20" },
  { upToLb: 15, eurPerLb: "8.90" },
  { upToLb: 20, eurPerLb: "8.50" },
  { upToLb: 25, eurPerLb: "8.20" },
  { upToLb: 30, eurPerLb: "7.90" },
]
export const paketosInsuranceEur = "2.70"
export const paketosOutsidePrishtinaEur = "2.40"
export const paketosMaxLb = 30

export type PaketosQuote = {
  billedLb: number
  eurPerLb: string
  freightEur: string
  insuranceEur: string
  totalEur: string
}

const display = (value: Decimal.Value) =>
  new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2)

function nonnegative(value: string, name: string) {
  let parsed: Decimal
  try {
    parsed = new Decimal(value)
  } catch {
    throw new Error(`${name} must be a nonnegative number`)
  }
  if (!parsed.isFinite() || parsed.isNegative()) {
    throw new Error(`${name} must be a nonnegative number`)
  }
  return parsed
}

/**
 * Paketos bills whole pounds, so a 1.2 lb parcel is billed as 2 lb. Returns
 * null above 30 lb, where Paketos asks for a quote.
 */
export function paketosQuote(weightLb: string): PaketosQuote | null {
  const weight = nonnegative(weightLb, "Weight")
  const billedLb = Math.max(1, weight.ceil().toNumber())
  const tier = paketosTiers.find((t) => billedLb <= t.upToLb)
  if (!tier) return null
  const freight = new Decimal(tier.eurPerLb).times(billedLb)
  return {
    billedLb,
    eurPerLb: tier.eurPerLb,
    freightEur: display(freight),
    insuranceEur: paketosInsuranceEur,
    totalEur: display(freight.plus(paketosInsuranceEur)),
  }
}

export type ImportInput = {
  price: { amount: string; currency: Currency }
  discountPercent: string
  /** Freight and insurance to Kosovo, in EUR. Part of the customs value. */
  shippingEur: string
  /** Delivery inside Kosovo, in EUR. Not part of the customs value. */
  localDeliveryEur: string
  dutyPercent: string
  vatPercent: string
  sellingPriceEur: string
  usdPerEur: string
}

export type ImportResult = {
  /** The listed price in EUR, before the discount. The basis for customs. */
  listedEur: string
  /** The price paid in EUR, after the discount. */
  productEur: string
  shippingEur: string
  customsValueEur: string
  dutyEur: string
  vatEur: string
  localDeliveryEur: string
  landedCostEur: string
  profitEur: string | null
  /** Duty and VAT together as a percentage of the listed price in EUR. */
  effectiveTaxPercent: string | null
}

/**
 * Duty is charged on the customs value, which is the listed price before any
 * discount plus freight and insurance. VAT is charged on the customs value
 * plus duty. A discount lowers what is paid but not the customs value.
 */
export function calculateImport(input: ImportInput): ImportResult {
  const usdPerEur =
    input.price.currency === "EUR"
      ? new Decimal(1)
      : nonnegative(input.usdPerEur, "Exchange rate")
  if (usdPerEur.isZero())
    throw new Error("Exchange rate must be greater than zero")
  const discount = nonnegative(input.discountPercent || "0", "Discount")
  if (discount.greaterThan(100))
    throw new Error("Discount must be between 0 and 100")

  const price = nonnegative(input.price.amount, "Product price")
  const listed = new Decimal(display(price.dividedBy(usdPerEur)))
  const product = new Decimal(
    display(
      price
        .times(new Decimal(1).minus(discount.dividedBy(100)))
        .dividedBy(usdPerEur)
    )
  )
  const shipping = nonnegative(input.shippingEur || "0", "Shipping")
  const localDelivery = nonnegative(input.localDeliveryEur || "0", "Delivery")
  const customsValue = listed.plus(shipping)
  const duty = new Decimal(
    display(
      customsValue
        .times(nonnegative(input.dutyPercent || "0", "Duty"))
        .dividedBy(100)
    )
  )
  const vat = new Decimal(
    display(
      customsValue
        .plus(duty)
        .times(nonnegative(input.vatPercent || "0", "VAT"))
        .dividedBy(100)
    )
  )
  const landed = product.plus(shipping).plus(duty).plus(vat).plus(localDelivery)
  const selling = input.sellingPriceEur.trim()
    ? nonnegative(input.sellingPriceEur, "Selling price")
    : null

  return {
    listedEur: display(listed),
    productEur: display(product),
    shippingEur: display(shipping),
    customsValueEur: display(customsValue),
    dutyEur: display(duty),
    vatEur: display(vat),
    localDeliveryEur: display(localDelivery),
    landedCostEur: display(landed),
    profitEur: selling ? display(selling.minus(landed)) : null,
    effectiveTaxPercent: listed.isZero()
      ? null
      : duty
          .plus(vat)
          .dividedBy(listed)
          .times(100)
          .toFixed(1, Decimal.ROUND_HALF_UP),
  }
}
