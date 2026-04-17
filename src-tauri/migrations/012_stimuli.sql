-- Fase 1: grabación de estímulos verbales + logoaudiometría
-- Tablas stimulus_lists (plantillas de palabras) + stimuli (grabaciones por token).

CREATE TABLE IF NOT EXISTS stimulus_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('srt','discrimination','dichotic_digits','sentence','custom')),
    language TEXT NOT NULL DEFAULT 'es',
    country_code TEXT,
    description TEXT,
    is_standard INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_lists_country ON stimulus_lists(country_code);

CREATE TABLE IF NOT EXISTS stimuli (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_id INTEGER NOT NULL,
    position INTEGER NOT NULL,
    token TEXT NOT NULL,
    file_path TEXT,
    duration_ms INTEGER,
    rms_dbfs REAL,
    peak_dbfs REAL,
    sample_rate INTEGER,
    normalized INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(list_id, position),
    FOREIGN KEY (list_id) REFERENCES stimulus_lists(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_stimuli_list ON stimuli(list_id);

-- País activo en settings (afecta filtrado de listas en UI)
INSERT OR IGNORE INTO settings (key, value) VALUES ('country_code', 'LATAM');

-- Seeds: listas neutras LatAm + US-ES. Solo tokens, sin audio (user graba).

INSERT INTO stimulus_lists (code, name, category, language, country_code, description, is_standard) VALUES
  ('SRT_LATAM_BISIL_A', 'SRT Bisílabos LatAm A', 'srt', 'es', 'LATAM',
   'Lista de 20 bisílabos balanceados (estilo Tato) — SRT umbral de recepción del habla', 1),
  ('DISC_LATAM_MONO_A', 'Discriminación Monosílabos LatAm A', 'discrimination', 'es', 'LATAM',
   '25 monosílabos fonéticamente balanceados para test de discriminación', 1),
  ('DICHOTIC_DIGITS_ES', 'Dichotic Digits ES', 'dichotic_digits', 'es', 'LATAM',
   'Dígitos 1–9 excluyendo 7 (bisílabo). Para test dicótico de dígitos', 1),
  ('SRT_US_ES_BISIL_A', 'SRT Bisílabos US-ES A', 'srt', 'es', 'US',
   'Lista bisílabos español EEUU (hispano) — variantes léxicas estadounidenses', 1);

-- Helper: insert tokens por lista
-- LATAM bisílabos
INSERT INTO stimuli (list_id, position, token)
  SELECT id, 1, 'casa' FROM stimulus_lists WHERE code='SRT_LATAM_BISIL_A'
  UNION ALL SELECT id, 2,  'mesa'   FROM stimulus_lists WHERE code='SRT_LATAM_BISIL_A'
  UNION ALL SELECT id, 3,  'perro'  FROM stimulus_lists WHERE code='SRT_LATAM_BISIL_A'
  UNION ALL SELECT id, 4,  'libro'  FROM stimulus_lists WHERE code='SRT_LATAM_BISIL_A'
  UNION ALL SELECT id, 5,  'árbol'  FROM stimulus_lists WHERE code='SRT_LATAM_BISIL_A'
  UNION ALL SELECT id, 6,  'pelo'   FROM stimulus_lists WHERE code='SRT_LATAM_BISIL_A'
  UNION ALL SELECT id, 7,  'mano'   FROM stimulus_lists WHERE code='SRT_LATAM_BISIL_A'
  UNION ALL SELECT id, 8,  'niño'   FROM stimulus_lists WHERE code='SRT_LATAM_BISIL_A'
  UNION ALL SELECT id, 9,  'agua'   FROM stimulus_lists WHERE code='SRT_LATAM_BISIL_A'
  UNION ALL SELECT id, 10, 'leche'  FROM stimulus_lists WHERE code='SRT_LATAM_BISIL_A'
  UNION ALL SELECT id, 11, 'noche'  FROM stimulus_lists WHERE code='SRT_LATAM_BISIL_A'
  UNION ALL SELECT id, 12, 'madre'  FROM stimulus_lists WHERE code='SRT_LATAM_BISIL_A'
  UNION ALL SELECT id, 13, 'padre'  FROM stimulus_lists WHERE code='SRT_LATAM_BISIL_A'
  UNION ALL SELECT id, 14, 'silla'  FROM stimulus_lists WHERE code='SRT_LATAM_BISIL_A'
  UNION ALL SELECT id, 15, 'pluma'  FROM stimulus_lists WHERE code='SRT_LATAM_BISIL_A'
  UNION ALL SELECT id, 16, 'papel'  FROM stimulus_lists WHERE code='SRT_LATAM_BISIL_A'
  UNION ALL SELECT id, 17, 'puerta' FROM stimulus_lists WHERE code='SRT_LATAM_BISIL_A'
  UNION ALL SELECT id, 18, 'barco'  FROM stimulus_lists WHERE code='SRT_LATAM_BISIL_A'
  UNION ALL SELECT id, 19, 'gato'   FROM stimulus_lists WHERE code='SRT_LATAM_BISIL_A'
  UNION ALL SELECT id, 20, 'llave'  FROM stimulus_lists WHERE code='SRT_LATAM_BISIL_A';

-- LATAM monosílabos
INSERT INTO stimuli (list_id, position, token)
  SELECT id, 1,  'sol'  FROM stimulus_lists WHERE code='DISC_LATAM_MONO_A'
  UNION ALL SELECT id, 2,  'pan'  FROM stimulus_lists WHERE code='DISC_LATAM_MONO_A'
  UNION ALL SELECT id, 3,  'mar'  FROM stimulus_lists WHERE code='DISC_LATAM_MONO_A'
  UNION ALL SELECT id, 4,  'luz'  FROM stimulus_lists WHERE code='DISC_LATAM_MONO_A'
  UNION ALL SELECT id, 5,  'fin'  FROM stimulus_lists WHERE code='DISC_LATAM_MONO_A'
  UNION ALL SELECT id, 6,  'voz'  FROM stimulus_lists WHERE code='DISC_LATAM_MONO_A'
  UNION ALL SELECT id, 7,  'pie'  FROM stimulus_lists WHERE code='DISC_LATAM_MONO_A'
  UNION ALL SELECT id, 8,  'tres' FROM stimulus_lists WHERE code='DISC_LATAM_MONO_A'
  UNION ALL SELECT id, 9,  'dos'  FROM stimulus_lists WHERE code='DISC_LATAM_MONO_A'
  UNION ALL SELECT id, 10, 'sal'  FROM stimulus_lists WHERE code='DISC_LATAM_MONO_A'
  UNION ALL SELECT id, 11, 'paz'  FROM stimulus_lists WHERE code='DISC_LATAM_MONO_A'
  UNION ALL SELECT id, 12, 'mal'  FROM stimulus_lists WHERE code='DISC_LATAM_MONO_A'
  UNION ALL SELECT id, 13, 'miel' FROM stimulus_lists WHERE code='DISC_LATAM_MONO_A'
  UNION ALL SELECT id, 14, 'cruz' FROM stimulus_lists WHERE code='DISC_LATAM_MONO_A'
  UNION ALL SELECT id, 15, 'rey'  FROM stimulus_lists WHERE code='DISC_LATAM_MONO_A'
  UNION ALL SELECT id, 16, 'mes'  FROM stimulus_lists WHERE code='DISC_LATAM_MONO_A'
  UNION ALL SELECT id, 17, 'pez'  FROM stimulus_lists WHERE code='DISC_LATAM_MONO_A'
  UNION ALL SELECT id, 18, 'tren' FROM stimulus_lists WHERE code='DISC_LATAM_MONO_A'
  UNION ALL SELECT id, 19, 'flor' FROM stimulus_lists WHERE code='DISC_LATAM_MONO_A'
  UNION ALL SELECT id, 20, 'gris' FROM stimulus_lists WHERE code='DISC_LATAM_MONO_A'
  UNION ALL SELECT id, 21, 'mil'  FROM stimulus_lists WHERE code='DISC_LATAM_MONO_A'
  UNION ALL SELECT id, 22, 'sed'  FROM stimulus_lists WHERE code='DISC_LATAM_MONO_A'
  UNION ALL SELECT id, 23, 'sur'  FROM stimulus_lists WHERE code='DISC_LATAM_MONO_A'
  UNION ALL SELECT id, 24, 'red'  FROM stimulus_lists WHERE code='DISC_LATAM_MONO_A'
  UNION ALL SELECT id, 25, 'tos'  FROM stimulus_lists WHERE code='DISC_LATAM_MONO_A';

-- Dichotic digits ES (sin 7 = siete, bisílabo)
INSERT INTO stimuli (list_id, position, token)
  SELECT id, 1, 'uno'    FROM stimulus_lists WHERE code='DICHOTIC_DIGITS_ES'
  UNION ALL SELECT id, 2, 'dos'    FROM stimulus_lists WHERE code='DICHOTIC_DIGITS_ES'
  UNION ALL SELECT id, 3, 'tres'   FROM stimulus_lists WHERE code='DICHOTIC_DIGITS_ES'
  UNION ALL SELECT id, 4, 'cuatro' FROM stimulus_lists WHERE code='DICHOTIC_DIGITS_ES'
  UNION ALL SELECT id, 5, 'cinco'  FROM stimulus_lists WHERE code='DICHOTIC_DIGITS_ES'
  UNION ALL SELECT id, 6, 'seis'   FROM stimulus_lists WHERE code='DICHOTIC_DIGITS_ES'
  UNION ALL SELECT id, 7, 'ocho'   FROM stimulus_lists WHERE code='DICHOTIC_DIGITS_ES'
  UNION ALL SELECT id, 8, 'nueve'  FROM stimulus_lists WHERE code='DICHOTIC_DIGITS_ES';

-- US-ES bisílabos (variantes léxicas estadounidenses hispanas)
INSERT INTO stimuli (list_id, position, token)
  SELECT id, 1,  'carro'  FROM stimulus_lists WHERE code='SRT_US_ES_BISIL_A'
  UNION ALL SELECT id, 2,  'casa'   FROM stimulus_lists WHERE code='SRT_US_ES_BISIL_A'
  UNION ALL SELECT id, 3,  'mesa'   FROM stimulus_lists WHERE code='SRT_US_ES_BISIL_A'
  UNION ALL SELECT id, 4,  'libro'  FROM stimulus_lists WHERE code='SRT_US_ES_BISIL_A'
  UNION ALL SELECT id, 5,  'perro'  FROM stimulus_lists WHERE code='SRT_US_ES_BISIL_A'
  UNION ALL SELECT id, 6,  'plata'  FROM stimulus_lists WHERE code='SRT_US_ES_BISIL_A'
  UNION ALL SELECT id, 7,  'niño'   FROM stimulus_lists WHERE code='SRT_US_ES_BISIL_A'
  UNION ALL SELECT id, 8,  'agua'   FROM stimulus_lists WHERE code='SRT_US_ES_BISIL_A'
  UNION ALL SELECT id, 9,  'papá'   FROM stimulus_lists WHERE code='SRT_US_ES_BISIL_A'
  UNION ALL SELECT id, 10, 'mamá'   FROM stimulus_lists WHERE code='SRT_US_ES_BISIL_A'
  UNION ALL SELECT id, 11, 'noche'  FROM stimulus_lists WHERE code='SRT_US_ES_BISIL_A'
  UNION ALL SELECT id, 12, 'leche'  FROM stimulus_lists WHERE code='SRT_US_ES_BISIL_A'
  UNION ALL SELECT id, 13, 'silla'  FROM stimulus_lists WHERE code='SRT_US_ES_BISIL_A'
  UNION ALL SELECT id, 14, 'puerta' FROM stimulus_lists WHERE code='SRT_US_ES_BISIL_A'
  UNION ALL SELECT id, 15, 'cama'   FROM stimulus_lists WHERE code='SRT_US_ES_BISIL_A'
  UNION ALL SELECT id, 16, 'zapato' FROM stimulus_lists WHERE code='SRT_US_ES_BISIL_A'
  UNION ALL SELECT id, 17, 'pluma'  FROM stimulus_lists WHERE code='SRT_US_ES_BISIL_A'
  UNION ALL SELECT id, 18, 'dinero' FROM stimulus_lists WHERE code='SRT_US_ES_BISIL_A'
  UNION ALL SELECT id, 19, 'escuela' FROM stimulus_lists WHERE code='SRT_US_ES_BISIL_A'
  UNION ALL SELECT id, 20, 'familia' FROM stimulus_lists WHERE code='SRT_US_ES_BISIL_A';
