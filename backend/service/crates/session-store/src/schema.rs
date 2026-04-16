//! SQLite schema constants and migrations for the local session store.

/// Current SQLite schema version.
pub(crate) const SCHEMA_VERSION: i64 = 6;

/// Full schema used when bootstrapping a new local store database.
pub(crate) const BOOTSTRAP_SCHEMA: &str = "
    CREATE TABLE open_sessions (
        open_session_id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        session_id TEXT NOT NULL,
        cwd TEXT NOT NULL,
        revision INTEGER NOT NULL,
        UNIQUE(provider, session_id, cwd)
    );
    CREATE TABLE transcript_items (
        open_session_id TEXT NOT NULL,
        item_ordinal INTEGER NOT NULL,
        item_json TEXT NOT NULL,
        PRIMARY KEY(open_session_id, item_ordinal),
        FOREIGN KEY(open_session_id)
            REFERENCES open_sessions(open_session_id)
            ON DELETE CASCADE
    );
    CREATE TABLE open_session_states (
        open_session_id TEXT PRIMARY KEY,
        state_json TEXT NOT NULL,
        FOREIGN KEY(open_session_id)
            REFERENCES open_sessions(open_session_id)
            ON DELETE CASCADE
    );
    CREATE TABLE session_index_meta (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        revision INTEGER NOT NULL
    );
    INSERT INTO session_index_meta (id, revision) VALUES (1, 0);
    CREATE TABLE session_index_sources (
        provider TEXT PRIMARY KEY,
        refreshed_at TEXT NOT NULL
    );
    CREATE TABLE session_index_entries (
        provider TEXT NOT NULL,
        session_id TEXT NOT NULL,
        cwd TEXT NOT NULL,
        title TEXT,
        updated_at TEXT,
        PRIMARY KEY(provider, session_id, cwd)
    );
    CREATE TABLE projects (
        project_id TEXT PRIMARY KEY,
        cwd TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
    CREATE TABLE project_suggestion_sources (
        provider TEXT PRIMARY KEY,
        refreshed_at TEXT NOT NULL
    );
    CREATE TABLE project_suggestions (
        provider TEXT NOT NULL,
        cwd TEXT NOT NULL,
        suggestion_id TEXT NOT NULL,
        PRIMARY KEY(provider, cwd)
    );
    CREATE TABLE global_settings (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        session_groups_updated_within_days INTEGER
    );
    INSERT INTO global_settings (id, session_groups_updated_within_days)
    VALUES (1, 5);
    PRAGMA user_version = 6;
";

/// Migration from schema version 5 to version 6.
pub(crate) const MIGRATE_SCHEMA_5_TO_6: &str = "
    CREATE TABLE IF NOT EXISTS open_session_states (
        open_session_id TEXT PRIMARY KEY,
        state_json TEXT NOT NULL,
        FOREIGN KEY(open_session_id)
            REFERENCES open_sessions(open_session_id)
            ON DELETE CASCADE
    );
    PRAGMA user_version = 6;
";
