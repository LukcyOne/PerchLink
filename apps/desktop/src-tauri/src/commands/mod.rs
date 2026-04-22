pub mod ai;
pub mod bookmarks;
pub mod metadata;
pub mod search;
pub mod sync;

pub use ai::{desktop_apply_ai_suggestions, desktop_queue_ai_enrichment, desktop_retry_ai_enrichment};
pub use bookmarks::{
    desktop_create_bookmark, desktop_delete_bookmark, desktop_delete_category,
    desktop_delete_collection, desktop_get_bookmark, desktop_list_bookmarks, desktop_list_categories,
    desktop_list_collections, desktop_replace_bookmark_tags, desktop_save_category,
    desktop_save_collection, desktop_update_bookmark,
};
pub use metadata::{desktop_queue_metadata_extraction, desktop_retry_metadata_extraction};
pub use search::{desktop_filter_bookmarks, desktop_search_bookmarks};
pub use sync::{
    desktop_ack_sync_push_results, desktop_apply_remote_events, desktop_clear_sync_connection,
    desktop_get_sync_connection, desktop_get_sync_status, desktop_list_sync_conflicts,
    desktop_list_sync_outbox, desktop_list_sync_rounds, desktop_mark_sync_conflict_read,
    desktop_prepare_sync_resync, desktop_rebuild_sync_state, desktop_record_sync_round,
    desktop_save_sync_connection,
};
