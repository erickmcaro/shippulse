import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { resolveOpenClawStateDir } from "../installer/paths.js";

export type KnowledgeDoc = {
  id: string;
  title: string;
  text: string;
  source: string;
  type: string;
  tags: string[];
};

type IndexedDoc = KnowledgeDoc & {
  len: number;
  tf: Record<string, number>;
  embedding?: number[];
};

type EmbeddingMeta = {
  provider: "openai";
  model: string;
  dimensions: number;
};

type EmbeddingCredentials = {
  apiKey: string;
  baseUrl: string;
  source: "env" | "openclaw";
  profileId?: string;
};

type OpenClawAuthProfile = {
  provider?: string;
  token?: string;
  apiKey?: string;
  key?: string;
  baseUrl?: string;
  baseURL?: string;
  endpoint?: string;
  url?: string;
};

type OpenClawAuthProfilesFile = {
  version?: number;
  profiles?: Record<string, OpenClawAuthProfile>;
};

export type KnowledgeIndex = {
  version: 1;
  createdAt: string;
  seedRoot: string;
  docCount: number;
  avgDocLen: number;
  df: Record<string, number>;
  docs: IndexedDoc[];
  embeddings?: EmbeddingMeta;
};

export type IndexBuildResult = {
  indexPath: string;
  seedRoot: string;
  docCount: number;
  withEmbeddings: boolean;
  embeddingModel?: string;
};

export type SearchHit = {
  id: string;
  title: string;
  source: string;
  type: string;
  tags: string[];
  score: number;
  lexicalScore: number;
  vectorScore?: number;
  snippet: string;
};

export type SearchResult = {
  query: string;
  total: number;
  hits: SearchHit[];
  withEmbeddings: boolean;
};

const DEFAULT_INDEX_PATH = path.join(os.homedir(), ".openclaw", "shippulse", "kb-index.json");
const DEFAULT_EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
const DEFAULT_OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const OPENAI_COMPATIBLE_PROVIDERS = new Set([
  "openai",
  "openrouter",
  "azure-openai",
  "azure_openai",
]);

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureParentDir(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

function normalizeText(input: string): string {
  return input.replace(/\r/g, "").trim();
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function buildTf(tokens: string[]): Record<string, number> {
  const tf: Record<string, number> = {};
  for (const t of tokens) tf[t] = (tf[t] ?? 0) + 1;
  return tf;
}

function pickSnippet(text: string, terms: string[]): string {
  const normalized = text.replace(/\s+/g, " ");
  if (!normalized) return "";
  const lc = normalized.toLowerCase();
  let idx = -1;
  for (const term of terms) {
    idx = lc.indexOf(term.toLowerCase());
    if (idx !== -1) break;
  }
  if (idx === -1) return normalized.slice(0, 220);
  const start = Math.max(0, idx - 80);
  const end = Math.min(normalized.length, idx + 140);
  return normalized.slice(start, end);
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    aNorm += a[i] * a[i];
    bNorm += b[i] * b[i];
  }
  if (aNorm === 0 || bNorm === 0) return 0;
  return dot / (Math.sqrt(aNorm) * Math.sqrt(bNorm));
}

async function readSeedJson(filePath: string): Promise<any[]> {
  if (!(await pathExists(filePath))) return [];
  const parsed = JSON.parse(await fs.readFile(filePath, "utf-8"));
  if (!Array.isArray(parsed?.value)) return [];
  return parsed.value;
}

function docId(prefix: string, raw: string, fallback: string): string {
  const base = (raw || fallback).replace(/[^a-zA-Z0-9._:-]/g, "_");
  return `${prefix}:${base}`;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asTrimmed(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function parseJsonSeedDocs(seedRoot: string, relPath: string, items: any[], kind: string): KnowledgeDoc[] {
  const docs: KnowledgeDoc[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item || typeof item !== "object") continue;

    if (kind === "golden") {
      const title = asString(item.title) || `Golden Example ${i + 1}`;
      const text = normalizeText(`${title}\n\n${asString(item.description)}`);
      if (!text) continue;
      const tags = [asString(item.workItemType)].filter(Boolean);
      docs.push({
        id: docId("golden", asString(item.id), String(i)),
        title,
        text,
        source: relPath,
        type: "golden-example",
        tags,
      });
      continue;
    }

    if (kind === "domain") {
      const title = asString(item.title) || `Domain Context ${i + 1}`;
      const text = normalizeText(`${title}\n\n${asString(item.content)}`);
      if (!text) continue;
      const tags: string[] = [];
      if (Array.isArray(item.tags)) {
        for (const tag of item.tags) {
          if (typeof tag === "string" && tag.trim()) tags.push(tag.trim());
        }
      }
      const category = asString(item.category);
      if (category) tags.push(category);
      docs.push({
        id: docId("domain", asString(item.id), String(i)),
        title,
        text,
        source: relPath,
        type: "domain-context",
        tags,
      });
      continue;
    }

    if (kind === "templates") {
      const title = asString(item.name) || `Template ${i + 1}`;
      const text = normalizeText(`${title}\n\n${asString(item.descriptionTemplate)}`);
      if (!text) continue;
      const tags = [asString(item.workItemType), ...(Array.isArray(item.applicableContexts) ? item.applicableContexts : [])]
        .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
        .map((t) => t.trim());
      docs.push({
        id: docId("template", asString(item.id), String(i)),
        title,
        text,
        source: relPath,
        type: "template",
        tags,
      });
      continue;
    }

    if (kind === "feedback") {
      const category = asString(item.category) || "Feedback";
      const pattern = asString(item.pattern);
      const title = `${category}: ${pattern.slice(0, 64) || `Pattern ${i + 1}`}`;
      const text = normalizeText(`${title}\n\n${pattern}`);
      if (!text) continue;
      const tags = [asString(item.workItemType), asString(item.thumbs)].filter(Boolean);
      docs.push({
        id: docId("feedback", asString(item.id), String(i)),
        title,
        text,
        source: relPath,
        type: "feedback",
        tags,
      });
      continue;
    }
  }
  return docs;
}

async function walkMarkdownFiles(rootDir: string): Promise<string[]> {
  const out: string[] = [];
  if (!(await pathExists(rootDir))) return out;

  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        out.push(full);
      }
    }
  }
  return out;
}

