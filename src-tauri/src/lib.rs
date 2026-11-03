use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::{Manager, State};

const KEYRING_SERVICE: &str = "com.skyblock.companion";
const KEYRING_USER: &str = "hypixel-api-key";
const HISTORY_RETENTION_MS: i64 = 14 * 24 * 60 * 60 * 1000;

struct AppState {
    db_path: PathBuf,
    data_dir: PathBuf,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CacheRow {
    payload: String,
    updated_at: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CacheStats {
    entries: i64,
    bytes: i64,
    history_points: i64,
    oldest: Option<i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SecretStatus {
    configured: bool,
    storage: String,
    hint: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WatchlistEntry {
    product_id: String,
    added_at: i64,
    target_price: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HistoryPoint {
    product_id: String,
    ts: i64,
    buy_price: f64,
    sell_price: f64,
    buy_volume: f64,
    sell_volume: f64,
}

fn db_error(error: rusqlite::Error) -> String {
    format!("Local database error: {error}")
}

fn open_db(state: &AppState) -> Result<Connection, String> {
    let connection = Connection::open(&state.db_path).map_err(db_error)?;
    connection
        .busy_timeout(Duration::from_secs(5))
        .map_err(db_error)?;
    let _ = connection.pragma_update(None, "journal_mode", "WAL");
    let _ = connection.pragma_update(None, "synchronous", "NORMAL");
    Ok(connection)
}

fn init_db(path: &Path) -> rusqlite::Result<()> {
    let connection = Connection::open(path)?;
    let _ = connection.pragma_update(None, "journal_mode", "WAL");
    let version: i64 = connection.pragma_query_value(None, "user_version", |row| row.get(0))?;
    if version > 1 {
        return Err(rusqlite::Error::InvalidQuery);
    }
    let existing: i64 = connection.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='settings'",
        [],
        |row| row.get(0),
    )?;
    if version == 0 && existing > 0 {
        let backups = path.parent().unwrap_or(Path::new(".")).join("backups");
        std::fs::create_dir_all(&backups)
            .map_err(|_| rusqlite::Error::InvalidPath(backups.clone()))?;
        let destination = backups.join(format!("pre-rc-schema-v0-{}.sqlite3", now_ms()));
        connection.execute(
            "VACUUM INTO ?1",
            params![destination.to_string_lossy().as_ref()],
        )?;
    }
    connection.execute_batch(
        "
        BEGIN IMMEDIATE;
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS cache (
            key TEXT PRIMARY KEY,
            payload TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS watchlist (
            product_id TEXT PRIMARY KEY,
            added_at INTEGER NOT NULL,
            target_price REAL
        );
        CREATE TABLE IF NOT EXISTS market_history (
            product_id TEXT NOT NULL,
            ts INTEGER NOT NULL,
            buy_price REAL NOT NULL,
            sell_price REAL NOT NULL,
            buy_volume REAL NOT NULL,
            sell_volume REAL NOT NULL,
            PRIMARY KEY (product_id, ts)
        );
        CREATE INDEX IF NOT EXISTS idx_market_history_product_ts
            ON market_history (product_id, ts);
        PRAGMA user_version=1;
        COMMIT;
        ",
    )?;
    Ok(())
}

fn read_cache_stats(connection: &Connection) -> Result<CacheStats, String> {
    let (entries, bytes) = connection
        .query_row(
            "SELECT COUNT(*), COALESCE(SUM(LENGTH(payload)), 0) FROM cache",
            [],
            |row| Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?)),
        )
        .map_err(db_error)?;
    let oldest = connection
        .query_row("SELECT MIN(updated_at) FROM cache", [], |row| {
            row.get::<_, Option<i64>>(0)
        })
        .map_err(db_error)?;
    let history_points = connection
        .query_row("SELECT COUNT(*) FROM market_history", [], |row| {
            row.get::<_, i64>(0)
        })
        .map_err(db_error)?;

    Ok(CacheStats {
        entries,
        bytes,
        history_points,
        oldest,
    })
}

fn keyring_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER)
        .map_err(|error| format!("Operating system credential store is unavailable: {error}"))
}

fn read_secret() -> Result<Option<String>, String> {
    let entry = keyring_entry()?;
    match entry.get_password() {
        Ok(secret) => Ok(Some(secret)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(format!(
            "Unable to read the API key from the credential store: {error}"
        )),
    }
}

#[tauri::command]
fn settings_get(state: State<'_, AppState>, key: String) -> Result<Option<String>, String> {
    let connection = open_db(&state)?;
    connection
        .query_row(
            "SELECT value FROM settings WHERE key = ?1",
            params![key],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(db_error)
}

#[tauri::command]
fn settings_set(state: State<'_, AppState>, key: String, value: String) -> Result<(), String> {
    let connection = open_db(&state)?;
    connection
        .execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )
        .map_err(db_error)?;
    Ok(())
}

#[tauri::command]
fn settings_delete(state: State<'_, AppState>, key: String) -> Result<(), String> {
    let connection = open_db(&state)?;
    connection
        .execute("DELETE FROM settings WHERE key = ?1", params![key])
        .map_err(db_error)?;
    Ok(())
}

#[tauri::command]
fn cache_get(state: State<'_, AppState>, key: String) -> Result<Option<CacheRow>, String> {
    let connection = open_db(&state)?;
    connection
        .query_row(
            "SELECT payload, updated_at FROM cache WHERE key = ?1",
            params![key],
            |row| {
                Ok(CacheRow {
                    payload: row.get(0)?,
                    updated_at: row.get(1)?,
                })
            },
        )
        .optional()
        .map_err(db_error)
}

#[tauri::command]
fn cache_set(
    state: State<'_, AppState>,
    key: String,
    payload: String,
    updated_at: i64,
) -> Result<(), String> {
    let connection = open_db(&state)?;
    connection
        .execute(
            "INSERT INTO cache (key, payload, updated_at) VALUES (?1, ?2, ?3)
             ON CONFLICT(key) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at",
            params![key, payload, updated_at],
        )
        .map_err(db_error)?;
    Ok(())
}

#[tauri::command]
fn cache_delete(state: State<'_, AppState>, key: String) -> Result<(), String> {
    let connection = open_db(&state)?;
    connection
        .execute("DELETE FROM cache WHERE key = ?1", params![key])
        .map_err(db_error)?;
    Ok(())
}

#[tauri::command]
fn cache_stats(state: State<'_, AppState>) -> Result<CacheStats, String> {
    let connection = open_db(&state)?;
    read_cache_stats(&connection)
}

#[tauri::command]
fn cache_clear(state: State<'_, AppState>) -> Result<CacheStats, String> {
    let connection = open_db(&state)?;
    connection
        .execute("DELETE FROM cache", [])
        .map_err(db_error)?;
    read_cache_stats(&connection)
}

#[tauri::command]
fn secret_set(state: State<'_, AppState>, key: String) -> Result<(), String> {
    let _ = state;
    let entry = keyring_entry()?;
    entry
        .set_password(key.trim())
        .map_err(|error| format!("Unable to store the API key: {error}"))
}

#[tauri::command]
fn secret_get(state: State<'_, AppState>) -> Result<Option<String>, String> {
    let _ = state;
    read_secret()
}

#[tauri::command]
fn secret_delete(state: State<'_, AppState>) -> Result<(), String> {
    let _ = state;
    let entry = keyring_entry()?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(format!("Unable to delete the API key: {error}")),
    }
}

#[tauri::command]
fn secret_status(state: State<'_, AppState>) -> Result<SecretStatus, String> {
    let _ = state;
    match read_secret() {
        Ok(Some(key)) => {
            let hint = if key.len() >= 4 {
                format!("••••{}", &key[key.len() - 4..])
            } else {
                "••••".to_string()
            };
            Ok(SecretStatus {
                configured: true,
                storage: "os-keychain".to_string(),
                hint: Some(hint),
            })
        }
        Ok(None) => Ok(SecretStatus {
            configured: false,
            storage: "none".to_string(),
            hint: None,
        }),
        Err(_) => Ok(SecretStatus {
            configured: false,
            storage: "none".to_string(),
            hint: None,
        }),
    }
}

#[tauri::command]
fn watchlist_list(state: State<'_, AppState>) -> Result<Vec<WatchlistEntry>, String> {
    let connection = open_db(&state)?;
    let mut statement = connection
        .prepare("SELECT product_id, added_at, target_price FROM watchlist ORDER BY added_at DESC")
        .map_err(db_error)?;
    let rows = statement
        .query_map([], |row| {
            Ok(WatchlistEntry {
                product_id: row.get(0)?,
                added_at: row.get(1)?,
                target_price: row.get(2)?,
            })
        })
        .map_err(db_error)?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(db_error)
}

#[tauri::command]
fn watchlist_add(
    state: State<'_, AppState>,
    product_id: String,
    added_at: i64,
    target_price: Option<f64>,
) -> Result<(), String> {
    let connection = open_db(&state)?;
    connection
        .execute(
            "INSERT INTO watchlist (product_id, added_at, target_price) VALUES (?1, ?2, ?3)
             ON CONFLICT(product_id) DO UPDATE SET added_at = excluded.added_at, target_price = excluded.target_price",
            params![product_id, added_at, target_price],
        )
        .map_err(db_error)?;
    Ok(())
}

#[tauri::command]
fn watchlist_remove(state: State<'_, AppState>, product_id: String) -> Result<(), String> {
    let connection = open_db(&state)?;
    connection
        .execute(
            "DELETE FROM watchlist WHERE product_id = ?1",
            params![product_id],
        )
        .map_err(db_error)?;
    Ok(())
}

#[tauri::command]
fn watchlist_set_target(
    state: State<'_, AppState>,
    product_id: String,
    target_price: Option<f64>,
) -> Result<(), String> {
    let connection = open_db(&state)?;
    connection
        .execute(
            "UPDATE watchlist SET target_price = ?2 WHERE product_id = ?1",
            params![product_id, target_price],
        )
        .map_err(db_error)?;
    Ok(())
}

#[tauri::command]
fn history_record(state: State<'_, AppState>, points: Vec<HistoryPoint>) -> Result<(), String> {
    if points.is_empty() {
        return Ok(());
    }

    let mut connection = open_db(&state)?;
    let transaction = connection.transaction().map_err(db_error)?;
    {
        let mut statement = transaction
            .prepare(
                "INSERT OR REPLACE INTO market_history
                 (product_id, ts, buy_price, sell_price, buy_volume, sell_volume)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            )
            .map_err(db_error)?;
        for point in points {
            if !point.buy_price.is_finite() || !point.sell_price.is_finite() {
                continue;
            }
            statement
                .execute(params![
                    point.product_id,
                    point.ts,
                    point.buy_price,
                    point.sell_price,
                    point.buy_volume,
                    point.sell_volume
                ])
                .map_err(db_error)?;
        }
    }

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;
    transaction
        .execute(
            "DELETE FROM market_history WHERE ts < ?1",
            params![now - HISTORY_RETENTION_MS],
        )
        .map_err(db_error)?;
    transaction.commit().map_err(db_error)?;
    Ok(())
}

#[tauri::command]
fn history_get(
    state: State<'_, AppState>,
    product_id: String,
    limit: i64,
) -> Result<Vec<HistoryPoint>, String> {
    let connection = open_db(&state)?;
    let limit = limit.clamp(1, 2_000);
    let mut statement = connection
        .prepare(
            "SELECT product_id, ts, buy_price, sell_price, buy_volume, sell_volume
             FROM (
                 SELECT product_id, ts, buy_price, sell_price, buy_volume, sell_volume
                 FROM market_history
                 WHERE product_id = ?1
                 ORDER BY ts DESC
                 LIMIT ?2
             )
             ORDER BY ts ASC",
        )
        .map_err(db_error)?;
    let rows = statement
        .query_map(params![product_id, limit], |row| {
            Ok(HistoryPoint {
                product_id: row.get(0)?,
                ts: row.get(1)?,
                buy_price: row.get(2)?,
                sell_price: row.get(3)?,
                buy_volume: row.get(4)?,
                sell_volume: row.get(5)?,
            })
        })
        .map_err(db_error)?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(db_error)
}

#[tauri::command]
fn history_count(state: State<'_, AppState>) -> Result<i64, String> {
    let connection = open_db(&state)?;
    connection
        .query_row("SELECT COUNT(*) FROM market_history", [], |row| {
            row.get::<_, i64>(0)
        })
        .map_err(db_error)
}

#[tauri::command]
fn history_clear(state: State<'_, AppState>) -> Result<(), String> {
    let connection = open_db(&state)?;
    connection
        .execute("DELETE FROM market_history", [])
        .map_err(db_error)?;
    Ok(())
}

#[tauri::command]
fn data_dir(state: State<'_, AppState>) -> Result<String, String> {
    Ok(state.data_dir.to_string_lossy().to_string())
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .min(i64::MAX as u128) as i64
}

fn diagnostic_projection(raw: &serde_json::Value) -> serde_json::Value {
    fn choice(raw: &serde_json::Value, key: &str, allowed: &[&str]) -> String {
        let value = raw.get(key).and_then(|v| v.as_str()).unwrap_or("unknown");
        if allowed.contains(&value) {
            value.to_string()
        } else {
            "unknown".to_string()
        }
    }
    fn positive(raw: &serde_json::Value, key: &str) -> Option<u64> {
        raw.get(key)
            .and_then(|v| v.as_u64())
            .filter(|n| *n <= 10_000_000_000_000_000)
    }
    fn version(value: &str) -> bool {
        let base = value.split("-rc.").next().unwrap_or("");
        let parts: Vec<_> = base.split('.').collect();
        parts.len() == 3
            && parts
                .iter()
                .all(|s| !s.is_empty() && s.len() <= 4 && s.chars().all(|c| c.is_ascii_digit()))
            && (base == value
                || value.strip_prefix(&format!("{base}-rc.")).is_some_and(|s| {
                    !s.is_empty() && s.len() <= 4 && s.chars().all(|c| c.is_ascii_digit())
                }))
    }
    let backend = raw
        .get("backend_version")
        .and_then(|v| v.as_str())
        .filter(|s| version(s));
    serde_json::json!({
        "schema_version": 1, "app_version": env!("CARGO_PKG_VERSION"),
        "build_type": if cfg!(debug_assertions) { "development" } else { "release" },
        "os": std::env::consts::OS, "generated_at": now_ms(),
        "provider": choice(raw,"provider", &["backend","direct","demo"]),
        "connection": choice(raw,"connection", &["checking","connected","degraded","offline","misconfigured","direct","demo"]),
        "backend_version": backend, "latest_success_ms": positive(raw,"latest_success_ms"),
        "cache_age_ms": positive(raw,"cache_age_ms"),
        "database": choice(raw,"database", &["ok","unavailable","not_applicable"]),
        "notification_permission": choice(raw,"notification_permission", &["granted","denied","default","unsupported"]),
        "last_error": choice(raw,"last_error", &["configuration","network","timeout","aborted","auth","missing-key","rate-limit","not-found","validation","server","unavailable","none"])
    })
}

#[tauri::command]
fn diagnostics_status(state: State<'_, AppState>) -> serde_json::Value {
    let healthy = open_db(&state)
        .and_then(|db| {
            db.query_row("PRAGMA quick_check", [], |row| row.get::<_, String>(0))
                .map_err(db_error)
        })
        .map(|s| s == "ok")
        .unwrap_or(false);
    serde_json::json!({"database": if healthy {"ok"} else {"unavailable"}, "os": std::env::consts::OS,
        "build_type": if cfg!(debug_assertions) {"development"} else {"release"}, "app_version": env!("CARGO_PKG_VERSION")})
}

#[tauri::command]
fn diagnostics_export(
    report: serde_json::Value,
    state: State<'_, AppState>,
) -> Result<String, String> {
    use std::io::Write;
    static SEQUENCE: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
    let dir = state.data_dir.join("diagnostics");
    std::fs::create_dir_all(&dir).map_err(|_| "diagnostic_export_failed")?;
    let name = format!(
        "skyblock-diagnostics-{}-{}.json",
        now_ms(),
        SEQUENCE.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
    );
    let temporary = dir.join(format!("{name}.tmp"));
    let data = serde_json::to_vec_pretty(&diagnostic_projection(&report))
        .map_err(|_| "diagnostic_export_failed")?;
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temporary)
        .map_err(|_| "diagnostic_export_failed")?;
    file.write_all(&data)
        .and_then(|_| file.sync_all())
        .map_err(|_| "diagnostic_export_failed")?;
    drop(file);
    std::fs::rename(&temporary, dir.join(&name)).map_err(|_| "diagnostic_export_failed")?;
    Ok(name)
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let db_path = data_dir.join("skyblock-companion.sqlite3");
            init_db(&db_path)?;
            app.manage(AppState { db_path, data_dir });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            settings_get,
            settings_set,
            settings_delete,
            cache_get,
            cache_set,
            cache_delete,
            cache_stats,
            cache_clear,
            secret_set,
            secret_get,
            secret_delete,
            secret_status,
            watchlist_list,
            watchlist_add,
            watchlist_remove,
            watchlist_set_target,
            history_record,
            history_get,
            history_count,
            history_clear,
            data_dir,
            diagnostics_status,
            diagnostics_export
        ])
        .run(tauri::generate_context!())
        .expect("error while running SkyForge Helper");
}

