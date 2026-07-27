import type { MediaApi } from '@/api/media/media.js';
import type {
  CreateOfferRequest,
  InventoryApi,
  InventoryItem,
  UpdateOfferRequest,
} from '@/api/listing-management/inventory.js';
import type { createUnpublishedOfferInputSchema } from '@/schemas/inventory-management/unpublishedOffer.js';
import type { InferEffectSchema } from '@/utils/effectSchemaTypes.js';
import { Effect } from 'effect';

type CreateUnpublishedOfferInput = InferEffectSchema<typeof createUnpublishedOfferInputSchema>;

export interface UnpublishedOfferResult {
  readonly sku: string;
  readonly offerId: string;
  readonly status: string;
  readonly marketplaceId: string;
  readonly imageUrls: string[];
  readonly inventoryItemVerified: boolean;
  readonly offerVerified: boolean;
  readonly published: boolean;
  readonly listingId?: string;
}

/**
 * Creates a complete Inventory API item and offer, but never calls publishOffer.
 * This is eBay's API-native representation of a saved draft.
 */
export class UnpublishedOfferApi {
  public constructor(
    private readonly inventory: InventoryApi,
    private readonly media: MediaApi,
  ) {}

  public createOrUpdate = (
    input: CreateUnpublishedOfferInput,
  ): Effect.Effect<UnpublishedOfferResult, unknown> =>
    Effect.gen(this, function* () {
      if (input.price < 0) {
        return yield* Effect.fail(new Error('price must be zero or greater'));
      }
      if (!Number.isInteger(input.quantity) || input.quantity < 0) {
        return yield* Effect.fail(
          new Error('quantity must be a whole number that is zero or greater'),
        );
      }

      const uploadedImages: string[] = [];

      for (const filePath of input.localImagePaths ?? []) {
        const image = yield* this.media.createImageFromFile({ filePath });
        const url = image.maxDimensionImageUrl ?? image.imageUrl;
        if (url) uploadedImages.push(url);
      }
      for (const sourceUrl of input.imageUrls ?? []) {
        const image = yield* this.media.createImageFromUrl({ imageUrl: sourceUrl });
        const url = image.maxDimensionImageUrl ?? image.imageUrl;
        if (url) uploadedImages.push(url);
      }

      const product = {
        title: input.title,
        ...(input.description ? { description: input.description } : {}),
        ...(input.aspects ? { aspects: input.aspects } : {}),
        ...(input.brand ? { brand: input.brand } : {}),
        ...(input.mpn ? { mpn: input.mpn } : {}),
        ...(input.upc ? { upc: input.upc } : {}),
        ...(input.ean ? { ean: input.ean } : {}),
        ...(input.isbn ? { isbn: input.isbn } : {}),
        ...(uploadedImages.length > 0 ? { imageUrls: uploadedImages } : {}),
      } as unknown as NonNullable<InventoryItem['product']>;
      const inventoryItem: InventoryItem = {
        availability: { shipToLocationAvailability: { quantity: input.quantity } },
        condition: input.condition,
        ...(input.conditionDescription ? { conditionDescription: input.conditionDescription } : {}),
        product,
      };

      yield* this.inventory.createOrReplaceInventoryItem({
        sku: input.sku,
        body: inventoryItem,
      });

      const offerBody: CreateOfferRequest = {
        sku: input.sku,
        marketplaceId: input.marketplaceId,
        format: input.format,
        categoryId: input.categoryId,
        availableQuantity: input.quantity,
        listingDescription: input.description,
        listingDuration: input.listingDuration,
        pricingSummary: {
          price: { currency: input.currency, value: input.price.toFixed(2) },
        },
        ...(input.merchantLocationKey ? { merchantLocationKey: input.merchantLocationKey } : {}),
        ...(input.listingPolicies ? { listingPolicies: input.listingPolicies } : {}),
      };

      let offerId = input.offerId;
      if (offerId) {
        yield* this.inventory.updateOffer({
          offerId,
          body: { ...offerBody, offerId } as UpdateOfferRequest,
        });
      } else {
        const created = yield* this.inventory.createOffer({ body: offerBody });
        offerId = created.offerId;
      }
      if (!offerId) {
        return yield* Effect.fail(new Error('eBay did not return an offer ID'));
      }

      const [savedItem, savedOffer] = yield* Effect.all([
        this.inventory.getInventoryItem({ sku: input.sku }),
        this.inventory.getOffer({ offerId }),
      ]);
      const status = savedOffer.status ?? 'UNKNOWN';
      const listingId = savedOffer.listing?.listingId;
      const published = status !== 'UNPUBLISHED' || Boolean(listingId);
      if (published) {
        return yield* Effect.fail(
          new Error(
            `Safety verification failed: offer ${offerId} is not an unpublished draft (status=${status}, listingId=${listingId ?? 'none'})`,
          ),
        );
      }

      return {
        sku: input.sku,
        offerId,
        status,
        marketplaceId: savedOffer.marketplaceId ?? input.marketplaceId,
        imageUrls: savedItem.product?.imageUrls ?? [],
        inventoryItemVerified: savedItem.sku === input.sku,
        offerVerified: savedOffer.offerId === offerId,
        published: false,
        ...(listingId ? { listingId } : {}),
      };
    });
}
