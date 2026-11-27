// Common Amazon product kinds and the tariff code each one is declared under.
// Rates are not stored here; they come from tariff.json so they stay current.
// Keywords are matched against the title and breadcrumbs when jev is not set
// up or has not answered yet. Earlier entries win ties, so put specific kinds
// (smartwatch, phone case) before general ones (watch, phone).
export type Category = {
  id: string
  label: string
  code: string
  keywords: string[]
  /** Matched in addition to the keywords. */
  pattern?: RegExp
  description: string
}

export const categories: Category[] = [
  {
    id: "phone_case",
    label: "Phone case or screen protector",
    code: "3926909790",
    keywords: ["phone case", "screen protector", "tempered glass"],
    pattern:
      /\b(iphone|galaxy|pixel|phone)\b[\w\s,]{0,30}\b(case|cover)\b|\b(case|cover)\s+for\s+(iphone|galaxy|pixel)\b/i,
    description:
      "A plastic case, cover or screen protector for a phone or tablet",
  },
  {
    id: "smartwatch",
    label: "Smartwatch or fitness tracker",
    code: "8517620090",
    keywords: [
      "smartwatch",
      "smart watch",
      "apple watch",
      "galaxy watch",
      "fitness tracker",
      "fitbit",
      "garmin",
    ],
    description: "A smartwatch or fitness band that connects to a phone",
  },
  {
    id: "smartphone",
    label: "Smartphone",
    code: "8517130000",
    keywords: [
      "smartphone",
      "iphone",
      "galaxy s",
      "pixel",
      "unlocked phone",
      "cell phone",
    ],
    description: "A mobile phone or smartphone",
  },
  {
    id: "laptop_tablet",
    label: "Laptop or tablet",
    code: "8471300000",
    keywords: [
      "laptop",
      "notebook",
      "macbook",
      "chromebook",
      "ipad",
      "tablet",
      "kindle",
      "e-reader",
      "steam deck",
    ],
    description:
      "A laptop, notebook, tablet, e-reader or other portable computer under 10 kg",
  },
  {
    id: "desktop",
    label: "Desktop computer",
    code: "8471410090",
    keywords: ["desktop", "mac mini", "imac", "mini pc", "gaming pc"],
    description: "A desktop computer, mini PC or all-in-one computer",
  },
  {
    id: "monitor",
    label: "Computer monitor",
    code: "8528521090",
    keywords: ["monitor", "display"],
    description: "A computer monitor without a TV tuner",
  },
  {
    id: "tv",
    label: "Television",
    code: "8528728000",
    keywords: ["tv", "television", "oled", "qled"],
    description: "A television set with a tuner",
  },
  {
    id: "keyboard_mouse",
    label: "Keyboard, mouse or webcam",
    code: "8471607090",
    keywords: ["keyboard", "mouse", "trackpad", "webcam"],
    description: "A computer keyboard, mouse, trackpad or other input device",
  },
  {
    id: "storage",
    label: "SSD or hard drive",
    code: "8471707090",
    keywords: ["ssd", "hard drive", "nvme", "hdd", "external drive"],
    description: "An internal or external SSD or hard disk drive",
  },
  {
    id: "memory_card",
    label: "Memory card or USB flash drive",
    code: "8523511000",
    keywords: [
      "sd card",
      "microsd",
      "memory card",
      "flash drive",
      "usb stick",
      "thumb drive",
    ],
    description: "A memory card or USB flash drive",
  },
  {
    id: "headphones",
    label: "Headphones or earbuds",
    code: "8518300010",
    keywords: [
      "headphones",
      "earbuds",
      "airpods",
      "earphones",
      "headset",
      "in-ear",
    ],
    description: "Headphones, earbuds or a headset",
  },
  {
    id: "speaker",
    label: "Speaker",
    code: "8518220090",
    keywords: ["speaker", "soundbar", "sound bar"],
    description: "A Bluetooth speaker, smart speaker or soundbar",
  },
  {
    id: "console",
    label: "Game console or controller",
    code: "9504500000",
    keywords: [
      "playstation",
      "ps5",
      "xbox",
      "nintendo switch",
      "controller",
      "gamepad",
      "joy-con",
    ],
    description: "A video game console, handheld console or game controller",
  },
  {
    id: "camera",
    label: "Camera",
    code: "8525890010",
    keywords: ["camera", "gopro", "mirrorless", "dslr", "camcorder"],
    description: "A digital camera, action camera or camcorder",
  },
  {
    id: "power_bank",
    label: "Power bank or battery",
    code: "8507600090",
    keywords: ["power bank", "portable charger", "battery pack"],
    description: "A power bank or rechargeable lithium-ion battery",
  },
  {
    id: "charger",
    label: "Charger or power adapter",
    code: "8504408320",
    keywords: ["charger", "power adapter", "charging station", "magsafe"],
    description:
      "A charger or power adapter for phones, laptops or other devices",
  },
  {
    id: "cable",
    label: "Cable",
    code: "8544429000",
    keywords: ["cable", "usb-c to", "hdmi", "lightning to", "cord"],
    description:
      "An electric or data cable with connectors (USB, HDMI and similar)",
  },
  {
    id: "network",
    label: "Router or network device",
    code: "8517620090",
    keywords: [
      "router",
      "mesh wifi",
      "wi-fi system",
      "modem",
      "access point",
      "network switch",
    ],
    description: "A Wi-Fi router, modem, mesh system or network switch",
  },
  {
    id: "printer",
    label: "Printer",
    code: "8443321090",
    keywords: ["printer"],
    description: "A printer that connects to a computer",
  },
  {
    id: "shaver",
    label: "Shaver or hair clipper",
    code: "8510100000",
    keywords: ["shaver", "razor", "trimmer", "clipper"],
    description: "An electric shaver, trimmer or hair clipper",
  },
  {
    id: "hair_dryer",
    label: "Hair dryer or styler",
    code: "8516310000",
    keywords: [
      "hair dryer",
      "dyson airwrap",
      "hairdryer",
      "straightener",
      "curling iron",
    ],
    description: "A hair dryer, hair styler or straightener",
  },
  {
    id: "vacuum",
    label: "Vacuum cleaner",
    code: "8508110000",
    keywords: ["vacuum", "roomba", "robot vacuum"],
    description: "A vacuum cleaner, including robot and stick vacuums",
  },
  {
    id: "coffee",
    label: "Coffee maker",
    code: "8516710000",
    keywords: ["coffee maker", "espresso", "nespresso", "keurig"],
    description: "A coffee or espresso machine",
  },
  {
    id: "watch",
    label: "Watch",
    code: "9102110000",
    keywords: ["watch"],
    description: "A wristwatch that is not a smartwatch",
  },
  {
    id: "toy",
    label: "Toy or building set",
    code: "9503009500",
    keywords: ["lego", "toy", "doll", "puzzle", "action figure"],
    description: "A toy, doll, puzzle or building set",
  },
  {
    id: "perfume",
    label: "Perfume",
    code: "3303001000",
    keywords: ["perfume", "eau de parfum", "eau de toilette", "cologne"],
    description: "A perfume or eau de toilette",
  },
]

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const patterns = categories.map((category) => ({
  category,
  pattern: new RegExp(
    `\\b(${category.keywords.map(escape).join("|")})s?\\b`,
    "i"
  ),
}))

/**
 * Matches the first category whose keywords appear in the text. Accessory
 * titles name the device they go with ("Earbuds ... for iPhone"), so text
 * from "for", "compatible with" or "works with" onward is ignored, unless the
 * category's own pattern needs it.
 */
export function guessCategory(text: string): Category | null {
  const subject = text.replace(/\b(for|compatible with|works with)\b.*$/i, "")
  return (
    patterns.find(
      ({ category, pattern }) =>
        pattern.test(subject) || category.pattern?.test(text)
    )?.category ?? null
  )
}
