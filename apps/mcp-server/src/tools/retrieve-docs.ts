import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasFailure } from '../failure-flags.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = process.env['DOCS_DIR'] ?? path.resolve(__dirname, '../../../../data/docs');

const NOISE_DOCS = [
  'The French Revolution began in 1789 with the storming of the Bastille.',
  'Photosynthesis converts sunlight into glucose using chlorophyll.',
  'The speed of light in a vacuum is approximately 299,792,458 metres per second.',
];

const STOP_WORDS = new Set(['what', 'is', 'how', 'does', 'the', 'a', 'an', 'and', 'or', 'in', 'of', 'to', 'it', 'do', 'why', 'when', 'are', 'can', 'for']);

function keywords(query: string): string[] {
  return query
    .toLowerCase()
    .replaceAll(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

export function retrieveDocs(query: string): { documents: string[] } {
  const docs: string[] = [];
  const terms = keywords(query);

  if (fs.existsSync(DOCS_DIR)) {
    const files = fs.readdirSync(DOCS_DIR).filter((f) => f.endsWith('.txt'));
    for (const file of files) {
      const content = fs.readFileSync(path.join(DOCS_DIR, file), 'utf-8');
      const lines = content.split('\n').filter((line) =>
        terms.some((term) => line.toLowerCase().includes(term))
      );
      docs.push(...lines);
    }
  }

  if (hasFailure('retrieval_noise')) {
    docs.push(...NOISE_DOCS);
  }

  if (docs.length === 0) {
    return {
      documents: [],
      grounded: false,
      instruction: 'No documents were found for this query. Answer from your own knowledge but explicitly tell the user that no relevant documents were found and your answer is based on general training knowledge, not retrieved evidence.',
    };
  }

  return { documents: docs, grounded: true };
}
