import { useState, useEffect, useRef } from "react";

const isElectron = typeof window !== 'undefined' && window.electronAPI;

const QUALITY_OPTIONS = {
  video: [
    { value: "2160", label: "4K / 2160p", icon: "◈" },
    { value: "1440", label: "1440p QHD", icon: "◇" },
    { value: "1080", label: "1080p FHD", icon: "◆" },
    { value: "720", label: "720p HD", icon: "▸" },
    { value: "480", label: "480p SD", icon: "▹" },
    { value: "360", label: "360p", icon: "▫" },
    { value: "best", label: "Найкраща", icon: "★" },
  ],
  audio: [
    { value: "320", label: "320 kbps", icon: "◈" },
    { value: "256", label: "256 kbps", icon: "◇" },
    { value: "192", label: "192 kbps", icon: "◆" },
    { value: "128", label: "128 kbps", icon: "▸" },
    { value: "96", label: "96 kbps", icon: "▹" },
    { value: "best", label: "Найкраща", icon: "★" },
  ],
};

const FORMAT_OPTIONS = [
  { id: "video_audio", label: "Відео + Звук", desc: "Повне відео з аудіо" },
  { id: "video_only", label: "Тільки відео", desc: "Відео без звуку" },
  { id: "audio_only", label: "Тільки аудіо", desc: "Музика або подкаст" },
];

const VIDEO_FORMATS = ["mp4", "mkv", "webm", "avi", "mov"];
const AUDIO_FORMATS = ["mp3", "m4a", "opus", "flac", "wav"];

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

