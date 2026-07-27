import { Effect } from 'effect';
import {
  createFeedTaskInputSchema,
  getFeedTaskInputSchema,
  getFeedTasksInputSchema,
  uploadFeedFileInputSchema,
} from '@/schemas/feed/feed.js';
import { defineTool } from '@/tools/defineTool.js';
import type { ToolEntry } from '@/tools/registry.js';

/** Sell Feed API tools for upload tasks and result-file workflows. */
export const feedEntries: ToolEntry[] = [
  defineTool({
    name: 'ebay_create_feed_task',
    description:
      'Create an eBay Sell Feed API upload task for any supported feed type, including Seller Hub FX_LISTING drafts',
    inputSchema: createFeedTaskInputSchema.shape,
    handler: (api, args) => Effect.runPromise(api.feed.createTask(args)),
  }),
  defineTool({
    name: 'ebay_upload_feed_file',
    description:
      'Upload a base64-encoded CSV, XML, JSON, or archive file to an eBay Sell Feed API task',
    inputSchema: uploadFeedFileInputSchema.shape,
    handler: (api, args) => Effect.runPromise(api.feed.uploadFile(args)),
  }),
  defineTool({
    name: 'ebay_get_feed_task',
    description: 'Get status, metadata, and processing counts for an eBay Feed API task',
    inputSchema: getFeedTaskInputSchema.shape,
    handler: (api, args) => Effect.runPromise(api.feed.getTask(args)),
  }),
  defineTool({
    name: 'ebay_get_feed_tasks',
    description: 'Find eBay Feed API tasks by feed type or schedule ID',
    inputSchema: getFeedTasksInputSchema.shape,
    handler: (api, args) => Effect.runPromise(api.feed.getTasks(args)),
  }),
  defineTool({
    name: 'ebay_get_feed_input_file',
    description: 'Download an uploaded eBay feed input file as base64',
    inputSchema: getFeedTaskInputSchema.shape,
    handler: (api, args) => Effect.runPromise(api.feed.getInputFile(args)),
  }),
  defineTool({
    name: 'ebay_get_feed_result_file',
    description: 'Download a completed eBay feed result file as base64',
    inputSchema: getFeedTaskInputSchema.shape,
    handler: (api, args) => Effect.runPromise(api.feed.getResultFile(args)),
  }),
];
