import { Effect } from 'effect';
import {
  createImageFromFileInputSchema,
  createImageFromUrlInputSchema,
  getImageInputSchema,
} from '@/schemas/media/media.js';
import { defineTool } from '@/tools/defineTool.js';
import type { ToolEntry } from '@/tools/registry.js';

/** eBay Media API tools for image upload and retrieval. */
export const mediaEntries: ToolEntry[] = [
  defineTool({
    name: 'ebay_create_image_from_file',
    description:
      'Upload a local image file to eBay Picture Services and return its reusable EPS URL',
    inputSchema: createImageFromFileInputSchema.shape,
    handler: (api, args) => Effect.runPromise(api.media.createImageFromFile(args)),
  }),
  defineTool({
    name: 'ebay_create_image_from_url',
    description: 'Copy a public image URL into eBay Picture Services',
    inputSchema: createImageFromUrlInputSchema.shape,
    handler: (api, args) => Effect.runPromise(api.media.createImageFromUrl(args)),
  }),
  defineTool({
    name: 'ebay_get_image',
    description: 'Retrieve EPS URL and expiration metadata for an eBay Media API image',
    inputSchema: getImageInputSchema.shape,
    handler: (api, args) => Effect.runPromise(api.media.getImage(args)),
  }),
];
