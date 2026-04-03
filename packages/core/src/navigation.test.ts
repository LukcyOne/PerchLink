import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { shellNavigation } from './navigation';

const currentDir = dirname(fileURLToPath(import.meta.url));
const tokensPath = resolve(currentDir, '../../ui/src/tokens.css');
const tokensCss = readFileSync(tokensPath, 'utf8');

describe('shellNavigation', () => {
  it('exposes the six expected navigation ids and label keys', () => {
    expect(shellNavigation).toHaveLength(6);
    expect(shellNavigation.map((item) => item.id)).toEqual([
      'all-bookmarks',
      'starred',
      'recent',
      'collections',
      'categories',
      'settings',
    ]);
    expect(shellNavigation.map((item) => item.labelKey)).toEqual([
      'nav.allBookmarks',
      'nav.starred',
      'nav.recent',
      'nav.collections',
      'nav.categories',
      'nav.settings',
    ]);
  });
});

describe('tokens.css', () => {
  it('uses the approved accent and rejects the demo accent', () => {
    expect(tokensCss).toContain('#2F6B62');
    expect(tokensCss).not.toContain('#6366f1');
  });
});
