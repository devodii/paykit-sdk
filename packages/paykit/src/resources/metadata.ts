import { z } from 'zod';

export const PAYKIT_METADATA_KEY = '__paykit';

export const metadataSchema = z.record(z.string(), z.string());

export type PaykitMetadata = z.infer<typeof metadataSchema>;
