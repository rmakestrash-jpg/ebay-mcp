import { UnpublishedOfferApi } from '@/api/listing-management/unpublishedOffer.js';
import type { InventoryApi } from '@/api/listing-management/inventory.js';
import type { MediaApi } from '@/api/media/media.js';
import { Effect } from 'effect';
import { describe, expect, it, vi } from 'vitest';

const baseInput = {
  sku: 'SKU-1',
  title: 'Example item',
  categoryId: '123',
  price: 49.99,
  currency: 'USD',
  quantity: 1,
  condition: 'NEW',
  marketplaceId: 'EBAY_US' as const,
  format: 'FIXED_PRICE',
  listingDuration: 'GTC',
};

describe('UnpublishedOfferApi', () => {
  it('creates and verifies an unpublished offer without publishing it', async () => {
    const inventory = {
      createOrReplaceInventoryItem: vi.fn(() => Effect.succeed({})),
      createOffer: vi.fn(() => Effect.succeed({ offerId: 'OFFER-1' })),
      getInventoryItem: vi.fn(() => Effect.succeed({ sku: 'SKU-1', product: { imageUrls: [] } })),
      getOffer: vi.fn(() =>
        Effect.succeed({
          offerId: 'OFFER-1',
          sku: 'SKU-1',
          marketplaceId: 'EBAY_US',
          status: 'UNPUBLISHED',
        }),
      ),
    } as unknown as InventoryApi;
    const media = {} as MediaApi;

    const result = await Effect.runPromise(
      new UnpublishedOfferApi(inventory, media).createOrUpdate(baseInput),
    );

    expect(result).toMatchObject({
      offerId: 'OFFER-1',
      status: 'UNPUBLISHED',
      published: false,
      inventoryItemVerified: true,
      offerVerified: true,
    });
    expect(inventory.createOffer).toHaveBeenCalledOnce();
  });

  it('uploads local images and updates an existing offer', async () => {
    const inventory = {
      createOrReplaceInventoryItem: vi.fn(() => Effect.succeed({})),
      updateOffer: vi.fn(() => Effect.succeed({ offerId: 'OFFER-2' })),
      getInventoryItem: vi.fn(() =>
        Effect.succeed({
          sku: 'SKU-1',
          product: { imageUrls: ['https://i.ebayimg.com/example.jpg'] },
        }),
      ),
      getOffer: vi.fn(() =>
        Effect.succeed({
          offerId: 'OFFER-2',
          sku: 'SKU-1',
          marketplaceId: 'EBAY_US',
          status: 'UNPUBLISHED',
        }),
      ),
    } as unknown as InventoryApi;
    const media = {
      createImageFromFile: vi.fn(() =>
        Effect.succeed({ maxDimensionImageUrl: 'https://i.ebayimg.com/example.jpg' }),
      ),
    } as unknown as MediaApi;

    const result = await Effect.runPromise(
      new UnpublishedOfferApi(inventory, media).createOrUpdate({
        ...baseInput,
        offerId: 'OFFER-2',
        localImagePaths: ['C:\\photo.jpg'],
      }),
    );

    expect(result.imageUrls).toEqual(['https://i.ebayimg.com/example.jpg']);
    expect(inventory.updateOffer).toHaveBeenCalledOnce();
  });

  it('fails closed if readback indicates the offer was published', async () => {
    const inventory = {
      createOrReplaceInventoryItem: vi.fn(() => Effect.succeed({})),
      createOffer: vi.fn(() => Effect.succeed({ offerId: 'OFFER-LIVE' })),
      getInventoryItem: vi.fn(() => Effect.succeed({ sku: 'SKU-1', product: {} })),
      getOffer: vi.fn(() =>
        Effect.succeed({
          offerId: 'OFFER-LIVE',
          marketplaceId: 'EBAY_US',
          status: 'PUBLISHED',
          listing: { listingId: '12345' },
        }),
      ),
    } as unknown as InventoryApi;

    await expect(
      Effect.runPromise(
        new UnpublishedOfferApi(inventory, {} as MediaApi).createOrUpdate(baseInput),
      ),
    ).rejects.toThrow('Safety verification failed');
  });
});
