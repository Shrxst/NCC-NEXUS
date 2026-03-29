import React, { useEffect, useState } from "react";
import "./CertificateModule.css";

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

  return (
    <div className="cert-shell">
      <div className="cert-upload-row">
        <div className="upload-help">
          <h3>Upload Certificate</h3>
          <p>Upload an image or PDF of your certificate. Accepted: JPG, PNG, PDF — max 10MB.</p>
        </div>

        <div className="upload-controls">
          <input id={inputId} type="file" onChange={onFileChange} className="hidden-file-input" />
          <label htmlFor={inputId} className="quiz-btn-primary">Choose File</label>
        </div>
      </div>

      <h4 className="section-subtitle">Your Certificates</h4>
      <div className="cert-grid">
        {certs.length === 0 ? (
          <div className="empty-msg">No certificates uploaded yet.</div>
        ) : (
          certs.map((c) => (
            <div key={c.id} className="cert-card">
              <div className="cert-thumb" onClick={() => openPreview(c)}>
                {c.type && c.type.startsWith("image/") ? (
                  <img src={c.dataUrl} alt={c.name} />
                ) : (
                  <div className="file-icon">PDF</div>
                )}
              </div>
              <div className="cert-meta">
                <div className="cert-name" title={c.name}>{c.name}</div>
                <div className="cert-sub">{new Date(c.uploadedAt).toLocaleString()}</div>
                <div className="cert-actions">
                  <button className="btn btn-link" onClick={() => openPreview(c)}>View</button>
                  <button className="btn btn-link danger" onClick={() => removeCert(c.id)}>Delete</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {preview && (
        <div className="cert-modal" onClick={closePreview}>
          <div className="cert-modal-inner" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h4>{preview.name}</h4>
              <button className="btn btn-close" onClick={closePreview}>Close</button>
            </div>
            <div className="modal-body">
              {preview.type && preview.type.startsWith("image/") ? (
                <img src={preview.dataUrl} alt={preview.name} className="preview-image" />
              ) : (
                <iframe title={preview.name} src={preview.dataUrl} className="preview-iframe" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
