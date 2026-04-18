use tauri_plugin_sql::{Migration, MigrationKind};

// Schema v2 (Fase 6 — sistema de paquetes). App arranca vacía.
// Contenido clínico (tests, listas, estímulos) viene por packs desde audiopac-assets.
//
// Las migraciones pre-v2 (002–018) fueron colapsadas en 001_initial.sql.
// Bases de datos pre-v2 se detectan en boot y se regeneran (ver PreV2DbCheck en el cliente).
pub fn get_migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "initial_schema_v2_packs",
        sql: include_str!("../migrations/001_initial.sql"),
        kind: MigrationKind::Up,
    }]
}
