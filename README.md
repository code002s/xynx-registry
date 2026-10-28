# xynx — бесплатные поддомены (.surf, .pro, .dev)

Получи бесплатный поддомен вида `name.xynx.surf`, `name.xynx.pro` или `name.xynx.dev` для своего сайта или проекта.
Регистрация идёт через Pull Request: проверка автоматическая, DNS создаётся сам после merge.

## Как получить поддомен

1. Сделай fork этого репозитория.
2. Создай файл `domains/<name>.json` (имя файла = твой поддомен).
3. Открой Pull Request. Бот проверит файл.
4. После merge записи появятся в Cloudflare за пару минут.

### Пример `domains/xynx.surf/myname.json`

```json
{
  "owner": { "username": "my-github-username", "email": "me@example.com" },
  "description": "Мой сайт",
  "records": [
    { "type": "CNAME", "name": "@", "value": "my-github-username.github.io", "proxied": true }
  ]
}
```

Результат: `myname.xynx.surf` указывает на `my-github-username.github.io`.
Запись с `"name": "docs"` даст `docs.myname.xynx.surf`.

### Поля

| Поле | Описание |
|------|----------|
| `owner.username` | Твой GitHub-логин. Должен совпадать с автором PR. |
| `owner.email` | Контакт (необязательно). |
| `records[].type` | `A`, `AAAA`, `CNAME` или `TXT`. |
| `records[].name` | `@` (сам поддомен) или одна метка, например `www`. |
| `records[].value` | IP, имя хоста или текст для TXT. |
| `records[].proxied` | Прокси Cloudflare. По умолчанию `true` (для A/AAAA/CNAME). |

## Правила

- Имя: 2–30 символов, `a-z`, `0-9` и `-`, без дефиса в начале и конце.
- До 10 записей на поддомен. Один человек: до 3 поддоменов.
- CNAME нельзя ставить рядом с A/AAAA на одном имени.
- Не допускаются: приватные IP, CNAME внутрь зоны регистрации, зарезервированные имена (`reserved.json`).
- Запрещены фишинг, малварь, спам, нелегальный контент, выдача себя за чужой бренд, раздача доступа к чужим сервисам. Такие поддомены удаляются без предупреждения.
- Поддомен, который 90+ дней ведёт на несуществующий сервис, может быть освобождён.

## Деплой сайта (GitHub Pages)

Сайт — один статический файл `site/index.html`, сборка не нужна. Workflow
`.github/workflows/pages.yml` публикует папку `site/` и на лету подставляет
`owner/repo` вместо плейсхолдера `YOUR-GITHUB-USERNAME/xynx-registry`.

1. Запушь проект в репозиторий на GitHub в ветку `main`.
2. Settings → Pages → Build and deployment → Source: **GitHub Actions**.
   Можно не делать это вручную: при первом запуске workflow включит Pages сам.
3. Actions → **Deploy site** → Run workflow.
4. Через минуту страница откроется на `https://<user>.github.io/<repo>/`.

Дальше каждый push в `site/` переопубликует страницу автоматически.

### Свой домен

- Settings → Pages → Custom domain → `xynx.surf`, затем включи Enforce HTTPS.
- В Cloudflare для apex `xynx.surf` добавь A-записи на `185.199.108.153`,
  `185.199.109.153`, `185.199.110.153`, `185.199.111.153`. Оранжевое облако
  можно оставить: сертификат выдаст GitHub Pages, проксировать будет Cloudflare.
- `scripts/sync.js` трогает только записи с комментарием `xynx-registry:`,
  поэтому apex, почта и остальные записи зоны не пострадают.

### Локальный предпросмотр

```
npm run serve        # http://127.0.0.1:8080
```

Пока в `site/index.html` стоит плейсхолдер, проверка имён работает в
демо-режиме. Чтобы проверить по-настоящему, открой
`http://127.0.0.1:8080/?repo=user/repo` — страница будет читать `reserved.json`
и `domains/` из указанного репозитория.

## Для владельца репозитория (настройка)

1. Купи `xynx.surf`, `xynx.pro`, `xynx.dev` и добавь все три зоны в Cloudflare.
2. Создай ОДИН API-токен: Cloudflare → My Profile → API Tokens → Create Token → «Edit zone DNS», в Zone Resources выбери **Include → Specific zone** и добавь все три зоны.
3. Возьми ID каждой зоны (Cloudflare → Overview зоны, правая колонка).
4. В GitHub → Settings → Secrets and variables → Actions добавь секреты:
   - `CF_API_TOKEN` — токен из шага 2
   - `CF_ZONES` — JSON с ID зон:
     `{"xynx.surf":"ID1","xynx.pro":"ID2","xynx.dev":"ID3"}`
5. Settings → Branches: защита `main`, обязательный workflow `Validate domains` и review.
6. Проверка локально:
   ```
   node scripts/validate.js
   CF_API_TOKEN=... CF_ZONES='{"xynx.surf":"ID1","xynx.pro":"ID2","xynx.dev":"ID3"}' node scripts/sync.js --dry-run
   ```

### Как добавить ещё одну зону
1. Добавь её в `zones.json` и создай папку `domains/<зона>/` с пустым `.gitkeep`.
2. Добавь ID зоны в секрет `CF_ZONES` и зону в токен Cloudflare.
3. Добавь её в список `ZONES` в `site/index.html`.

Синхронизация трогает только записи с комментарием `xynx-registry:*`, остальные записи зон (apex, почта и т.д.) она не меняет и не удаляет.
Пока секреты Cloudflare не заданы, workflow «Sync DNS» пропускает синхронизацию с предупреждением; если файлы доменов уже есть, он падает с ошибкой, чтобы поддомен не остался без DNS.

## Лицензия

MIT
