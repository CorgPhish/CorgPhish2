# Release Guide

## Что уже настроено

В репозитории есть два workflow:

- `.github/workflows/build.yml` — сборка и проверка на `push`, `pull_request`, `workflow_dispatch`
- `.github/workflows/release.yml` — выпуск релиза по тегу `vX.Y.Z`

Оба workflow делают:

1. `checkout`
2. `actions/setup-node`
3. `npm ci`
4. `npm test`
5. `./scripts/verify.sh`
6. `./scripts/package.sh`

`release.yml` после этого автоматически создаёт GitHub Release и прикладывает ZIP-архив.

## Что должно быть включено в GitHub

Проверьте настройки репозитория:

1. `Settings -> General -> Default branch -> main`
2. `Settings -> Actions -> General -> Allow all actions and reusable workflows`
3. `Settings -> Actions -> General -> Workflow permissions -> Read and write permissions`

Без `Read and write permissions` workflow релиза не сможет опубликовать release.

## Локальная подготовка релиза

Перед тегом обязательно выполните:

```bash
./scripts/build-content.sh
npm test
./scripts/verify.sh
./scripts/package.sh
```

Проверьте, что:

- версия в `apps/extension/manifest.json` актуальна;
- `docs/meta/CHANGELOG.md` обновлён;
- в `dist/` собрался свежий архив.

## Как выпустить новую версию

1. Обновите `version` в `apps/extension/manifest.json`
2. Обновите `docs/meta/CHANGELOG.md`
3. Закоммитьте изменения
4. Создайте тег:

```bash
git tag vX.Y.Z
```

5. Отправьте код и тег:

```bash
git push
git push --tags
```

6. Дождитесь выполнения workflow `Release Extension`

## Что публикуется

Workflow собирает:

- `dist/corgphish-release-vX.Y.Z.zip`

Этот архив прикрепляется к GitHub Release автоматически.

## Что делать, если релиз не вышел

1. Откройте вкладку `Actions`
2. Найдите workflow `Release Extension`
3. Проверьте шаги:
   - `Install dependencies`
   - `Run tests`
   - `Verify tag matches manifest`
   - `Package extension`
   - `Create GitHub release`

Наиболее частые причины сбоя:

- тег не совпадает с `manifest.json`;
- не обновлён `CHANGELOG`;
- не проходят тесты;
- у workflow нет прав на запись релизов.
