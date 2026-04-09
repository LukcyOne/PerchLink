import type { BookmarkRecord } from '@perchlink/core';
import { invokeDesktop } from './desktopBridge';

interface DesktopBookmarkAiSuggestionDto {
  run_id: string;
  status: NonNullable<BookmarkRecord['aiSuggestion']>['status'];
  proposed_primary_category_id: string | null;
  proposed_description: string | null;
  proposed_tags: string[];
  last_error: string | null;
  generated_at: string | null;
  updated_at: string;
}

export interface DesktopBookmarkRecordDto {
  id: string;
  url: string;
  normalized_url: string;
  title: string;
  description: string | null;
  description_excerpt: string | null;
  favicon: string | null;
  cover_url: string | null;
  primary_category_id: string | null;
  tags: Array<{
    id: string;
    label: string;
    color: string | null;
    created_at: string;
    updated_at: string;
  }>;
  collection_ids: string[];
  is_starred: boolean;
  processing_status: BookmarkRecord['processingStatus'];
  processing_error: string | null;
  user_edited_mask: BookmarkRecord['userEditedMask'];
  ai_suggestion: DesktopBookmarkAiSuggestionDto | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function mapTag(tag: DesktopBookmarkRecordDto['tags'][number]) {
  return {
    id: tag.id,
    label: tag.label,
    color: tag.color,
    createdAt: tag.created_at,
    updatedAt: tag.updated_at,
  };
}

export function mapBookmarkDto(bookmark: DesktopBookmarkRecordDto): BookmarkRecord {
  return {
    id: bookmark.id,
    url: bookmark.url,
    normalizedUrl: bookmark.normalized_url,
    title: bookmark.title,
    description: bookmark.description,
    descriptionExcerpt: bookmark.description_excerpt ?? bookmark.description,
    favicon: bookmark.favicon,
    coverUrl: bookmark.cover_url,
    primaryCategoryId: bookmark.primary_category_id,
    tags: bookmark.tags.map(mapTag),
    collectionIds: bookmark.collection_ids,
    isStarred: bookmark.is_starred,
    processingStatus: bookmark.processing_status,
    processingError: bookmark.processing_error,
    userEditedMask: bookmark.user_edited_mask,
    aiSuggestion: bookmark.ai_suggestion
      ? {
          status: bookmark.ai_suggestion.status,
          runId: bookmark.ai_suggestion.run_id,
          proposedPrimaryCategoryId: bookmark.ai_suggestion.proposed_primary_category_id,
          proposedDescription: bookmark.ai_suggestion.proposed_description,
          proposedTags: bookmark.ai_suggestion.proposed_tags,
          lastError: bookmark.ai_suggestion.last_error,
          generatedAt: bookmark.ai_suggestion.generated_at,
          updatedAt: bookmark.ai_suggestion.updated_at,
        }
      : null,
    createdAt: bookmark.created_at,
    updatedAt: bookmark.updated_at,
    deletedAt: bookmark.deleted_at,
  };
}

export async function queueMetadataExtraction(bookmarkId: string): Promise<BookmarkRecord> {
  const bookmark = await invokeDesktop<DesktopBookmarkRecordDto>('desktop_queue_metadata_extraction', { bookmarkId });
  return mapBookmarkDto(bookmark);
}

export async function retryMetadataExtraction(bookmarkId: string): Promise<BookmarkRecord> {
  const bookmark = await invokeDesktop<DesktopBookmarkRecordDto>('desktop_retry_metadata_extraction', { bookmarkId });
  return mapBookmarkDto(bookmark);
}
