# grabby

<div align="center">

![grabby](https://img.shields.io/badge/grabby-5B5BFF?style=for-the-badge)
![Electron](https://img.shields.io/badge/Electron-27-47848F?style=for-the-badge&logo=electron)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)

**Сучасний графічний інтерфейс для yt-dlp з підтримкою 1000+ сервісів**

Завантажуй відео та аудіо з YouTube, Twitch, TikTok та інших платформ через зручний UI

[Завантажити](#встановлення) • [Особливості](#особливості) • [Розробка](#розробка)

</div>

---

## ✨ Особливості

- 🎨 **Сучасний темний UI** — мінімалістичний дизайн з IBM Plex Mono
- 🎬 **Гнучкі налаштування** — вибір якості відео (360p-4K), аудіо (96-320kbps) та форматів
- 🎵 **Режими завантаження** — відео+аудіо, тільки відео, тільки аудіо
- 📝 **Субтитри** — автоматичне завантаження українських та англійських субтитрів
- 🖼️ **Обкладинки** — вбудовування thumbnail у медіафайли
- 📋 **Плейлисти** — підтримка завантаження окремих елементів плейлиста
- ⚡ **Швидкий запуск** — виконання команд безпосередньо з програми
- 🔧 **Генератор команд** — копіювання готових команд для терміналу

## 🖥️ Підтримувані платформи

- ✅ Windows 10/11
- ✅ macOS (потребує збірки)
- ✅ Linux (потребує збірки)

## 📦 Встановлення

### Передумови

Спочатку встанови **yt-dlp**:

**Windows:**
```bash
winget install yt-dlp
```

**macOS:**
```bash
brew install yt-dlp
```

**Linux / pip:**
```bash
pip install -U yt-dlp
```

### Завантаження програми

1. Завантаж останню версію з [Releases](../../releases)
2. Запусти інсталятор
3. Готово! Програма автоматично визначить встановлений yt-dlp

## 🚀 Використання

1. **Вставте URL** — посилання на відео або плейлист
2. **Оберіть режим** — відео+аудіо, тільки відео або тільки аудіо
3. **Налаштуйте якість** — виберіть бажану якість та формат
4. **Додаткові опції** — субтитри, обкладинки, елементи плейлиста
5. **Запустіть** — натисніть "Запустити" або скопіюйте команду

### Приклади команд

**Завантажити відео 1080p у форматі MP4:**
```bash
yt-dlp -f "bestvideo[height<=1080][ext=mp4]+bestaudio/best[abr<=192]/bestvideo[height<=1080]+bestaudio" --merge-output-format mp4 -o "Downloads/%(title)s.%(ext)s" "URL"
```

**Витягнути аудіо у MP3 320kbps:**
```bash
yt-dlp -x --audio-format mp3 --audio-quality 320k -o "Downloads/%(title)s.%(ext)s" "URL"
```

## 🛠️ Розробка

### Встановлення залежностей

```bash
npm install
```

### Запуск у режимі розробки

```bash
npm run electron-dev
```

Це запустить React dev server та Electron одночасно з hot reload.

### Збірка

**Windows:**
```bash
npm run dist-win
```

**macOS:**
```bash
npm run dist-mac
```

Готові файли будуть у папці `dist/`.

## 📁 Структура проєкту

```
yt-dlp-app/
├── electron/          # Electron main process
│   ├── main.js       # Головний процес
│   └── preload.js    # Preload скрипт
├── src/              # React додаток
│   ├── App.jsx       # Головний компонент
│   └── index.js      # Entry point
├── public/           # Статичні файли
└── package.json      # Конфігурація проєкту
```

## 🎨 Технології

- **Frontend:** React 18, CSS-in-JS
- **Desktop:** Electron 27
- **Build:** electron-builder
- **Fonts:** IBM Plex Mono, Space Grotesk

## 🤝 Внесок

Contributions are welcome! Відкривай issues або pull requests.

1. Fork проєкт
2. Створи feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit зміни (`git commit -m 'Add some AmazingFeature'`)
4. Push у branch (`git push origin feature/AmazingFeature`)
5. Відкрий Pull Request

## 📄 Ліцензія

MIT License - дивись [LICENSE](LICENSE)

## 🙏 Подяки

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) — потужний інструмент завантаження відео
- [Electron](https://www.electronjs.org/) — фреймворк для десктопних застосунків
- [React](https://react.dev/) — бібліотека для UI

---

<div align="center">

**Зроблено з ❤️ за допомогою AI**

[⬆ Повернутися до початку](#yt-dlp-builder)

</div>
