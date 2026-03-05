import React, { useMemo, useState } from "react";
import { communityApi } from "../../api/communityApi";

export default function MediaViewer({ mediaUrls = [], videoUrls = [], pdfUrls = [] }) {
  const [modalItem, setModalItem] = useState(null);
  const [downloadingPdfId, setDownloadingPdfId] = useState(null);
  const hasMedia = useMemo(
    () => mediaUrls.length || videoUrls.length || pdfUrls.length,
    [mediaUrls, videoUrls, pdfUrls]
  );

  const handlePdfDownload = async (pdf) => {
    const fallbackUrl = pdf?.url;
    const fallbackName = pdf?.name || "document.pdf";

    try {
      setDownloadingPdfId(pdf?.id || fallbackName);

      let url = fallbackUrl;
      let name = fallbackName;
      if (pdf?.id) {
        const response = await communityApi.getMediaDownloadUrl(pdf.id);
        const data = response?.data?.data || {};
        url = data.url || fallbackUrl;
        name = data.filename || fallbackName;
      }

      if (!url) {
        throw new Error("Download URL not available");
      }

      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = name;
      anchor.rel = "noreferrer";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    } catch (error) {
      alert(error?.message || "Failed to download PDF");
    } finally {
      setDownloadingPdfId(null);
    }
  };

  if (!hasMedia) return null;

  return (
    <>
      <div className="community-media-block">
        {mediaUrls.length ? (
          <div className="community-media-grid">
            {mediaUrls.map((url, idx) => (
              <button
                key={`${url}-${idx}`}
                type="button"
                className="community-image-tile"
                onClick={() => setModalItem({ type: "image", url })}
              >
                <img src={url} alt={`Post media ${idx + 1}`} />
              </button>
            ))}
          </div>
        ) : null}

        {videoUrls.length ? (
          <div className="community-video-list">
            {videoUrls.map((url, idx) => (
              <video key={`${url}-${idx}`} src={url} controls preload="metadata" />
            ))}
          </div>
        ) : null}

        {pdfUrls.length ? (
          <div className="community-pdf-list">
            {pdfUrls.map((pdf, idx) => (
              <button
                key={`${pdf.name}-${idx}`}
                type="button"
                onClick={() => handlePdfDownload(pdf)}
                className="community-pdf-item"
              >
                <span>PDF</span>
                <strong>
                  {downloadingPdfId === pdf.id ? "Preparing download..." : pdf.name || `document-${idx + 1}.pdf`}
                </strong>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {modalItem ? (
        <div className="community-modal-overlay" role="dialog" aria-modal="true" onClick={() => setModalItem(null)}>
          <div className="community-modal-card" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="community-modal-close" onClick={() => setModalItem(null)}>
              Close
            </button>
            {modalItem.type === "image" ? <img src={modalItem.url} alt="Expanded media" /> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
