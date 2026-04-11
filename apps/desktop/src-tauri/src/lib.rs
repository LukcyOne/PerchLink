mod ai;
mod commands;
mod db;
mod metadata;
mod sync;

use commands::{
    desktop_apply_ai_suggestions, desktop_queue_ai_enrichment, desktop_retry_ai_enrichment,
    desktop_ack_sync_push_results, desktop_apply_remote_events, desktop_clear_sync_connection,
    desktop_create_bookmark, desktop_delete_bookmark, desktop_delete_category,
    desktop_delete_collection, desktop_filter_bookmarks, desktop_get_bookmark,
    desktop_get_sync_connection, desktop_get_sync_status,
    desktop_list_bookmarks, desktop_list_categories, desktop_list_collections,
    desktop_list_sync_outbox, desktop_queue_metadata_extraction, desktop_replace_bookmark_tags,
    desktop_retry_metadata_extraction, desktop_save_category, desktop_save_collection,
    desktop_save_sync_connection, desktop_search_bookmarks, desktop_update_bookmark,
};
use db::init_database;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let database_state = init_database(app.handle())?;
            app.manage(database_state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            desktop_create_bookmark,
            desktop_get_bookmark,
            desktop_list_bookmarks,
            desktop_search_bookmarks,
            desktop_filter_bookmarks,
            desktop_queue_metadata_extraction,
            desktop_retry_metadata_extraction,
            desktop_queue_ai_enrichment,
            desktop_retry_ai_enrichment,
            desktop_apply_ai_suggestions,
            desktop_update_bookmark,
            desktop_delete_bookmark,
            desktop_list_categories,
            desktop_save_category,
            desktop_delete_category,
            desktop_list_collections,
            desktop_save_collection,
            desktop_delete_collection,
            desktop_replace_bookmark_tags,
            desktop_get_sync_connection,
            desktop_get_sync_status,
            desktop_save_sync_connection,
            desktop_clear_sync_connection,
            desktop_list_sync_outbox,
            desktop_ack_sync_push_results,
            desktop_apply_remote_events,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
