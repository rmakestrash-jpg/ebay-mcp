import { z } from '@/utils/effectSchema.js';

/** Input accepted by Feed API createTask. */
export const createFeedTaskInputSchema = z.object({
  feedType: z
    .string()
    .min(1)
    .describe('eBay feed type, such as FX_LISTING, FX_FULFILLMENT, or LMS_ORDER_ACK'),
  schemaVersion: z
    .string()
    .min(1)
    .default('1.0')
    .describe('Feed file schema version; Seller Hub feed types currently use 1.0'),
});

/** Input accepted by Feed API uploadFile. */
export const uploadFeedFileInputSchema = z.object({
  taskId: z.string().min(1).describe('Task ID returned by ebay_create_feed_task'),
  fileName: z
    .string()
    .min(1)
    .describe('File name including extension, for example seller-hub-listings.csv'),
  fileContentBase64: z
    .string()
    .min(1)
    .describe('Complete feed file encoded as base64; supports CSV, XML, JSON, and archives'),
  contentType: z
    .string()
    .min(1)
    .default('text/csv')
    .describe('MIME type for the uploaded file, for example text/csv or application/zip'),
});

/** Input accepted by Feed API getTask and file download methods. */
export const getFeedTaskInputSchema = z.object({
  taskId: z.string().min(1).describe('eBay Feed API task ID'),
});

/** Input accepted by Feed API getTasks. */
export const getFeedTasksInputSchema = z.object({
  feedType: z.string().min(1).optional().describe('Feed type whose tasks should be returned'),
  scheduleId: z.string().min(1).optional().describe('Schedule ID whose tasks should be returned'),
  lookBackDays: z
    .number()
    .int()
    .min(1)
    .max(90)
    .optional()
    .describe('Number of previous days to search, from 1 through 90'),
  dateRange: z
    .string()
    .min(1)
    .optional()
    .describe('UTC creation range: start..end; cannot be combined with lookBackDays'),
  limit: z.number().int().min(1).max(500).optional().describe('Maximum tasks per page'),
  offset: z.number().int().min(0).optional().describe('Zero-based result offset'),
});
