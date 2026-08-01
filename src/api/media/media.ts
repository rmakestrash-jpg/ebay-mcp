import type { EbayApiClient } from '@/api/client.js';
import {
  EbayApiError,
  type EndpointInputError,
  requireStringEffect,
} from '@/api/shared/request.js';
import type {
  createImageFromFileInputSchema,
  createImageFromUrlInputSchema,
  getImageInputSchema,
} from '@/schemas/media/media.js';
import type { InferEffectSchema } from '@/utils/effectSchemaTypes.js';
import { Effect } from 'effect';
import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';

type CreateImageFromFileInput = InferEffectSchema<typeof createImageFromFileInputSchema>;
type CreateImageFromUrlInput = InferEffectSchema<typeof createImageFromUrlInputSchema>;
type GetImageInput = InferEffectSchema<typeof getImageInputSchema>;

/** Image metadata returned by eBay Media API. */
export interface EbayMediaImage {
  readonly imageId?: string;
  readonly imageUrl?: string;
  readonly maxDimensionImageUrl?: string;
  readonly expirationDate?: string;
}

const contentTypeForPath = (filePath: string): string => {
  const extension = extname(filePath).toLowerCase();
  const types: Readonly<Record<string, string>> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.tif': 'image/tiff',
    '.tiff': 'image/tiff',
    '.avif': 'image/avif',
    '.heic': 'image/heic',
    '.webp': 'image/webp',
  };
  return types[extension] ?? 'application/octet-stream';
};

/** eBay Media API image operations. */
export class MediaApi {
  public constructor(private readonly client: EbayApiClient) {}

  private baseUrl(): string {
    return this.client.getConfig().environment === 'production'
      ? 'https://apim.ebay.com/commerce/media/v1_beta'
      : 'https://apim.sandbox.ebay.com/commerce/media/v1_beta';
  }

  private imageIdFromLocation(location?: string): string | undefined {
    return location?.split('/').filter(Boolean).at(-1);
  }

  /**
   * Uploads a local image file to eBay Picture Services.
   *
   * @see https://developer.ebay.com/api-docs/commerce/media/resources/image/methods/createImageFromFile
   */
  public createImageFromFile = (
    input: CreateImageFromFileInput,
  ): Effect.Effect<EbayMediaImage, EbayApiError | EndpointInputError> =>
    Effect.gen(this, function* () {
      const filePath = yield* requireStringEffect(input.filePath, 'filePath');
      const path = `${this.baseUrl()}/image/create_image_from_file`;
      const bytes = yield* Effect.tryPromise({
        try: () => readFile(filePath),
        catch: (cause) => new EbayApiError({ method: 'GET', path: filePath, cause }),
      });
      const form = new FormData();
      form.append(
        'image',
        new Blob([bytes], { type: contentTypeForPath(filePath) }),
        basename(filePath),
      );
      const response = yield* Effect.tryPromise({
        try: () => this.client.postWithFullUrlResponse<EbayMediaImage>(path, form),
        catch: (cause) => new EbayApiError({ method: 'POST', path, cause }),
      });
      return {
        ...response.data,
        imageId: response.data?.imageId ?? this.imageIdFromLocation(response.headers.location),
      };
    });

  /**
   * Copies a public image URL into eBay Picture Services.
   *
   * @see https://developer.ebay.com/api-docs/commerce/media/resources/image/methods/createImageFromUrl
   */
  public createImageFromUrl = (
    input: CreateImageFromUrlInput,
  ): Effect.Effect<EbayMediaImage, EbayApiError | EndpointInputError> =>
    Effect.gen(this, function* () {
      const imageUrl = yield* requireStringEffect(input.imageUrl, 'imageUrl');
      const path = `${this.baseUrl()}/image/create_image_from_url`;
      const response = yield* Effect.tryPromise({
        try: () => this.client.postWithFullUrlResponse<EbayMediaImage>(path, { imageUrl }),
        catch: (cause) => new EbayApiError({ method: 'POST', path, cause }),
      });
      return {
        ...response.data,
        imageId: response.data?.imageId ?? this.imageIdFromLocation(response.headers.location),
      };
    });

  /**
   * Retrieves an uploaded EPS image.
   *
   * @see https://developer.ebay.com/api-docs/commerce/media/resources/image/methods/getImage
   */
  public getImage = (
    input: GetImageInput,
  ): Effect.Effect<EbayMediaImage, EbayApiError | EndpointInputError> =>
    Effect.gen(this, function* () {
      const imageId = yield* requireStringEffect(input.imageId, 'imageId');
      const path = `${this.baseUrl()}/image/${encodeURIComponent(imageId)}`;
      const response = yield* Effect.tryPromise({
        try: () => this.client.getWithFullUrlResponse<EbayMediaImage>(path),
        catch: (cause) => new EbayApiError({ method: 'GET', path, cause }),
      });
      return { ...response.data, imageId };
    });
}
