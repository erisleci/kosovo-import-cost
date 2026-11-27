import { categories } from "./categories"
import type { Tariff, TariffRow } from "./tariff"

// jev answers multiple-choice questions with probabilities instead of text.
// https://openrouter.ai/docs/guides/community/jev-tutorial
export const jevEndpoint = "https://openrouter.ai/api/alpha/decisions"
export const jevModel = "typesafe/jev-1.13"
const otherOption = "other"

export type Product = { title: string; breadcrumbs: string[] }

export type JevChoice = {
  choice: string
  confidence: number
  /** How likely jev thinks each option is, keyed by option. */
  probabilities: Record<string, number>
}

function state(product: Product) {
  return {
    amazon_title: product.title,
    amazon_category: product.breadcrumbs.join(" > ") || "unknown",
  }
}

/** First pass: pick one of the common product kinds, or "other". */
export function categoryRequest(product: Product) {
  return {
    model: jevModel,
    state: state(product),
    questions: {
      category: {
        type: "choice",
        instructions:
          "Which kind of product is this Amazon listing? Judge the item that is sold, not what it works with: a case for a phone is a case, not a phone.",
        criteria: {
          ...Object.fromEntries(categories.map((c) => [c.id, c.description])),
          [otherOption]: "Anything that does not fit the other options",
        },
      },
    },
  }
}

/** Second pass: pick one of the tariff lines from `candidateLines`. */
export function codeRequest(product: Product, candidates: TariffRow[]) {
  return {
    model: jevModel,
    state: state(product),
    questions: {
      category: {
        type: "choice",
        instructions:
          "Which Kosovo customs tariff line should this Amazon product be declared under?",
        criteria: Object.fromEntries(
          candidates.map((row) => [row.code, row.description.slice(-300)])
        ),
      },
    },
  }
}

export function parseChoice(body: unknown): JevChoice {
  const answer = (body as { answers?: { category?: Record<string, unknown> } })
    .answers?.category
  if (answer?.type === "refusal")
    throw new Error("jev declined to classify this product")
  if (answer?.type !== "choice" || typeof answer.choice !== "string") {
    const message = (body as { error?: { message?: string } }).error?.message
    throw new Error(message ?? "jev returned no answer")
  }
  const probabilities: Record<string, number> = {}
  if (answer.probabilities && typeof answer.probabilities === "object") {
    for (const [option, value] of Object.entries(answer.probabilities)) {
      if (typeof value === "number") probabilities[option] = value
    }
  }
  return {
    choice: answer.choice,
    confidence: typeof answer.confidence === "number" ? answer.confidence : 0,
    probabilities,
  }
}

// Lines for civil aircraft repeat ordinary lines at 0% duty and never apply to
// a parcel from Amazon.
const civilAircraft = /civil aircraft|civilne vazduhoplove/i
const maxTypes = 3
const minimumProbability = 0.1

/**
 * Options for the second pass, built from the first answer: every tariff line
 * in the same subheading (first six digits) as the codes of jev's most likely
 * product types. For headphones that is all of 8518 30, so jev chooses
 * between the 0% and 10% duty lines. Returns no lines when jev's best answer
 * is "other", since there is then no subheading to start from.
 */
export function candidateLines(tariff: Tariff, first: JevChoice): TariffRow[] {
  const likely = categories
    .map((category) => ({
      category,
      probability:
        first.probabilities[category.id] ??
        (first.choice === category.id ? first.confidence : 0),
    }))
    .filter(({ probability }) => probability >= minimumProbability)
    .sort((a, b) => b.probability - a.probability)
    .slice(0, maxTypes)
  if (isOther(first) || likely.length === 0) return []
  const subheadings = new Set(
    likely.map(({ category }) => category.code.slice(0, 6))
  )
  return tariff.rows.filter(
    (row) =>
      subheadings.has(row.code.slice(0, 6)) &&
      !civilAircraft.test(row.description)
  )
}

export const isOther = (choice: JevChoice) => choice.choice === otherOption
