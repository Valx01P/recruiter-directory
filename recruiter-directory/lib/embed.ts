import { pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

// gte-small → 384-dim sentence embeddings, run locally (no API key). The model
// downloads once (~30MB) and is cached to disk. Same model is used at index
// time and query time so the vectors live in the same space.
const MODEL = process.env.EMBEDDING_MODEL || "Supabase/gte-small";

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

function getExtractor(): Promise<FeatureExtractionPipeline> {
  // Singleton: load the model once per process and reuse it.
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", MODEL) as Promise<FeatureExtractionPipeline>;
  }
  return extractorPromise;
}

/** Embed a batch of texts → array of 384-float vectors (mean-pooled, L2-normalized). */
export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const extractor = await getExtractor();
  const output = await extractor(texts, { pooling: "mean", normalize: true });
  return output.tolist() as number[][];
}

/** Embed a single string → one 384-float vector. */
export async function embedOne(text: string): Promise<number[]> {
  const [v] = await embed([text]);
  return v;
}

/** Format a vector for a pgvector column / RPC argument: "[0.1,0.2,...]". */
export function toPgVector(v: number[]): string {
  return `[${v.join(",")}]`;
}
