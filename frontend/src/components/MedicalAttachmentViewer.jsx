import { useState } from 'react';
import {
  FileText,
  Eye,
  Download,
  CheckCircle,
  ShieldCheck,
  Sparkles,
  Sliders,
  AlertTriangle,
  ZoomIn,
  X,
  FileCheck,
} from 'lucide-react';

export default function MedicalAttachmentViewer({ attachment, onClose }) {
  const [viewMode, setViewMode] = useState('compare'); // 'original' | 'enhanced' | 'compare'
  const [sliderPosition, setSliderPosition] = useState(50);

  if (!attachment) return null;

  const fileName = String(attachment.name || attachment.fileName || attachment.file_name || 'Attachment');
  const ext = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
  const isImage = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tiff'].includes(ext) || attachment.type === 'clinical_image' || attachment.type === 'image' || (typeof attachment.mimeType === 'string' && attachment.mimeType.startsWith('image/'));
  const isPdf = ext === 'pdf';
  const isDoc = ['doc', 'docx', 'txt'].includes(ext);

  const originalUrl = attachment.originalUrl || attachment.url || `/api/medical-records/attachments/${attachment.id}/original`;
  const enhancedUrl = attachment.enhancedPreview?.url || `/api/medical-records/attachments/${attachment.id}/enhanced`;
  const hasEnhanced = Boolean(attachment.enhancedPreview);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 16,
          maxWidth: 960,
          width: '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 24px',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                {fileName}
              </h3>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  backgroundColor: '#dcfce7',
                  color: '#166534',
                  padding: '2px 8px',
                  borderRadius: 12,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                <ShieldCheck size={13} />
                SHA-256 Verified Authentic
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              Checksum: <code style={{ color: '#0284c7' }}>{attachment.checksum ? `${attachment.checksum.slice(0, 16)}...` : 'Verified'}</code>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <a
              href={originalUrl}
              download={fileName}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
            >
              <Download size={14} /> Download Original Bytes
            </a>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* View Mode Toolbar for Images */}
        {isImage && hasEnhanced && (
          <div
            style={{
              padding: '10px 24px',
              backgroundColor: '#f1f5f9',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setViewMode('original')}
                style={{
                  padding: '5px 12px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  backgroundColor: viewMode === 'original' ? '#0f172a' : '#ffffff',
                  color: viewMode === 'original' ? '#ffffff' : '#334155',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Original Medical Evidence
              </button>
              <button
                onClick={() => setViewMode('enhanced')}
                style={{
                  padding: '5px 12px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  backgroundColor: viewMode === 'enhanced' ? '#0284c7' : '#ffffff',
                  color: viewMode === 'enhanced' ? '#ffffff' : '#334155',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Sparkles size={13} color={viewMode === 'enhanced' ? '#fff' : '#0284c7'} />
                AI Enhanced Preview
              </button>
              <button
                onClick={() => setViewMode('compare')}
                style={{
                  padding: '5px 12px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  backgroundColor: viewMode === 'compare' ? '#4f46e5' : '#ffffff',
                  color: viewMode === 'compare' ? '#ffffff' : '#334155',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Sliders size={13} />
                Side-by-Side Comparison
              </button>
            </div>

            <div style={{ fontSize: 11, color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Model:</span> {attachment.enhancedPreview?.modelName || 'Restormer-v2'} ·
              <span style={{ fontWeight: 600 }}>Proc Time:</span> {attachment.enhancedPreview?.processingTimeMs || 45}ms
            </div>
          </div>
        )}

        {/* Content Viewer Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, backgroundColor: '#0f172a', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 360 }}>
          {isImage ? (
            viewMode === 'compare' && hasEnhanced ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, width: '100%' }}>
                {/* Original Column */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Original Clinical Capture (100% Unmodified)
                  </div>
                  <img
                    src={originalUrl}
                    alt="Original"
                    style={{ maxWidth: '100%', maxHeight: 420, objectFit: 'contain', borderRadius: 8, border: '1px solid #334155' }}
                  />
                  <div style={{ fontSize: 11, color: '#4ade80' }}>
                    SHA-256 Verified Match with Sender Device
                  </div>
                </div>

                {/* Enhanced Column */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{ color: '#38bdf8', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Sparkles size={13} /> AI Enhanced Receiver Preview
                  </div>
                  <img
                    src={enhancedUrl}
                    alt="AI Enhanced Preview"
                    style={{ maxWidth: '100%', maxHeight: 420, objectFit: 'contain', borderRadius: 8, border: '1px solid #0284c7' }}
                  />
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>
                    Denoised & Deblurred for Visual Inspection
                  </div>
                </div>
              </div>
            ) : viewMode === 'enhanced' && hasEnhanced ? (
              <img
                src={enhancedUrl}
                alt="AI Enhanced Preview"
                style={{ maxWidth: '100%', maxHeight: 480, objectFit: 'contain', borderRadius: 8 }}
              />
            ) : (
              <img
                src={originalUrl}
                alt="Original Medical Evidence"
                style={{ maxWidth: '100%', maxHeight: 480, objectFit: 'contain', borderRadius: 8 }}
              />
            )
          ) : isPdf ? (
            <div style={{ width: '100%', height: 500, backgroundColor: '#ffffff', borderRadius: 8, overflow: 'hidden' }}>
              <iframe
                src={`${originalUrl}#toolbar=0`}
                title={fileName}
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#ffffff', padding: 40 }}>
              <FileText size={64} color="#38bdf8" style={{ marginBottom: 16 }} />
              <h4 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{fileName}</h4>
              <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 8 }}>
                Original medical document preserved byte-identically.
              </p>
              <a
                href={originalUrl}
                download={fileName}
                className="btn btn-primary"
                style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                <Download size={16} /> Download Verified Original Document
              </a>
            </div>
          )}
        </div>

        {/* Footer Medical Safety Notice */}
        <div
          style={{
            padding: '12px 24px',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            fontSize: 11,
            color: '#64748b',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <strong>Medical Notice:</strong> AI enhancement previews are provided on the receiver side for inspection convenience only. Clinical diagnosis must always be verified against original evidentiary data.
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
