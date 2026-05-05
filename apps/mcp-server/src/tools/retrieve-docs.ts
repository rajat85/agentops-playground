import fs from 'fs';
import path from 'path';
import { hasFailure } from '../failure-flags.js';

const DOCS_DIR = process.env['DOCS_DIR'] ?? path.resolve(process.cwd(), 'data/docs');

const NOISE_DOCS = [
  'The French Revolution began in 1789 with the storming of the Bastille.',
  'Photosynthesis converts sunlight into glucose using chlorophyll.',
  'The speed of light in a vacuum is approximately 299,792,458 metres per second.',
];

export function retrieveDocs(query: string): { documents: string[] } {
  const docs: string[] = [];

  if (fs.existsSync(DOCS_DIR)) {
    const files = fs.readdirSync(DOCS_DIR).filter((f) => f.endsWith('.txt'));
    for (const file of files) {
      const content = fs.readFileSync(path.join(DOCS_DIR, file), 'utf-8');
      const lines = content.split('\n').filter((line) =>
        line.toLowerCase().includes(query.toLowerCase())
      );
      docs.push(...lines);
    }
  }

  if (hasFailure('retrieval_noise')) {
    docs.push(...NOISE_DOCS);
  }

  return { documents: docs.length > 0 ? docs : [`No documents found for query: ${query}`] };
}
