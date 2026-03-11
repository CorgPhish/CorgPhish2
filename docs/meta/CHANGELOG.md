# Changelog / История изменений

All notable changes to this project will be documented in this file.
Все значимые изменения проекта фиксируются здесь.

## [Unreleased] / [В разработке]
- Added a dedicated testing documentation pack with unit, integration, and user testing summaries.
- Added executable `node:test` unit tests, integration runner, coverage script, and testing helpers.

## [2.2.3]
- Restored the previous popup layout while keeping clearer action buttons for risky pages.
- Fixed form/download blocking on untrusted pages when the block-input setting is enabled.
- Split the content script into source modules and added automatic `content.js` build in verify/package scripts.
- Added repository navigation, contributing, and security documentation.

## [2.2.2]
- Added Anti-scam banner mode with social-engineering text detection on page content.
- Added settings toggle to enable/disable Anti-scam banners.

## [2.2.1]
- Added phishing report action in popup with Safe Browsing report link.
- Added phishing report button on blocked page.
- Report details are copied to clipboard before opening report form.

## [2.2.0]
- Added pre-click link inspection to block phishing URLs before navigation.
- Added redirect-chain analysis for nested `url/redirect/next/...` parameters.
- Added sensitive-data guard warnings on risky pages when users type/paste credentials.

## [2.1.4]
- Added toggle for link highlighting in settings.
- Updated suspicious link highlight color to avoid confusion with phishing alerts.

## [2.1.3]
- Use domain fallback URL for ML when full URL is unavailable.

## [2.1.2]
- Ensure link scan runs even when main inspection fails.
- Updated beta demo page phishing link.

## [2.1.1]
- Highlight risky links on page before click.

## [2.1.0]
- Added content-based phishing scorer (forms + text signals).

## [2.0.9]
- Replace blocking overlay with redirect to a dedicated blocked page.

## [2.0.8]
- Fixed ONNX model input types (float32) to restore ML inference.

## [2.0.7]
- Skip local ORT when background returns fallback; disable ORT after type mismatch errors.

## [2.0.6]
- Fixed ORT session creation by removing forced float32 outputs.

## [2.0.5]
- Lowered heuristic threshold for stronger fallback detection.

## [2.0.4]
- Retry ML locally when background returns heuristic fallback.
- Escalate spoofed domains and risky forms to phishing.
- Phishing hint now describes signals instead of ML-only wording.

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
