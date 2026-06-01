#!/usr/bin/env node
/**
 * Shared sector taxonomy for Node-based recruiter data scripts.
 *
 * Keep this aligned with recruiter-directory/lib/sectors.ts. The frontend can
 * still compute richer multi-sector filters; these scripts need one stable
 * primary sector per company so independent agents never edit the same record.
 */

const SECTORS = [
  {
    key: "bigtech",
    label: "Big Tech",
    catKeywords: ["big tech"],
    nameKeywords: [
      "apple", "google", "alphabet", "amazon", "microsoft", "meta", "netflix",
      "nvidia", "tesla", "ibm", "oracle", "salesforce", "adobe", "intel",
      "cisco", "qualcomm", "broadcom", "uber", "airbnb", "paypal", "spotify",
      "samsung"
    ],
    aliases: ["big tech", "faang", "maang", "tech giant", "tech giants", "megacap"],
  },
  {
    key: "fintech",
    label: "Fintech / Finance",
    catKeywords: ["fintech", "financial", "banking", "payments", "crypto", "quant"],
    aliases: ["fintech", "finance", "financial", "banking", "bank", "payments"],
  },
  {
    key: "insurance",
    label: "Insurance",
    catKeywords: ["insurance", "insurtech"],
    aliases: ["insurance", "insurer", "insurtech", "underwriting", "actuarial", "claims"],
  },
  {
    key: "defense",
    label: "Aerospace / Defense",
    catKeywords: ["aerospace", "defense", "space"],
    aliases: ["defense", "defence", "military", "aerospace", "space", "aviation", "weapons", "govtech", "national security"],
  },
  {
    key: "health",
    label: "Healthcare / Bio",
    catKeywords: ["healthcare", "health", "healthtech", "medtech", "biotech", "medical", "bio"],
    aliases: ["healthcare", "health", "medical", "medtech", "biotech", "bio", "pharma", "pharmaceutical", "life sciences", "medicine", "clinical", "wellness"],
  },
  {
    key: "consulting",
    label: "Consulting / IT Services",
    catKeywords: ["consulting", "it services", "msp", "tech services", "cx"],
    aliases: ["consulting", "consultancy", "advisory", "professional services", "it services", "systems integrator", "staffing"],
  },
  {
    key: "media",
    label: "Gaming / Media",
    catKeywords: ["gaming", "media", "entertainment", "streaming", "audio", "social"],
    aliases: ["gaming", "game", "games", "video games", "esports", "media", "entertainment", "streaming"],
  },
  {
    key: "retail",
    label: "Retail / Consumer",
    catKeywords: ["retail", "consumer", "commerce", "food", "pet"],
    aliases: ["retail", "consumer", "cpg", "ecommerce", "e-commerce", "commerce", "shopping", "dtc"],
  },
  {
    key: "cyber",
    label: "Cybersecurity",
    catKeywords: ["cybersecurity", "security", "cyber", "identity"],
    aliases: ["cybersecurity", "cyber", "security", "infosec", "appsec", "threat", "identity", "zero trust", "privacy"],
  },
  {
    key: "cloud",
    label: "Cloud / DevTools",
    catKeywords: ["cloud", "infrastructure", "devtools", "devops", "saas", "developer", "database", "storage", "observability", "networking", "cdn", "enterprise", "software", "no-code", "web", "telecom", "design"],
    aliases: ["cloud", "infrastructure", "infra", "devtools", "devops", "saas", "developer tools", "platform", "database", "storage", "networking", "observability", "backend", "enterprise software", "b2b"],
  },
  {
    key: "hardware",
    label: "Semiconductors / Hardware",
    catKeywords: ["semiconductors", "semiconductor", "hardware", "iot", "eda", "gps", "electronics", "manufacturing", "measurement", "test"],
    aliases: ["semiconductors", "semiconductor", "chips", "chip", "silicon", "hardware", "iot", "embedded", "electronics", "wafer", "fabless"],
  },
  {
    key: "ai",
    label: "AI / Data",
    catKeywords: ["ai", "ml", "data", "analytics", "autonomous", "robotics", "drones", "lidar", "vision"],
    aliases: ["ai", "artificial intelligence", "ml", "machine learning", "deep learning", "data", "analytics", "data science", "autonomous", "self-driving", "robotics", "robots", "drones", "computer vision", "llm", "genai"],
  },
  {
    key: "edhr",
    label: "EdTech / HR Tech",
    catKeywords: ["edtech", "education", "hr"],
    aliases: ["edtech", "education", "learning", "e-learning", "hr", "hr tech", "human resources", "recruiting", "talent", "people ops", "workforce"],
  },
  {
    key: "proptech",
    label: "PropTech / Real Estate",
    catKeywords: ["proptech", "construction", "homebuilding", "real estate"],
    aliases: ["proptech", "real estate", "property", "construction", "housing", "homebuilding", "mortgage"],
  },
  {
    key: "logistics",
    label: "Logistics / Mobility",
    catKeywords: ["logistics", "mobility", "marketplaces", "marketplace", "transportation", "delivery", "distribution", "travel"],
    aliases: ["logistics", "supply chain", "shipping", "freight", "mobility", "transportation", "transit", "delivery", "marketplace", "fulfillment", "last mile"],
  },
  {
    key: "energy",
    label: "EV / Energy",
    catKeywords: ["ev", "energy", "auto", "automotive"],
    aliases: ["ev", "electric vehicle", "energy", "cleantech", "climate", "solar", "battery", "auto", "automotive", "cars", "vehicles"],
  },
];

const OTHER_SECTOR = {
  key: "other",
  label: "Other / Mixed",
  catKeywords: [],
  aliases: ["other", "mixed"],
};

function tokenize(s) {
  return String(s || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function sectorsForCompany(company) {
  const category = String(company.category || "");
  const catLow = category.toLowerCase();
  const catToks = tokenize(category);
  const nameToks = tokenize(company.name || "");
  const out = [];

  for (const sector of SECTORS) {
    let hit = sector.catKeywords.some((keyword) => (
      /[\s-]/.test(keyword) ? catLow.includes(keyword) : catToks.includes(keyword)
    ));
    if (!hit && sector.nameKeywords) {
      hit = sector.nameKeywords.some((keyword) => nameToks.includes(keyword));
    }
    if (hit) out.push(sector);
  }

  return out;
}

function primarySectorForCompany(company) {
  return sectorsForCompany(company)[0] || OTHER_SECTOR;
}

module.exports = {
  SECTORS,
  OTHER_SECTOR,
  ALL_SECTORS: [...SECTORS, OTHER_SECTOR],
  tokenize,
  sectorsForCompany,
  primarySectorForCompany,
};
