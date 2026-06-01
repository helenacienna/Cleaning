'use client';

import { useState } from 'react';

export default function CleanerPhotoLightbox({ photos, title }) {
  const [activePhoto, setActivePhoto] = useState(null);

  return (
    <>
      <div className="flag-row" style={{ marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
        {photos.slice(0, 6).map((photo) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setActivePhoto(photo)}
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

      {activePhoto && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`${title} photo preview`}>
          <div className="fullscreen-checklist" style={{ alignItems: 'center', justifyContent: 'center' }}>
            <header className="modal-header compact-modal-header" style={{ width: '100%' }}>
              <div>
                <span className="badge">Photo preview</span>
                <strong>{title}</strong>
              </div>
              <div className="workflow-banner-actions">
                <a className="button secondary" href={activePhoto.photoUrl} target="_blank" rel="noreferrer">Open original</a>
                <button className="button secondary" type="button" onClick={() => setActivePhoto(null)}>Close</button>
              </div>
            </header>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, width: '100%' }}>
              <img
                src={activePhoto.photoUrl}
                alt={`${title} preview`}
                style={{ maxWidth: '92vw', maxHeight: '78vh', borderRadius: 18, objectFit: 'contain', background: '#fff' }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
