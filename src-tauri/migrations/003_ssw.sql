-- SSW (Staggered Spondaic Word, Katz 1962/1998).
-- Agrega 'SSW' a test_templates.test_type y 'matrix'/'ssw' a stimulus_lists.category.
-- SQLite no soporta ALTER CHECK → recrear tablas preservando filas+índices+FK.

PRAGMA foreign_keys = OFF;

-- test_templates: extender CHECK con 'SSW'
CREATE TABLE test_templates_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    test_type TEXT NOT NULL CHECK(test_type IN ('DPS','PPS','CUSTOM','SSW')),
    description TEXT,
    config_json TEXT NOT NULL,
    is_standard INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    pack_id INTEGER REFERENCES packs(id) ON DELETE SET NULL,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL
);

INSERT INTO test_templates_new (id, code, name, test_type, description, config_json, is_standard, is_active, pack_id, created_by, created_at, updated_at)
SELECT id, code, name, test_type, description, config_json, is_standard, is_active, pack_id, created_by, created_at, updated_at
FROM test_templates;

DROP TABLE test_templates;
ALTER TABLE test_templates_new RENAME TO test_templates;

CREATE INDEX IF NOT EXISTS idx_templates_pack ON test_templates(pack_id);

-- stimulus_lists: extender CHECK con 'matrix' (faltaba) y 'ssw'
CREATE TABLE stimulus_lists_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('srt','discrimination','dichotic_digits','sentence','matrix','ssw','custom')),
    language TEXT NOT NULL DEFAULT 'es',
    country_code TEXT,
    description TEXT,
    is_standard INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    pack_id INTEGER REFERENCES packs(id) ON DELETE SET NULL,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL
);

INSERT INTO stimulus_lists_new (id, code, name, category, language, country_code, description, is_standard, is_active, pack_id, created_by, created_at)
SELECT id, code, name, category, language, country_code, description, is_standard, is_active, pack_id, created_by, created_at
FROM stimulus_lists;

DROP TABLE stimulus_lists;
ALTER TABLE stimulus_lists_new RENAME TO stimulus_lists;

CREATE INDEX IF NOT EXISTS idx_lists_country ON stimulus_lists(country_code);
CREATE INDEX IF NOT EXISTS idx_lists_pack ON stimulus_lists(pack_id);

PRAGMA foreign_keys = ON;
