import type { Company } from "./types";

// --- Sector taxonomy ---------------------------------------------------------
// The raw `category` field is free-text and sprawls across 130+ variants
// ("Aerospace / Defense / Space", "Fintech / Crypto / Payments", "E-commerce"…).
// People search by the *industry* ("insurance", "defense", "big tech",
// "consulting"), not the exact category string. This taxonomy folds those
// categories into ~16 sectors and drives three things:
//   1. Search synonym expansion — each company's search haystack gets its
//      sectors' `aliases` injected, so "defence", "finance", "machine learning",
//      "ecommerce", "automotive", "big tech" etc. match even when the literal
//      word never appears in the company name or its category.
//   2. The quick-filter sector chips (replacing the messy raw-category chips).
//   3. The semantic-search embedding text (companyToText), so the vector index
//      understands a company's industry even when its category is terse.
export interface Sector {
  key: string;
  label: string;
  catKeywords: string[];   // membership: a category *token* equals one of these
                           // (or, if the entry has a space/hyphen, is a substring)
  aliases: string[];       // search terms injected into the haystack for this sector
  nameKeywords?: string[]; // membership by company-name token (for the "big tech" giants)
}

export const SECTORS: Sector[] = [
  { key: "bigtech", label: "Big Tech", catKeywords: ["big tech"],
    nameKeywords: ["apple","google","alphabet","amazon","microsoft","meta","netflix","nvidia","tesla","ibm","oracle","salesforce","adobe","intel","cisco","qualcomm","broadcom","uber","airbnb","paypal","spotify","samsung"],
    aliases: ["big tech","faang","maang","tech giant","tech giants","megacap"] },
  { key: "fintech", label: "Fintech / Finance", catKeywords: ["fintech","financial","banking","payments","crypto","quant"],
    // sector-level only; crypto/quant/lending cos still match via their category.
    aliases: ["fintech","finance","financial","banking","bank","payments"] },
  { key: "insurance", label: "Insurance", catKeywords: ["insurance","insurtech"],
    aliases: ["insurance","insurer","insurtech","underwriting","actuarial","claims"] },
  { key: "defense", label: "Aerospace / Defense", catKeywords: ["aerospace","defense","space"],
    aliases: ["defense","defence","military","aerospace","space","aviation","weapons","govtech","national security"] },
  { key: "health", label: "Healthcare / Bio", catKeywords: ["healthcare","health","healthtech","medtech","biotech","medical","bio"],
    aliases: ["healthcare","health","medical","medtech","biotech","bio","pharma","pharmaceutical","life sciences","medicine","clinical","wellness"] },
  { key: "consulting", label: "Consulting / IT Services", catKeywords: ["consulting","it services","msp","tech services","cx"],
    aliases: ["consulting","consultancy","advisory","professional services","it services","systems integrator","staffing"] },
  { key: "media", label: "Gaming / Media", catKeywords: ["gaming","media","entertainment","streaming","audio","social"],
    // sub-verticals (music, film, audio) are left to literal matching to avoid
    // tagging every gaming co as "music"; sector-level synonyms only.
    aliases: ["gaming","game","games","video games","esports","media","entertainment","streaming"] },
  { key: "retail", label: "Retail / Consumer", catKeywords: ["retail","consumer","commerce","food","pet"],
    // NB: "food"/"grocery"/"apparel" deliberately NOT injected — they'd tag all
    // 97 retail cos (eBay, Etsy…) as food. Real food cos still match literally.
    aliases: ["retail","consumer","cpg","ecommerce","e-commerce","commerce","shopping","dtc"] },
  { key: "cyber", label: "Cybersecurity", catKeywords: ["cybersecurity","security","cyber","identity"],
    aliases: ["cybersecurity","cyber","security","infosec","appsec","threat","identity","zero trust","privacy"] },
  { key: "cloud", label: "Cloud / DevTools", catKeywords: ["cloud","infrastructure","devtools","devops","saas","developer","database","storage","observability","networking","cdn","enterprise","software","no-code","web","telecom","design"],
    aliases: ["cloud","infrastructure","infra","devtools","devops","saas","developer tools","platform","database","storage","networking","observability","backend","enterprise software","b2b"] },
  { key: "hardware", label: "Semiconductors / Hardware", catKeywords: ["semiconductors","semiconductor","hardware","iot","eda","gps","electronics","manufacturing","measurement","test"],
    aliases: ["semiconductors","semiconductor","chips","chip","silicon","hardware","iot","embedded","electronics","wafer","fabless"] },
  { key: "ai", label: "AI / Data", catKeywords: ["ai","ml","data","analytics","autonomous","robotics","drones","lidar","vision"],
    aliases: ["ai","artificial intelligence","ml","machine learning","deep learning","data","analytics","data science","autonomous","self-driving","robotics","robots","drones","computer vision","llm","genai"] },
  { key: "edhr", label: "EdTech / HR Tech", catKeywords: ["edtech","education","hr"],
    aliases: ["edtech","education","learning","e-learning","hr","hr tech","human resources","recruiting","talent","people ops","workforce"] },
  { key: "proptech", label: "PropTech / Real Estate", catKeywords: ["proptech","construction","homebuilding","real estate"],
    aliases: ["proptech","real estate","property","construction","housing","homebuilding","mortgage"] },
  { key: "logistics", label: "Logistics / Mobility", catKeywords: ["logistics","mobility","marketplaces","marketplace","transportation","delivery","distribution","travel"],
    aliases: ["logistics","supply chain","shipping","freight","mobility","transportation","transit","delivery","marketplace","fulfillment","last mile"] },
  { key: "energy", label: "EV / Energy", catKeywords: ["ev","energy","auto","automotive"],
    aliases: ["ev","electric vehicle","energy","cleantech","climate","solar","battery","auto","automotive","cars","vehicles"] },
];

