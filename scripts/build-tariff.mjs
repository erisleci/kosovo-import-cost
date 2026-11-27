// Downloads the Kosovo customs tariff and writes public/tariff.json.
// Run with: npm run tariff
import { writeFile, mkdir } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const url = "https://dogana.rks-gov.net/CustomsFee/GetAll"
const out = join(
  dirname(fileURLToPath(import.meta.url)),
  "../public/tariff.json"
)

async function download(language) {
  const response = await fetch(url, {
    headers: { cookie: `PreferedLanguage=${language}` },
  })
  if (!response.ok) throw new Error(`${url} returned ${response.status}`)
  return response.json()
}

const [albanian, english] = await Promise.all([
  download("sq-AL"),
  download("en-US"),
])
const englishById = new Map(english.map((row) => [row.id, row]))
const byId = new Map(albanian.map((row) => [row.id, row]))

// Some descriptions carry markup such as "(TAR_DSC3)" and "(E0012)".
const clean = (text) =>
  (text ?? "")
    .replace(/\((TAR_\w+|E\d+)\)/g, "")
    .replace(/\s+/g, " ")
    .trim()

// 8% of rows have no English text; fall back to Albanian for those.
const name = (row) =>
  clean(englishById.get(row.id)?.descriptionValue) ||
  clean(row.descriptionValue)

function description(row) {
  const parts = []
  for (let node = row; node; node = byId.get(node.parentId)) {
    const part = name(node)
    if (part && part !== parts[0]) parts.unshift(part)
  }
  return parts.join(" > ")
}

// Rows: [code, description with parent headings, duty %, VAT %, excise].
const rows = albanian
  .filter((row) => row.code.length === 10)
  .map((row) => [
    row.code,
    description(row),
    row.percentage,
    row.tvsh,
    row.excise,
  ])
  .sort((a, b) => a[0].localeCompare(b[0]))

await mkdir(dirname(out), { recursive: true })
await writeFile(
  out,
  JSON.stringify({ fetchedAt: new Date().toISOString().slice(0, 10), rows })
)
console.log(`Wrote ${rows.length} tariff rows to ${out}`)
