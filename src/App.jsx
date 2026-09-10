import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import "./App.css";
import { translations } from "./translations";
import { parseError } from "./errorParser";
import { ProgressBar, QualityChip, FormatPill, FormatCard, ToggleSwitch, QueueItem } from "./components";
import {
  buildYtDlpCommand,
  buildFfmpegCommand,
  formatCommandForDisplay,
  parseTimecode as parseTimecodeLib,
  isAudioOutputFormat as isAudioOutputFormatLib,
} from "./lib/command";

function getIsElectron() {
  if (typeof window !== 'undefined' && window.electronAPI) return true;
  if (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.includes('Electron')) return true;
  return false;
}

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
  // Phase 1: structured { bin, args } — no shell. Use formatCommandForDisplay() for UI.
  return buildYtDlpCommand(state);
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

function parseTimecode(value) {
  return parseTimecodeLib(value);
}

function isAudioOutputFormat(format) {
  return isAudioOutputFormatLib(format);
}

export default function App() {
  const [savedSettings] = useState(() => loadSettings());

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

  // Update state
  const [appUpdate, setAppUpdate] = useState(null);
  const [updating, setUpdating] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState('downloader'); // 'downloader' or 'converter'

  // Converter state
  const [converterFile, setConverterFile] = useState(null);
  const [converterOutputFormat, setConverterOutputFormat] = useState('mp4');
  const [converterResolution, setConverterResolution] = useState('original');
  const [converterPreset, setConverterPreset] = useState('none');
  const [converterRunning, setConverterRunning] = useState(false);
  const [converterProgress, setConverterProgress] = useState(0);
  const [converterOutput, setConverterOutput] = useState('');
  const [showConverterOutput, setShowConverterOutput] = useState(false);
  const [converterTrimStart, setConverterTrimStart] = useState('');
  const [converterTrimEnd, setConverterTrimEnd] = useState('');
  const [converterMute, setConverterMute] = useState(false);
  const [converterRotate, setConverterRotate] = useState('0');
  const [converterQuality, setConverterQuality] = useState('medium');
  const [videoDuration, setVideoDuration] = useState(0);
  const [trimStartSeconds, setTrimStartSeconds] = useState(0);
  const [trimEndSeconds, setTrimEndSeconds] = useState(0);

  const isElectron = getIsElectron();

  const state = { url, mode, videoQuality, audioQuality, videoFormat, audioFormat, subtitles, thumbnail, playlistItems, outputPath };

  const command = useMemo(() => buildCommand(state), [url, mode, videoQuality, audioQuality, videoFormat, audioFormat, subtitles, thumbnail, playlistItems, outputPath]);
  const commandDisplay = useMemo(() => formatCommandForDisplay(command), [command]);
  const isAudio = mode === "audio_only";
  const isVideoOnly = mode === "video_only";

  // Phase 1 C2/C4: stable refs to avoid stale closures in single progress listener
  const activeRequestIdRef = useRef(null);
  const activeTabRef = useRef(activeTab);
  const videoDurationRef = useRef(videoDuration);
  const outputBoxRef = useRef(null);
  const converterOutputBoxRef = useRef(null);
  const videoPreviewRef = useRef(null);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  useEffect(() => { videoDurationRef.current = videoDuration; }, [videoDuration]);

  // Phase 1.5: last completed output dir for "Open folder"
  const [lastOutputDir, setLastOutputDir] = useState('');
  const [lastConvertedFile, setLastConvertedFile] = useState('');

  useEffect(() => {
    if (!getIsElectron() || !window.electronAPI) return;
    window.electronAPI.checkYtDlp().then(res => setYtdlpStatus(res)).catch(() => {});

    // Check for app updates (with timeout so offline doesn't hang)
    try {
      const p = window.electronAPI.checkAppUpdate();
      const timeout = new Promise((resolve) => setTimeout(() => resolve({ hasUpdate: false }), 12000));
      Promise.race([p, timeout]).then(res => {
        if (res && res.hasUpdate) setAppUpdate(res);
      }).catch(() => {});
    } catch {}

    // Single stable progress listener (C4). Routes by kind, filters by requestId when known.
    const unsubscribe = window.electronAPI.onDownloadProgress((data) => {
      if (!data) return;
      const kind = data.kind || (data.time ? 'ffmpeg' : 'ytdlp');
      // Ignore stale events from previous request (except when idle between batch items)
      if (data.requestId && activeRequestIdRef.current && data.requestId !== activeRequestIdRef.current) {
        // Still allow batch queue per-item update via currentDownload mapping below
        // For single download strict-filter; batch handler sets activeRequestIdRef per item
        if (activeTabRef.current !== 'downloader') {
          // converter: strict
          return;
        }
        // downloader batch: allow (queue loop updates activeRequestIdRef synchronously)
        if (data.requestId !== activeRequestIdRef.current) return;
      }
      if (kind === 'ffmpeg') {
        if (data.time && videoDurationRef.current > 0) {
          const [h, m, s] = String(data.time).split(':').map(parseFloat);
          if (Number.isFinite(h) && Number.isFinite(m) && Number.isFinite(s)) {
            const currentSeconds = h * 3600 + m * 60 + s;
            const percent = Math.min(100, Math.max(0, (currentSeconds / videoDurationRef.current) * 100));
            setConverterProgress(percent);
          }
        }
        // No duration -> indeterminate (handled in render: bar pulses when running && progress===0)
      } else {
        setProgress(data);
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
      else if (window.electronAPI?.removeDownloadProgressListener) {
        window.electronAPI.removeDownloadProgressListener();
      }
      activeRequestIdRef.current = null;
    };
  }, []);

  // Phase 1.5: auto-scroll terminal outputs
  useEffect(() => {
    if (showOutput && outputBoxRef.current) {
      outputBoxRef.current.scrollTop = outputBoxRef.current.scrollHeight;
    }
  }, [output, showOutput]);

  useEffect(() => {
    if (showConverterOutput && converterOutputBoxRef.current) {
      converterOutputBoxRef.current.scrollTop = converterOutputBoxRef.current.scrollHeight;
    }
  }, [converterOutput, showConverterOutput]);

  useEffect(() => {
    saveSettings({ language, mode, videoQuality, audioQuality, videoFormat, audioFormat, subtitles, thumbnail, outputPath });
  }, [language, mode, videoQuality, audioQuality, videoFormat, audioFormat, subtitles, thumbnail, outputPath]);

  useEffect(() => {
    return () => {
      if (converterFile?.file && converterFile.url && !getIsElectron() && converterFile.url.startsWith('blob:')) {
        try { URL.revokeObjectURL(converterFile.url); } catch {}
      }
    };
  }, [converterFile]);

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
    if (!commandDisplay) return;
    const done = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(commandDisplay).then(done).catch(() => {
        // Fallback for Electron file:// without clipboard permission
        try {
          const ta = document.createElement('textarea');
          ta.value = commandDisplay;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          done();
        } catch { setCopied(false); }
      });
    }
  }, [commandDisplay]);

  const makeRequestId = useCallback(() => {
    try {
      if (crypto?.randomUUID) return crypto.randomUUID();
    } catch {}
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }, []);

  const batchCancelRequestedRef = useRef(false);

  const runDownload = useCallback(async () => {
    if (!command || !getIsElectron() || !window.electronAPI) return;

    const validation = validateURL(url, t);
    if (!validation.valid) {
      setUrlError(validation.error);
      return;
    }

    const requestId = makeRequestId();
    activeRequestIdRef.current = requestId;
    batchCancelRequestedRef.current = false;
    setRunning(true);
    setShowOutput(true);
    setOutput(t.outputStarted);
    setProgress({ percent: 0, size: null, speed: null, eta: null });

    let result;
    try {
      result = await window.electronAPI.runCommand(command, requestId);
    } catch (e) {
      result = { success: false, output: String(e?.message || e) };
    }

    activeRequestIdRef.current = null;

    if (result?.cancelled) {
      setOutput((prev) => `${prev}\n⏹ ${language === "uk" ? "Скасовано користувачем." : "Cancelled by user."}`);
      setProgress({ percent: 0, size: null, speed: null, eta: null });
    } else if (!result.success && result.output) {
      const parsedError = parseError(result.output, language);
      if (parsedError.found) {
        setOutput(`❌ ${parsedError.title}\n\n${parsedError.message}\n\n💡 ${parsedError.solution}\n\n--- Original Error ---\n${parsedError.original}`);
      } else {
        setOutput(result.output || t.outputError);
      }
    } else {
      setOutput(result.output || (result.success ? t.outputSuccess : t.outputError));
      if (result.success) {
        setProgress({ percent: 100, size: null, speed: null, eta: null });
        if (command?.outputDir) setLastOutputDir(command.outputDir);
      }
    }

    setRunning(false);
  }, [command, url, t, language, makeRequestId]);

  const cancelDownload = useCallback(async () => {
    const id = activeRequestIdRef.current;
    batchCancelRequestedRef.current = true;
    if (id && window.electronAPI?.cancelCommand) {
      try { await window.electronAPI.cancelCommand(id); } catch {}
    }
  }, []);

  // Batch download functions
  const addToQueue = useCallback(() => {
    if (!batchUrls.trim()) return;

    const urls = batchUrls.split('\n').map(u => u.trim()).filter(Boolean);
    const existingUrls = new Set(queue.map(item => item.url));
    const validItems = [];
    const invalidUrls = [];

    urls.forEach((urlString) => {
      const validation = validateURL(urlString, t);
      if (!validation.valid) {
        invalidUrls.push(urlString);
        return;
      }
      if (existingUrls.has(urlString)) return;
      existingUrls.add(urlString);
      let id;
      try { id = crypto.randomUUID(); } catch { id = `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
      validItems.push({
        id,
        url: urlString,
        status: 'pending',
        progress: 0,
        output: '',
      });
    });

    if (invalidUrls.length > 0) {
      setOutput(`❌ ${language === "uk" ? "Невірний URL:" : "Invalid URL:"}\n${invalidUrls.join('\n')}`);
      setShowOutput(true);
    }

    if (validItems.length > 0) {
      setQueue(prev => [...prev, ...validItems]);
      setBatchUrls("");
    }
  }, [batchUrls, queue, language, t]);

  const removeFromQueue = useCallback((id) => {
    setQueue(prev => prev.filter(item => item.id !== id));
  }, []);

  const retryFailed = useCallback(() => {
    setQueue(prev => prev.map(q => q.status === 'error' ? { ...q, status: 'pending', output: '' } : q));
  }, []);

  const startBatchDownload = useCallback(async () => {
    if (queue.length === 0 || running) return;
    if (!getIsElectron() || !window.electronAPI) return;

    batchCancelRequestedRef.current = false;
    setRunning(true);

    // Snapshot pending at start to avoid stale-closure misses; re-check cancel between items
    const pending = queue.filter(q => q.status === 'pending');
    for (const item of pending) {
      if (batchCancelRequestedRef.current) break;

      const requestId = makeRequestId();
      activeRequestIdRef.current = requestId;
      setCurrentDownload(item.id);
      setQueue(prev => prev.map(q =>
        q.id === item.id ? { ...q, status: 'downloading' } : q
      ));
      setProgress({ percent: 0, size: null, speed: null, eta: null });

      const itemState = { ...state, url: item.url };
      const cmd = buildCommand(itemState);
      if (!cmd) {
        setQueue(prev => prev.map(q =>
          q.id === item.id ? { ...q, status: 'error', output: t.outputError } : q
        ));
        continue;
      }

      let result;
      try {
        result = await window.electronAPI.runCommand(cmd, requestId);
      } catch (e) {
        result = { success: false, output: String(e?.message || e) };
      }

      if (result?.cancelled || batchCancelRequestedRef.current) {
        setQueue(prev => prev.map(q =>
          q.id === item.id && q.status === 'downloading' ? { ...q, status: 'pending' } : q
        ));
        break;
      }

      setQueue(prev => prev.map(q =>
        q.id === item.id ? {
          ...q,
          status: result.success ? 'completed' : 'error',
          output: result.output || (result.success ? t.outputSuccess : t.outputError)
        } : q
      ));
      if (result.success && cmd?.outputDir) setLastOutputDir(cmd.outputDir);
    }

    activeRequestIdRef.current = null;
    setRunning(false);
    setCurrentDownload(null);
  }, [queue, running, state, t, makeRequestId]);

  const clearCompleted = useCallback(() => {
    setQueue(prev => prev.filter(item => item.status !== 'completed' && item.status !== 'error'));
  }, []);

  const clearOutput = useCallback(() => {
    setOutput('');
    setShowOutput(false);
    setProgress({ percent: 0, size: null, speed: null, eta: null });
  }, []);

  const clearConverterOutput = useCallback(() => {
    setConverterOutput('');
    setShowConverterOutput(false);
    setConverterProgress(0);
  }, []);

  const pasteUrl = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text?.trim()) {
        setUrl(text.trim());
        const validation = validateURL(text.trim(), t);
        setUrlError(validation.error);
      }
    } catch {
      // Clipboard read blocked — user pastes manually
    }
  }, [t]);

  const pickOutputFolder = useCallback(async () => {
    if (!getIsElectron() || !window.electronAPI?.selectFolder) return;
    const folder = await window.electronAPI.selectFolder();
    if (folder) setOutputPath(folder);
  }, []);

  const openOutputFolder = useCallback(async (dirOverride) => {
    const dir = dirOverride || lastOutputDir || outputPath;
    if (!dir || !window.electronAPI?.openPath) return;
    // Expand %USERPROFILE% for display-only placeholder
    let target = dir;
    if (target.includes('%USERPROFILE%') && window.electronAPI?.getDownloadsDir) {
      try {
        const dl = await window.electronAPI.getDownloadsDir();
        if (dl) target = target.replace('%USERPROFILE%\\Downloads', dl).replace('%USERPROFILE%/Downloads', dl);
      } catch {}
    }
    await window.electronAPI.openPath(target);
  }, [lastOutputDir, outputPath]);

  const updateYtDlp = useCallback(async () => {
    if (!getIsElectron() || updating) return;

    setUpdating(true);
    setOutput(language === "uk" ? "Оновлення yt-dlp..." : "Updating yt-dlp...");
    setShowOutput(true);

    const result = await window.electronAPI.updateYtDlp();

    if (result.success) {
      setOutput(result.message || (language === "uk" ? "✓ yt-dlp успішно оновлено!" : "✓ yt-dlp updated successfully!"));
      // Refresh yt-dlp status
      window.electronAPI.checkYtDlp().then(res => setYtdlpStatus(res));
    } else {
      setOutput(`❌ ${result.message || (language === "uk" ? "Помилка оновлення" : "Update failed")}`);
    }

    setUpdating(false);
  }, [updating, language]);

  // Converter functions
  const handleFileSelect = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      // Revoke previous blob URL to avoid leak
      try {
        if (converterFile?.url && converterFile.url.startsWith('blob:')) {
          URL.revokeObjectURL(converterFile.url);
        }
      } catch {}
      const filePath = file.path;
      const electron = getIsElectron();

      // Ensure path is correctly formatted for Electron's file:// protocol
      // On Windows, we need to handle backslashes and potentially a leading slash
      let fileURL = '';
      if (electron && filePath) {
        // format path for file:// protocol
        const normalizedPath = filePath.replace(/\\/g, '/');
        fileURL = `file:///${normalizedPath}`;
      } else {
        fileURL = URL.createObjectURL(file);
      }

      setConverterFile({ name: file.name, path: filePath, url: fileURL, file: file });
      setConverterOutput('');
      setConverterProgress(0);
      setConverterTrimStart('');
      setConverterTrimEnd('');
      setTrimStartSeconds(0);
      setTrimEndSeconds(0);
      setVideoDuration(0);
    }
  }, []);

  const formatTime = useCallback((seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const handleTrimStartChange = useCallback((seconds) => {
    setTrimStartSeconds(seconds);
    setConverterTrimStart(formatTime(seconds));
    if (videoPreviewRef.current) {
      try { videoPreviewRef.current.currentTime = seconds; } catch {}
    }
  }, [formatTime]);

  const handleTrimEndChange = useCallback((seconds) => {
    setTrimEndSeconds(seconds);
    setConverterTrimEnd(formatTime(seconds));
    if (videoPreviewRef.current) {
      try { videoPreviewRef.current.currentTime = seconds; } catch {}
    }
  }, [formatTime]);

  const applyPreset = useCallback((preset) => {
    setConverterPreset(preset);
    if (preset === 'telegram_sticker') {
      setConverterResolution('512x512');
      setConverterOutputFormat('webm');
    } else if (preset === 'youtube') {
      setConverterResolution('1920x1080');
      setConverterOutputFormat('mp4');
    } else if (preset === 'instagram') {
      setConverterResolution('1080x1080');
      setConverterOutputFormat('mp4');
    }
  }, []);

  const runConverter = useCallback(async () => {
    if (!converterFile || converterRunning) return;

    if (!getIsElectron() || !window.electronAPI) {
      alert(language === "uk" ? "Ця функція працює тільки в Electron-версії програми." : "This feature only works in the Electron version of the app.");
      return;
    }

    if (!converterFile.path) {
      setConverterOutput(language === "uk" ? "❌ Помилка: Не вдалося отримати шлях до файлу. Спробуйте вибрати файл знову." : "❌ Error: Could not get file path. Try selecting the file again.");
      setShowConverterOutput(true);
      return;
    }

    const requestId = makeRequestId();
    activeRequestIdRef.current = requestId;
    setConverterRunning(true);
    setShowConverterOutput(true);
    setConverterOutput(language === "uk" ? "⏳ Підготовка до конвертації..." : "⏳ Preparing conversion...");
    setConverterProgress(0);

    const startSeconds = converterTrimStart ? parseTimecode(converterTrimStart) : null;
    const endSeconds = converterTrimEnd ? parseTimecode(converterTrimEnd) : null;

    if (converterTrimStart && startSeconds === null) {
      setConverterOutput(`${t.errorInvalidTrimStart}`);
      setConverterRunning(false);
      activeRequestIdRef.current = null;
      setShowConverterOutput(true);
      return;
    }

    if (converterTrimEnd && endSeconds === null) {
      setConverterOutput(`${t.errorInvalidTrimEnd}`);
      setConverterRunning(false);
      activeRequestIdRef.current = null;
      setShowConverterOutput(true);
      return;
    }

    if (startSeconds !== null && endSeconds !== null && endSeconds <= startSeconds) {
      setConverterOutput(`${t.errorTrimEndBeforeStart}`);
      setConverterRunning(false);
      activeRequestIdRef.current = null;
      setShowConverterOutput(true);
      return;
    }

    const outPath = (outputPath || '').trim() || "%USERPROFILE%\\Downloads";
    const outputFileName = `converted_${Date.now()}.${converterOutputFormat}`;

    const ffmpegCmd = buildFfmpegCommand({
      inputPath: converterFile.path,
      outputDir: outPath,
      outputFileName,
      outputFormat: converterOutputFormat,
      resolution: converterResolution,
      rotate: converterRotate,
      quality: converterQuality,
      mute: converterMute,
      trimStart: startSeconds !== null ? converterTrimStart : null,
      trimEnd: endSeconds !== null ? converterTrimEnd : null,
    });

    if (!ffmpegCmd) {
      setConverterOutput(language === "uk" ? "❌ Помилка побудови команди" : "❌ Failed to build command");
      setConverterRunning(false);
      activeRequestIdRef.current = null;
      return;
    }

    let result;
    try {
      result = await window.electronAPI.runCommand(ffmpegCmd, requestId);
    } catch (e) {
      result = { success: false, output: String(e?.message || e) };
    }

    activeRequestIdRef.current = null;

    if (result?.cancelled) {
      setConverterOutput(`⏹ ${language === "uk" ? "Конвертацію скасовано." : "Conversion cancelled."}`);
      setConverterProgress(0);
    } else if (result.success) {
      const sep = outPath.includes('\\') ? '\\' : '/';
      setConverterOutput(`✓ ${language === "uk" ? "Конвертація завершена!" : "Conversion completed!"}\n${language === "uk" ? "Збережено:" : "Saved:"} ${outPath}${sep}${outputFileName}`);
      setConverterProgress(100);
      setLastOutputDir(outPath);
      setLastConvertedFile(`${outPath}${sep}${outputFileName}`);
    } else {
      setConverterOutput(`❌ ${result.output || (language === "uk" ? "Помилка конвертації" : "Conversion failed")}`);
    }

    setConverterRunning(false);
  }, [converterFile, converterOutputFormat, converterResolution, converterTrimStart, converterTrimEnd, converterMute, converterRotate, converterQuality, converterRunning, language, outputPath, t, makeRequestId]);

  const cancelConverter = useCallback(async () => {
    const id = activeRequestIdRef.current;
    if (id && window.electronAPI?.cancelCommand) {
      try { await window.electronAPI.cancelCommand(id); } catch {}
    }
  }, []);

  // Phase 1.5: ESC cancels running task
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (converterRunning || running) {
          const id = activeRequestIdRef.current;
          batchCancelRequestedRef.current = true;
          if (id && window.electronAPI?.cancelCommand) {
            window.electronAPI.cancelCommand(id).catch(() => {});
          }
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [converterRunning, running]);

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
              <button key={b.action} aria-label={b.action} className="titlebar-btn" onClick={() => window.electronAPI[b.action]()} style={{ background: "transparent", border: "none", color: b.danger ? "#FF5555" : "#555", fontSize: 14, cursor: "pointer", width: 28, height: 28, borderRadius: 4, transition: "background 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = b.danger ? "#3A1A1A" : "#222"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
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
              {ytdlpStatus.installed && (
                <button
                  onClick={updateYtDlp}
                  disabled={updating}
                  style={{
                    background: "transparent",
                    border: "1px solid #7AFF91",
                    color: "#7AFF91",
                    padding: "4px 10px",
                    borderRadius: 4,
                    cursor: updating ? "not-allowed" : "pointer",
                    fontSize: 10,
                    fontWeight: 600,
                    transition: "all 0.2s",
                    opacity: updating ? 0.5 : 1
                  }}
                  onMouseEnter={e => { if (!updating) e.currentTarget.style.background = "#1A2A1A"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                >
                  {updating ? "⏳" : "🔄"} {language === "uk" ? "Оновити" : "Update"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 24px" }}>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24, borderBottom: "1px solid #1E1E28" }}>
          <button
            onClick={() => setActiveTab('downloader')}
            style={{
              background: activeTab === 'downloader' ? '#5B5BFF' : 'transparent',
              color: activeTab === 'downloader' ? '#fff' : '#888',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px 8px 0 0',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "'IBM Plex Mono', monospace",
              transition: 'all 0.2s',
              borderBottom: activeTab === 'downloader' ? '2px solid #5B5BFF' : '2px solid transparent'
            }}
            onMouseEnter={e => activeTab !== 'downloader' && (e.target.style.color = '#ccc')}
            onMouseLeave={e => activeTab !== 'downloader' && (e.target.style.color = '#888')}
          >
            📥 {language === "uk" ? "Завантаження" : "Downloader"}
          </button>
          <button
            onClick={() => setActiveTab('converter')}
            style={{
              background: activeTab === 'converter' ? '#5B5BFF' : 'transparent',
              color: activeTab === 'converter' ? '#fff' : '#888',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px 8px 0 0',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "'IBM Plex Mono', monospace",
              transition: 'all 0.2s',
              borderBottom: activeTab === 'converter' ? '2px solid #5B5BFF' : '2px solid transparent'
            }}
            onMouseEnter={e => activeTab !== 'converter' && (e.target.style.color = '#ccc')}
            onMouseLeave={e => activeTab !== 'converter' && (e.target.style.color = '#888')}
          >
            🎬 {language === "uk" ? "Конвертер" : "Converter"}
          </button>
        </div>

        {/* Downloader Tab */}
        {activeTab === 'downloader' && (
          <div>

        {/* App update banner */}
        {isElectron && appUpdate && (
          <div style={{ background: "#1A1A2A", border: "1px solid #5B5BFF", borderRadius: 8, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 13, color: "#9090FF", fontWeight: 600, marginBottom: 4 }}>
                {language === "uk" ? "🎉 Доступна нова версія!" : "🎉 New version available!"}
              </div>
              <div style={{ fontSize: 11, color: "#888" }}>
                {language === "uk" ? `v${appUpdate.currentVersion} → v${appUpdate.latestVersion}` : `v${appUpdate.currentVersion} → v${appUpdate.latestVersion}`}
              </div>
            </div>
            <button
              onClick={() => window.open(appUpdate.downloadUrl, '_blank')}
              style={{
                background: "#5B5BFF",
                color: "white",
                border: "none",
                padding: "8px 16px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                transition: "all 0.2s"
              }}
              onMouseEnter={e => e.target.style.background = "#7777FF"}
              onMouseLeave={e => e.target.style.background = "#5B5BFF"}
            >
              {language === "uk" ? "Завантажити" : "Download"}
            </button>
          </div>
        )}

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
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className={`url-input ${urlError ? "error" : ""}`}
                type="text"
                placeholder={t.urlPlaceholder}
                value={url}
                onChange={handleUrlChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && isValidUrl && !running && isElectron) runDownload();
                }}
                style={{ flex: 1 }}
              />
              <button
                className="pill-btn"
                onClick={pasteUrl}
                title={language === "uk" ? "Вставити з буфера" : "Paste from clipboard"}
                style={{ flexShrink: 0, alignSelf: "center" }}
              >
                📋
              </button>
            </div>
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
              <div style={{ display: "flex", gap: 8 }}>
                <input className="url-input" style={{ fontSize: 11, flex: 1 }} placeholder={t.outputPathPlaceholder} value={outputPath} onChange={e => setOutputPath(e.target.value)} />
                {isElectron && window.electronAPI?.selectFolder && (
                  <button className="pill-btn" onClick={pickOutputFolder} title={language === "uk" ? "Вибрати папку" : "Choose folder"} style={{ flexShrink: 0, alignSelf: "center" }}>
                    📁
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Command */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div className="section-label" style={{ margin: 0 }}>{t.sectionCommand}</div>
          </div>
          <div className="cmd-box">
            {commandDisplay ? <><span style={{ color: "#444" }}>$ </span><span>{commandDisplay}</span></> : <span style={{ color: "#222" }}>{t.commandPlaceholder}</span>}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {!batchMode ? (
            <>
              <button className="copy-btn" disabled={!isValidUrl} onClick={copyCommand}>{copied ? t.btnCopied : t.btnCopy}</button>
              {!running ? (
                <button
                  className="run-btn"
                  disabled={!isValidUrl || running || !isElectron || (ytdlpStatus && !ytdlpStatus.installed)}
                  onClick={runDownload}
                >
                  {(isElectron ? t.btnRun : t.electronOnlyButton)}
                </button>
              ) : (
                <button className="run-btn" onClick={cancelDownload} style={{ borderColor: "#5A2020", color: "#FF8888" }}>
                  ⏹ {language === "uk" ? "Скасувати (Esc)" : "Cancel (Esc)"}
                </button>
              )}
              {(lastOutputDir || outputPath) && (
                <button className="pill-btn" onClick={() => openOutputFolder()} title={language === "uk" ? "Відкрити папку" : "Open folder"}>
                  📂 {language === "uk" ? "Папка" : "Folder"}
                </button>
              )}
            </>
          ) : (
            <>
              {!running ? (
                <button
                  className="run-btn"
                  disabled={queue.length === 0 || running || !isElectron || (ytdlpStatus && !ytdlpStatus.installed)}
                  onClick={startBatchDownload}
                >
                  {t.btnStartBatch}
                </button>
              ) : (
                <button className="run-btn" onClick={cancelDownload} style={{ borderColor: "#5A2020", color: "#FF8888" }}>
                  ⏹ {language === "uk" ? "Скасувати (Esc)" : "Cancel (Esc)"}
                </button>
              )}
              <button className="copy-btn" disabled={queue.length === 0} onClick={clearCompleted}>
                {t.btnClearCompleted}
              </button>
              {queue.some(q => q.status === 'error') && (
                <button className="pill-btn" onClick={retryFailed}>
                  🔁 {language === "uk" ? "Повторити помилки" : "Retry failed"}
                </button>
              )}
            </>
          )}
        </div>
        {!isElectron && (
          <div style={{ color: "#FF8888", fontSize: 12, marginTop: 10 }}>
            {t.electronOnlyMessage}
          </div>
        )}

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
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div className="section-label" style={{ margin: 0 }}>{t.sectionOutput}</div>
              <button className="pill-btn" onClick={clearOutput} style={{ fontSize: 10 }}>
                {language === "uk" ? "✕ Очистити" : "✕ Clear"}
              </button>
            </div>
            <div ref={outputBoxRef} className={`output-box ${output.includes('❌') ? 'error' : ''}`}>{output}</div>
          </div>
        )}

        </div>
        )}

        {/* Converter Tab */}
        {activeTab === 'converter' && (
          <div>
            {/* File Picker */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 8, fontWeight: 600 }}>
                {language === "uk" ? "📁 Виберіть файл" : "📁 Select File"}
              </label>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = "#5B5BFF";
                  e.currentTarget.style.background = "#1A1A2A";
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = "#1E1E28";
                  e.currentTarget.style.background = "#0F0F14";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = "#1E1E28";
                  e.currentTarget.style.background = "#0F0F14";
                  const file = e.dataTransfer.files?.[0];
                  if (file) {
                    handleFileSelect({ target: { files: [file] } });
                  }
                }}
                style={{
                  position: "relative",
                  border: "2px dashed #1E1E28",
                  borderRadius: 12,
                  padding: "40px 20px",
                  textAlign: "center",
                  background: "#0F0F14",
                  transition: "all 0.2s",
                  cursor: "pointer"
                }}
                onClick={() => document.getElementById('converter-file-input').click()}
              >
                <input
                  id="converter-file-input"
                  type="file"
                  accept="video/*,audio/*"
                  onChange={handleFileSelect}
                  style={{ display: "none" }}
                />
                <div style={{ fontSize: 32, marginBottom: 12 }}>{converterFile ? "✅" : "📥"}</div>
                <div style={{ fontSize: 13, color: "#E8E6E0", marginBottom: 4, fontWeight: 600 }}>
                  {converterFile ? converterFile.name : (language === "uk" ? "Перетягніть файл сюди" : "Drag & drop file here")}
                </div>
                <div style={{ fontSize: 11, color: "#666" }}>
                  {language === "uk" ? "або натисніть, щоб вибрати" : "or click to browse"}
                </div>
              </div>
            </div>

            {/* Video Preview */}
            {converterFile && converterFile.url && (
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 8, fontWeight: 600 }}>
                  {language === "uk" ? "👁️ Перегляд" : "👁️ Preview"}
                </label>
                <div style={{ background: "#0F0F14", border: "1px solid #1E1E28", borderRadius: 8, padding: 12 }}>
                  <video
                    ref={videoPreviewRef}
                    src={converterFile.url}
                    controls
                    preload="metadata"
                    style={{
                      width: "100%",
                      maxHeight: 400,
                      borderRadius: 6,
                      background: "#000"
                    }}
                    onLoadedMetadata={(e) => {
                      const duration = e.target.duration;
                      if (Number.isFinite(duration) && duration > 0) {
                        setVideoDuration(duration);
                        setTrimEndSeconds(duration);
                        setConverterTrimEnd(formatTime(duration));
                      } else {
                        setVideoDuration(0);
                      }
                    }}
                    onError={() => {
                      setConverterOutput(`❌ ${language === "uk" ? "Помилка завантаження відео" : "Video load error"}`);
                      setShowConverterOutput(true);
                    }}
                  />

                  {/* Timeline */}
                  {videoDuration > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 11, color: "#888" }}>
                        <span>{language === "uk" ? "Початок:" : "Start:"} {converterTrimStart || "00:00:00"}</span>
                        <span>{language === "uk" ? "Кінець:" : "End:"} {converterTrimEnd || formatTime(videoDuration)}</span>
                      </div>

                      {/* Timeline bar */}
                      <div style={{ position: "relative", height: 60, background: "#1E1E28", borderRadius: 6, marginBottom: 12 }}>
                        {/* Selected range */}
                        <div style={{
                          position: "absolute",
                          left: `${(trimStartSeconds / videoDuration) * 100}%`,
                          width: `${((trimEndSeconds - trimStartSeconds) / videoDuration) * 100}%`,
                          height: "100%",
                          background: "linear-gradient(90deg, rgba(91,91,255,0.3), rgba(122,255,145,0.3))",
                          borderLeft: "3px solid #5B5BFF",
                          borderRight: "3px solid #7AFF91",
                          borderRadius: 6
                        }} />

                        {/* Time markers */}
                        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "100%", display: "flex", alignItems: "center", padding: "0 8px", justifyContent: "space-between" }}>
                          {[0, 0.25, 0.5, 0.75, 1].map(pos => (
                            <div key={pos} style={{ fontSize: 9, color: "#666" }}>
                              {formatTime(videoDuration * pos)}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Start slider */}
                      <div style={{ marginBottom: 12 }}>
                        <label style={{ display: "block", fontSize: 11, color: "#5B5BFF", marginBottom: 4 }}>
                          ⏮️ {language === "uk" ? "Початок" : "Start"}
                        </label>
                        <input
                          type="range"
                          min="0"
                          max={videoDuration}
                          step="0.1"
                          value={trimStartSeconds}
                          onChange={(e) => handleTrimStartChange(parseFloat(e.target.value))}
                          style={{
                            width: "100%",
                            height: 6,
                            background: `linear-gradient(to right, #5B5BFF ${(trimStartSeconds / videoDuration) * 100}%, #1E1E28 ${(trimStartSeconds / videoDuration) * 100}%)`,
                            borderRadius: 3,
                            outline: "none",
                            cursor: "pointer"
                          }}
                        />
                      </div>

                      {/* End slider */}
                      <div>
                        <label style={{ display: "block", fontSize: 11, color: "#7AFF91", marginBottom: 4 }}>
                          ⏭️ {language === "uk" ? "Кінець" : "End"}
                        </label>
                        <input
                          type="range"
                          min="0"
                          max={videoDuration}
                          step="0.1"
                          value={trimEndSeconds}
                          onChange={(e) => handleTrimEndChange(parseFloat(e.target.value))}
                          style={{
                            width: "100%",
                            height: 6,
                            background: `linear-gradient(to right, #7AFF91 ${(trimEndSeconds / videoDuration) * 100}%, #1E1E28 ${(trimEndSeconds / videoDuration) * 100}%)`,
                            borderRadius: 3,
                            outline: "none",
                            cursor: "pointer"
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Presets */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 8, fontWeight: 600 }}>
                {language === "uk" ? "⚡ Швидкі пресети" : "⚡ Quick Presets"}
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  { id: 'telegram_sticker', label: language === "uk" ? "Telegram Стікер" : "Telegram Sticker", icon: "💬", desc: "512x512 WebM" },
                  { id: 'youtube', label: "YouTube", icon: "📺", desc: "1920x1080 MP4" },
                  { id: 'instagram', label: "Instagram", icon: "📷", desc: "1080x1080 MP4" },
                ].map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => applyPreset(preset.id)}
                    style={{
                      background: converterPreset === preset.id ? "#5B5BFF" : "#0F0F14",
                      border: converterPreset === preset.id ? "1px solid #7A7AFF" : "1px solid #1E1E28",
                      padding: "10px 16px",
                      borderRadius: 8,
                      color: converterPreset === preset.id ? "#fff" : "#aaa",
                      fontSize: 12,
                      cursor: "pointer",
                      transition: "all 0.2s",
                      fontFamily: "'IBM Plex Mono', monospace"
                    }}
                  >
                    {preset.icon} {preset.label}
                    <div style={{ fontSize: 10, color: converterPreset === preset.id ? "#ccc" : "#666", marginTop: 2 }}>
                      {preset.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Output Format */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 8, fontWeight: 600 }}>
                {language === "uk" ? "📦 Формат виводу" : "📦 Output Format"}
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {['mp4', 'mkv', 'webm', 'avi', 'mov', 'mp3', 'flac', 'wav'].map(fmt => (
                  <button
                    key={fmt}
                    onClick={() => setConverterOutputFormat(fmt)}
                    style={{
                      background: converterOutputFormat === fmt ? "#5B5BFF" : "#0F0F14",
                      border: converterOutputFormat === fmt ? "1px solid #7A7AFF" : "1px solid #1E1E28",
                      padding: "8px 16px",
                      borderRadius: 6,
                      color: converterOutputFormat === fmt ? "#fff" : "#aaa",
                      fontSize: 12,
                      cursor: "pointer",
                      transition: "all 0.2s",
                      fontFamily: "'IBM Plex Mono', monospace",
                      textTransform: "uppercase"
                    }}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>

            {/* Resolution */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 8, fontWeight: 600 }}>
                {language === "uk" ? "📐 Роздільна здатність" : "📐 Resolution"}
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  { value: 'original', label: language === "uk" ? "Оригінал" : "Original" },
                  { value: '512x512', label: '512×512' },
                  { value: '1080x1080', label: '1080×1080' },
                  { value: '1280x720', label: '1280×720' },
                  { value: '1920x1080', label: '1920×1080' },
                  { value: '3840x2160', label: '3840×2160 (4K)' },
                ].map(res => (
                  <button
                    key={res.value}
                    onClick={() => setConverterResolution(res.value)}
                    style={{
                      background: converterResolution === res.value ? "#5B5BFF" : "#0F0F14",
                      border: converterResolution === res.value ? "1px solid #7A7AFF" : "1px solid #1E1E28",
                      padding: "8px 16px",
                      borderRadius: 6,
                      color: converterResolution === res.value ? "#fff" : "#aaa",
                      fontSize: 12,
                      cursor: "pointer",
                      transition: "all 0.2s",
                      fontFamily: "'IBM Plex Mono', monospace"
                    }}
                  >
                    {res.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quality */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 8, fontWeight: 600 }}>
                {language === "uk" ? "🌟 Якість" : "🌟 Quality"}
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  { value: 'high', label: language === "uk" ? "Висока" : "High" },
                  { value: 'medium', label: language === "uk" ? "Середня" : "Medium" },
                  { value: 'low', label: language === "uk" ? "Низька" : "Low" },
                ].map(q => (
                  <button
                    key={q.value}
                    onClick={() => setConverterQuality(q.value)}
                    style={{
                      background: converterQuality === q.value ? "#5B5BFF" : "#0F0F14",
                      border: converterQuality === q.value ? "1px solid #7A7AFF" : "1px solid #1E1E28",
                      padding: "8px 16px",
                      borderRadius: 6,
                      color: converterQuality === q.value ? "#fff" : "#aaa",
                      fontSize: 12,
                      cursor: "pointer",
                      transition: "all 0.2s",
                      fontFamily: "'IBM Plex Mono', monospace"
                    }}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Advanced Options (Rotate & Mute) */}
            <div style={{ marginBottom: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 8, fontWeight: 600 }}>
                  {language === "uk" ? "🔄 Поворот" : "🔄 Rotation"}
                </label>
                <select
                  value={converterRotate}
                  onChange={(e) => setConverterRotate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    background: "#0F0F14",
                    border: "1px solid #1E1E28",
                    borderRadius: 6,
                    color: "#E8E6E0",
                    fontSize: 12,
                    fontFamily: "'IBM Plex Mono', monospace",
                    cursor: "pointer"
                  }}
                >
                  <option value="0">{language === "uk" ? "Немає" : "None"}</option>
                  <option value="90">90° CW</option>
                  <option value="180">180°</option>
                  <option value="270">90° CCW</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 8, fontWeight: 600 }}>
                  {language === "uk" ? "🔇 Звук" : "🔇 Audio"}
                </label>
                <button
                  onClick={() => setConverterMute(!converterMute)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    background: converterMute ? "#5A2020" : "#0F0F14",
                    border: converterMute ? "1px solid #FF5555" : "1px solid #1E1E28",
                    borderRadius: 6,
                    color: converterMute ? "#FF8888" : "#aaa",
                    fontSize: 12,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    fontFamily: "'IBM Plex Mono', monospace"
                  }}
                >
                  {converterMute ? (language === "uk" ? "Видалено" : "Muted") : (language === "uk" ? "Є звук" : "Original Audio")}
                </button>
              </div>
            </div>

            {/* Trim/Cut */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 8, fontWeight: 600 }}>
                {language === "uk" ? "✂️ Обрізати відео" : "✂️ Trim Video"}
              </label>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: 11, color: "#666", marginBottom: 4 }}>
                    {language === "uk" ? "Початок (00:00:00)" : "Start (00:00:00)"}
                  </label>
                  <input
                    type="text"
                    placeholder="00:00:00"
                    value={converterTrimStart}
                    onChange={(e) => setConverterTrimStart(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      background: "#0F0F14",
                      border: "1px solid #1E1E28",
                      borderRadius: 6,
                      color: "#E8E6E0",
                      fontSize: 12,
                      fontFamily: "'IBM Plex Mono', monospace"
                    }}
                  />
                </div>
                <div style={{ color: "#666", fontSize: 16, marginTop: 20 }}>→</div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: 11, color: "#666", marginBottom: 4 }}>
                    {language === "uk" ? "Кінець (00:00:00)" : "End (00:00:00)"}
                  </label>
                  <input
                    type="text"
                    placeholder="00:00:00"
                    value={converterTrimEnd}
                    onChange={(e) => setConverterTrimEnd(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      background: "#0F0F14",
                      border: "1px solid #1E1E28",
                      borderRadius: 6,
                      color: "#E8E6E0",
                      fontSize: 12,
                      fontFamily: "'IBM Plex Mono', monospace"
                    }}
                  />
                </div>
              </div>
              <div style={{ fontSize: 10, color: "#666", marginTop: 6 }}>
                {language === "uk" ? "💡 Формат: 00:00:00 (години:хвилини:секунди) або 00:00 (хвилини:секунди)" : "💡 Format: 00:00:00 (hours:minutes:seconds) or 00:00 (minutes:seconds)"}
              </div>
            </div>

            {/* Convert Button */}
            {!converterRunning ? (
              <button
                onClick={runConverter}
                disabled={!converterFile || converterRunning}
                style={{
                  width: "100%",
                  padding: "16px",
                  background: !converterFile || converterRunning ? "#1E1E28" : "linear-gradient(135deg, #5B5BFF, #7AFF91)",
                  border: "none",
                  borderRadius: 8,
                  color: !converterFile || converterRunning ? "#555" : "#000",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: !converterFile || converterRunning ? "not-allowed" : "pointer",
                  fontFamily: "'Space Grotesk', sans-serif",
                  transition: "all 0.2s",
                  marginBottom: 16
                }}
              >
                {(language === "uk" ? "🎬 Конвертувати" : "🎬 Convert")}
              </button>
            ) : (
              <button
                onClick={cancelConverter}
                style={{
                  width: "100%",
                  padding: "16px",
                  background: "#2A1212",
                  border: "1px solid #5A2020",
                  borderRadius: 8,
                  color: "#FF8888",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "'Space Grotesk', sans-serif",
                  transition: "all 0.2s",
                  marginBottom: 16
                }}
              >
                ⏹ {language === "uk" ? "Скасувати (Esc)" : "Cancel (Esc)"}
              </button>
            )}

            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              {(lastOutputDir || outputPath) && (
                <button className="pill-btn" onClick={() => openOutputFolder()}>
                  📂 {language === "uk" ? "Відкрити папку" : "Open folder"}
                </button>
              )}
              {showConverterOutput && (
                <button className="pill-btn" onClick={clearConverterOutput}>
                  {language === "uk" ? "✕ Очистити" : "✕ Clear"}
                </button>
              )}
            </div>

            {/* Progress Bar */}
            {converterRunning && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: "#aaa" }}>
                    {converterProgress > 0 ? `${converterProgress.toFixed(1)}%` : (language === "uk" ? "⏳ Обробка..." : "⏳ Processing...")}
                  </div>
                </div>
                <div style={{ width: "100%", height: 8, background: "#1E1E28", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{
                    width: converterProgress > 0 ? `${converterProgress}%` : "30%",
                    height: "100%",
                    background: "linear-gradient(90deg, #5B5BFF, #7AFF91)",
                    transition: "width 0.3s",
                    ...(converterProgress <= 0 ? { animation: "pulse 1.2s ease-in-out infinite" } : {}),
                  }} />
                </div>
              </div>
            )}

            {/* Output */}
            {showConverterOutput && converterOutput && (
              <div ref={converterOutputBoxRef} style={{
                background: "#0F0F14",
                border: "1px solid #1E1E28",
                borderRadius: 8,
                padding: 16,
                fontSize: 11,
                color: "#aaa",
                fontFamily: "'IBM Plex Mono', monospace",
                whiteSpace: "pre-wrap",
                maxHeight: 200,
                overflowY: "auto"
              }}>
                {converterOutput}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
