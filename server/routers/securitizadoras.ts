import { publicProcedure } from '../_core/trpc';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dir, '..', 'data', 'securitizadoras.json');

let cached: any[] | null = null;

function getData() {
  if (!cached) {
    cached = JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
  }
  return cached!;
}

export const securitizadorasRouter = {
  get: publicProcedure.query(() => {
    return getData();
  }),
};
