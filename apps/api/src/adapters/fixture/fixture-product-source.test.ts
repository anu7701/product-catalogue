import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FixtureLoadError, FixtureProductSource } from './fixture-product-source.ts';

// Behaviour shared with every ProductSource is covered by the contract suite
// (product-source.contract.test.ts). These tests cover what is fixture-specific.

describe('FixtureProductSource', () => {
  it('T13: the committed snapshot has the 20 Fake Store products in 4 categories', async () => {
    const source = await FixtureProductSource.load();

    expect(await source.listProducts()).toHaveLength(20);
    expect(await source.listCategories()).toEqual([
      "men's clothing",
      'jewelery',
      'electronics',
      "women's clothing",
    ]);
  });

  it('NEW-47: contains the featured IDs from .env.example', async () => {
    const source = await FixtureProductSource.load();
    for (const id of ['1', '5', '9', '15', '18']) {
      expect(await source.getProduct(id)).not.toBeNull();
    }
  });

  it('returns copies, so callers cannot change the snapshot', async () => {
    const source = await FixtureProductSource.load();
    const [first] = await source.listProducts();
    if (!first) throw new Error('fixture is empty');
    first.title = 'changed';

    expect((await source.getProduct(first.id))?.title).not.toBe('changed');
  });

  describe('refuses to load an unusable snapshot', () => {
    let dir: string;

    beforeEach(async () => {
      dir = await mkdtemp(join(tmpdir(), 'fixture-'));
    });

    afterEach(async () => {
      await rm(dir, { recursive: true, force: true });
    });

    async function loadJson(content: string) {
      const file = join(dir, 'products.json');
      await writeFile(file, content);
      return FixtureProductSource.load(file);
    }

    const valid = {
      id: '1',
      title: 'T',
      price: 1,
      description: 'D',
      categoryName: 'c',
      imageRef: 'placeholder.svg',
      rating: null,
    };

    it('missing file', async () => {
      await expect(FixtureProductSource.load(join(dir, 'nope.json'))).rejects.toThrow(
        FixtureLoadError,
      );
    });

    it('not JSON', async () => {
      await expect(loadJson('{not json')).rejects.toThrow(FixtureLoadError);
    });

    it('record with a missing field', async () => {
      const { title, ...noTitle } = valid;
      await expect(loadJson(JSON.stringify([noTitle]))).rejects.toThrow(/title/);
    });

    it('duplicate product IDs', async () => {
      await expect(loadJson(JSON.stringify([valid, valid]))).rejects.toThrow(/unique/);
    });

    it('empty snapshot', async () => {
      await expect(loadJson('[]')).rejects.toThrow(FixtureLoadError);
    });
  });
});