export default function App() {
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState("video_audio");
  const [videoQuality, setVideoQuality] = useState("1080");
  const [audioQuality, setAudioQuality] = useState("192");
  const [videoFormat, setVideoFormat] = useState("mp4");
  const [audioFormat, setAudioFormat] = useState("mp3");
  const [subtitles, setSubtitles] = useState(false);
  const [thumbnail, setThumbnail] = useState(false);
  const [playlistItems, setPlaylistItems] = useState("");
  const [outputPath, setOutputPath] = useState("");
  const [copied, setCopied] = useState(false);
  const [ytdlpStatus, setYtdlpStatus] = useState(null);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState("");
  const [showOutput, setShowOutput] = useState(false);

  const state = { url, mode, videoQuality, audioQuality, videoFormat, audioFormat, subtitles, thumbnail, playlistItems, outputPath };
  const command = buildCommand(state);
  const isAudio = mode === "audio_only";
  const isVideoOnly = mode === "video_only";

  useEffect(() => {
    if (isElectron) {
      window.electronAPI.checkYtDlp().then(res => setYtdlpStatus(res));
    }
  }, []);

  const copyCommand = () => {
    if (command) {
      navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const runDownload = async () => {
    if (!command || !isElectron) return;
    setRunning(true);
    setShowOutput(true);
    setOutput("⏳ Завантаження розпочато...\n");
    const result = await window.electronAPI.runCommand(command);
    setOutput(result.output || (result.success ? "✅ Готово!" : "❌ Помилка"));
    setRunning(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0C0C0F", fontFamily: "'IBM Plex Mono', monospace", color: "#E8E6E0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&family=Space+Grotesk:wght@700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #111; } ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
        .pill-btn { background: transparent; border: 1px solid #2A2A30; color: #888; padding: 6px 16px; border-radius: 999px; cursor: pointer; font-family: 'IBM Plex Mono', monospace; font-size: 12px; transition: all 0.2s; }
        .pill-btn:hover { border-color: #555; color: #ccc; }
        .pill-btn.active { background: #E8E6E0; border-color: #E8E6E0; color: #0C0C0F; font-weight: 600; }
        .quality-chip { background: transparent; border: 1px solid #222; color: #666; padding: 8px 14px; border-radius: 6px; cursor: pointer; font-family: 'IBM Plex Mono', monospace; font-size: 11px; transition: all 0.15s; display: flex; align-items: center; gap: 6px; }
        .quality-chip:hover { border-color: #444; color: #aaa; background: #111; }
        .quality-chip.active { background: #1A1A22; border-color: #5B5BFF; color: #9090FF; }
        .format-card { background: #0F0F14; border: 1px solid #1E1E28; border-radius: 10px; padding: 16px; cursor: pointer; transition: all 0.2s; flex: 1; }
        .format-card:hover { border-color: #333; }
        .format-card.active { background: #12121C; border-color: #5B5BFF; box-shadow: 0 0 20px rgba(91,91,255,0.1); }
        .toggle-switch { width: 40px; height: 22px; background: #1E1E28; border-radius: 11px; position: relative; cursor: pointer; transition: background 0.2s; border: none; flex-shrink: 0; }
        .toggle-switch.on { background: #5B5BFF; }
        .toggle-switch::after { content: ''; position: absolute; width: 16px; height: 16px; background: #666; border-radius: 50%; top: 3px; left: 3px; transition: all 0.2s; }
        .toggle-switch.on::after { transform: translateX(18px); background: #fff; }
        .url-input { width: 100%; background: #0F0F14; border: 1px solid #1E1E28; color: #E8E6E0; font-family: 'IBM Plex Mono', monospace; font-size: 13px; padding: 14px 16px; border-radius: 8px; outline: none; transition: border-color 0.2s; }
        .url-input:focus { border-color: #5B5BFF; }
        .url-input::placeholder { color: #333; }
        .cmd-box { background: #060608; border: 1px solid #1A1A22; border-radius: 8px; padding: 20px; font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: #7AFF91; line-height: 1.8; word-break: break-all; min-height: 80px; }
        .copy-btn { background: #5B5BFF; color: white; border: none; padding: 10px 22px; border-radius: 6px; cursor: pointer; font-family: 'IBM Plex Mono', monospace; font-size: 12px; font-weight: 600; transition: all 0.2s; }
        .copy-btn:hover { background: #7777FF; }
        .copy-btn:disabled { background: #2A2A30; color: #444; cursor: not-allowed; }
        .run-btn { background: #1A2A1A; color: #7AFF91; border: 1px solid #2A4A2A; padding: 10px 22px; border-radius: 6px; cursor: pointer; font-family: 'IBM Plex Mono', monospace; font-size: 12px; font-weight: 600; transition: all 0.2s; }
        .run-btn:hover { background: #2A3A2A; }
        .run-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .section-label { font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #444; margin-bottom: 10px; }
        .fmt-pill { background: transparent; border: 1px solid #222; color: #555; padding: 5px 12px; border-radius: 5px; cursor: pointer; font-family: 'IBM Plex Mono', monospace; font-size: 11px; transition: all 0.15s; }
        .fmt-pill:hover { border-color: #444; color: #aaa; }
        .fmt-pill.active { border-color: #5B5BFF; color: #9090FF; background: #0F0F1A; }
        .titlebar { -webkit-app-region: drag; }
        .titlebar-btn { -webkit-app-region: no-drag; }
        .output-box { background: #060608; border: 1px solid #1A2A1A; border-radius: 8px; padding: 16px; font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: #7AFF91; max-height: 200px; overflow-y: auto; white-space: pre-wrap; word-break: break-all; }
      `}</style>

      {/* Custom Titlebar (Electron only) */}
      {isElectron && (
        <div className="titlebar" style={{ height: 40, background: "#09090C", borderBottom: "1px solid #111", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", userSelect: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 24, height: 24, background: "#5B5BFF", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>↓</div>
            <span style={{ fontSize: 12, color: "#555", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700 }}>yt-dlp Builder</span>
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
      <div style={{ borderBottom: "1px solid #111", padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#09090C" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {!isElectron && <div style={{ width: 36, height: 36, background: "#5B5BFF", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>↓</div>}
          <div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, letterSpacing: "-0.5px" }}>yt-dlp <span style={{ color: "#5B5BFF" }}>Builder</span></div>
            <div style={{ fontSize: 10, color: "#333", letterSpacing: "1px" }}>COMMAND GENERATOR · 1000+ СЕРВІСІВ</div>
          </div>
        </div>
        {isElectron && ytdlpStatus && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: ytdlpStatus.installed ? "#7AFF91" : "#FF5555" }} />
            <span style={{ fontSize: 11, color: ytdlpStatus.installed ? "#7AFF91" : "#FF5555" }}>
              {ytdlpStatus.installed ? `yt-dlp ${ytdlpStatus.version}` : "yt-dlp не встановлено"}
            </span>
          </div>
        )}
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 24px" }}>

        {/* yt-dlp not installed warning */}
        {isElectron && ytdlpStatus && !ytdlpStatus.installed && (
          <div style={{ background: "#1A0F0F", border: "1px solid #5A2020", borderRadius: 8, padding: "12px 16px", marginBottom: 20, fontSize: 12, color: "#FF8888" }}>
            ⚠️ yt-dlp не знайдено. Встанови його: <code style={{ background: "#2A1010", padding: "2px 6px", borderRadius: 4 }}>winget install yt-dlp</code> або <code style={{ background: "#2A1010", padding: "2px 6px", borderRadius: 4 }}>pip install yt-dlp</code>
          </div>
        )}

        {/* URL */}
        <div style={{ marginBottom: 24 }}>
          <div className="section-label">01 — URL відео або плейлисту</div>
          <input className="url-input" type="text" placeholder="https://youtube.com/watch?v=..." value={url} onChange={e => setUrl(e.target.value)} />
        </div>

        {/* Mode */}
        <div style={{ marginBottom: 24 }}>
          <div className="section-label">02 — Що завантажити</div>
          <div style={{ display: "flex", gap: 10 }}>
            {FORMAT_OPTIONS.map(f => (
              <div key={f.id} className={`format-card ${mode === f.id ? "active" : ""}`} onClick={() => setMode(f.id)}>
                <div style={{ fontSize: 12, fontWeight: 600, color: mode === f.id ? "#9090FF" : "#666", marginBottom: 4 }}>{f.label}</div>
                <div style={{ fontSize: 10, color: "#333" }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Quality */}
        <div style={{ display: "grid", gridTemplateColumns: isAudio || isVideoOnly ? "1fr" : "1fr 1fr", gap: 20, marginBottom: 24 }}>
          {!isAudio && (
            <div>
              <div className="section-label">03 — Якість відео</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {QUALITY_OPTIONS.video.map(q => (
                  <button key={q.value} className={`quality-chip ${videoQuality === q.value ? "active" : ""}`} onClick={() => setVideoQuality(q.value)}>
                    <span>{q.icon}</span> {q.label}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 10, color: "#333", marginBottom: 6, letterSpacing: "1px" }}>ФОРМАТ</div>
              <div style={{ display: "flex", gap: 6 }}>
                {VIDEO_FORMATS.map(f => <button key={f} className={`fmt-pill ${videoFormat === f ? "active" : ""}`} onClick={() => setVideoFormat(f)}>{f}</button>)}
              </div>
            </div>
          )}
          {!isVideoOnly && (
            <div>
              <div className="section-label">{isAudio ? "03" : "04"} — Якість аудіо</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {QUALITY_OPTIONS.audio.map(q => (
                  <button key={q.value} className={`quality-chip ${audioQuality === q.value ? "active" : ""}`} onClick={() => setAudioQuality(q.value)}>
                    <span>{q.icon}</span> {q.label}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 10, color: "#333", marginBottom: 6, letterSpacing: "1px" }}>ФОРМАТ</div>
              <div style={{ display: "flex", gap: 6 }}>
                {AUDIO_FORMATS.map(f => <button key={f} className={`fmt-pill ${audioFormat === f ? "active" : ""}`} onClick={() => setAudioFormat(f)}>{f}</button>)}
              </div>
            </div>
          )}
        </div>

        {/* Advanced */}
        <div style={{ marginBottom: 24 }}>
          <div className="section-label">05 — Додаткові параметри</div>
          <div style={{ background: "#0F0F14", border: "1px solid #1E1E28", borderRadius: 10, padding: "14px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { label: "Субтитри", desc: "Завантажити (uk, en)", val: subtitles, set: setSubtitles },
              { label: "Вбудувати обкладинку", desc: "Додати thumbnail", val: thumbnail, set: setThumbnail },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", ...(i > 0 ? { borderTop: "1px solid #111", paddingTop: 12 } : {}) }}>
                <div>
                  <div style={{ fontSize: 13, color: "#aaa" }}>{item.label}</div>
                  <div style={{ fontSize: 10, color: "#333" }}>{item.desc}</div>
                </div>
                <button className={`toggle-switch ${item.val ? "on" : ""}`} onClick={() => item.set(!item.val)} />
              </div>
            ))}
            <div style={{ borderTop: "1px solid #111", paddingTop: 12 }}>
              <div style={{ fontSize: 12, color: "#aaa", marginBottom: 8 }}>Елементи плейлисту</div>
              <input className="url-input" style={{ fontSize: 11 }} placeholder="напр: 1-10 або 1,3,5" value={playlistItems} onChange={e => setPlaylistItems(e.target.value)} />
            </div>
            <div style={{ borderTop: "1px solid #111", paddingTop: 12 }}>
              <div style={{ fontSize: 12, color: "#aaa", marginBottom: 8 }}>Папка збереження</div>
              <input className="url-input" style={{ fontSize: 11 }} placeholder={isElectron ? "C:\\Users\\name\\Downloads" : "~/Downloads"} value={outputPath} onChange={e => setOutputPath(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Command */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div className="section-label" style={{ margin: 0 }}>→ Згенерована команда</div>
          </div>
          <div className="cmd-box">
            {command ? <><span style={{ color: "#444" }}>$ </span><span>{command}</span></> : <span style={{ color: "#222" }}>// Введи URL щоб отримати команду...</span>}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button className="copy-btn" disabled={!command} onClick={copyCommand}>{copied ? "✓ Скопійовано!" : "⎘ Копіювати"}</button>
          {isElectron && (
            <button className="run-btn" disabled={!command || running || (ytdlpStatus && !ytdlpStatus.installed)} onClick={runDownload}>
              {running ? "⏳ Завантаження..." : "▶ Запустити"}
            </button>
          )}
        </div>

        {/* Output */}
        {showOutput && (
          <div style={{ marginTop: 16 }}>
            <div className="section-label">Вивід терміналу</div>
            <div className="output-box">{output}</div>
          </div>
        )}

        {/* Install hint */}
        <div style={{ marginTop: 28, background: "#09090C", border: "1px solid #111", borderRadius: 10, padding: "14px 18px" }}>
          <div className="section-label">Як встановити yt-dlp</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {[
              { os: "Windows", cmd: "winget install yt-dlp" },
              { os: "macOS", cmd: "brew install yt-dlp" },
              { os: "Linux / pip", cmd: "pip install -U yt-dlp" },
            ].map(item => (
              <div key={item.os} style={{ background: "#0F0F14", border: "1px solid #1A1A22", borderRadius: 6, padding: "8px 14px" }}>
                <div style={{ fontSize: 9, color: "#444", letterSpacing: "1px", marginBottom: 4 }}>{item.os}</div>
                <code style={{ fontSize: 11, color: "#5B5BFF" }}>{item.cmd}</code>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
