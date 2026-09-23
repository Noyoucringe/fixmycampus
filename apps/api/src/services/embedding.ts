import { createHash } from 'crypto';

interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
}

const DIMENSIONS = 768;

class LocalEmbedding implements EmbeddingProvider {
  async embed(text: string): Promise<number[]> {
    const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const words = normalized.split(/\s+/).filter(Boolean);
    const vector = new Float64Array(DIMENSIONS);

    for (const word of words) {
      const hash = createHash('sha256').update(word).digest();
      for (let i = 0; i < DIMENSIONS; i++) {
        vector[i] += (hash[i % hash.length]! / 255) * 2 - 1;
      }
    }

    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (magnitude > 0) {
      for (let i = 0; i < DIMENSIONS; i++) {
        vector[i] = vector[i]! / magnitude;
      }
    }
    return Array.from(vector);
  }
}

class GeminiEmbedding implements EmbeddingProvider {
  private apiKey: string;
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async embed(text: string): Promise<number[]> {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'models/text-embedding-004', content: { parts: [{ text }] } }),
      }
    );
    if (!res.ok) throw new Error(`Gemini embedding failed: ${res.status}`);
    const data = (await res.json()) as { embedding: { values: number[] } };
    return data.embedding.values;
  }
}

class OpenAIEmbedding implements EmbeddingProvider {
  private apiKey: string;
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async embed(text: string): Promise<number[]> {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: text, dimensions: DIMENSIONS }),
    });
    if (!res.ok) throw new Error(`OpenAI embedding failed: ${res.status}`);
    const data = (await res.json()) as { data: { embedding: number[] }[] };
    return data.data[0]!.embedding;
  }
}

let provider: EmbeddingProvider | null = null;

export function getEmbeddingProvider(): EmbeddingProvider {
  if (provider) return provider;

  const type = process.env.EMBEDDING_PROVIDER || 'local';
  switch (type) {
    case 'gemini': {
      const key = process.env.GEMINI_API_KEY;
      if (!key) throw new Error('GEMINI_API_KEY required when EMBEDDING_PROVIDER=gemini');
      provider = new GeminiEmbedding(key);
      break;
    }
    case 'openai': {
      const key = process.env.OPENAI_API_KEY;
      if (!key) throw new Error('OPENAI_API_KEY required when EMBEDDING_PROVIDER=openai');
      provider = new OpenAIEmbedding(key);
      break;
    }
    default:
      provider = new LocalEmbedding();
  }
  return provider;
}
