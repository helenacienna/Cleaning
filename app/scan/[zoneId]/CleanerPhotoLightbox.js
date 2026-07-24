'use client';

import { useState } from 'react';

export default function CleanerPhotoLightbox({ photos, title, viewerPhotos = photos, framed = false }) {
  const [activePhotoId, setActivePhotoId] = useState(null);
  const activePhotos = viewerPhotos?.length ? viewerPhotos : photos;
  const activeIndex = activePhotoId ? activePhotos.findIndex((photo) => photo.id === activePhotoId) : -1;
  const activePhoto = activeIndex >= 0 ? activePhotos[activeIndex] : null;
  const hasMultiplePhotos = activePhotos.length > 1;

  function openPhoto(photo) {
    const viewerPhoto = activePhotos.find((candidate) => candidate.id === photo.id) ?? photo;
    setActivePhotoId(viewerPhoto.id);
  }

  function movePhoto(direction) {
    if (!hasMultiplePhotos || activeIndex < 0) return;
    const nextIndex = (activeIndex + direction + activePhotos.length) % activePhotos.length;
    setActivePhotoId(activePhotos[nextIndex].id);
  }

  return (
    <>
      <div className={framed ? 'photo-preview-frame' : ''} style={{ marginBottom: 12 }}>
        {framed ? <strong className="photo-preview-frame-title">Uploaded Photos</strong> : null}
        <div
          className="photo-preview-strip"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onTouchStart={(event) => event.stopPropagation()}
        >
          {photos.slice(0, 12).map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => openPhoto(photo)}
              style={{ background: 'transparent', border: 0, padding: 0, cursor: 'pointer' }}
            >
              <img
                src={photo.photoUrl}
                alt={`${title} evidence`}
                style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 12, border: '1px solid #d8dee8' }}
              />
            </button>
          ))}
        </div>
      </div>

      {activePhoto && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`${title} photo preview`}>
          <div className="fullscreen-checklist photo-lightbox-shell">
            <header className="modal-header compact-modal-header" style={{ width: '100%' }}>
              <div>
                <span className="badge">Photo preview {hasMultiplePhotos ? `${activeIndex + 1} of ${activePhotos.length}` : ''}</span>
                <strong>{title}</strong>
              </div>
              <div className="workflow-banner-actions">
                <a className="button secondary" href={activePhoto.photoUrl} target="_blank" rel="noreferrer">Open original</a>
                <button className="button secondary" type="button" onClick={() => setActivePhotoId(null)}>Close</button>
              </div>
            </header>
            <div className="photo-viewer-stage">
              {hasMultiplePhotos ? (
                <button className="photo-viewer-arrow photo-viewer-arrow-left" type="button" aria-label="Previous photo" onClick={() => movePhoto(-1)}>
                  ‹
                </button>
              ) : null}
              <img
                src={activePhoto.photoUrl}
                alt={`${title} preview`}
                className="photo-viewer-image"
              />
              {hasMultiplePhotos ? (
                <button className="photo-viewer-arrow photo-viewer-arrow-right" type="button" aria-label="Next photo" onClick={() => movePhoto(1)}>
                  ›
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
