-- Pruebas PAC con generador de ruido (Fase 5).
-- Requieren ToneDefinition.{kind, noise_type, center_hz, bandwidth_hz, gap_at_ms, gap_width_ms}.

-- GIN (Gaps-in-Noise): ruido de banda ancha de 3 s con 0 o 1 gap centrado.
-- El operador sabe por el token si hay gap y cuánto dura; marca según la respuesta "sí/no" del paciente.
INSERT OR IGNORE INTO test_templates (code, name, test_type, description, is_standard, config_json) VALUES
('GIN_STD', 'GIN - Detección de gaps en ruido', 'CUSTOM',
 'Gaps in Noise (adaptado). Cada ítem: 3 s de ruido blanco con 0 o 1 gap en el medio. Gaps de 2, 4, 6, 10, 15 o 20 ms. Paciente indica si oyó un silencio. Tokens: A=sin gap, B=2ms, C=4ms, D=6ms, E=10ms, F=15ms, G=20ms.',
 1,
 '{"tones":{"A":{"label":"Sin gap","kind":"noise","noise_type":"white","duration_ms":3000},"B":{"label":"Gap 2 ms","kind":"noise","noise_type":"white","duration_ms":3000,"gap_at_ms":1500,"gap_width_ms":2},"C":{"label":"Gap 4 ms","kind":"noise","noise_type":"white","duration_ms":3000,"gap_at_ms":1500,"gap_width_ms":4},"D":{"label":"Gap 6 ms","kind":"noise","noise_type":"white","duration_ms":3000,"gap_at_ms":1500,"gap_width_ms":6},"E":{"label":"Gap 10 ms","kind":"noise","noise_type":"white","duration_ms":3000,"gap_at_ms":1500,"gap_width_ms":10},"F":{"label":"Gap 15 ms","kind":"noise","noise_type":"white","duration_ms":3000,"gap_at_ms":1500,"gap_width_ms":15},"G":{"label":"Gap 20 ms","kind":"noise","noise_type":"white","duration_ms":3000,"gap_at_ms":1500,"gap_width_ms":20}},"isi_ms":800,"iri_ms":3500,"envelope_ms":15,"pattern_length":1,"practice_sequences":["G","A","F","E","A","G"],"test_sequences":["G","A","F","E","D","A","C","B","G","F","A","E","D","C","A","B","G","F","E","A","D","C","B","A","G","F","E","D","C","B"],"channel":"binaural","level_db":65}'),

-- RGD (Random Gap Detection adaptado): 2 ráfagas de ruido blanco de 50 ms separadas por ISI fijo.
-- Variantes por ISI (20/10/5 ms). Tokens: A = una sola ráfaga (catch), AA = dos ráfagas.
('RGD_20', 'RGD ruido - gap 20 ms', 'CUSTOM',
 'Random Gap Detection en ruido. 2 bursts de ruido blanco (50 ms cada uno) separados por 20 ms. Token A = 1 burst solo, AA = 2 bursts. Paciente: ¿uno o dos?',
 1,
 '{"tones":{"A":{"label":"Burst","kind":"noise","noise_type":"white","duration_ms":50}},"isi_ms":20,"iri_ms":3500,"envelope_ms":3,"pattern_length":2,"practice_sequences":["AA","A","AA","A"],"test_sequences":["AA","A","AA","AA","A","AA","A","AA","AA","A","AA","AA","A","AA","A","AA","AA","A","AA","AA"],"channel":"binaural","level_db":65}'),

('RGD_10', 'RGD ruido - gap 10 ms', 'CUSTOM',
 'Idem RGD pero ISI 10 ms. Cerca del umbral adulto normal.',
 1,
 '{"tones":{"A":{"label":"Burst","kind":"noise","noise_type":"white","duration_ms":50}},"isi_ms":10,"iri_ms":3500,"envelope_ms":2,"pattern_length":2,"practice_sequences":["AA","A","AA","A"],"test_sequences":["AA","A","AA","AA","A","AA","A","AA","AA","A","AA","AA","A","AA","A","AA","AA","A","AA","AA"],"channel":"binaural","level_db":65}'),

('RGD_5', 'RGD ruido - gap 5 ms', 'CUSTOM',
 'Idem RGD pero ISI 5 ms. Umbral exigente.',
 1,
 '{"tones":{"A":{"label":"Burst","kind":"noise","noise_type":"white","duration_ms":50}},"isi_ms":5,"iri_ms":3500,"envelope_ms":1,"pattern_length":2,"practice_sequences":["AA","A","AA","A"],"test_sequences":["AA","A","AA","AA","A","AA","A","AA","AA","A","AA","AA","A","AA","A","AA","AA","A","AA","AA"],"channel":"binaural","level_db":65}'),

-- Ruido de banda angosta para enmascaramiento perceptual
('NBN_SCREEN', 'Ruido de banda angosta - screening', 'CUSTOM',
 'Ítem único de 2 s de ruido de banda angosta centrado en 1000 Hz (ancho 200 Hz). Útil como estímulo de enmascaramiento o verificación auditiva general. Token N = ruido centrado.',
 1,
 '{"tones":{"N":{"label":"NBN 1 kHz","kind":"noise","noise_type":"narrow","center_hz":1000,"bandwidth_hz":200,"duration_ms":2000}},"isi_ms":500,"iri_ms":3000,"envelope_ms":15,"pattern_length":1,"practice_sequences":["N","N"],"test_sequences":["N","N","N","N","N","N","N","N","N","N"],"channel":"binaural","level_db":60}');
