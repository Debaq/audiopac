-- MLD (Masking Level Difference). Requiere ToneDefinition.{noise_mix, phase_invert_right}.
-- Tono 500 Hz enmascarado en ruido blanco binaural. Dos condiciones:
--   SoNo: tono y ruido homófasicos en ambos oídos (difícil detectar).
--   SπNo: tono invertido 180° entre oídos, ruido igual (fácil detectar).
-- MLD normal ≥10 dB. En normales SπNo se detecta hasta ~12-15 dB por debajo de SoNo.
-- Tokens:
--   A = SoNo + tono (detectable)
--   B = SoNo catch (solo ruido)
--   C = SπNo + tono a nivel más bajo (tipicamente ~10 dB bajo A)
--   D = SπNo catch (solo ruido, tono invertido no aplica)
-- El paciente responde sí/no oye tono. En normales A y C deben ser detectados, catches B/D rechazados.
-- Si detecta A pero no C → MLD reducido → sospecha alteración tronco cerebral.

INSERT OR IGNORE INTO test_templates (code, name, test_type, description, is_standard, config_json) VALUES
('MLD_STD', 'MLD - Masking Level Difference', 'CUSTOM',
 'MLD clásico a 500 Hz. Tono enmascarado en ruido blanco. Dos condiciones: SoNo (homófasica) y SπNo (tono invertido 180° en oído derecho). MLD normal ≥10 dB. Tokens A=SoNo tono, B=SoNo catch, C=SπNo tono (10 dB menos), D=SπNo catch. Auricular estéreo obligatorio.',
 1,
 '{"tones":{"A":{"label":"SoNo + tono","kind":"tone","frequency":500,"duration_ms":500,"level_db":60,"noise_mix":{"noise_type":"white","level_db":65}},"B":{"label":"SoNo catch","kind":"noise","noise_type":"white","duration_ms":500,"level_db":65},"C":{"label":"SπNo + tono","kind":"tone","frequency":500,"duration_ms":500,"level_db":50,"phase_invert_right":true,"noise_mix":{"noise_type":"white","level_db":65}},"D":{"label":"SπNo catch","kind":"noise","noise_type":"white","duration_ms":500,"level_db":65}},"isi_ms":1000,"iri_ms":3000,"envelope_ms":20,"pattern_length":1,"practice_sequences":["A","B","C","D","A","C"],"test_sequences":["A","C","B","A","C","D","A","C","A","C","B","A","C","D","A","C","B","A","C","D"],"channel":"binaural","level_db":60}');
