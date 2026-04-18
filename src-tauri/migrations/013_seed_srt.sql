-- Fase 1: plantilla SRT (logoaudiometría umbral recepción del habla)
-- Discriminador: config.srt presente. test_type='CUSTOM' para reutilizar el pipeline.
-- La lista de estímulos se resuelve por code (stimulus_list_code) en runtime.

INSERT OR IGNORE INTO test_templates (code, name, test_type, description, is_standard, config_json) VALUES
('SRT_LATAM_BISIL', 'SRT bisílabos LatAm', 'CUSTOM',
 'Umbral de recepción del habla (SRT) con bisílabos balanceados. Método descendente-ascendente con bracketing. Requiere grabar la lista SRT_LATAM_BISIL_A en /estimulos.',
 1,
 '{"tones":{},"isi_ms":0,"iri_ms":0,"envelope_ms":0,"pattern_length":0,"practice_sequences":[],"test_sequences":[],"channel":"binaural","level_db":50,"srt":{"stimulus_list_code":"SRT_LATAM_BISIL_A","start_level_db":50,"words_per_level":4,"step_down_db":10,"step_up_db":5,"min_level_db":0,"max_level_db":90,"threshold_pass_ratio":0.5,"max_total_trials":40}}'),
('SRT_US_ES_BISIL', 'SRT bisílabos US-ES', 'CUSTOM',
 'SRT variante US-ES. Requiere grabar la lista SRT_US_ES_BISIL_A en /estimulos.',
 1,
 '{"tones":{},"isi_ms":0,"iri_ms":0,"envelope_ms":0,"pattern_length":0,"practice_sequences":[],"test_sequences":[],"channel":"binaural","level_db":50,"srt":{"stimulus_list_code":"SRT_US_ES_BISIL_A","start_level_db":50,"words_per_level":4,"step_down_db":10,"step_up_db":5,"min_level_db":0,"max_level_db":90,"threshold_pass_ratio":0.5,"max_total_trials":40}}');
