import type { ApplyAiSuggestionsInput, BookmarkRecord } from '@perchlink/core';
import { invokeDesktop } from './desktopBridge';
import type { DesktopBookmarkRecordDto } from './metadataClient';
import { mapBookmarkDto } from './metadataClient';

export async function queueAiEnrichment(bookmarkId: string): Promise<BookmarkRecord> {
  const bookmark = await invokeDesktop<DesktopBookmarkRecordDto>('desktop_queue_ai_enrichment', { bookmarkId });
  return mapBookmarkDto(bookmark);
}

export async function retryAiEnrichment(bookmarkId: string): Promise<BookmarkRecord> {
  const bookmark = await invokeDesktop<DesktopBookmarkRecordDto>('desktop_retry_ai_enrichment', { bookmarkId });
  return mapBookmarkDto(bookmark);
}

export async function applyAiSuggestions(bookmarkId: string, input: ApplyAiSuggestionsInput): Promise<BookmarkRecord> {
  const bookmark = await invokeDesktop<DesktopBookmarkRecordDto>('desktop_apply_ai_suggestions', { bookmarkId, input });
  return mapBookmarkDto(bookmark);
}
