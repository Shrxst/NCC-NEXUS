import { useEffect, useState } from "react";
import {
  Upload,
  FileText,
  Eye,
  Trash2,
  Award,
  X,
  Image,
  ShieldCheck,
} from "lucide-react";
import "./CertificateModule.css";

function formatFileSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

export default function CertificateModule({ storageKey = "certificates" }) {
  const STORAGE_KEY = storageKey;

  const loadCertificates = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  };

  const saveCertificates = (list) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  };

  const [certs, setCerts] = useState(() => loadCertificates());
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    saveCertificates(certs);
  }, [certs]);

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const item = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl: e.target.result,
        uploadedAt: new Date().toISOString(),
      };
      setCerts((s) => [item, ...s]);
    };
    reader.readAsDataURL(file);
  };

  const onFileChange = (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (f) handleFile(f);
  };

  const openPreview = (cert) => setPreview(cert);
  const closePreview = () => setPreview(null);

  const removeCert = (id) => {
    if (!window.confirm("Remove this certificate?")) return;
    setCerts((s) => s.filter((c) => c.id !== id));
  };

  const inputId = `${STORAGE_KEY}-file-input`;
  const isImage = (type) => type && type.startsWith("image/");

  return (
    <div className="cert-shell">
      {/* Header */}
      <div className="cert-page-head">
        <div className="cert-page-head-text">
          <h2>Certificates</h2>
          <p>Upload and manage your NCC certificates and achievements</p>
          <span className="cert-head-accent" />
        </div>
      </div>

      {/* Upload Card */}
      <div className="cert-upload-card">
        <div className="cert-upload-icon">
          <Upload size={26} strokeWidth={1.8} />
        </div>
        <div className="cert-upload-info">
          <h3>Upload Certificate</h3>
          <p>Upload an image or PDF of your certificate — max 10MB</p>
          <div className="cert-upload-formats">
            <span className="cert-format-tag">JPG</span>
            <span className="cert-format-tag">PNG</span>
            <span className="cert-format-tag">PDF</span>
          </div>
        </div>
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          onChange={onFileChange}
          className="hidden-file-input"
        />
        <label htmlFor={inputId} className="cert-upload-btn">
          <Upload size={16} />
          Choose File
        </label>
      </div>

      {/* Section Header */}
      <div className="cert-section-header">
        <h3>
          <Award size={20} strokeWidth={1.8} />
          Your Certificates
          {certs.length > 0 && (
            <span className="cert-count-badge">{certs.length}</span>
          )}
        </h3>
      </div>

      {/* Grid */}
      <div className="cert-grid">
        {certs.length === 0 ? (
          <div className="cert-empty">
            <div className="cert-empty-icon">
              <ShieldCheck size={34} strokeWidth={1.5} />
            </div>
            <h4>No Certificates Yet</h4>
            <p>
              Upload your NCC certificates, camp completions, and achievement
              documents to keep them organized.
            </p>
          </div>
        ) : (
          certs.map((c, i) => (
            <div
              key={c.id}
              className="cert-card"
              style={{ animationDelay: `${i * 0.06}s` }}
            >
              <div className="cert-thumb" onClick={() => openPreview(c)}>
                {isImage(c.type) ? (
                  <img src={c.dataUrl} alt={c.name} />
                ) : (
                  <div className="cert-file-icon">
                    <FileText size={28} strokeWidth={1.5} />
                    <span className="cert-file-icon-label">PDF</span>
                  </div>
                )}
                <div className="cert-thumb-overlay">
                  <span className="cert-thumb-overlay-text">
                    <Eye size={14} />
                    Preview
                  </span>
                </div>
              </div>
              <div className="cert-meta">
                <div className="cert-name" title={c.name}>
                  {c.name}
                </div>
                <div className="cert-sub">
                  <span
                    className={`cert-type-badge ${isImage(c.type) ? "" : "pdf"}`}
                  >
                    {isImage(c.type) ? "Image" : "PDF"}
                  </span>
                  {c.size > 0 && (
                    <span className="cert-size">{formatFileSize(c.size)}</span>
                  )}
                </div>
                <div className="cert-sub">
                  {new Date(c.uploadedAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </div>
                <div className="cert-actions">
                  <button
                    className="cert-action-btn view"
                    onClick={() => openPreview(c)}
                  >
                    <Eye size={14} />
                    View
                  </button>
                  <button
                    className="cert-action-btn delete"
                    onClick={() => removeCert(c.id)}
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Preview Modal */}
      {preview && (
        <div className="cert-modal" onClick={closePreview}>
          <div className="cert-modal-inner" onClick={(e) => e.stopPropagation()}>
            <div className="cert-modal-head">
              <h4>{preview.name}</h4>
              <button className="cert-modal-close" onClick={closePreview}>
                <X size={16} />
                Close
              </button>
            </div>
            <div className="cert-modal-body">
              {isImage(preview.type) ? (
                <img
                  src={preview.dataUrl}
                  alt={preview.name}
                  className="cert-preview-image"
                />
              ) : (
                <iframe
                  title={preview.name}
                  src={preview.dataUrl}
                  className="cert-preview-iframe"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
