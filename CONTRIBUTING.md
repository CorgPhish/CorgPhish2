# Contributing / Вклад

Thanks for your interest in CorgPhish! Below are concise guidelines for contributions.
Спасибо за интерес к CorgPhish! Ниже — краткие правила для контрибьюторов.

## Workflow / Процесс работы
- Fork the repo and create a feature branch.
- Keep changes focused and well‑scoped.
- Update docs and translations when adding user‑visible features.

- Форкните репозиторий и создайте feature‑ветку.
- Делайте изменения точечно и по делу.
- Обновляйте документацию и переводы для пользовательских изменений.

## Development / Разработка
- Load the extension from the `CorgPhish/` folder via `chrome://extensions`.
- Reload the extension after code changes.
- Use the popup and content script logs for debugging.

- Загружайте расширение из папки `CorgPhish/` через `chrome://extensions`.
- После изменений перезагружайте расширение.
- Используйте логи попапа и контент‑скрипта для отладки.

## Code style / Стиль кода
- Follow existing patterns and naming.
- Prefer small functions and readable state handling.
- Avoid introducing heavy dependencies.

- Следуйте текущим паттернам и неймингу.
- Дробите сложную логику на небольшие функции.
- Не добавляйте тяжёлые зависимости без необходимости.

## Localization / Локализация
- All UI text lives in `CorgPhish/popup/config.js`.
- Keep RU and EN keys in sync.

- Весь UI‑текст находится в `CorgPhish/popup/config.js`.
- Синхронизируйте ключи RU и EN.

## Commits / Коммиты
- Use short, descriptive commit messages (e.g., `feat: add enterprise policy`).
- Avoid committing build artifacts unless explicitly requested.

- Используйте короткие, понятные сообщения коммитов.
- Не коммитьте артефакты сборки без необходимости.

## Issues / Задачи
- Provide repro steps, expected/actual behavior, and screenshots when possible.

- Указывайте шаги воспроизведения, ожидаемое/фактическое поведение и скриншоты при возможности.