// Natural-language "what they do / how they're perceived" gloss per sector.
// Used ONLY in companyToText() to enrich the embedding (so conceptual and
// reputation-flavored queries like "company that blows people up" → defense, or
// "creepy surveillance tech" → data/AI work). Deliberately NOT added to the
// keyword `aliases` above, so literal keyword search keeps its precision.
export const SECTOR_GLOSS: Record<string, string> = {
  bigtech: "a dominant big tech company and powerful technology giant, sometimes criticized as a controversial monopoly that collects huge amounts of user data",
  fintech: "moves money and handles banking, payments, lending, investing, trading and financial markets",
  insurance: "sells insurance and health coverage, handling claims, premiums, underwriting and risk",
  defense: "a defense contractor that builds weapons, missiles, bombs, fighter jets, warships, drones and military hardware used in war and combat, things that blow up and kill",
  health: "provides healthcare, hospitals, medicine, drugs, biotech research, patient care and medical treatment",
  consulting: "consulting and professional advisory services that help other organizations with strategy, operations and technology",
  media: "makes video games, movies, music, streaming and entertainment media content",
  retail: "sells products to consumers through retail stores and online ecommerce shopping",
  cyber: "cybersecurity protecting computers, networks and data from hackers, including surveillance, encryption and privacy",
  cloud: "cloud computing, software infrastructure, databases, developer tools and enterprise software platforms",
  hardware: "designs computer chips, semiconductors, processors and physical electronic hardware devices",
  ai: "artificial intelligence, machine learning, big data analytics, data mining and surveillance technology, sometimes seen as creepy, invasive or dystopian",
  edhr: "education technology and human resources software for learning, hiring, recruiting and managing people",
  proptech: "real estate, property, housing, construction, homebuilding and mortgages",
  logistics: "logistics, shipping, supply chain, delivery, freight and transportation of goods",
  energy: "electric vehicles, clean energy, solar power, batteries and automobiles",
};

export const tokenize = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

// Which sectors does a company belong to? Single-word catKeywords match a
// category *token* exactly (so "ai" doesn't match "Retail"); multi-word entries
// match as a substring of the whole category string.
export function sectorsForCompany(c: Company): Set<string> {
  const catLow = c.category.toLowerCase();
  const catToks = tokenize(c.category);
  const nameToks = tokenize(c.name);
  const out = new Set<string>();
  for (const s of SECTORS) {
    if (c.sector === s.key) out.add(s.key);
    let hit = s.catKeywords.some((k) =>
      /[\s-]/.test(k) ? catLow.includes(k) : catToks.includes(k),
    );
    if (!hit && s.nameKeywords) hit = s.nameKeywords.some((k) => nameToks.includes(k));
    if (hit) out.add(s.key);
  }
  return out;
}

// Build the natural-language text that represents a company for embedding.
// Folds in sector labels + aliases (so the vector "knows" the industry) plus a
// few signal-bearing recruiter fields, deduped and length-bounded for speed.
export function companyToText(c: Company): string {
  const sectors = sectorsForCompany(c);
  const sectorBits: string[] = [];
  const glossBits: string[] = [];
  for (const s of SECTORS) {
    if (!sectors.has(s.key)) continue;
    sectorBits.push(s.label, ...s.aliases);
    const gloss = SECTOR_GLOSS[s.key];
    if (gloss) glossBits.push(gloss);
  }
  // Recruiter titles ("Technical Recruiter", "University Recruiter") describe the
  // hiring team, not what the company does — they're generic across companies and
  // only inflate the similarity baseline, so they're left out of the embedding.
  const parts = [
    `${c.name} is a ${c.category} company.`,
    c.description || "",
    // lead with "what they do / how they're perceived" so conceptual & reputation
    // queries ("company that blows people up" → defense) dominate the vector.
    glossBits.join(". "),
    sectorBits.join(", "),
    [c.hq_location, c.size_estimate].filter(Boolean).join(", "),
    c.has_intern_program ? "offers an internship / early-career program" : "",
    c.early_career_programs || "",
    c.application_timeline || "",
    c.visa_sponsorship || "",
    c.recent_internship_signal || "",
    c.opportunity_notes || "",
  ].filter(Boolean);
  return parts.join(". ").replace(/\s+/g, " ").trim().slice(0, 1600);
}
