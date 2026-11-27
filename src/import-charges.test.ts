import { describe, expect, it } from "vitest"
import { calculateImport, paketosQuote } from "./import-charges"

describe("paketosQuote", () => {
  it("matches the 3 lb example on the Paketos price list", () => {
    expect(paketosQuote("3")).toMatchObject({
      billedLb: 3,
      eurPerLb: "9.50",
      totalEur: "31.20",
    })
  })

  it("bills partial pounds as whole pounds", () => {
    expect(paketosQuote("1.2")).toMatchObject({
      billedLb: 2,
      freightEur: "19.00",
    })
    expect(paketosQuote("0.3")).toMatchObject({
      billedLb: 1,
      freightEur: "9.95",
    })
  })

  it("applies the tier rate to the whole weight", () => {
    expect(paketosQuote("30")).toMatchObject({
      eurPerLb: "7.90",
      freightEur: "237.00",
    })
  })

  it("has no quote above 30 lb", () => {
    expect(paketosQuote("30.1")).toBeNull()
  })
})

describe("calculateImport", () => {
  const phone = {
    price: { amount: "1100", currency: "USD" as const },
    discountPercent: "",
    shippingEur: "21.70",
    localDeliveryEur: "",
    dutyPercent: "10",
    vatPercent: "18",
    sellingPriceEur: "",
    usdPerEur: "1.10",
  }

  it("charges duty on price plus shipping and VAT on that plus duty", () => {
    const result = calculateImport(phone)
    expect(result.productEur).toBe("1000.00")
    expect(result.customsValueEur).toBe("1021.70")
    expect(result.dutyEur).toBe("102.17")
    expect(result.vatEur).toBe("202.30")
    expect(result.landedCostEur).toBe("1326.17")
    expect(result.profitEur).toBeNull()
  })

  it("keeps local delivery out of the customs value", () => {
    const result = calculateImport({ ...phone, localDeliveryEur: "2.40" })
    expect(result.dutyEur).toBe("102.17")
    expect(result.landedCostEur).toBe("1328.57")
  })

  it("charges customs on the price before the discount", () => {
    const result = calculateImport({ ...phone, discountPercent: "10" })
    expect(result.listedEur).toBe("1000.00")
    expect(result.productEur).toBe("900.00")
    expect(result.customsValueEur).toBe("1021.70")
    expect(result.dutyEur).toBe("102.17")
    expect(result.vatEur).toBe("202.30")
    expect(result.landedCostEur).toBe("1226.17")
  })

  it("computes profit from the selling price", () => {
    const result = calculateImport({
      ...phone,
      shippingEur: "0",
      dutyPercent: "0",
      vatPercent: "8",
      sellingPriceEur: "1100",
    })
    expect(result.vatEur).toBe("80.00")
    expect(result.profitEur).toBe("20.00")
    expect(result.effectiveTaxPercent).toBe("8.0")
  })

  it("ignores the exchange rate for EUR prices", () => {
    const result = calculateImport({
      ...phone,
      price: { amount: "100", currency: "EUR" },
      usdPerEur: "",
    })
    expect(result.productEur).toBe("100.00")
  })

  it("rejects a USD price without an exchange rate", () => {
    expect(() => calculateImport({ ...phone, usdPerEur: "" })).toThrow()
  })
})
