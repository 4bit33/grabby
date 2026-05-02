import { memo } from 'react';

export const ProgressBar = memo(({ progress, running }) => {
  if (!running && progress.percent === 0) return null;

  return (
    <div style={{ marginTop: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: "#aaa" }}>
          {progress.percent.toFixed(1)}%
          {progress.size && ` • ${progress.size}`}
        </div>
        <div style={{ fontSize: 12, color: "#666" }}>
          {progress.speed && `${progress.speed}`}
          {progress.eta && ` • ETA ${progress.eta}`}
        </div>
      </div>
      <div style={{
        width: "100%",
        height: 8,
        background: "#1E1E28",
        borderRadius: 4,
        overflow: "hidden"
      }}>
        <div style={{
          width: `${progress.percent}%`,
          height: "100%",
          background: "linear-gradient(90deg, #5B5BFF, #7AFF91)",
          transition: "width 0.3s ease",
          borderRadius: 4
        }} />
      </div>
    </div>
  );
});

export const QualityChip = memo(({ quality, active, onClick, icon, label }) => (
  <button
    className={`quality-chip ${active ? "active" : ""}`}
    onClick={onClick}
  >
    <span>{icon}</span> {label}
  </button>
));

export const FormatPill = memo(({ format, active, onClick }) => (
  <button
    className={`fmt-pill ${active ? "active" : ""}`}
    onClick={onClick}
  >
    {format}
  </button>
));

export const FormatCard = memo(({ id, active, onClick, labelKey, descKey, t }) => (
  <div
    className={`format-card ${active ? "active" : ""}`}
    onClick={onClick}
  >
    <div style={{ fontSize: 13, fontWeight: 600, color: active ? "#9090FF" : "#666", marginBottom: 4 }}>
      {t[labelKey]}
    </div>
    <div style={{ fontSize: 11, color: "#666" }}>{t[descKey]}</div>
  </div>
));

export const ToggleSwitch = memo(({ value, onChange }) => (
  <button
    className={`toggle-switch ${value ? "on" : ""}`}
    onClick={() => onChange(!value)}
  />
));

export const QueueItem = memo(({ item, currentDownload, language, onRemove }) => (
  <div
    style={{
      padding: "12px 16px",
      display: "flex",
      alignItems: "center",
      gap: 12,
      background: currentDownload === item.id ? "#12121C" : "transparent"
    }}
  >
    <div style={{
      width: 8,
      height: 8,
      borderRadius: "50%",
      background: item.status === 'completed' ? '#7AFF91' : item.status === 'error' ? '#FF5555' : item.status === 'downloading' ? '#5B5BFF' : '#666',
      flexShrink: 0
    }} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 12, color: "#aaa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {item.url}
      </div>
      {item.status === 'error' && item.output && (
        <div style={{ fontSize: 10, color: "#FF8888", marginTop: 4 }}>
          {item.output.substring(0, 100)}...
        </div>
      )}
    </div>
    <div style={{ fontSize: 11, color: "#666", flexShrink: 0 }}>
      {item.status === 'pending' && (language === "uk" ? "Очікує" : "Pending")}
      {item.status === 'downloading' && (language === "uk" ? "Завантаження..." : "Downloading...")}
      {item.status === 'completed' && (language === "uk" ? "✓ Готово" : "✓ Done")}
      {item.status === 'error' && (language === "uk" ? "✗ Помилка" : "✗ Error")}
    </div>
    {item.status === 'pending' && (
      <button
        onClick={() => onRemove(item.id)}
        style={{
          background: "transparent",
          border: "1px solid #333",
          color: "#888",
          padding: "4px 8px",
          borderRadius: 4,
          cursor: "pointer",
          fontSize: 11,
          transition: "all 0.2s"
        }}
        onMouseEnter={e => { e.target.style.borderColor = "#FF5555"; e.target.style.color = "#FF5555"; }}
        onMouseLeave={e => { e.target.style.borderColor = "#333"; e.target.style.color = "#888"; }}
      >
        ✕
      </button>
    )}
  </div>
));
