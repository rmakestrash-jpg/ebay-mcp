import type { EbayApiClient } from '@/api/client.js';
import {
  buildEndpointParams,
  EbayApiError,
  EndpointInputError,
  optionalNonNegativeNumberEffect,
  optionalPositiveNumberEffect,
  optionalStringEffect,
  requestGetEffect,
  requestPostEffect,
  requireStringEffect,
} from '@/api/shared/request.js';
import type {
  createFeedTaskInputSchema,
  getFeedTaskInputSchema,
  getFeedTasksInputSchema,
  uploadFeedFileInputSchema,
} from '@/schemas/feed/feed.js';
import type { InferEffectSchema } from '@/utils/effectSchemaTypes.js';
import { Effect } from 'effect';

type CreateFeedTaskInput = InferEffectSchema<typeof createFeedTaskInputSchema>;
type UploadFeedFileInput = InferEffectSchema<typeof uploadFeedFileInputSchema>;
type GetFeedTaskInput = InferEffectSchema<typeof getFeedTaskInputSchema>;
type GetFeedTasksInput = InferEffectSchema<typeof getFeedTasksInputSchema>;

/** Summary counts supplied for completed upload tasks. */
export interface FeedUploadSummary {
  readonly failureCount?: number;
  readonly successCount?: number;
}

/** Status and metadata for one Feed API task. */
export interface FeedTask {
  readonly completionDate?: string;
  readonly creationDate?: string;
  readonly detailHref?: string;
  readonly feedType: string;
  readonly schemaVersion: string;
  readonly status: string;
  readonly taskId: string;
  readonly uploadSummary?: FeedUploadSummary;
}

/** Paginated Feed API task collection. */
export interface FeedTaskCollection {
  readonly href: string;
  readonly limit: number;
  readonly next?: string;
  readonly offset: number;
  readonly prev?: string;
  readonly tasks: FeedTask[];
  readonly total: number;
}

/** Result returned after eBay accepts a new feed task. */
export interface CreateFeedTaskResult {
  readonly location: string;
  readonly taskId: string;
}

/** Binary file returned by a Feed API download endpoint. */
export interface FeedFileDownload {
  readonly contentBase64: string;
  readonly contentDisposition?: string;
  readonly contentType?: string;
}

const FEED_BASE_PATH = '/sell/feed/v1';

/** eBay Sell Feed API task and file operations. */
export class FeedApi {
  public constructor(private readonly client: EbayApiClient) {}

  /**
   * Creates an upload feed task and returns its eBay-assigned task ID.
   *
   * @see https://developer.ebay.com/api-docs/sell/feed/resources/task/methods/createTask
   */
  public createTask = (
    input: CreateFeedTaskInput,
  ): Effect.Effect<CreateFeedTaskResult, EbayApiError | EndpointInputError> =>
    Effect.gen(this, function* () {
      const feedType = yield* requireStringEffect(input.feedType, 'feedType');
      const schemaVersion = yield* requireStringEffect(input.schemaVersion, 'schemaVersion');
      const path = `${FEED_BASE_PATH}/task`;

      const response = yield* Effect.tryPromise({
        try: () =>
          this.client.postResponse<void>(path, {
            feedType,
            schemaVersion,
          }),
        catch: (cause) => new EbayApiError({ method: 'POST', path, cause }),
      });
      const location = response.headers.location;
      const taskId = location?.split('/').filter(Boolean).at(-1);

      if (!(location && taskId)) {
        return yield* Effect.fail(
          new EbayApiError({
            method: 'POST',
            path,
            cause: new Error('eBay accepted the task but did not return a Location header'),
          }),
        );
      }

      return { location, taskId };
    });

  /**
   * Uploads a base64-encoded feed file to an existing task.
   *
   * @see https://developer.ebay.com/api-docs/sell/feed/resources/task/methods/uploadFile
   */
  public uploadFile = (
    input: UploadFeedFileInput,
  ): Effect.Effect<void, EbayApiError | EndpointInputError> =>
    Effect.gen(this, function* () {
      const taskId = yield* requireStringEffect(input.taskId, 'taskId');
      const fileName = yield* requireStringEffect(input.fileName, 'fileName');
      const fileContentBase64 = yield* requireStringEffect(
        input.fileContentBase64,
        'fileContentBase64',
      );
      const contentType = yield* requireStringEffect(input.contentType, 'contentType');
      const path = `${FEED_BASE_PATH}/task/${taskId}/upload_file`;
      const bytes = Uint8Array.from(Buffer.from(fileContentBase64, 'base64'));
      const form = new FormData();
      form.append('file', new Blob([bytes], { type: contentType }), fileName);

      return yield* requestPostEffect<void>(this.client, path, form);
    });

