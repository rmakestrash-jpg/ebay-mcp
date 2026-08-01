import { z } from '@/utils/effectSchema.js';

/** Input accepted by Media API createImageFromFile. */
export const createImageFromFileInputSchema = z.object({
  filePath: z.string().min(1).describe('Absolute local path of the image to upload'),
});

/** Input accepted by Media API createImageFromUrl. */
export const createImageFromUrlInputSchema = z.object({
  imageUrl: z.string().url().describe('Public image URL to copy into eBay Picture Services'),
});

/** Input accepted by Media API getImage. */
export const getImageInputSchema = z.object({
  imageId: z.string().min(1).describe('eBay Media API image ID'),
});