function firstMarkdownHeading(content: string): string | null {
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ")) return trimmed.slice(2).trim();
  }
  return null;
}

export async function collectSeedDocuments(seedRoot: string): Promise<KnowledgeDoc[]> {
  const docs: KnowledgeDoc[] = [];
  const absSeedRoot = path.resolve(seedRoot);
  const azureRoot = path.join(absSeedRoot, "azure-search");
  const cosmosRoot = path.join(absSeedRoot, "cosmos");

  const golden = await readSeedJson(path.join(azureRoot, "golden-examples.json"));
  docs.push(...parseJsonSeedDocs(absSeedRoot, "azure-search/golden-examples.json", golden, "golden"));

  const domain = await readSeedJson(path.join(azureRoot, "domain-context.json"));
  docs.push(...parseJsonSeedDocs(absSeedRoot, "azure-search/domain-context.json", domain, "domain"));

  const templates = await readSeedJson(path.join(azureRoot, "templates.json"));
  docs.push(...parseJsonSeedDocs(absSeedRoot, "azure-search/templates.json", templates, "templates"));

  const feedback = await readSeedJson(path.join(azureRoot, "feedback.json"));
  docs.push(...parseJsonSeedDocs(absSeedRoot, "azure-search/feedback.json", feedback, "feedback"));

  const mdFiles = await walkMarkdownFiles(cosmosRoot);
  for (const fullPath of mdFiles) {
    const rel = path.relative(absSeedRoot, fullPath);
    const raw = await fs.readFile(fullPath, "utf-8");
    const text = normalizeText(raw);
    if (!text) continue;
    const title = firstMarkdownHeading(raw) || path.basename(fullPath, path.extname(fullPath));
    docs.push({
      id: docId("md", rel, title),
      title,
      text,
      source: rel,
      type: "markdown",
      tags: rel.split(path.sep).slice(0, 2),
    });
  }

  return docs;
}

type EmbeddingFn = (inputs: string[]) => Promise<number[][]>;

function rankProvider(provider: string | undefined): number {
  if (!provider) return 100;
  if (provider === "openai") return 0;
  if (provider === "openrouter") return 1;
  if (OPENAI_COMPATIBLE_PROVIDERS.has(provider)) return 2;
  return 100;
}

function providerDefaultBaseUrl(provider: string | undefined): string {
  if (provider === "openrouter") return OPENROUTER_BASE_URL;
  return DEFAULT_OPENAI_BASE_URL;
}

async function readOpenClawAuthProfiles(): Promise<Record<string, OpenClawAuthProfile>> {
  const stateDir = resolveOpenClawStateDir();
  const authProfilesPath = path.join(stateDir, "agents", "main", "agent", "auth-profiles.json");
  if (!(await pathExists(authProfilesPath))) {
    return {};
  }

  let parsed: OpenClawAuthProfilesFile;
  try {
    parsed = JSON.parse(await fs.readFile(authProfilesPath, "utf-8")) as OpenClawAuthProfilesFile;
  } catch {
    return {};
  }

  if (!parsed || typeof parsed !== "object" || !parsed.profiles || typeof parsed.profiles !== "object") {
    return {};
  }
  return parsed.profiles;
}

