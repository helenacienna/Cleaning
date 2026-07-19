'use client';

import { useState } from 'react';

function buildEvidenceTitle({ required, incident }) {
  if (required && incident) {
    return 'Compulsory incident photo evidence';
  }

  if (required) {
    return 'Compulsory photo evidence';
  }

  if (incident) {
    return 'Incident photo evidence';
  }

  return 'Photo evidence';
}

export default function CleanerPhotoLightbox({ photos, title, required = false, incident = false }) {
  const [activePhoto, setActivePhoto] = useState(null);

  const evidenceTitle = buildEvidenceTitle({ required, incident });
  const evidenceClassName = [
    'cleaner-photo-evidence',
    required ? 'compulsory-photo-evidence' : '',
    incident ? 'incident-photo-evidence' : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      <section className={evidenceClassName} aria-label={evidenceTitle}>
        <div className="cleaner-photo-evidence-title">{evidenceTitle}</div>
        <div className="flag-row cleaner-photo-evidence-row">
          {photos.slice(0, 6).map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setActivePhoto(photo)}
              className="cleaner-photo-preview-button"
            >
              <img
                src={photo.photoUrl}
                alt={`${title} evidence`}
                className="cleaner-photo-preview-image"
              />
            </button>
          ))}
        </div>
      </section>

      {activePhoto && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`${title} photo preview`}>
          <div className="fullscreen-checklist" style={{ alignItems: 'center', justifyContent: 'center' }}>
            <header className="modal-header compact-modal-header" style={{ width: '100%' }}>
              <div>
                <span className="badge">{evidenceTitle}</span>
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
                className={required ? 'cleaner-photo-full-preview compulsory-photo-full-preview' : 'cleaner-photo-full-preview'}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
