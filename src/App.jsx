import { useState, useEffect, useMemo, useCallback } from "react";
import "./App.css";
import { translations } from "./translations";
import { parseError } from "./errorParser";
import { ProgressBar, QualityChip, FormatPill, FormatCard, ToggleSwitch, QueueItem } from "./components";

const isElectron = typeof window !== 'undefined' && window.electronAPI;

const STORAGE_KEY = "grabby_settings";

const QUALITY_OPTIONS = {
  video: [
    { value: "2160", labelKey: "quality4K", icon: "◈" },
    { value: "1440", labelKey: "quality1440p", icon: "◇" },
    { value: "1080", labelKey: "quality1080p", icon: "◆" },
    { value: "720", labelKey: "quality720p", icon: "▸" },
    { value: "480", labelKey: "quality480p", icon: "▹" },
    { value: "360", labelKey: "quality360p", icon: "▫" },
    { value: "best", labelKey: "qualityBest", icon: "★" },
  ],
  audio: [
    { value: "320", label: "320 kbps", icon: "◈" },
    { value: "256", label: "256 kbps", icon: "◇" },
    { value: "192", label: "192 kbps", icon: "◆" },
    { value: "128", label: "128 kbps", icon: "▸" },
    { value: "96", label: "96 kbps", icon: "▹" },
    { value: "best", labelKey: "qualityBest", icon: "★" },
  ],
};

const FORMAT_OPTIONS = [
  { id: "video_audio", labelKey: "formatVideoAudio", descKey: "formatVideoAudioDesc" },
  { id: "video_only", labelKey: "formatVideoOnly", descKey: "formatVideoOnlyDesc" },
  { id: "audio_only", labelKey: "formatAudioOnly", descKey: "formatAudioOnlyDesc" },
];

const VIDEO_FORMATS = ["mp4", "mkv", "webm", "avi", "mov"];
const AUDIO_FORMATS = ["mp3", "m4a", "opus", "flac", "wav"];

function validateURL(url, t) {
  if (!url || !url.trim()) return { valid: false, error: "" };

  try {
    const urlObj = new URL(url);
    const validProtocols = ['http:', 'https:'];
    if (!validProtocols.includes(urlObj.protocol)) {
      return { valid: false, error: t.errorInvalidProtocol };
    }
    return { valid: true, error: "" };
  } catch {
    return { valid: false, error: t.errorInvalidUrl };
  }
}

function buildCommand(state) {
  const { url, mode, videoQuality, audioQuality, videoFormat, audioFormat, outputPath, subtitles, thumbnail, playlistItems } = state;
  if (!url.trim()) return "";
  let cmd = "yt-dlp";
  if (mode === "audio_only") {
    cmd += " -x";
    cmd += ` --audio-format ${audioFormat}`;
    if (audioQuality !== "best") cmd += ` --audio-quality ${audioQuality}k`;
  } else if (mode === "video_only") {
    cmd += videoQuality === "best"
      ? ` -f "bestvideo[ext=${videoFormat}]/bestvideo"`
      : ` -f "bestvideo[height<=${videoQuality}][ext=${videoFormat}]/bestvideo[height<=${videoQuality}]"`;
    cmd += ` --remux-video ${videoFormat}`;
  } else {
    cmd += videoQuality === "best"
      ? ` -f "bestvideo[ext=${videoFormat}]+bestaudio/best"`
      : ` -f "bestvideo[height<=${videoQuality}][ext=${videoFormat}]+bestaudio/best[abr<=${audioQuality}]/bestvideo[height<=${videoQuality}]+bestaudio"`;
    cmd += ` --merge-output-format ${videoFormat}`;
  }
  if (subtitles) cmd += " --write-subs --sub-langs uk,en";
  if (thumbnail) cmd += " --embed-thumbnail";
  if (playlistItems) cmd += ` --playlist-items ${playlistItems}`;
  const outPath = outputPath || (isElectron ? "%USERPROFILE%\\Downloads" : "~/Downloads");
  cmd += ` -o "${outPath}/%(title)s.%(ext)s"`;
  cmd += ` "${url}"`;
  return cmd;
}

function loadSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error("Failed to save settings:", e);
  }
}

