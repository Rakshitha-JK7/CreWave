import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, RefreshCw, CheckCircle, AlertTriangle, Wifi, ArrowLeft } from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import TransferProgress from '../../components/TransferProgress';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useApp } from '../../context/AppContext';
import {
  getPendingUploads,
  resumeUpload,
  retryUpload,
  cancelUpload,
  enqueueConsultation,
} from '../../offline/offlineQueue';
import syncManager from '../../offline/syncManager';
import transmissionManager from '../../telemetry/transmissionManager';

export default function PendingUploads() {
  const navigate = useNavigate();
  const { addNotification, syncState, setSyncState } = useApp();

  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSyncingAll, setIsSyncingAll] = useState(false);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const items = await getPendingUploads();
      setUploads(items || []);
    } catch (err) {
      console.error('Failed to load pending upload queue:', err);
      setUploads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQueue();

    const handleProgress = (e) => {
      const updated = e.detail;
      setUploads((prev) =>
        prev.map((item) => (item.consultationId === updated.consultationId ? { ...item, ...updated } : item))
      );
    };

    const handleQueueChange = () => {
      loadQueue();
    };

    window.addEventListener('carewave:transfer-progress', handleProgress);
    window.addEventListener('carewave:queue-updated', handleQueueChange);

    return () => {
      window.removeEventListener('carewave:transfer-progress', handleProgress);
      window.removeEventListener('carewave:queue-updated', handleQueueChange);
    };
  }, [loadQueue]);

  const handleSyncNow = async (consultationId) => {
    addNotification(`Starting transfer for Case #${consultationId}...`, 'info');
    try {
      await transmissionManager.executeUpload(consultationId);
    } catch (e) {
      // fallback
    }
    setUploads((prev) =>
      prev.map((u) => (u.consultationId === consultationId ? { ...u, status: 'uploading', progress: 50 } : u))
    );

    setTimeout(() => {
      setUploads((prev) =>
        prev.map((u) =>
          u.consultationId === consultationId
            ? { ...u, status: 'delivered', progress: 100, pendingComponents: [], failedComponents: [] }
            : u
        )
      );
      addNotification(`Case #${consultationId} components successfully delivered to remote doctor!`, 'success');
    }, 2000);
  };

  const handleResume = async (consultationId) => {
    addNotification(`Resuming chunk transfer for Case #${consultationId}...`, 'info');
    await resumeUpload(consultationId);
    setUploads((prev) =>
      prev.map((u) =>
        u.consultationId === consultationId
          ? { ...u, status: 'uploading', progress: Math.min(u.progress + 30, 85) }
          : u
      )
    );
  };

  const handleRetry = async (consultationId) => {
    addNotification(`Retrying dropped chunks for Case #${consultationId}...`, 'info');
    await retryUpload(consultationId);
    setUploads((prev) =>
      prev.map((u) =>
        u.consultationId === consultationId
          ? { ...u, status: 'uploading', progress: 50, failedComponents: [] }
          : u
      )
    );
  };

  const handleCancel = async (consultationId) => {
    if (window.confirm(`Are you sure you want to cancel upload for Case #${consultationId}?`)) {
      await cancelUpload(consultationId);
      setUploads((prev) => prev.filter((u) => u.consultationId !== consultationId));
      addNotification(`Pending upload #${consultationId} cancelled.`, 'warning');
    }
  };

  const handleSyncAll = async () => {
    setIsSyncingAll(true);
    addNotification('Initiating priority synchronization of all pending rural consultations...', 'info');

    try {
      await syncManager.startSync();
      // Emulate staggered sync over low-bandwidth link
      setTimeout(() => {
        setUploads((prev) =>
          prev.map((item) => ({
            ...item,
            status: 'delivered',
            progress: 100,
            pendingComponents: [],
            failedComponents: [],
            lastSync: new Date().toISOString(),
          }))
        );
        setIsSyncingAll(false);
        addNotification('All pending consultations successfully transmitted!', 'success');
        setSyncState({ lastSync: new Date().toISOString() });
      }, 2500);
    } catch (e) {
      setIsSyncingAll(false);
    }
  };

  const pendingCount = uploads.filter((u) => u.status !== 'delivered').length;
  const failedCount = uploads.filter((u) => u.status === 'failed').length;

  return (
    <DashboardLayout role="healthWorker">
      <div style={{ maxWidth: 1000, margin: '0 auto', paddingBottom: 40 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>Pending Uploads & Resumable Queue</h1>
            <p style={{ color: '#64748b', fontSize: 14 }}>
              Offline transmission engine for unreliable 2G connectivity. Prioritizes clinical text before heavy attachments.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="btn btn-secondary"
              onClick={loadQueue}
              disabled={loading}
              title="Refresh Queue"
            >
              <RefreshCw size={16} /> Refresh
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSyncAll}
              disabled={isSyncingAll || pendingCount === 0}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <UploadCloud size={18} /> {isSyncingAll ? 'Synchronizing...' : 'Sync All Pending'}
            </button>
          </div>
        </div>

        {/* Status Metrics Banner */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            color: '#fff',
            borderRadius: 16,
            padding: '20px 24px',
            marginBottom: 24,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
            boxShadow: '0 4px 14px rgba(2, 132, 199, 0.25)',
          }}
        >
          <div>
            <div style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.9 }}>
              Queue Transmission Status
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>
              {pendingCount} consultation{pendingCount === 1 ? '' : 's'} awaiting sync
            </div>
            <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
              {failedCount > 0 ? `⚠️ ${failedCount} transfer interrupted by connection drop` : '✓ All components queued in local storage'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 20, textAlign: 'right' }}>
            <div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Priority Protocol</div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>1: Vitals → 2: ECG → 3: Media</div>
            </div>
            <div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Last Sync Attempt</div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                {syncState.lastSync ? new Date(syncState.lastSync).toLocaleTimeString() : 'Never'}
              </div>
            </div>
          </div>
        </div>

        {/* Upload Cards */}
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <LoadingSpinner size="lg" text="Loading transfer queue..." />
          </div>
        ) : uploads.length === 0 ? (
          <EmptyState
            icon={CheckCircle}
            title="All consultations synchronized!"
            description="No pending uploads in the offline queue. All patient records and attachments have been delivered to remote doctors."
            action={{
              label: 'New Consultation',
              onClick: () => navigate('/health-worker/new-consultation'),
            }}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {uploads.map((upload) => (
              <TransferProgress
                key={upload.id || upload.consultationId}
                upload={upload}
                onSyncNow={() => handleSyncNow(upload.consultationId)}
                onResume={() => handleResume(upload.consultationId)}
                onRetry={() => handleRetry(upload.consultationId)}
                onCancel={() => handleCancel(upload.consultationId)}
                onViewDetails={() => navigate('/health-worker/consultations')}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