function openClawProfileToCredentials(
  profileId: string,
  profile: OpenClawAuthProfile,
): EmbeddingCredentials | null {
  const provider = asTrimmed(profile.provider)?.toLowerCase();
  if (provider && !OPENAI_COMPATIBLE_PROVIDERS.has(provider)) return null;

  const apiKey = asTrimmed(profile.token) || asTrimmed(profile.apiKey) || asTrimmed(profile.key);
  if (!apiKey) return null;

  const baseUrl = asTrimmed(process.env.OPENAI_BASE_URL)
    || asTrimmed(profile.baseUrl)
    || asTrimmed(profile.baseURL)
    || asTrimmed(profile.endpoint)
    || asTrimmed(profile.url)
    || providerDefaultBaseUrl(provider);

  return {
    apiKey,
    baseUrl,
    source: "openclaw",
    profileId,
  };
}

async function resolveEmbeddingCredentials(): Promise<EmbeddingCredentials> {
  const envApiKey = asTrimmed(process.env.OPENAI_API_KEY);
  if (envApiKey) {
    return {
      apiKey: envApiKey,
      baseUrl: asTrimmed(process.env.OPENAI_BASE_URL) || DEFAULT_OPENAI_BASE_URL,
      source: "env",
    };
  }

  const preferredProfileId = asTrimmed(process.env.OPENCLAW_EMBEDDING_PROFILE);
  const profiles = await readOpenClawAuthProfiles();
  const entries = Object.entries(profiles);
  const ranked = entries
    .map(([profileId, profile]) => ({ profileId, profile, rank: rankProvider(asTrimmed(profile.provider)?.toLowerCase()) }))
    .sort((a, b) => {
      if (preferredProfileId) {
        if (a.profileId === preferredProfileId) return -1;
        if (b.profileId === preferredProfileId) return 1;
      }
      return a.rank - b.rank;
    });

  for (const item of ranked) {
    const creds = openClawProfileToCredentials(item.profileId, item.profile);
    if (creds) return creds;
  }

  throw new Error(
    "Embedding auth missing. Set OPENAI_API_KEY or configure an OpenAI-compatible OpenClaw auth profile.",
  );
}

async function createOpenAIEmbedder(model: string): Promise<EmbeddingFn> {
  const creds = await resolveEmbeddingCredentials();
  const apiKey = creds.apiKey;
  const baseUrl = creds.baseUrl.replace(/\/$/, "");
  return async (inputs: string[]) => {
    const resp = await fetch(`${baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, input: inputs }),
    });
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Embedding request failed (${resp.status}): ${body.slice(0, 500)}`);
    }
    const json = await resp.json() as { data?: Array<{ embedding: number[] }> };
    const vectors = (json.data ?? []).map((d) => d.embedding);
    if (vectors.length !== inputs.length) {
      throw new Error(`Embedding response size mismatch: expected ${inputs.length}, got ${vectors.length}`);
    }
    return vectors;
  };
}

export function getDefaultIndexPath(): string {
  return DEFAULT_INDEX_PATH;
}

export async function buildKnowledgebaseIndex(params?: {
  seedRoot?: string;
  indexPath?: string;
  withEmbeddings?: boolean;
  embeddingModel?: string;
}): Promise<IndexBuildResult> {
  const seedRoot = path.resolve(params?.seedRoot || path.join(process.cwd(), "infra", "seed"));
  const indexPath = path.resolve(params?.indexPath || DEFAULT_INDEX_PATH);
  const withEmbeddings = Boolean(params?.withEmbeddings);
  const model = params?.embeddingModel || DEFAULT_EMBEDDING_MODEL;

  if (!(await pathExists(seedRoot))) {
    throw new Error(`Seed root not found: ${seedRoot}`);
  }

  const docs = await collectSeedDocuments(seedRoot);
  if (docs.length === 0) {
    throw new Error(`No documents found in seed root: ${seedRoot}`);
  }

  const indexedDocs: IndexedDoc[] = [];
  const df: Record<string, number> = {};
  let totalLen = 0;

  for (const doc of docs) {
    const tokens = tokenize(`${doc.title}\n${doc.text}`);
    const tf = buildTf(tokens);
    const len = tokens.length || 1;
    totalLen += len;
    const seen = new Set<string>();
    for (const term of Object.keys(tf)) {
      if (seen.has(term)) continue;
      seen.add(term);
      df[term] = (df[term] ?? 0) + 1;
    }
    indexedDocs.push({ ...doc, len, tf });
  }

  let embeddingsMeta: EmbeddingMeta | undefined;
  if (withEmbeddings) {
    const embed = await createOpenAIEmbedder(model);
    const batchSize = 32;
    const vectors: number[][] = [];
    const embedInputs = indexedDocs.map((d) => `${d.title}\n\n${d.text.slice(0, 7000)}`);
    for (let i = 0; i < embedInputs.length; i += batchSize) {
      const chunk = embedInputs.slice(i, i + batchSize);
      const chunkVectors = await embed(chunk);
      vectors.push(...chunkVectors);
    }
    for (let i = 0; i < indexedDocs.length; i++) {
      indexedDocs[i].embedding = vectors[i];
    }
    embeddingsMeta = {
      provider: "openai",
      model,
      dimensions: vectors[0]?.length ?? 0,
    };
  }

  const avgDocLen = totalLen / indexedDocs.length;
  const index: KnowledgeIndex = {
    version: 1,
    createdAt: new Date().toISOString(),
    seedRoot,
    docCount: indexedDocs.length,
    avgDocLen,
    df,
    docs: indexedDocs,
    embeddings: embeddingsMeta,
  };

  await ensureParentDir(indexPath);
  await fs.writeFile(indexPath, JSON.stringify(index), "utf-8");

  return {
    indexPath,
    seedRoot,
    docCount: indexedDocs.length,
    withEmbeddings: Boolean(embeddingsMeta),
    embeddingModel: embeddingsMeta?.model,
  };
}

