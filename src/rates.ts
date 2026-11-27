export type ReferenceRate = {
  usdPerEur: string
  date: string
}

export function parseEcbRate(xml: string): ReferenceRate {
  const date = xml.match(/<Cube\s+time=['"](\d{4}-\d{2}-\d{2})['"]/)?.[1]
  const usdPerEur = xml.match(
    /<Cube\s+currency=['"]USD['"]\s+rate=['"]([\d.]+)['"]\s*\/>/
  )?.[1]
  if (!date) throw new Error("ECB publication date is missing")
  if (
    !usdPerEur ||
    !Number.isFinite(Number(usdPerEur)) ||
    Number(usdPerEur) <= 0
  ) {
    throw new Error("ECB USD rate is missing or invalid")
  }
  return { date, usdPerEur }
}

export async function getLatestUsdEurRate(): Promise<ReferenceRate> {
  const response = await fetch(
    "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml"
  )
  if (!response.ok) throw new Error("Could not fetch the ECB exchange rate")
  return parseEcbRate(await response.text())
}
