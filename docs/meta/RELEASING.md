# Release Guide / Гайд по релизу

## English

1. Update version in `CorgPhish/manifest.json`.
2. Update `CHANGELOG.md` with the new version.
3. Commit changes and create a tag:
   - `git tag vX.Y.Z`
4. Push commits and tags:
   - `git push`
   - `git push --tags`
5. GitHub Actions will build `dist/corgphish-release-vX.Y.Z.zip` and create a GitHub Release.

## Русский

1. Обновите версию в `CorgPhish/manifest.json`.
2. Обновите `CHANGELOG.md` новой версией.
3. Сделайте коммит и создайте тег:
   - `git tag vX.Y.Z`
4. Запушьте коммиты и теги:
   - `git push`
   - `git push --tags`
5. GitHub Actions соберёт `dist/corgphish-release-vX.Y.Z.zip` и создаст GitHub Release.