export default function App() {
  const savedSettings = loadSettings();

  const [language, setLanguage] = useState(savedSettings.language || "uk");
  const t = translations[language];

  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState("");
  const [mode, setMode] = useState(savedSettings.mode || "video_audio");
  const [videoQuality, setVideoQuality] = useState(savedSettings.videoQuality || "1080");
  const [audioQuality, setAudioQuality] = useState(savedSettings.audioQuality || "192");
  const [videoFormat, setVideoFormat] = useState(savedSettings.videoFormat || "mp4");
  const [audioFormat, setAudioFormat] = useState(savedSettings.audioFormat || "mp3");
  const [subtitles, setSubtitles] = useState(savedSettings.subtitles || false);
  const [thumbnail, setThumbnail] = useState(savedSettings.thumbnail || false);
  const [playlistItems, setPlaylistItems] = useState("");
  const [outputPath, setOutputPath] = useState(savedSettings.outputPath || "");
  const [copied, setCopied] = useState(false);
  const [ytdlpStatus, setYtdlpStatus] = useState(null);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState("");
  const [showOutput, setShowOutput] = useState(false);

  // Batch download state
  const [batchMode, setBatchMode] = useState(false);
  const [batchUrls, setBatchUrls] = useState("");
  const [queue, setQueue] = useState([]);
  const [currentDownload, setCurrentDownload] = useState(null);

  // Progress state
  const [progress, setProgress] = useState({
    percent: 0,
    size: null,
    speed: null,
    eta: null
  });

  const state = { url, mode, videoQuality, audioQuality, videoFormat, audioFormat, subtitles, thumbnail, playlistItems, outputPath };

  const command = useMemo(() => buildCommand(state), [url, mode, videoQuality, audioQuality, videoFormat, audioFormat, subtitles, thumbnail, playlistItems, outputPath]);
  const isAudio = mode === "audio_only";
  const isVideoOnly = mode === "video_only";

  useEffect(() => {
    if (isElectron) {
      window.electronAPI.checkYtDlp().then(res => setYtdlpStatus(res));

      // Listen for download progress
      window.electronAPI.onDownloadProgress((data) => {
        setProgress(data);
      });

      return () => {
        window.electronAPI.removeDownloadProgressListener();
      };
    }
  }, []);

  useEffect(() => {
    saveSettings({ language, mode, videoQuality, audioQuality, videoFormat, audioFormat, subtitles, thumbnail, outputPath });
  }, [language, mode, videoQuality, audioQuality, videoFormat, audioFormat, subtitles, thumbnail, outputPath]);

  const handleUrlChange = useCallback((e) => {
    const newUrl = e.target.value;
    setUrl(newUrl);

    if (newUrl.trim()) {
      const validation = validateURL(newUrl, t);
      setUrlError(validation.error);
    } else {
      setUrlError("");
    }
  }, [t]);

  const copyCommand = useCallback(() => {
    if (command) {
      navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [command]);

  const runDownload = useCallback(async () => {
    if (!command || !isElectron) return;

    const validation = validateURL(url, t);
    if (!validation.valid) {
      setUrlError(validation.error);
      return;
    }

    setRunning(true);
    setShowOutput(true);
    setOutput(t.outputStarted);
    setProgress({ percent: 0, size: null, speed: null, eta: null });

    const result = await window.electronAPI.runCommand(command);

    if (!result.success && result.output) {
      // Parse error and show user-friendly message
      const parsedError = parseError(result.output, language);

      if (parsedError.found) {
        setOutput(`❌ ${parsedError.title}\n\n${parsedError.message}\n\n💡 ${parsedError.solution}\n\n--- Original Error ---\n${parsedError.original}`);
      } else {
        setOutput(result.output || t.outputError);
      }
    } else {
      setOutput(result.output || (result.success ? t.outputSuccess : t.outputError));
    }

    setRunning(false);
    setProgress({ percent: 100, size: null, speed: null, eta: null });
  }, [command, url, t, language]);

  // Batch download functions
  const addToQueue = useCallback(() => {
    if (!batchUrls.trim()) return;

    const urls = batchUrls.split('\n').filter(u => u.trim());
    const newItems = urls.map((url, idx) => ({
      id: Date.now() + idx,
      url: url.trim(),
      status: 'pending', // pending, downloading, completed, error
      progress: 0,
      output: '',
    }));

    setQueue(prev => [...prev, ...newItems]);
    setBatchUrls("");
  }, [batchUrls]);

  const removeFromQueue = useCallback((id) => {
    setQueue(prev => prev.filter(item => item.id !== id));
  }, []);

  const startBatchDownload = useCallback(async () => {
    if (queue.length === 0 || running) return;

    setRunning(true);

    for (const item of queue) {
      if (item.status !== 'pending') continue;

      setCurrentDownload(item.id);
      setQueue(prev => prev.map(q =>
        q.id === item.id ? { ...q, status: 'downloading' } : q
      ));

      const itemState = { ...state, url: item.url };
      const cmd = buildCommand(itemState);

      const result = await window.electronAPI.runCommand(cmd);

      setQueue(prev => prev.map(q =>
        q.id === item.id ? {
          ...q,
          status: result.success ? 'completed' : 'error',
          output: result.output || (result.success ? t.outputSuccess : t.outputError)
        } : q
      ));
    }

    setRunning(false);
    setCurrentDownload(null);
  }, [queue, running, state, t]);

  const clearCompleted = useCallback(() => {
    setQueue(prev => prev.filter(item => item.status !== 'completed'));
  }, []);

  const isValidUrl = url.trim() && !urlError;

  return (
    <div style={{ minHeight: "100vh", background: "#0C0C0F", fontFamily: "'IBM Plex Mono', monospace", color: "#E8E6E0" }}>
      {/* Custom Titlebar (Electron only) */}
      {isElectron && (
        <div className="titlebar" style={{ height: 40, background: "#09090C", borderBottom: "1px solid #111", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", userSelect: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 24, height: 24, background: "#5B5BFF", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>↓</div>
            <span style={{ fontSize: 12, color: "#555", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700 }}>{t.appName}</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { label: "─", action: "minimize" },
              { label: "□", action: "maximize" },
              { label: "✕", action: "close", danger: true },
            ].map(b => (
              <button key={b.action} className="titlebar-btn" onClick={() => window.electronAPI[b.action]()} style={{ background: "transparent", border: "none", color: b.danger ? "#FF5555" : "#555", fontSize: 14, cursor: "pointer", width: 28, height: 28, borderRadius: 4, transition: "background 0.15s" }}
                onMouseEnter={e => e.target.style.background = b.danger ? "#3A1A1A" : "#222"}
                onMouseLeave={e => e.target.style.background = "transparent"}>
                {b.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ borderBottom: "1px solid #111", padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#09090C", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {!isElectron && <div style={{ width: 36, height: 36, background: "#5B5BFF", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>↓</div>}
          <div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, letterSpacing: "-0.5px", color: "#5B5BFF" }}>{t.appName}</div>
            <div style={{ fontSize: 10, color: "#666", letterSpacing: "1px" }}>{t.appSubtitle}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Language Switcher */}
          <div style={{ display: "flex", gap: 4, background: "#0F0F14", border: "1px solid #1E1E28", borderRadius: 6, padding: 4 }}>
            {["uk", "en"].map(lang => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                style={{
                  background: language === lang ? "#5B5BFF" : "transparent",
                  color: language === lang ? "#fff" : "#888",
                  border: "none",
                  padding: "4px 10px",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 10,
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontWeight: 600,
                  transition: "all 0.2s",
                  textTransform: "uppercase"
                }}
              >
                {lang}
              </button>
            ))}
          </div>
          {isElectron && ytdlpStatus && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: ytdlpStatus.installed ? "#7AFF91" : "#FF5555" }} />
              <span style={{ fontSize: 11, color: ytdlpStatus.installed ? "#7AFF91" : "#FF5555" }}>
                {ytdlpStatus.installed ? `${ytdlpStatus.bundled ? t.ytdlpBundled : t.ytdlpInstalled} ${ytdlpStatus.version}` : t.ytdlpNotInstalled}
              </span>
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 24px" }}>

        {/* yt-dlp not installed warning */}
        {isElectron && ytdlpStatus && !ytdlpStatus.installed && (
          <div style={{ background: "#1A0F0F", border: "1px solid #5A2020", borderRadius: 8, padding: "12px 16px", marginBottom: 20, fontSize: 12, color: "#FF8888" }}>
            {t.warningNotInstalled} <code style={{ background: "#2A1010", padding: "2px 6px", borderRadius: 4 }}>winget install yt-dlp</code> {language === "uk" ? "або" : "or"} <code style={{ background: "#2A1010", padding: "2px 6px", borderRadius: 4 }}>pip install yt-dlp</code>
          </div>
        )}

        {/* Batch Mode Toggle */}
        <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
          <button
            className={`mode-toggle ${!batchMode ? "active" : ""}`}
            onClick={() => setBatchMode(false)}
          >
            {language === "uk" ? "Одне завантаження" : "Single Download"}
          </button>
          <button
            className={`mode-toggle ${batchMode ? "active" : ""}`}
            onClick={() => setBatchMode(true)}
          >
            {language === "uk" ? "Пакетне завантаження" : "Batch Download"}
          </button>
        </div>

        {/* URL */}
        {!batchMode ? (
          <div style={{ marginBottom: 24 }}>
            <div className="section-label">{t.section01}</div>
            <input
              className={`url-input ${urlError ? "error" : ""}`}
              type="text"
              placeholder={t.urlPlaceholder}
              value={url}
              onChange={handleUrlChange}
            />
            {urlError && <div className="error-message">⚠️ {urlError}</div>}
          </div>
        ) : (
          <div style={{ marginBottom: 24 }}>
            <div className="section-label">{language === "uk" ? "ДОДАТИ URL (один на рядок)" : "ADD URLS (one per line)"}</div>
            <textarea
              className="url-input"
              style={{ minHeight: 120, resize: "vertical", fontFamily: "'IBM Plex Mono', monospace" }}
              placeholder={language === "uk" ? "https://youtube.com/watch?v=...\nhttps://youtube.com/watch?v=..." : "https://youtube.com/watch?v=...\nhttps://youtube.com/watch?v=..."}
              value={batchUrls}
              onChange={(e) => setBatchUrls(e.target.value)}
            />
            <button
              className="copy-btn"
              style={{ marginTop: 10 }}
              onClick={addToQueue}
              disabled={!batchUrls.trim()}
            >
              {language === "uk" ? "➕ Додати до черги" : "➕ Add to Queue"}
            </button>
          </div>
        )}

        {/* Mode */}
        <div style={{ marginBottom: 24 }}>
          <div className="section-label">{t.section02}</div>
          <div style={{ display: "flex", gap: 10 }}>
            {FORMAT_OPTIONS.map(f => (
              <FormatCard
                key={f.id}
                id={f.id}
                active={mode === f.id}
                onClick={() => setMode(f.id)}
                labelKey={f.labelKey}
                descKey={f.descKey}
                t={t}
              />
            ))}
          </div>
        </div>

        {/* Quality */}
        <div style={{ display: "grid", gridTemplateColumns: isAudio || isVideoOnly ? "1fr" : "1fr 1fr", gap: 20, marginBottom: 24 }}>
          {!isAudio && (
            <div>
              <div className="section-label">{t.section03Video}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {QUALITY_OPTIONS.video.map(q => (
                  <QualityChip
                    key={q.value}
                    quality={q.value}
                    active={videoQuality === q.value}
                    onClick={() => setVideoQuality(q.value)}
                    icon={q.icon}
                    label={q.labelKey ? t[q.labelKey] : q.label}
                  />
                ))}
              </div>
              <div style={{ fontSize: 10, color: "#777", marginBottom: 6, letterSpacing: "1px" }}>{t.formatLabel}</div>
              <div style={{ display: "flex", gap: 6 }}>
                {VIDEO_FORMATS.map(f => (
                  <FormatPill
                    key={f}
                    format={f}
                    active={videoFormat === f}
                    onClick={() => setVideoFormat(f)}
                  />
                ))}
              </div>
            </div>
          )}
          {!isVideoOnly && (
            <div>
              <div className="section-label">{isAudio ? t.section03Audio : t.section04Audio}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {QUALITY_OPTIONS.audio.map(q => (
                  <QualityChip
                    key={q.value}
                    quality={q.value}
                    active={audioQuality === q.value}
                    onClick={() => setAudioQuality(q.value)}
                    icon={q.icon}
                    label={q.labelKey ? t[q.labelKey] : q.label}
                  />
                ))}
              </div>
              <div style={{ fontSize: 10, color: "#777", marginBottom: 6, letterSpacing: "1px" }}>{t.formatLabel}</div>
              <div style={{ display: "flex", gap: 6 }}>
                {AUDIO_FORMATS.map(f => (
                  <FormatPill
                    key={f}
                    format={f}
                    active={audioFormat === f}
                    onClick={() => setAudioFormat(f)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Advanced */}
        <div style={{ marginBottom: 24 }}>
          <div className="section-label">{t.section05}</div>
          <div style={{ background: "#0F0F14", border: "1px solid #1E1E28", borderRadius: 10, padding: "14px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { label: t.optionSubtitles, desc: t.optionSubtitlesDesc, val: subtitles, set: setSubtitles },
              { label: t.optionThumbnail, desc: t.optionThumbnailDesc, val: thumbnail, set: setThumbnail },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", ...(i > 0 ? { borderTop: "1px solid #111", paddingTop: 12 } : {}) }}>
                <div>
                  <div style={{ fontSize: 13, color: "#aaa" }}>{item.label}</div>
                  <div style={{ fontSize: 10, color: "#666" }}>{item.desc}</div>
                </div>
                <ToggleSwitch value={item.val} onChange={item.set} />
              </div>
            ))}
            <div style={{ borderTop: "1px solid #111", paddingTop: 12 }}>
              <div style={{ fontSize: 12, color: "#aaa", marginBottom: 8 }}>{t.optionPlaylistItems}</div>
              <input className="url-input" style={{ fontSize: 11 }} placeholder={t.playlistPlaceholder} value={playlistItems} onChange={e => setPlaylistItems(e.target.value)} />
            </div>
            <div style={{ borderTop: "1px solid #111", paddingTop: 12 }}>
              <div style={{ fontSize: 12, color: "#aaa", marginBottom: 8 }}>{t.optionOutputPath}</div>
              <input className="url-input" style={{ fontSize: 11 }} placeholder={t.outputPathPlaceholder} value={outputPath} onChange={e => setOutputPath(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Command */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div className="section-label" style={{ margin: 0 }}>{t.sectionCommand}</div>
          </div>
          <div className="cmd-box">
            {command ? <><span style={{ color: "#444" }}>$ </span><span>{command}</span></> : <span style={{ color: "#222" }}>{t.commandPlaceholder}</span>}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {!batchMode ? (
            <>
              <button className="copy-btn" disabled={!isValidUrl} onClick={copyCommand}>{copied ? t.btnCopied : t.btnCopy}</button>
              {isElectron && (
                <button className="run-btn" disabled={!isValidUrl || running || (ytdlpStatus && !ytdlpStatus.installed)} onClick={runDownload}>
                  {running ? t.btnRunning : t.btnRun}
                </button>
              )}
            </>
          ) : (
            isElectron && (
              <>
                <button className="run-btn" disabled={queue.length === 0 || running || (ytdlpStatus && !ytdlpStatus.installed)} onClick={startBatchDownload}>
                  {running ? (language === "uk" ? "⏳ Завантаження..." : "⏳ Downloading...") : (language === "uk" ? "▶ Почати завантаження" : "▶ Start Download")}
                </button>
                <button className="copy-btn" disabled={queue.length === 0} onClick={clearCompleted}>
                  {language === "uk" ? "🗑️ Очистити завершені" : "🗑️ Clear Completed"}
                </button>
              </>
            )
          )}
        </div>

        {/* Progress Bar */}
        {!batchMode && <ProgressBar progress={progress} running={running} />}

        {/* Batch Queue Display */}
        {batchMode && queue.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div className="section-label">{language === "uk" ? `ЧЕРГА ЗАВАНТАЖЕНЬ (${queue.length})` : `DOWNLOAD QUEUE (${queue.length})`}</div>
            <div style={{ background: "#0F0F14", border: "1px solid #1E1E28", borderRadius: 10, overflow: "hidden" }}>
              {queue.map((item, idx) => (
                <div key={item.id} style={{ borderBottom: idx < queue.length - 1 ? "1px solid #1E1E28" : "none" }}>
                  <QueueItem
                    item={item}
                    currentDownload={currentDownload}
                    language={language}
                    onRemove={removeFromQueue}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Output */}
        {showOutput && (
          <div style={{ marginTop: 16 }}>
            <div className="section-label">{t.sectionOutput}</div>
            <div className={`output-box ${output.includes('❌') ? 'error' : ''}`}>{output}</div>
          </div>
        )}

      </div>
    </div>
  );
}