async function loadIndex(indexPath: string): Promise<KnowledgeIndex> {
  if (!(await pathExists(indexPath))) {
    throw new Error(`Knowledge index not found: ${indexPath}. Run "shippulse kb index" first.`);
  }
  const raw = await fs.readFile(indexPath, "utf-8");
  const index = JSON.parse(raw) as KnowledgeIndex;
  if (!index || index.version !== 1 || !Array.isArray(index.docs)) {
    throw new Error(`Invalid knowledge index at ${indexPath}`);
  }
  return index;
}

async function embedQuery(index: KnowledgeIndex, query: string): Promise<number[] | null> {
  if (!index.embeddings) return null;
  const embed = await createOpenAIEmbedder(index.embeddings.model);
  const vectors = await embed([query]);
  return vectors[0] ?? null;
}

export async function searchKnowledgebaseIndex(params: {
  query: string;
  topK?: number;
  indexPath?: string;
  useEmbeddings?: boolean;
  alpha?: number;
}): Promise<SearchResult> {
  const query = params.query.trim();
  if (!query) throw new Error("Search query cannot be empty.");

  const indexPath = path.resolve(params.indexPath || DEFAULT_INDEX_PATH);
  const index = await loadIndex(indexPath);
  const topK = params.topK && params.topK > 0 ? params.topK : 8;
  const alpha = Math.min(1, Math.max(0, params.alpha ?? 0.6)); // lexical weight

  const terms = tokenize(query);
  const N = index.docCount || 1;
  const k1 = 1.2;
  const b = 0.75;

  const lexicalScores = new Array<number>(index.docs.length).fill(0);
  for (let i = 0; i < index.docs.length; i++) {
    const doc = index.docs[i];
    let score = 0;
    for (const term of terms) {
      const tf = doc.tf[term] ?? 0;
      if (!tf) continue;
      const df = index.df[term] ?? 0;
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      const denom = tf + k1 * (1 - b + b * (doc.len / (index.avgDocLen || 1)));
      score += idf * ((tf * (k1 + 1)) / (denom || 1));
    }
    lexicalScores[i] = score;
  }

  let vectorScores: number[] | null = null;
  if (params.useEmbeddings !== false && index.embeddings) {
    const qVec = await embedQuery(index, query);
    if (qVec) {
      vectorScores = index.docs.map((d) => d.embedding ? Math.max(0, cosineSimilarity(qVec, d.embedding)) : 0);
    }
  }

  const maxLex = Math.max(...lexicalScores, 0.000001);
  const maxVec = vectorScores ? Math.max(...vectorScores, 0.000001) : 1;
  const withEmbeddings = Boolean(vectorScores);

  const scored = index.docs.map((doc, i) => {
    const lexNorm = lexicalScores[i] / maxLex;
    const vecNorm = vectorScores ? vectorScores[i] / maxVec : 0;
    const finalScore = vectorScores ? (alpha * lexNorm) + ((1 - alpha) * vecNorm) : lexNorm;
    return {
      doc,
      score: finalScore,
      lexicalScore: lexNorm,
      vectorScore: vectorScores ? vecNorm : undefined,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  const hits = scored
    .slice(0, topK)
    .map((item): SearchHit => ({
      id: item.doc.id,
      title: item.doc.title,
      source: item.doc.source,
      type: item.doc.type,
      tags: item.doc.tags,
      score: item.score,
      lexicalScore: item.lexicalScore,
      vectorScore: item.vectorScore,
      snippet: pickSnippet(item.doc.text, terms),
    }))
    .filter((h) => h.score > 0 || h.snippet.length > 0);

  return {
    query,
    total: hits.length,
    hits,
    withEmbeddings,
  };
}