  /**
   * Retrieves one feed task.
   *
   * @see https://developer.ebay.com/api-docs/sell/feed/resources/task/methods/getTask
   */
  public getTask = (
    input: GetFeedTaskInput,
  ): Effect.Effect<FeedTask, EbayApiError | EndpointInputError> =>
    Effect.gen(this, function* () {
      const taskId = yield* requireStringEffect(input.taskId, 'taskId');
      return yield* requestGetEffect<FeedTask>(this.client, `${FEED_BASE_PATH}/task/${taskId}`);
    });

  /**
   * Retrieves feed tasks by feed type or schedule ID.
   *
   * @see https://developer.ebay.com/api-docs/sell/feed/resources/task/methods/getTasks
   */
  public getTasks = (
    input: GetFeedTasksInput,
  ): Effect.Effect<FeedTaskCollection, EbayApiError | EndpointInputError> =>
    Effect.gen(this, function* () {
      const feedType = yield* optionalStringEffect(input.feedType, 'feedType');
      const scheduleId = yield* optionalStringEffect(input.scheduleId, 'scheduleId');
      const lookBackDays = yield* optionalPositiveNumberEffect(input.lookBackDays, 'lookBackDays');
      const dateRange = yield* optionalStringEffect(input.dateRange, 'dateRange');
      const limit = yield* optionalPositiveNumberEffect(input.limit, 'limit');
      const offset = yield* optionalNonNegativeNumberEffect(input.offset, 'offset');

      if (!(feedType || scheduleId) || (feedType && scheduleId)) {
        return yield* Effect.fail(
          new EndpointInputError({
            parameter: 'feedType',
            message: 'Provide exactly one of feedType or scheduleId',
          }),
        );
      }
      if (lookBackDays !== undefined && dateRange !== undefined) {
        return yield* Effect.fail(
          new EndpointInputError({
            parameter: 'lookBackDays',
            message: 'lookBackDays and dateRange cannot be combined',
          }),
        );
      }

      const params = buildEndpointParams({
        feedType: { wireName: 'feed_type', value: feedType },
        scheduleId: { wireName: 'schedule_id', value: scheduleId },
        lookBackDays: { wireName: 'look_back_days', value: lookBackDays },
        dateRange: { wireName: 'date_range', value: dateRange },
        limit: { wireName: 'limit', value: limit },
        offset: { wireName: 'offset', value: offset },
      });

      return yield* requestGetEffect<FeedTaskCollection>(
        this.client,
        `${FEED_BASE_PATH}/task`,
        params,
      );
    });

  private downloadFile = (
    taskIdValue: unknown,
    endpoint: 'download_input_file' | 'download_result_file',
  ): Effect.Effect<FeedFileDownload, EbayApiError | EndpointInputError> =>
    Effect.gen(this, function* () {
      const taskId = yield* requireStringEffect(taskIdValue, 'taskId');
      const path = `${FEED_BASE_PATH}/task/${taskId}/${endpoint}`;
      const response = yield* Effect.tryPromise({
        try: () =>
          this.client.getResponse<Buffer>(path, undefined, {
            headers: { Accept: 'application/octet-stream' },
            responseType: 'arraybuffer',
          }),
        catch: (cause) => new EbayApiError({ method: 'GET', path, cause }),
      });

      return {
        contentBase64: response.data.toString('base64'),
        contentDisposition: response.headers['content-disposition'],
        contentType: response.headers['content-type'],
      };
    });

  /**
   * Downloads the original file uploaded for a feed task.
   *
   * @see https://developer.ebay.com/api-docs/sell/feed/resources/task/methods/getInputFile
   */
  public getInputFile = (
    input: GetFeedTaskInput,
  ): Effect.Effect<FeedFileDownload, EbayApiError | EndpointInputError> =>
    this.downloadFile(input.taskId, 'download_input_file');

  /**
   * Downloads the result file for a completed feed task.
   *
   * @see https://developer.ebay.com/api-docs/sell/feed/resources/task/methods/getResultFile
   */
  public getResultFile = (
    input: GetFeedTaskInput,
  ): Effect.Effect<FeedFileDownload, EbayApiError | EndpointInputError> =>
    this.downloadFile(input.taskId, 'download_result_file');
}
