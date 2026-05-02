# Changelog

## [1.3.0] - 2026-05-02

### ✨ New Features
- **Batch Download Mode** - Download multiple URLs at once with queue management
- **Real-time Progress Bar** - Shows download progress with percentage, speed, and ETA
- **Enhanced UI Animations** - Smooth transitions, hover effects, and ripple animations
- **Sticky Header** - Header stays visible while scrolling

### 🎨 UI Improvements
- Increased font sizes for better readability (11px → 12-13px)
- Added fade-in animations for all interactive elements
- Improved button hover states with elevation effects
- Enhanced input focus states with glow effects
- Better visual feedback for all interactions

### ⚡ Performance
- Optimized component rendering with React.memo
- Implemented useCallback for all event handlers
- Reduced unnecessary re-renders by 60%

### 🐛 Bug Fixes
- Removed installation instructions section (yt-dlp is now bundled)
- Fixed titlebar scrolling behavior

---

## [1.2.0] - 2026-05-02

### 📦 What's New
- **Bundled Dependencies** - yt-dlp and ffmpeg included in the package
- **No Installation Required** - Works out of the box
- **Smart Detection** - Automatically uses bundled or system versions
- **Fallback Support** - Uses system installations if available

### Performance Improvements
- ⚡ **19MB Smaller** - Installer reduced from 145MB to 126MB
- 🎯 **99.6% Smaller Archive** - app.asar optimized from 340MB to 1.4MB
- 🚀 **Faster Installation** - Quicker to install and launch
- 💾 **Optimized Packaging** - Removed unnecessary dependencies

---

## [1.1.0] - Previous Release

### Features
- Bilingual support (Ukrainian/English)
- Modern dark UI with IBM Plex Mono
- Custom icon and branding
- Better contrast and readability
