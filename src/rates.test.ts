import { describe, expect, it } from "vitest"
import { parseEcbRate } from "./rates"

describe("parseEcbRate", () => {
  it("reads the publication date and USD per EUR rate", () => {
    const xml = `<gesmes:Envelope><Cube><Cube time='2026-09-25'><Cube currency='USD' rate='1.1403'/><Cube currency='JPY' rate='179.70'/></Cube></Cube></gesmes:Envelope>`
    expect(parseEcbRate(xml)).toEqual({
      usdPerEur: "1.1403",
      date: "2026-09-25",
    })
  })

  it("rejects a response with no USD rate", () => {
    const xml = `<Cube><Cube time='2026-09-25'><Cube currency='JPY' rate='179.70'/></Cube></Cube>`
    expect(() => parseEcbRate(xml)).toThrow("USD rate")
  })
})
