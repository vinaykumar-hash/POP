import React, { useState } from 'react';

export default function Step2Photos({ data, onChange, onContinue, onBack }) {
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const photos = data.photos || [];

  const handleFiles = (fileList) => {
    setError(null);
    const files = Array.from(fileList);

    if (photos.length + files.length > 6) {
      setError(`You can upload a maximum of 6 photos. (Currently have ${photos.length})`);
      return;
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const newPhotos = [];

    for (const file of files) {
      if (!validTypes.includes(file.type)) {
        setError('Only JPG, PNG, and WebP images are supported.');
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setError(`File "${file.name}" exceeds the 10MB limit.`);
        return;
      }

      newPhotos.push({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: file.name,
        size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
        previewUrl: URL.createObjectURL(file),
        file
      });
    }

    onChange({
      ...data,
      photos: [...photos, ...newPhotos]
    });
  };

  const handleInputChange = (e) => {
    if (e.target.files) {
      handleFiles(e.target.files);
      e.target.value = ''; // Reset file input so user can pick the same file again if desired
    }
  };

  const handleRemovePhoto = (idToRemove) => {
    setError(null);
    const updated = photos.filter((p) => p.id !== idToRemove);
    onChange({
      ...data,
      photos: updated
    });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (photos.length < 2) {
      setError('Please upload at least 2 photos to continue.');
      return;
    }
    if (photos.length > 6) {
      setError('Please remove photos to stay within the maximum of 6.');
      return;
    }
    onContinue();
  };

  return (
    <form className="step-form-container" onSubmit={handleSubmit} noValidate>
      <div className="step-header">
        <div className="step-badge">Step 2 of 6</div>
        <h1 className="step-title">Show your parking space</h1>
        <p className="step-subtitle">
          Add clear photos so renters know what to expect.
        </p>
      </div>

      {/* Suggestion hints */}
      <div className="tips-box">
        <h2 className="tips-title">Recommended photos to include:</h2>
        <ul className="tips-list">
          <li><strong>Parking Space:</strong> Clear view of the empty parking bay or slot.</li>
          <li><strong>Entrance / Access:</strong> Gate, ramp, or driveway leading in.</li>
          <li><strong>Surrounding Area:</strong> Lighting, security features, or street context.</li>
        </ul>
      </div>

      <div className="form-card">
        <div className="form-group">
          <div className="photos-header-row">
            <label className="form-label" style={{ marginBottom: 0 }}>
              Uploaded Photos ({photos.length}/6) <span className="required-star" aria-hidden="true">*</span>
            </label>
            <span className="photo-requirement-badge">
              Minimum 2 photos required
            </span>
          </div>

          {/* Drag & Drop Area */}
          {photos.length < 6 && (
            <div
              className={`upload-dropzone photo-dropzone ${isDragging ? 'dropzone-active' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                id="photo-upload-input"
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                className="file-hidden-input"
                onChange={handleInputChange}
              />
              <label htmlFor="photo-upload-input" className="upload-zone-label">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                  <circle cx="9" cy="9" r="2" />
                  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                </svg>
                <span className="upload-cta-text">Click to add photos or drag them here</span>
                <span className="upload-format-text">JPEG, PNG, WebP up to 10MB each</span>
              </label>
            </div>
          )}

          {error && (
            <div className="error-message" role="alert" style={{ marginTop: '0.75rem' }}>
              {error}
            </div>
          )}

          {/* Photo Preview Grid */}
          {photos.length > 0 && (
            <div className="photos-grid" role="region" aria-label="Photo previews">
              {photos.map((photo, index) => (
                <div key={photo.id} className="photo-card">
                  <img
                    src={photo.previewUrl}
                    alt={`Parking preview ${index + 1}`}
                    className="photo-img"
                  />
                  {index === 0 && <span className="cover-badge">Cover Photo</span>}
                  <button
                    type="button"
                    className="btn-photo-remove"
                    onClick={() => handleRemovePhoto(photo.id)}
                    aria-label={`Remove photo ${index + 1}: ${photo.name}`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="form-actions space-between">
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          Back
        </button>
        <button
          type="submit"
          id="btn-step2-continue"
          className="btn btn-primary btn-large"
          disabled={photos.length < 2}
        >
          Continue to Location ({photos.length}/2 min)
        </button>
      </div>
    </form>
  );
}