#[cfg(test)]
mod release_tests {
    use super::*;
    #[test]
    fn legacy_sqlite_migration_backs_up_once_and_preserves_rows() {
        let dir =
            std::env::temp_dir().join(format!("sbc-migration-{}-{}", std::process::id(), now_ms()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("test.sqlite3");
        let db = Connection::open(&path).unwrap();
        db.execute_batch("CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT NOT NULL); INSERT INTO settings VALUES('preferences','{corrupt');").unwrap();
        drop(db);
        init_db(&path).unwrap();
        init_db(&path).unwrap();
        assert_eq!(std::fs::read_dir(dir.join("backups")).unwrap().count(), 1);
        let db = Connection::open(&path).unwrap();
        assert_eq!(
            db.query_row(
                "SELECT value FROM settings WHERE key='preferences'",
                [],
                |r| r.get::<_, String>(0)
            )
            .unwrap(),
            "{corrupt"
        );
        db.execute_batch("BEGIN; INSERT INTO settings VALUES('interrupted','x');")
            .unwrap();
        drop(db);
        let db = Connection::open(&path).unwrap();
        assert_eq!(
            db.query_row(
                "SELECT count(*) FROM settings WHERE key='interrupted'",
                [],
                |r| r.get::<_, i64>(0)
            )
            .unwrap(),
            0
        );
        db.pragma_update(None, "user_version", 99).unwrap();
        drop(db);
        assert!(init_db(&path).is_err());
        std::fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn diagnostics_rejects_sensitive_values_even_inside_allowed_fields() {
        let raw = serde_json::json!({"provider":"secret-token","last_error":"/Users/private/key", "backend_version":"1.2.3-secret", "inventory":{"secret":"hidden"},"endpoint":"https://secret@example.com"});
        let out = diagnostic_projection(&raw);
        let text = out.to_string();
        assert!(!text.contains("secret"));
        assert!(!text.contains("/Users"));
        assert!(out["backend_version"].is_null());
        assert_eq!(out["provider"], "unknown");
        assert_eq!(out["app_version"], env!("CARGO_PKG_VERSION"));
    }
}
