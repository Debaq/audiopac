-- Fase 4: plantillas Dichotic Digits ES (recuerdo libre y dirigido)
-- Discriminador: config.dichotic_digits presente. test_type='CUSTOM'.
-- La lista DICHOTIC_DIGITS_ES ya fue sembrada en mig 012 (dígitos 1–9 sin "siete").

INSERT OR IGNORE INTO test_templates (code, name, test_type, description, is_standard, config_json) VALUES
('DD_ES_FREE', 'Dichotic Digits ES — Recuerdo libre', 'CUSTOM',
 'Prueba de dígitos dicóticos en español. Pares de 2 dígitos simultáneos (uno por oído). Modo libre: el paciente reporta todos los dígitos que recuerde. Requiere grabar la lista DICHOTIC_DIGITS_ES en /estimulos.',
 1,
 '{"tones":{},"isi_ms":0,"iri_ms":0,"envelope_ms":0,"pattern_length":0,"practice_sequences":[],"test_sequences":[],"channel":"binaural","level_db":55,"dichotic_digits":{"stimulus_list_code":"DICHOTIC_DIGITS_ES","num_pairs":20,"digits_per_ear":2,"isi_ms":300,"level_db":55,"mode":"free"}}'),
('DD_ES_DIRECTED', 'Dichotic Digits ES — Recuerdo dirigido', 'CUSTOM',
 'Prueba de dígitos dicóticos en español. Pares de 2 dígitos simultáneos (uno por oído). Modo dirigido: el evaluador indica qué oído reportar primero (alterna L/R). Requiere grabar la lista DICHOTIC_DIGITS_ES en /estimulos.',
 1,
 '{"tones":{},"isi_ms":0,"iri_ms":0,"envelope_ms":0,"pattern_length":0,"practice_sequences":[],"test_sequences":[],"channel":"binaural","level_db":55,"dichotic_digits":{"stimulus_list_code":"DICHOTIC_DIGITS_ES","num_pairs":20,"digits_per_ear":2,"isi_ms":300,"level_db":55,"mode":"directed"}}');
