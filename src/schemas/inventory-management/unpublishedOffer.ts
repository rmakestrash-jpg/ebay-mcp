import { MarketplaceId } from '@/types/ebayEnums.js';
import { z } from '@/utils/effectSchema.js';

const listingPoliciesSchema = z
  .object({
    fulfillmentPolicyId: z.string().optional(),
    paymentPolicyId: z.string().optional(),
    returnPolicyId: z.string().optional(),
  })
  .optional();

/**
 * High-level input for creating or updating an API-native eBay draft.
 * The resulting offer is deliberately left UNPUBLISHED.
 */
export const createUnpublishedOfferInputSchema = z.object({
  sku: z.string().min(1).describe('Stable seller-defined SKU used as the draft key'),
  offerId: z
    .string()
    .optional()
    .describe('Existing unpublished offer ID to update; omit to create a new offer'),
  title: z.string().min(1).max(80).describe('eBay listing title'),
  description: z.string().optional().describe('Listing description; HTML is accepted by eBay'),
  categoryId: z.string().min(1).describe('Leaf eBay category ID'),
  price: z.number().describe('Buy It Now price; must be zero or greater'),
  currency: z.string().default('USD').describe('ISO 4217 currency code'),
  quantity: z.number().default(1).describe('Whole-number quantity; must be zero or greater'),
  condition: z.string().default('NEW').describe('eBay Inventory API condition enum'),
  conditionDescription: z.string().optional(),
  marketplaceId: z.nativeEnum(MarketplaceId).default(MarketplaceId.EBAY_US),
  format: z.string().default('FIXED_PRICE'),
  listingDuration: z.string().default('GTC'),
  aspects: z.record(z.array(z.string())).optional().describe('Item specifics keyed by aspect name'),
  brand: z.string().optional(),
  mpn: z.string().optional(),
  upc: z.array(z.string()).optional(),
  ean: z.array(z.string()).optional(),
  isbn: z.array(z.string()).optional(),
  localImagePaths: z
    .array(z.string())
    .optional()
    .describe('Local image files to upload to eBay Picture Services'),
  imageUrls: z
    .array(z.string().url())
    .optional()
    .describe('Existing public image URLs to copy into eBay Picture Services'),
  merchantLocationKey: z.string().optional(),
  listingPolicies: listingPoliciesSchema,
});

export const unpublishedOfferOutputSchema = z.object({
  sku: z.string(),
  offerId: z.string(),
  status: z.string(),
  marketplaceId: z.string(),
  imageUrls: z.array(z.string()),
  inventoryItemVerified: z.boolean(),
  offerVerified: z.boolean(),
  published: z.boolean(),
  listingId: z.string().optional(),
});
