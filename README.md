# grabby

<div align="center">

![grabby](https://img.shields.io/badge/grabby-5B5BFF?style=for-the-badge)
![Electron](https://img.shields.io/badge/Electron-27-47848F?style=for-the-badge&logo=electron)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)

**Modern GUI for yt-dlp with support for 1000+ services**

Download videos and audio from YouTube, Twitch, TikTok and other platforms with a sleek UI

[English](#english) • [Українська](#українська)

</div>

---

## English

### ✨ Features

- 🎨 **Modern Dark UI** — Minimalist design with IBM Plex Mono
- 🎬 **Flexible Settings** — Choose video quality (360p-4K), audio (96-320kbps) and formats
- 🎵 **Download Modes** — Video+audio, video only, or audio only
- 📝 **Subtitles** — Auto-download Ukrainian and English subtitles
- 🖼️ **Thumbnails** — Embed thumbnails into media files
- 📋 **Playlists** — Support for downloading specific playlist items
- ⚡ **Quick Launch** — Execute commands directly from the app
- 🔧 **Command Generator** — Copy ready-to-use terminal commands
- 💾 **Settings Persistence** — Your preferences are saved automatically

### 🖥️ Supported Platforms

- ✅ Windows 10/11
- ✅ macOS (requires build)
- ✅ Linux (requires build)

### 📦 Installation

#### Prerequisites

First, install **yt-dlp**:

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

#### Download the App

1. Download the latest version from [Releases](../../releases)
2. Run the installer
3. Done! The app will automatically detect installed yt-dlp

### 🚀 Usage

1. **Paste URL** — Link to video or playlist
2. **Choose mode** — Video+audio, video only, or audio only
3. **Set quality** — Select desired quality and format
4. **Additional options** — Subtitles, thumbnails, playlist items
5. **Run** — Click "Run" or copy the command

#### Command Examples

**Download 1080p video in MP4:**
```bash
yt-dlp -f "bestvideo[height<=1080][ext=mp4]+bestaudio/best[abr<=192]/bestvideo[height<=1080]+bestaudio" --merge-output-format mp4 -o "Downloads/%(title)s.%(ext)s" "URL"
```

**Extract audio to MP3 320kbps:**
```bash
yt-dlp -x --audio-format mp3 --audio-quality 320k -o "Downloads/%(title)s.%(ext)s" "URL"
```

### 🛠️ Development

#### Install Dependencies

```bash
npm install
```

#### Run in Development Mode

```bash
npm run electron-dev
```

This will start React dev server and Electron simultaneously with hot reload.

#### Build

**Windows:**
```bash
npm run dist-win
```

**macOS:**
```bash
npm run dist-mac
```

Built files will be in the `dist/` folder.

### 📁 Project Structure

```
grabby/
├── electron/          # Electron main process
│   ├── main.js       # Main process
│   └── preload.js    # Preload script
├── src/              # React app
│   ├── App.jsx       # Main component
│   ├── App.css       # Styles
│   └── index.js      # Entry point
├── public/           # Static files
└── package.json      # Project config
```

### 🎨 Technologies

- **Frontend:** React 18, CSS
- **Desktop:** Electron 27
- **Build:** electron-builder
- **Fonts:** IBM Plex Mono, Space Grotesk

### 🤝 Contributing

Contributions are welcome! Open issues or pull requests.

1. Fork the project
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

### 📄 License

MIT License - see [LICENSE](LICENSE)

### 🙏 Acknowledgments

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) — Powerful video download tool
- [Electron](https://www.electronjs.org/) — Desktop app framework
- [React](https://react.dev/) — UI library

---

## Українська

### ✨ Особливості

- 🎨 **Сучасний темний UI** — Мінімалістичний дизайн з IBM Plex Mono
- 🎬 **Гнучкі налаштування** — Вибір якості відео (360p-4K), аудіо (96-320kbps) та форматів
- 🎵 **Режими завантаження** — Відео+аудіо, тільки відео, тільки аудіо
- 📝 **Субтитри** — Автоматичне завантаження українських та англійських субтитрів
- 🖼️ **Обкладинки** — Вбудовування thumbnail у медіафайли
- 📋 **Плейлисти** — Підтримка завантаження окремих елементів плейлиста
- ⚡ **Швидкий запуск** — Виконання команд безпосередньо з програми
- 🔧 **Генератор команд** — Копіювання готових команд для терміналу
- 💾 **Збереження налаштувань** — Ваші налаштування зберігаються автоматично

### 🖥️ Підтримувані платформи

- ✅ Windows 10/11
- ✅ macOS (потребує збірки)
- ✅ Linux (потребує збірки)

### 📦 Встановлення

#### Передумови

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

#### Завантаження програми

1. Завантаж останню версію з [Releases](../../releases)
2. Запусти інсталятор
3. Готово! Програма автоматично визначить встановлений yt-dlp

### 🚀 Використання

1. **Вставте URL** — Посилання на відео або плейлист
2. **Оберіть режим** — Відео+аудіо, тільки відео або тільки аудіо
3. **Налаштуйте якість** — Виберіть бажану якість та формат
4. **Додаткові опції** — Субтитри, обкладинки, елементи плейлиста
5. **Запустіть** — Натисніть "Запустити" або скопіюйте команду

#### Приклади команд

**Завантажити відео 1080p у форматі MP4:**
```bash
yt-dlp -f "bestvideo[height<=1080][ext=mp4]+bestaudio/best[abr<=192]/bestvideo[height<=1080]+bestaudio" --merge-output-format mp4 -o "Downloads/%(title)s.%(ext)s" "URL"
```

**Витягнути аудіо у MP3 320kbps:**
```bash
yt-dlp -x --audio-format mp3 --audio-quality 320k -o "Downloads/%(title)s.%(ext)s" "URL"
```

### 🛠️ Розробка

#### Встановлення залежностей

```bash
npm install
```

#### Запуск у режимі розробки

```bash
npm run electron-dev
```

Це запустить React dev server та Electron одночасно з hot reload.

#### Збірка

**Windows:**
```bash
npm run dist-win
```

**macOS:**
```bash
npm run dist-mac
```

Готові файли будуть у папці `dist/`.

### 📁 Структура проєкту

```
grabby/
├── electron/          # Electron main process
│   ├── main.js       # Головний процес
│   └── preload.js    # Preload скрипт
├── src/              # React додаток
│   ├── App.jsx       # Головний компонент
│   ├── App.css       # Стилі
│   └── index.js      # Entry point
├── public/           # Статичні файли
└── package.json      # Конфігурація проєкту
```

### 🎨 Технології

- **Frontend:** React 18, CSS
- **Desktop:** Electron 27
- **Build:** electron-builder
- **Fonts:** IBM Plex Mono, Space Grotesk

### 🤝 Внесок

Contributions are welcome! Відкривай issues або pull requests.

1. Fork проєкт
2. Створи feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit зміни (`git commit -m 'Add some AmazingFeature'`)
4. Push у branch (`git push origin feature/AmazingFeature`)
5. Відкрий Pull Request

### 📄 Ліцензія

MIT License - дивись [LICENSE](LICENSE)

### 🙏 Подяки

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) — Потужний інструмент завантаження відео
- [Electron](https://www.electronjs.org/) — Фреймворк для десктопних застосунків
- [React](https://react.dev/) — Бібліотека для UI

---

<div align="center">

**Made with ❤️ using AI**

**Зроблено з ❤️ за допомогою AI**

[⬆ Back to top](#grabby) • [⬆ Повернутися до початку](#grabby)

</div>
