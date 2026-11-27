import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { categories, guessCategory } from "./categories"
import {
  candidateLines,
  categoryRequest,
  codeRequest,
  parseChoice,
} from "./jev"
import { parseTariff, searchTariff } from "./tariff"

const tariff = parseTariff(
  JSON.parse(
    readFileSync(new URL("../public/tariff.json", import.meta.url), "utf8")
  )
)

describe("categories", () => {
  it("point at codes that exist in the tariff", () => {
    const missing = categories.filter((c) => !tariff.byCode.has(c.code))
    expect(missing.map((c) => c.id)).toEqual([])
  })

  it.each([
    ["Apple iPhone 16 Pro, 256GB, Black Titanium - Unlocked", "smartphone"],
    ["OtterBox iPhone 16 Case, Symmetry Series", "phone_case"],
    ["Apple Watch Series 10 GPS 42mm", "smartwatch"],
    ["Apple 2024 MacBook Air 13-inch Laptop with M3 chip", "laptop_tablet"],
    ["Sony WF-1000XM5 Wireless Noise Canceling Earbuds", "headphones"],
    ["Anker Power Bank, 10,000mAh Portable Charger", "power_bank"],
    ["Casio Men's Classic Watch", "watch"],
    ["Spigen Tough Armor Case for iPhone 16 Pro", "phone_case"],
    [
      "AirPods Pro (2nd Gen) Wireless Earbuds, Bluetooth Headphones for iPhone",
      "headphones",
    ],
    ["USB C Charger for iPhone 16, 20W Fast Charging Block", "charger"],
  ])("guesses %s", (title, id) => {
    expect(guessCategory(title)?.id).toBe(id)
  })

  it("returns null for products it has no keyword for", () => {
    expect(guessCategory("Stanley Quencher H2.0 Tumbler 40 oz")).toBeNull()
  })
})

describe("searchTariff", () => {
  it("ranks rows whose own heading matches first", () => {
    expect(searchTariff(tariff, "microwave ovens", 1)[0].code).toBe(
      "8516500000"
    )
  })

  it("matches code prefixes", () => {
    const rows = searchTariff(tariff, "851713")
    expect(rows.map((r) => r.code)).toEqual(["8517130000"])
  })

  it("leaves out the chapter 98 postal categories", () => {
    expect(
      searchTariff(tariff, "mobile phones").some((r) => r.code.startsWith("98"))
    ).toBe(false)
  })
})

describe("jev", () => {
  const product = { title: "Apple iPhone 16", breadcrumbs: ["Cell Phones"] }

  it("offers every category plus other", () => {
    const options = Object.keys(
      categoryRequest(product).questions.category.criteria
    )
    expect(options).toHaveLength(categories.length + 1)
    expect(options).toContain("other")
  })

  it("offers candidate rows by code", () => {
    const rows = searchTariff(tariff, "smartphones", 3)
    const options = Object.keys(
      codeRequest(product, rows).questions.category.criteria
    )
    expect(options).toEqual(rows.map((r) => r.code))
  })

  it("offers every line in the subheadings of the likeliest types", () => {
    const lines = candidateLines(tariff, {
      choice: "headphones",
      confidence: 0.4,
      probabilities: { headphones: 0.45, speaker: 0.3, smartphone: 0.05 },
    })
    expect(lines.map((r) => r.code)).toEqual([
      "8518220090",
      "8518300010",
      "8518300020",
      "8518300090",
    ])
  })

  it("leaves out civil aircraft lines", () => {
    const lines = candidateLines(tariff, {
      choice: "smartwatch",
      confidence: 0.3,
      probabilities: { smartwatch: 0.3 },
    })
    expect(lines.map((r) => r.code)).toEqual(["8517620020", "8517620090"])
  })

  it("offers nothing when jev answers other", () => {
    expect(
      candidateLines(tariff, {
        choice: "other",
        confidence: 0.4,
        probabilities: { other: 0.4, toy: 0.3 },
      })
    ).toEqual([])
  })

  it("reads the chosen option", () => {
    const body = {
      answers: {
        category: {
          type: "choice",
          choice: "smartphone",
          confidence: 0.91,
          probabilities: {},
        },
      },
    }
    expect(parseChoice(body)).toEqual({
      choice: "smartphone",
      confidence: 0.91,
      probabilities: {},
    })
  })

  it("reports refusals and API errors", () => {
    expect(() =>
      parseChoice({ answers: { category: { type: "refusal" } } })
    ).toThrow("declined")
    expect(() =>
      parseChoice({ error: { code: 401, message: "No auth" } })
    ).toThrow("No auth")
  })
})
