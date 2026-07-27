import type { EbayApiClient } from '@/api/client.js';
import { FeedApi } from '@/api/feed/feed.js';
import { Effect } from 'effect';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('FeedApi', () => {
  let feedApi: FeedApi;
  let mockClient: EbayApiClient;

  beforeEach(() => {
    mockClient = {
      get: vi.fn(),
      getResponse: vi.fn(),
      post: vi.fn(),
      postResponse: vi.fn(),
    } as unknown as EbayApiClient;
    feedApi = new FeedApi(mockClient);
  });

  it('creates an upload task and extracts its ID from the Location header', async () => {
    vi.mocked(mockClient.postResponse).mockResolvedValue({
      data: undefined,
      status: 202,
      statusText: 'Accepted',
      headers: {
        location: 'https://api.ebay.com/sell/feed/v1/task/task-123',
      },
    });

    const result = await Effect.runPromise(
      feedApi.createTask({ feedType: 'FX_LISTING', schemaVersion: '1.0' }),
    );

    expect(mockClient.postResponse).toHaveBeenCalledWith('/sell/feed/v1/task', {
      feedType: 'FX_LISTING',
      schemaVersion: '1.0',
    });
    expect(result).toEqual({
      location: 'https://api.ebay.com/sell/feed/v1/task/task-123',
      taskId: 'task-123',
    });
  });

  it('fails clearly when eBay omits the task Location header', async () => {
    vi.mocked(mockClient.postResponse).mockResolvedValue({
      data: undefined,
      status: 202,
      statusText: 'Accepted',
      headers: {},
    });

    const error = await Effect.runPromise(
      Effect.flip(feedApi.createTask({ feedType: 'FX_LISTING', schemaVersion: '1.0' })),
    );

    expect(error._tag).toBe('EbayApiError');
    expect(error.message).toContain('Location header');
  });

  it('uploads a decoded file as multipart form data', async () => {
    vi.mocked(mockClient.post).mockResolvedValue(undefined);

    await Effect.runPromise(
      feedApi.uploadFile({
        taskId: 'task-123',
        fileName: 'drafts.csv',
        fileContentBase64: Buffer.from('Action(SiteID=US),CustomLabel\nDraft,SKU-1').toString(
          'base64',
        ),
        contentType: 'text/csv',
      }),
    );

    expect(mockClient.post).toHaveBeenCalledTimes(1);
    const [path, form] = vi.mocked(mockClient.post).mock.calls[0];
    expect(path).toBe('/sell/feed/v1/task/task-123/upload_file');
    expect(form).toBeInstanceOf(FormData);
    const file = (form as FormData).get('file');
    expect(file).toBeInstanceOf(Blob);
    expect((file as File).name).toBe('drafts.csv');
    expect(await (file as Blob).text()).toContain('Draft,SKU-1');
  });

  it('gets tasks with eBay wire-format query names', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({
      href: '/sell/feed/v1/task',
      limit: 20,
      offset: 0,
      tasks: [],
      total: 0,
    });

    await Effect.runPromise(
      feedApi.getTasks({
        feedType: 'FX_LISTING',
        lookBackDays: 7,
        limit: 20,
        offset: 0,
      }),
    );

    expect(mockClient.get).toHaveBeenCalledWith('/sell/feed/v1/task', {
      feed_type: 'FX_LISTING',
      look_back_days: 7,
      limit: 20,
      offset: 0,
    });
  });

  it('requires exactly one feed task selector', async () => {
    const missing = await Effect.runPromise(Effect.flip(feedApi.getTasks({})));
    expect(missing._tag).toBe('EndpointInputError');

    const conflicting = await Effect.runPromise(
      Effect.flip(feedApi.getTasks({ feedType: 'FX_LISTING', scheduleId: 'schedule-1' })),
    );
    expect(conflicting._tag).toBe('EndpointInputError');
  });

  it('downloads result files with metadata and base64 content', async () => {
    vi.mocked(mockClient.getResponse).mockResolvedValue({
      data: Buffer.from('result-file'),
      status: 200,
      statusText: 'OK',
      headers: {
        'content-disposition': 'attachment; filename="result.csv"',
        'content-type': 'text/csv',
      },
    });

    const result = await Effect.runPromise(feedApi.getResultFile({ taskId: 'task-123' }));

    expect(mockClient.getResponse).toHaveBeenCalledWith(
      '/sell/feed/v1/task/task-123/download_result_file',
      undefined,
      {
        headers: { Accept: 'application/octet-stream' },
        responseType: 'arraybuffer',
      },
    );
    expect(result).toEqual({
      contentBase64: Buffer.from('result-file').toString('base64'),
      contentDisposition: 'attachment; filename="result.csv"',
      contentType: 'text/csv',
    });
  });
});
