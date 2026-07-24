'use client';

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';

function formatPhotoViewerLabel(photo, index, total) {
  const typeLabel = photo?.photoType === 'exception'
    ? 'Before photo'
    : photo?.photoType === 'completion'
      ? 'After photo'
      : 'Photo';
  return `${typeLabel} ${index + 1}/${total}`;
}

export default function CleanerPhotoLightbox({ photos, title, viewerPhotos = photos, framed = false, photoGroupLabel = '' }) {
  const touchStartRef = useRef(null);
  const [activePhotoId, setActivePhotoId] = useState(null);
  const [viewMode, setViewMode] = useState('preview');
  const [deleteStatus, setDeleteStatus] = useState('idle');
  const activePhotos = viewerPhotos?.length ? viewerPhotos : photos;
  const activeIndex = activePhotoId ? activePhotos.findIndex((photo) => photo.id === activePhotoId) : -1;
  const activePhoto = activeIndex >= 0 ? activePhotos[activeIndex] : null;
  const hasMultiplePhotos = activePhotos.length > 1;
  const photoLabel = activePhoto ? formatPhotoViewerLabel(activePhoto, activeIndex, activePhotos.length) : '';

  function closeViewer() {
    setViewMode('preview');
    setDeleteStatus('idle');
    setActivePhotoId(null);
  }

  async function deleteActivePhoto() {
    if (!activePhoto || deleteStatus === 'deleting') return;

    const confirmed = window.confirm(`Delete ${photoLabel}? This cannot be undone.`);
    if (!confirmed) return;

    setDeleteStatus('deleting');

    try {
      const response = await fetch(`/api/task-photos/${activePhoto.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Delete failed');
      }

      closeViewer();
      window.location.reload();
    } catch {
      setDeleteStatus('error');
    }
  }

  function openPhoto(photo) {
    const viewerPhoto = activePhotos.find((candidate) => candidate.id === photo.id) ?? photo;
    setViewMode('preview');
    setActivePhotoId(viewerPhoto.id);
  }

  function movePhoto(direction) {
    if (!hasMultiplePhotos || activeIndex < 0) return;
    const nextIndex = (activeIndex + direction + activePhotos.length) % activePhotos.length;
    setActivePhotoId(activePhotos[nextIndex].id);
  }

  function handleTouchStart(event) {
    const touch = event.touches?.[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleTouchEnd(event) {
    if (!hasMultiplePhotos || !touchStartRef.current) return;
    const touch = event.changedTouches?.[0];
    if (!touch) return;

    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    if (Math.abs(deltaX) < 45 || Math.abs(deltaX) < Math.abs(deltaY) * 1.4) return;
    movePhoto(deltaX < 0 ? 1 : -1);
  }

  const viewerPopup = activePhoto ? (
    <div className="modal-backdrop photo-viewer-popup" role="dialog" aria-modal="true" aria-label={`${title} photo viewer`}>
      <div className={`fullscreen-checklist photo-lightbox-shell ${viewMode === 'original' ? 'photo-lightbox-shell-original' : ''}`}>
        <header className="modal-header compact-modal-header photo-lightbox-header" style={{ width: '100%' }}>
          <strong className="photo-lightbox-title">{title}</strong>
          <div className="photo-lightbox-toolbar" aria-label="Photo viewer controls">
            <span className="badge">{photoLabel}</span>
            {viewMode === 'original' ? <span className="badge neutral">Original photo view</span> : null}
            {viewMode === 'original' ? (
              <button className="button secondary" type="button" onClick={() => setViewMode('preview')}>Back</button>
            ) : (
              <button className="button secondary" type="button" onClick={() => setViewMode('original')}>Open original</button>
            )}
            <button className="button danger" type="button" onClick={deleteActivePhoto} disabled={deleteStatus === 'deleting'}>
              {deleteStatus === 'deleting' ? 'Deleting…' : 'Delete'}
            </button>
            <button className="button secondary" type="button" onClick={closeViewer}>Close</button>
            {deleteStatus === 'error' ? <span className="badge tone-red">Delete failed</span> : null}
          </div>
        </header>
        <div
          className="photo-viewer-stage"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {photoGroupLabel ? <span className="photo-lightbox-group-label">{photoGroupLabel}</span> : null}
          <img
            src={activePhoto.photoUrl}
            alt={`${title} preview`}
            className="photo-viewer-image"
          />
        </div>
        {hasMultiplePhotos ? (
          <div className="photo-viewer-nav-row" aria-label="Photo navigation">
            <button className="photo-viewer-arrow" type="button" aria-label="Previous photo" onClick={() => movePhoto(-1)}>
              ‹
            </button>
            <button className="photo-viewer-arrow" type="button" aria-label="Next photo" onClick={() => movePhoto(1)}>
              ›
            </button>
            <span className="photo-viewer-swipe-hint">Swipe photo to move through photos</span>
          </div>
        ) : null}
      </div>
    </div>
  ) : null;

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

      {viewerPopup ? createPortal(viewerPopup, document.body) : null}
    </>
  );
}
