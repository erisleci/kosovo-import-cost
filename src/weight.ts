// Estimates total shipped package weight (in lb) via OpenRouter when Amazon
// omits package weight or only lists the bare item weight.
export const openRouterChatEndpoint =
  "https://openrouter.ai/api/v1/chat/completions"
export const weightModel = "openai/gpt-4.1-mini"

export type WeightInput = {
  title: string
  breadcrumbs: string[]
  itemWeightLb: number | null
  packageWeightLb: number | null
  packageDimensions: string | null
  productDimensions: string | null
  inTheBox?: string[]
}

export type ParsedWeightEstimate = {
  weightLb: number
  reason: string | null
}

const systemPrompt = `You estimate the total shipped package weight in pounds (lb) of an Amazon.com product as delivered to a US freight forwarder.

Include everything in the delivered parcel:
- The product itself
- The manufacturer's retail box, internal inserts/foam, and all included accessories (chargers, cables, stands, cases, manuals, especially anything listed in in_the_box)
- Amazon's outer corrugated shipping box or padded mailer and dunnage (unless bulky boxed items like monitors, TVs, or printers ship in their own retail carton)

Rules:
- Use your knowledge of the specific product and its typical retail and shipping packaging to estimate total parcel weight accurately — do not return only the bare item weight.
- If Amazon's item_weight_lb is given, treat it as the bare product weight floor unless it is clearly a listing error.
- If Amazon's package_weight_lb is given and plausible, it usually reflects the retail box before Amazon's outer shipping box/mailer; add outer shipping packaging if Amazon would overbox it, or correct it if it is obviously wrong (for example smaller than item_weight_lb).
- Use package_dimensions, product_dimensions, and in_the_box when provided to account for box size, cardboard/foam weight, and heavy accessories (like power bricks or stands).
- Return a realistic positive number in pounds, rounded to 1 decimal place (or 2 decimal places if under 1 lb).`

export function weightRequest(input: WeightInput) {
  const details: Record<string, string | number | string[]> = {
    amazon_title: input.title,
    amazon_category: input.breadcrumbs.join(" > ") || "unknown",
  }
  if (input.itemWeightLb !== null) details.item_weight_lb = input.itemWeightLb
  if (input.packageWeightLb !== null) {
    details.package_weight_lb = input.packageWeightLb
  }
  if (input.packageDimensions) {
    details.package_dimensions = input.packageDimensions
  }
  if (input.productDimensions) {
    details.product_dimensions = input.productDimensions
  }
  if (input.inTheBox && input.inTheBox.length > 0) {
    details.in_the_box = input.inTheBox
  }

  return {
    model: weightModel,
    temperature: 0,
    max_tokens: 160,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: JSON.stringify(details) },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "package_weight",
        strict: true,
        schema: {
          type: "object",
          properties: {
            package_weight_lb: {
              type: "number",
              description:
                "Estimated total shipped package weight in pounds (lb).",
            },
            reason: {
              type: "string",
              description:
                "Short one-sentence breakdown, e.g. '2.7 lb laptop + 1.8 lb charger & retail box + 1.0 lb shipping carton'.",
            },
          },
          required: ["package_weight_lb", "reason"],
          additionalProperties: false,
        },
      },
    },
  }
}

function stripCodeFence(text: string) {
  const trimmed = text.trim()
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return match ? match[1] : trimmed
}

export function parseWeightEstimate(body: unknown): ParsedWeightEstimate {
  const payload = body as {
    error?: { message?: string }
    choices?: Array<{ message?: { content?: string | null } }>
  }
  if (payload.error?.message) {
    throw new Error(payload.error.message)
  }
  const content = payload.choices?.[0]?.message?.content
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("OpenRouter returned no weight estimate")
  }
  let parsed: { package_weight_lb?: unknown; reason?: unknown }
  try {
    parsed = JSON.parse(stripCodeFence(content)) as {
      package_weight_lb?: unknown
      reason?: unknown
    }
  } catch {
    throw new Error("OpenRouter returned invalid JSON for weight estimate")
  }
  const raw = parsed.package_weight_lb
  if (
    typeof raw !== "number" ||
    !Number.isFinite(raw) ||
    raw <= 0 ||
    raw > 500
  ) {
    throw new Error("OpenRouter returned an invalid package weight")
  }
  const weightLb = Math.max(0.01, Math.round(raw * 100) / 100)
  const reason =
    typeof parsed.reason === "string" && parsed.reason.trim()
      ? parsed.reason.trim()
      : null
  return { weightLb, reason }
}
