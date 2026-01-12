# Changelog / История изменений

All notable changes to this project will be documented in this file.
Все значимые изменения проекта фиксируются здесь.

## [Unreleased] / [В разработке]

## [2.0.3]
- Simplified suspicious title for non-list detections.

## [2.0.2]
- ML verdicts no longer mark unlisted sites as trusted.
- Added fallback ML warning and clearer suspicious hints.

## [2.0.1]
- Fixed active tab URL fallback using content script signals.

## [2.0.0]
- Simplified README and updated project structure notes.
- Expanded trusted domain list for banks, marketplaces, and government services.
- Cleaned docs assets and streamlined release packaging.

## [1.1.3]
- Hardened trusted/whitelist validation to prevent broad domain matches.
- Trusted UI now shows whether the match came from trusted.json, whitelist, or ML.
- Improved similarity matching for spoofed domains.

## [1.1.2]
- Added CI/CD build and release workflows for automatic packaging.
- Added local release scripts and release guide documentation.

## [1.1.1]
- Removed corporate policy UI and logic from the consumer build (moved to corporate edition).

## [1.1.0]
- Corporate policy mode with allow/deny lists and warn/block reactions.
- Corporate policy signals integrated into inspection and blocking.
- Bilingual GitHub documentation, badges, and visuals.

## [1.0.0]
- Initial offline anti‑phishing extension release.
