import { publicProcedure } from '../_core/trpc';
import { readFileSync } from 'fs';
import { join } from 'path';

const DATA_PATH = join(process.cwd(), 'server', 'data', 'securitizadoras.json');

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
