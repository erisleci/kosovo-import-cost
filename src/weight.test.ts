import { describe, expect, it } from "vitest"
import { parseWeightEstimate, weightModel, weightRequest } from "./weight"

describe("weightRequest", () => {
  it("builds a strict json_schema chat request with available product details", () => {
    const request = weightRequest({
      title: "Apple 2024 MacBook Air 13-inch Laptop with M3 chip",
      breadcrumbs: ["Electronics", "Computers & Accessories", "Laptops"],
      itemWeightLb: 2.7,
      packageWeightLb: null,
      packageDimensions: "14.5 x 10.5 x 3.2 inches",
      productDimensions: null,
      inTheBox: ["13-inch MacBook Air", "30W USB-C Power Adapter"],
    })

    expect(request.model).toBe(weightModel)
    expect(request.response_format.type).toBe("json_schema")
    expect(request.response_format.json_schema.strict).toBe(true)

    const userPayload = JSON.parse(request.messages[1].content) as Record<
      string,
      unknown
    >
    expect(userPayload).toEqual({
      amazon_title: "Apple 2024 MacBook Air 13-inch Laptop with M3 chip",
      amazon_category: "Electronics > Computers & Accessories > Laptops",
      item_weight_lb: 2.7,
      package_dimensions: "14.5 x 10.5 x 3.2 inches",
      in_the_box: ["13-inch MacBook Air", "30W USB-C Power Adapter"],
    })
  })

  it("omits null optional fields and falls back to unknown category", () => {
    const request = weightRequest({
      title: "Apple AirPods Pro 2",
      breadcrumbs: [],
      itemWeightLb: null,
      packageWeightLb: null,
      packageDimensions: null,
      productDimensions: null,
    })
    const userPayload = JSON.parse(request.messages[1].content) as Record<
      string,
      unknown
    >
    expect(userPayload).toEqual({
      amazon_title: "Apple AirPods Pro 2",
      amazon_category: "unknown",
    })
  })
})

describe("parseWeightEstimate", () => {
  it("parses a JSON response and rounds to two decimals", () => {
    const result = parseWeightEstimate({
      choices: [
        {
          message: {
            content: JSON.stringify({
              package_weight_lb: 5.846,
              reason:
                "2.7 lb laptop + 2.1 lb charger & retail box + 1.0 lb shipper",
            }),
          },
        },
      ],
    })
    expect(result).toEqual({
      weightLb: 5.85,
      reason: "2.7 lb laptop + 2.1 lb charger & retail box + 1.0 lb shipper",
    })
  })

  it("handles JSON wrapped in markdown code fences", () => {
    const result = parseWeightEstimate({
      choices: [
        {
          message: {
            content: '```json\n{"package_weight_lb": 1.3, "reason": "  "}\n```',
          },
        },
      ],
    })
    expect(result).toEqual({ weightLb: 1.3, reason: null })
  })

  it("reports API errors and invalid payloads", () => {
    expect(() =>
      parseWeightEstimate({ error: { message: "Invalid API key" } })
    ).toThrow("Invalid API key")
    expect(() => parseWeightEstimate({ choices: [] })).toThrow("no weight")
    expect(() =>
      parseWeightEstimate({
        choices: [{ message: { content: "not json" } }],
      })
    ).toThrow("invalid JSON")
    expect(() =>
      parseWeightEstimate({
        choices: [
          { message: { content: '{"package_weight_lb": 0, "reason": ""}' } },
        ],
      })
    ).toThrow("invalid package weight")
    expect(() =>
      parseWeightEstimate({
        choices: [
          { message: { content: '{"package_weight_lb": 999, "reason": ""}' } },
        ],
      })
    ).toThrow("invalid package weight")
  })
})
