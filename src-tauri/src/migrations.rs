use tauri_plugin_sql::{Migration, MigrationKind};

pub fn get_migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "initial_schema",
            sql: include_str!("../migrations/001_initial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "seed_default_tests",
            sql: include_str!("../migrations/002_seed_tests.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "seed_pac_tests_v2",
            sql: include_str!("../migrations/004_seed_pac_tests_v2.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "seed_pac_extended",
            sql: include_str!("../migrations/005_seed_pac_extended.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "calibration_dichotic",
            sql: include_str!("../migrations/006_calibration_dichotic.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "seed_noise_tests",
            sql: include_str!("../migrations/007_seed_noise_tests.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "seed_mld",
            sql: include_str!("../migrations/008_seed_mld.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "seed_gap_freq",
            sql: include_str!("../migrations/009_seed_gap_freq.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 10,
            description: "calibration_device",
            sql: include_str!("../migrations/010_calibration_device.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 11,
            description: "calibration_multifreq",
            sql: include_str!("../migrations/011_calibration_multifreq.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 12,
            description: "stimuli",
            sql: include_str!("../migrations/012_stimuli.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 13,
            description: "seed_srt",
            sql: include_str!("../migrations/013_seed_srt.sql"),
            kind: MigrationKind::Up,
        },
    ]
}
