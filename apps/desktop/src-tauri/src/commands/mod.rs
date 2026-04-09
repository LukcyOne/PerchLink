pub mod ai;
pub mod bookmarks;
pub mod metadata;
pub mod search;

pub use ai::{desktop_apply_ai_suggestions, desktop_queue_ai_enrichment, desktop_retry_ai_enrichment};
pub use bookmarks::{
    desktop_create_bookmark, desktop_delete_bookmark, desktop_delete_category,
    desktop_delete_collection, desktop_get_bookmark, desktop_list_bookmarks, desktop_list_categories,
    desktop_list_collections, desktop_replace_bookmark_tags, desktop_save_category,
    desktop_save_collection, desktop_update_bookmark,
};
pub use metadata::{desktop_queue_metadata_extraction, desktop_retry_metadata_extraction};
pub use search::{desktop_filter_bookmarks, desktop_search_bookmarks};
