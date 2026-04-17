# SignPath Foundation Application

Ready-to-paste values for the form at https://signpath.org/foundation

## Form fields

### Project Name *
```
AudioPAC
```

### Repository URL *
```
https://github.com/Debaq/audiopac
```

### Homepage URL *
```
https://github.com/Debaq/audiopac
```

### Download URL
```
https://github.com/Debaq/audiopac/releases
```
*(The README already states: "Windows binaries are signed with a code signing certificate provided by SignPath Foundation as part of their free sponsorship program for open source projects.")*

### Privacy Policy URL
```
https://github.com/Debaq/audiopac/blob/main/PRIVACY.md
```

### Wikipedia URL
*(leave empty)*

### Tagline *
```
Open-source clinical software for Central Auditory Processing evaluation (DPS/PPS tests)
```

### Description *
```
AudioPAC is open-source cross-platform software for the clinical evaluation of Central Auditory Processing Disorders (CAPD). It implements the standard Duration Pattern Sequence (DPS) and Pitch Pattern Sequence (PPS) tests used by audiologists and speech-language pathologists for diagnosing auditory processing disorders. The software provides fully configurable test parameters for research use, patient management, clinical PDF report generation, and CSV data export for statistical analysis. It runs 100% offline with a local SQLite database, with no telemetry or remote data transmission.
```

### Reputation *
```
AudioPAC is an early-stage clinical project built to fill a real gap in the Spanish-speaking open-source audiology software ecosystem. The DPS and PPS tests are standard procedures taught in university audiology and speech-language pathology programs throughout Latin America, but existing commercial software is expensive (USD $500-2000 per license) and closed-source, limiting adoption in public universities, low-resource healthcare centers, and research projects.

The project is developed with professional standards: full CI/CD on GitHub Actions, strict TypeScript, modular Tauri + React architecture, versioned SQLite migrations, and extensive technical documentation. Source code and documentation are publicly available under the MIT license.

Initial target audience: clinical professionals, audiology/speech-language pathology students, and researchers in Chile and Latin America. Obtaining a code signing certificate is critical for adoption in hospital and institutional environments where IT policies block unsigned executables.

Links:
- Repository: https://github.com/Debaq/audiopac
- Releases: https://github.com/Debaq/audiopac/releases
- Technical documentation: https://github.com/Debaq/audiopac/tree/main/docs
- Privacy policy: https://github.com/Debaq/audiopac/blob/main/PRIVACY.md
```

### Maintainer Type
```
Individual
```
*(or "Informal group" if you collaborate with others)*

### Build System
```
GitHub Actions
```

### First Name *
```
Nicolás
```

### Last Name *
```
Baier Quezada
```

### Email *
```
davil004@gmail.com
```

### Company Name
*(leave empty)*

### Primary Discovery Channel *
```
Recommendation
```

### Please specify the exact source
```
Recommended while researching Windows code signing options for my open source Tauri project
```

### Checkboxes
- ☑ **Code of Conduct** — required
- ☐ I agree to receive other communications — optional
- ☑ **Store and process personal data** — required

## Info needed from you

To generate the final text I need:

1. **First Name** and **Last Name** (real)
2. **Email** for the SignPath account
3. **Company Name** (optional — university, clinical center, or empty)
4. **Primary Discovery Channel** and the specific source

Share those 4 items and I'll give you the final ready-to-paste text.

## After approval

SignPath will set up for you:
- Organization ID
- Project at signpath.io (slug: `audiopac`)
- Signing policy (usually `release-signing`)

Then configure GitHub → Settings → Secrets:
- `SIGNPATH_ORGANIZATION_ID`
- `SIGNPATH_PROJECT_SLUG` = `audiopac`
- `SIGNPATH_SIGNING_POLICY_SLUG` = `release-signing`
- `SIGNPATH_API_TOKEN` (unless they set up OIDC trust relationship)

And activate the workflow:
```bash
mv .github/workflows/release.yml .github/workflows/release-unsigned.yml.disabled
mv .github/workflows/release-signpath.yml.disabled .github/workflows/release.yml
git commit -am "chore: enable SignPath Foundation signing"
git push
```
