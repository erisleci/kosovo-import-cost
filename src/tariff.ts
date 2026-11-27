export type TariffRow = {
  code: string
  description: string
  dutyPercent: number
  vatPercent: number
  excise: number
}

export type Tariff = {
  fetchedAt: string
  byCode: Map<string, TariffRow>
  rows: TariffRow[]
}

type TariffFile = {
  fetchedAt: string
  rows: Array<[string, string, number, number, number]>
}

export function parseTariff(file: TariffFile): Tariff {
  const rows = file.rows.map(
    ([code, description, dutyPercent, vatPercent, excise]) => ({
      code,
      description,
      dutyPercent,
      vatPercent,
      excise,
    })
  )
  return {
    fetchedAt: file.fetchedAt,
    rows,
    byCode: new Map(rows.map((r) => [r.code, r])),
  }
}

// Words that appear in most titles or tariff text and say nothing about the
// kind of product.
const stopwords = new Set(
  "a an and for of or the to with in on by other than not more less including whether new pack set black white".split(
    " "
  )
)

function words(text: string) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !stopwords.has(word))
    .map((word) => word.replace(/(es|s)$/, ""))
}

/**
 * Ranks tariff rows by how many query words appear in their description, with
 * a bonus for words in the row's own last heading. A query that is all digits
 * matches code prefixes. Chapter 98 rows are excluded unless searched by code:
 * they repeat other chapters as broad postal categories.
 */
export function searchTariff(
  tariff: Tariff,
  query: string,
  limit = 20
): TariffRow[] {
  const trimmed = query.trim()
  if (/^\d{2,10}$/.test(trimmed)) {
    return tariff.rows
      .filter((row) => row.code.startsWith(trimmed))
      .slice(0, limit)
  }
  const wanted = new Set(words(trimmed))
  if (wanted.size === 0) return []
  const scored: Array<{ row: TariffRow; score: number }> = []
  for (const row of tariff.rows) {
    if (row.code.startsWith("98")) continue
    const headings = row.description.split(" > ")
    const own = new Set(words(headings[headings.length - 1]))
    const all = new Set(words(row.description))
    let score = 0
    for (const word of wanted) {
      if (own.has(word)) score += 3
      else if (all.has(word)) score += 1
    }
    if (score > 0) scored.push({ row, score })
  }
  return scored
    .sort((a, b) => b.score - a.score || a.row.code.localeCompare(b.row.code))
    .slice(0, limit)
    .map(({ row }) => row)
}
