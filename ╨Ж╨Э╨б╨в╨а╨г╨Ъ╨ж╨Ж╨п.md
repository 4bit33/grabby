# 📦 yt-dlp Builder — Інструкція встановлення

## Що тобі потрібно встановити (один раз)

### 1. Node.js
Перейди на https://nodejs.org і завантаж версію **LTS** (зелена кнопка).
Встанови як звичайну програму → Next → Next → Finish.

**Перевірка:** відкрий `cmd` (Win+R → введи `cmd` → Enter) і напиши:
```
node --version
```
Має показати щось типу `v20.11.0` — все ок!

---

## 🖥️ Windows — зібрати .EXE

### Крок 1 — Відкрий папку з проєктом
Розпакуй `yt-dlp-app.zip` в будь-яке місце (напр. `C:\yt-dlp-app`)

### Крок 2 — Відкрий термінал у цій папці
- Зайди у папку в Провіднику
- Клікни на адресний рядок вгорі, напиши `cmd` і натисни Enter

### Крок 3 — Встанови залежності
```
npm install
```
⏳ Зачекай 2-3 хвилини (завантажує потрібні бібліотеки)

### Крок 4 — Збери .EXE
```
npm run dist-win
```
⏳ Зачекай 3-5 хвилин

### Крок 5 — Знайди свій .exe
Відкрий папку `dist\` — там буде файл `yt-dlp Builder Setup X.X.X.exe`

🎉 **Встанови його та користуйся!**

---

## 🤖 Android — зібрати .APK

Android вимагає трохи більше кроків.

### Крок 1 — Встанови Java (JDK 17)
Перейди на https://adoptium.net і завантаж **JDK 17 LTS** для Windows.
Встанови як звичайну програму.

### Крок 2 — Встанови Android Studio
Перейди на https://developer.android.com/studio і завантаж Android Studio.
При встановленні обери **Standard** та встанови всі компоненти.

> ⚠️ Android Studio важкий (~4GB) але потрібен лише один раз

### Крок 3 — Встанови Capacitor
У папці проєкту відкрий cmd і виконай:
```
npm install
npm run build
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "yt-dlp Builder" "com.ytdlp.builder"
npx cap add android
npx cap sync
```

### Крок 4 — Відкрий у Android Studio
```
npx cap open android
```

### Крок 5 — Збери APK
У Android Studio:
- Меню **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
- Зачекай 2-5 хвилин
- Натисни **locate** у повідомленні знизу

APK буде в папці: `android\app\build\outputs\apk\debug\app-debug.apk`

📱 **Перенеси на телефон і встанови!**
> (На телефоні потрібно увімкнути "Дозволити встановлення з невідомих джерел" у налаштуваннях)

---

## ❓ Частi проблеми

### "npm не знайдено"
→ Перевстанови Node.js і перезапусти cmd

### "JAVA_HOME не знайдено" (при збірці APK)
→ Перевстанови JDK і перезапусти комп'ютер

### Антивірус блокує .exe
→ Це нормально для зібраних Electron-застосунків. Додай у виключення.

---

## 🎯 Також не забудь встановити yt-dlp!

Без нього застосунок буде генерувати команди але не зможе їх виконати.

**Windows:**
```
winget install yt-dlp
```
або завантаж `yt-dlp.exe` з https://github.com/yt-dlp/yt-dlp/releases і поклади у `C:\Windows\System32\`

**Android:**
На телефоні застосунок генерує команди — скопіюй та використай у Termux або схожому терміналі.

---

Зроблено з ❤️ | yt-dlp Builder v1.0.0
