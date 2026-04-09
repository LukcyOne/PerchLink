import { promises as dnsPromises } from 'node:dns';
import { defineConfig } from 'vitest/config';

const originalLookup = dnsPromises.lookup.bind(dnsPromises);

dnsPromises.lookup = (async (hostname, options) => {
  try {
    return await originalLookup(hostname, options as never);
  } catch (error) {
    if (
      hostname === 'localhost' &&
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'EAI_FAIL'
    ) {
      return { address: '127.0.0.1', family: 4 };
    }

    throw error;
  }
}) as typeof dnsPromises.lookup;

export default defineConfig({
  server: {
    host: '127.0.0.1',
  },
  test: {
    projects: [
      {
        test: {
          name: 'workspace',
          include: [
            'packages/**/*.test.ts',
            'packages/**/*.test.tsx',
            'apps/**/*.test.ts',
            'apps/**/*.test.tsx',
          ],
          environment: 'node',
        },
      },
    ],
  },
});
