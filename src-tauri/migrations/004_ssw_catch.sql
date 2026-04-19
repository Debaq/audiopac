-- SSW catch trials: extender test_responses.phase CHECK con 'catch'.
-- SQLite no soporta ALTER CHECK → recrear tabla preservando filas+índices.

PRAGMA foreign_keys = OFF;

CREATE TABLE test_responses_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    item_index INTEGER NOT NULL,
    phase TEXT NOT NULL CHECK(phase IN ('practice','test','catch')),
    expected_pattern TEXT NOT NULL,
    given_pattern TEXT,
    is_correct INTEGER,
    reaction_time_ms INTEGER,
    presented_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES test_sessions(id) ON DELETE CASCADE
);

INSERT INTO test_responses_new (id, session_id, item_index, phase, expected_pattern, given_pattern, is_correct, reaction_time_ms, presented_at)
SELECT id, session_id, item_index, phase, expected_pattern, given_pattern, is_correct, reaction_time_ms, presented_at
FROM test_responses;

DROP TABLE test_responses;
ALTER TABLE test_responses_new RENAME TO test_responses;

CREATE INDEX IF NOT EXISTS idx_responses_session ON test_responses(session_id);

PRAGMA foreign_keys = ON;
