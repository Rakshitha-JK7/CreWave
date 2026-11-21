import React from 'react';
import { useNetworkStatus } from './hooks.js';
import { NetworkSimPreset } from './constants.js';

export function NetworkSimulatorBadge() {
  const { online, quality, rtt, effectiveType, simulatedPreset, setSimulatedPreset } = useNetworkStatus();

  const getBadgeColor = () => {
    if (!online || simulatedPreset === NetworkSimPreset.OFFLINE) return '#ef4444'; // Red
    if (quality === 'poor' || simulatedPreset === NetworkSimPreset.POOR_2G) return '#f59e0b'; // Amber
    if (simulatedPreset === NetworkSimPreset.FLAKY) return '#8b5cf6'; // Purple
    return '#10b981'; // Green
  };

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      padding: '6px 12px',
      borderRadius: '8px',
      backgroundColor: '#1f2937',
      color: '#f9fafb',
      fontSize: '13px',
      fontFamily: 'system-ui, sans-serif',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      <span style={{
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        backgroundColor: getBadgeColor(),
        display: 'inline-block'
      }} />
      <span>
        <strong>Simulated Network:</strong> {simulatedPreset.toUpperCase()} ({online ? `${quality.toUpperCase()}, ${rtt}ms` : 'OFFLINE'})
      </span>

      <select
        value={simulatedPreset}
        onChange={(e) => setSimulatedPreset(e.target.value)}
        style={{
          marginLeft: '8px',
          background: '#374151',
          color: '#ffffff',
          border: '1px solid #4b5563',
          borderRadius: '4px',
          padding: '2px 6px',
          fontSize: '12px',
          cursor: 'pointer'
        }}
      >
        <option value={NetworkSimPreset.NORMAL}>Normal (Broadband)</option>
        <option value={NetworkSimPreset.POOR_2G}>2G (30-50kbps, 800ms)</option>
        <option value={NetworkSimPreset.FLAKY}>Flaky (20% Drop, Jitter)</option>
        <option value={NetworkSimPreset.OFFLINE}>Offline</option>
      </select>
    </div>
  );
}
