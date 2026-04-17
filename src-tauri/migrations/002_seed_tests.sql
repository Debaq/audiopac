-- DPS estándar (Musiek Duration Pattern Sequence)
INSERT OR IGNORE INTO test_templates (code, name, test_type, description, is_standard, config_json) VALUES
('DPS_STD', 'DPS Estándar (Musiek)', 'DPS',
 'Test de Patrón de Duración - Versión estándar 1000Hz, tonos largos (500ms) y cortos (250ms)',
 1,
 '{"frequency":1000,"tones":{"L":{"label":"Largo","duration_ms":500},"C":{"label":"Corto","duration_ms":250}},"isi_ms":300,"iri_ms":6000,"envelope_ms":10,"pattern_length":3,"practice_sequences":["LCC","CLC","CCL","LLC","CCL","LCL","CLC","LLC","LCC","CCL"],"test_sequences":["CCL","CLL","LCL","LCC","LCC","LLC","LLC","CLC","CCL","LCC","CLL","LCL","CCL","CCL","CLC","LCL","LCC","LLC","CLC","LLC","CLC","LLC","CCL","CLC","CCL","CLC","CLC","LCL","LCC","CCL","LLC","LLC","CCL","LCL","LCC","CLC","CLC","CLL","CCL","LCC","LLC","CLL","CLL","LCL","CLC","LCC","LLC","CLL","CLL","LCL","CCL","CLL","LLC","LCL","LCL","CLL","CLL","LCC","LCC","LCL"],"channel":"binaural","level_db":60}'),

-- PPS estándar (Pitch Pattern Sequence)
('PPS_STD', 'PPS Estándar (Pinheiro)', 'PPS',
 'Test de Patrón de Frecuencia - Versión estándar tonos grave 880Hz (L) y agudo 1430Hz (H)',
 1,
 '{"tones":{"L":{"label":"Grave","frequency":880},"H":{"label":"Agudo","frequency":1430}},"duration_ms":200,"isi_ms":300,"iri_ms":6000,"envelope_ms":10,"pattern_length":3,"practice_sequences":["LH","HH","HL","LL","HL","LH","LL","HL","LL","HL","LH","HL","HH","LH","LL","LH","HH","LH","HL","HH"],"test_sequences":["HHL","HLL","LHL","LHH","LHH","LLH","LLH","HLH","HHL","LHH","HLL","LHL","HHL","HHL","HLH","LHL","LHH","LLH","HLH","LLH","HLH","LLH","HHL","HLH","HHL","HLH","HLH","LHL","LHH","HHL","LLH","LLH","HHL","LHL","LHH","HLH","HLH","HLL","HHL","LHH","LLH","HLL","HLL","LHL","HLH","LHH","LLH","HLL","HLL","LHL","HHL","HLL","LLH","LHL","LHL","HLL","HLL","LHH","LHH","LHL"],"channel":"binaural","level_db":60}');

-- Configuración inicial
INSERT OR IGNORE INTO settings (key, value) VALUES
('app_version', '0.1.0'),
('default_iri_ms', '6000'),
('default_isi_ms', '300'),
('sample_rate', '48000'),
('calibration_ref_db', '60'),
('pass_threshold', '0.75');
