import type { ReferenceRate } from "./rates"
import type { Product } from "./jev"
import type { TariffRow } from "./tariff"
import type { WeightInput } from "./weight"

export type Classification = {
  row: TariffRow
  /** "manual" is a line picked with "Change" in the panel. */
  source: "jev" | "keywords" | "manual"
  /** jev's confidence in its choice, from 0 to 1. */
  confidence: number | null
  /** True when the line came from the saved classifications, not a new call. */
  saved: boolean
  /** Why jev was not used, when it was skipped or failed. */
  note: string | null
}

export type WeightResolution = {
  weightLb: number | null
  /** Where the resolved package weight came from, or null when unavailable. */
  source: "amazon" | "openrouter" | "manual" | null
  /** True when the weight came from chrome.storage.local rather than a new call. */
  saved: boolean
  /** Short breakdown from OpenRouter, shown as a tooltip. */
  reason: string | null
  /** Why there is no estimate, when weightLb is null. Shown in the panel. */
  note: string | null
}

export type Request =
  | { type: "classify"; key: string; product: Product }
  | { type: "remember"; key: string; code: string }
  | {
      type: "weight"
      key: string
      product: WeightInput
      forceEstimate?: boolean
    }
  | { type: "rememberWeight"; key: string; weightLb: number }
  | { type: "search"; query: string }
  | { type: "row"; code: string }
  | { type: "rate" }
  | { type: "dev-check" }

export type Response<TRequest extends Request> = TRequest extends {
  type: "classify"
}
  ? Classification | null
  : TRequest extends { type: "remember" }
    ? null
    : TRequest extends { type: "weight" }
      ? WeightResolution
      : TRequest extends { type: "rememberWeight" }
        ? null
        : TRequest extends { type: "search" }
          ? TariffRow[]
          : TRequest extends { type: "row" }
            ? TariffRow | null
            : TRequest extends { type: "dev-check" }
              ? null
              : TRequest extends { type: "rate" }
                ? ReferenceRate | null
                : never

export type Settings = {
  openRouterKey: string
  outsidePrishtina: boolean
  /** Ask OpenRouter for a package weight without waiting for "Estimate". */
  estimateWeight: boolean
}

export const defaultSettings: Settings = {
  openRouterKey: "",
  outsidePrishtina: false,
  estimateWeight: true,
}

type Reply<TValue> = { ok: true; value: TValue } | { ok: false; error: string }

export async function send<TRequest extends Request>(
  request: TRequest
): Promise<Response<TRequest>> {
  const reply = await chrome.runtime.sendMessage<
    TRequest,
    Reply<Response<TRequest>>
  >(request)
  if (!reply.ok) throw new Error(reply.error)
  return reply.value
}

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(Object.keys(defaultSettings))
  return { ...defaultSettings, ...stored }
}
