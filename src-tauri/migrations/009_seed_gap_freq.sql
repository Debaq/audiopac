-- Detección de gap con cambio de frecuencia (roadmap §1.3).
-- Paciente escucha un tono y debe decir si es "continuo" (mismo pitch) o hay un "cambio" breve de freq en el medio.
-- Implementado como micro-secuencia concatenada con ISI=0 y envolvente corta:
--   F = 1000 Hz 120 ms (base)
--   G = 1200 Hz 60 ms (cambio ~3 semitonos)
--   H = 1500 Hz 60 ms (cambio ~7 semitonos, más fácil)
-- Patrones:
--   FFF = continuo (respuesta "igual")
--   FGF = cambio pequeño en medio (respuesta "diferente")
--   FHF = cambio grande (respuesta "diferente")
-- El splice se percibe casi continuo con envolvente 2 ms.

INSERT OR IGNORE INTO test_templates (code, name, test_type, description, is_standard, config_json) VALUES
('FGC_SCREEN', 'Gap con cambio de frecuencia - screening', 'CUSTOM',
 'Gap de frecuencia. Tono de ~300 ms; puede ser continuo (A) o tener un cambio breve de pitch en el medio (B = cambio de 200 Hz, C = cambio de 500 Hz). El paciente responde igual/diferente. Útil como índice de resolución espectral temporal.',
 1,
 '{"tones":{"F":{"label":"Base 1 kHz","frequency":1000,"duration_ms":120},"G":{"label":"Cambio +200 Hz","frequency":1200,"duration_ms":60},"H":{"label":"Cambio +500 Hz","frequency":1500,"duration_ms":60}},"isi_ms":0,"iri_ms":2500,"envelope_ms":2,"pattern_length":3,"practice_sequences":["FFF","FHF","FFF","FGF"],"test_sequences":["FFF","FGF","FHF","FFF","FGF","FHF","FFF","FGF","FFF","FHF","FGF","FFF","FHF","FGF","FFF","FHF","FGF","FFF","FHF","FGF"],"channel":"binaural","level_db":60}');
