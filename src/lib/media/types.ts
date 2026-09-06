import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.ts';
export type MediaClient = SupabaseClient<Database>;
export type MediaAsset = Database['public']['Tables']['media_assets']['Row'];
export type MediaReference = Database['public']['Tables']['media_references']['Row'];
export type MediaBucket = 'portfolio-public' | 'blog' | 'documents' | 'private';
export type MediaCategory = 'project' | 'blog' | 'profile' | 'document' | 'general';
export interface EditorialMetadata {
  altText: string;
  decorative: boolean;
  caption: string;
  category: MediaCategory;
}
export interface ValidatedFile {
  bytes: Uint8Array;
  filename: string;
  mime: string;
  extension: string;
  size: number;
  width: number | null;
  height: number | null;
}
export type FileValidator = (file: File, metadata: EditorialMetadata) => Promise<ValidatedFile>;
export type UploadState = 'waiting' | 'uploading' | 'processing' | 'complete' | 'failed';
export interface UploadProgress {
  state: UploadState;
  percent: number | null;
}
export interface CleanupIssue {
  bucket: MediaBucket;
  path: string;
  reason: string;
}
export interface UploadResult {
  asset: MediaAsset;
  cleanup: readonly CleanupIssue[];
}
