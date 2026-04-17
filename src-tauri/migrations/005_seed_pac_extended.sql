-- Pruebas PAC con extensiones chicas de motor (level_db/ear/gain por tono).
-- Requieren ToneDefinition.{level_db, ear, gain_l, gain_r}.

INSERT OR IGNORE INTO test_templates (code, name, test_type, description, is_standard, config_json) VALUES
('GAP_20', 'Gap detection (20 ms)', 'CUSTOM',
 'Detección de gap de 20 ms entre 2 tonos de 1000 Hz. Pregunta al paciente: ¿escuchó uno o dos tonos? Items "A" = catch (un solo tono), "AA" = par separado por 20 ms.',
 1,
 '{"frequency":1000,"tones":{"A":{"label":"Tono","frequency":1000,"duration_ms":300}},"duration_ms":300,"isi_ms":20,"iri_ms":4000,"envelope_ms":5,"pattern_length":2,"practice_sequences":["AA","A","AA","A"],"test_sequences":["AA","A","AA","AA","A","AA","A","AA","AA","A","AA","AA","A","AA","A","AA","AA","A","AA","AA"],"channel":"binaural","level_db":60}'),

('GAP_10', 'Gap detection (10 ms)', 'CUSTOM',
 'Detección de gap de 10 ms. Nivel intermedio, umbral adulto normal ~2-5 ms.',
 1,
 '{"frequency":1000,"tones":{"A":{"label":"Tono","frequency":1000,"duration_ms":300}},"duration_ms":300,"isi_ms":10,"iri_ms":4000,"envelope_ms":3,"pattern_length":2,"practice_sequences":["AA","A","AA","A"],"test_sequences":["AA","A","AA","AA","A","AA","A","AA","AA","A","AA","AA","A","AA","A","AA","AA","A","AA","AA"],"channel":"binaural","level_db":60}'),

('GAP_5', 'Gap detection (5 ms)', 'CUSTOM',
 'Detección de gap de 5 ms. Cerca del umbral normal. Envelope corto (2 ms) para no enmascarar el gap.',
 1,
 '{"frequency":1000,"tones":{"A":{"label":"Tono","frequency":1000,"duration_ms":300}},"duration_ms":300,"isi_ms":5,"iri_ms":4000,"envelope_ms":2,"pattern_length":2,"practice_sequences":["AA","A","AA","A"],"test_sequences":["AA","A","AA","AA","A","AA","A","AA","AA","A","AA","AA","A","AA","A","AA","AA","A","AA","AA"],"channel":"binaural","level_db":60}'),

('DLI_SCREEN', 'DLI screening (Δ=3 dB)', 'CUSTOM',
 'Diferencia Limen de Intensidad - Pares de tonos mismo Hz/dur, distinta intensidad. A=60 dB, B=63 dB. Paciente responde ¿igual o distinto?',
 1,
 '{"frequency":1000,"tones":{"A":{"label":"60 dB","frequency":1000,"duration_ms":400,"level_db":60},"B":{"label":"63 dB","frequency":1000,"duration_ms":400,"level_db":63}},"isi_ms":500,"iri_ms":4000,"envelope_ms":15,"pattern_length":2,"practice_sequences":["AA","AB","BA","BB","AB","AA","BA","BB"],"test_sequences":["AA","AB","BA","BB","AB","AA","BA","BB","AA","AB","BA","BB","AB","AA","BA","BB","AA","AB","BA","BB","AB","AA","BA","BB","AA","AB","BA","BB","AB","AA"],"channel":"binaural","level_db":60}'),

('DLI_FINE', 'DLI fino (Δ=1 dB)', 'CUSTOM',
 'DLI fino - Δ=1 dB, cercano al umbral de Weber normal (~0.5-1 dB a 60 dB SL).',
 1,
 '{"frequency":1000,"tones":{"A":{"label":"60 dB","frequency":1000,"duration_ms":400,"level_db":60},"B":{"label":"61 dB","frequency":1000,"duration_ms":400,"level_db":61}},"isi_ms":500,"iri_ms":4000,"envelope_ms":15,"pattern_length":2,"practice_sequences":["AA","AB","BA","BB","AB","AA","BA","BB"],"test_sequences":["AA","AB","BA","BB","AB","AA","BA","BB","AA","AB","BA","BB","AB","AA","BA","BB","AA","AB","BA","BB","AB","AA","BA","BB","AA","AB","BA","BB","AB","AA"],"channel":"binaural","level_db":60}'),

('TOJ_BIN', 'TOJ binaural (orden temporal L/R)', 'CUSTOM',
 'Temporal Order Judgement - Tono L (1000 Hz a oído izquierdo) y tono R (1000 Hz a oído derecho) con ISI variable. Paciente responde ¿izquierda-derecha o derecha-izquierda? ISI 100 ms.',
 1,
 '{"tones":{"L":{"label":"Izq","frequency":1000,"duration_ms":150,"ear":"left"},"R":{"label":"Der","frequency":1000,"duration_ms":150,"ear":"right"}},"isi_ms":100,"iri_ms":4000,"envelope_ms":10,"pattern_length":2,"practice_sequences":["LR","RL","LR","RL"],"test_sequences":["LR","RL","LR","RL","LR","RL","LR","RL","LR","RL","LR","RL","LR","RL","LR","RL","LR","RL","LR","RL"],"channel":"binaural","level_db":60}'),

('TOJ_FAST', 'TOJ binaural rápido (ISI 40 ms)', 'CUSTOM',
 'TOJ con ISI 40 ms, más cerca del umbral adulto (~20-30 ms). Orden L/R.',
 1,
 '{"tones":{"L":{"label":"Izq","frequency":1000,"duration_ms":100,"ear":"left"},"R":{"label":"Der","frequency":1000,"duration_ms":100,"ear":"right"}},"isi_ms":40,"iri_ms":4000,"envelope_ms":5,"pattern_length":2,"practice_sequences":["LR","RL","LR","RL"],"test_sequences":["LR","RL","LR","RL","LR","RL","LR","RL","LR","RL","LR","RL","LR","RL","LR","RL","LR","RL","LR","RL"],"channel":"binaural","level_db":60}'),

('ILD_LAT', 'Lateralización por ILD', 'CUSTOM',
 'Lateralización por diferencia interaural de intensidad. C=centrado (1.0/1.0), L=lateralizado izq (1.0/0.3), R=lateralizado der (0.3/1.0). Paciente indica si el tono se escucha al centro, izquierda o derecha.',
 1,
 '{"frequency":1000,"tones":{"C":{"label":"Centro","frequency":1000,"duration_ms":500,"gain_l":1.0,"gain_r":1.0},"L":{"label":"Izq","frequency":1000,"duration_ms":500,"gain_l":1.0,"gain_r":0.3},"R":{"label":"Der","frequency":1000,"duration_ms":500,"gain_l":0.3,"gain_r":1.0}},"isi_ms":2000,"iri_ms":3000,"envelope_ms":20,"pattern_length":1,"practice_sequences":["C","L","R","C","L","R"],"test_sequences":["C","L","R","L","C","R","R","L","C","L","R","C","C","R","L","R","C","L","L","C","R","C","L","R"],"channel":"binaural","level_db":60}');
