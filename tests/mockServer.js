/**
 * Mock Server implementing CareWave Upload & Consultation Protocol
 * with failure injection switches (Section 5 of Test Plan).
 */
import { computeSHA256 } from '../src/communication/cryptoUtils.js';

export class MockServer {
  constructor() {
    this.reset();
  }

  reset() {
    this.consultations = new Map();
    this.uploadSessions = new Map();
    this.responses = [];
    this.acknowledgedResponses = new Set();
    
    // Tracking for test assertions
    this.consultationsReceived = [];
    this.chunksReceivedThisSession = [];
    this.completedUploads = [];

    // Failure injection switches
    this.failChunkCount = 0;
    this.failChunkStatus = 500;
    this.corruptChunkIndex = -1;
    this.dropAfterChunkIndex = -1;
    this.delayMs = 0;
    this.rejectCompleteDueToHash = false;
  }

  // Failure switch helpers
  failNextChunks(n, status = 503) {
    this.failChunkCount = n;
    this.failChunkStatus = status;
  }

  corruptChunk(index) {
    this.corruptChunkIndex = index;
  }

  dropAfter(index) {
    this.dropAfterChunkIndex = index;
  }

  delay(ms) {
    this.delayMs = ms;
  }

  setReceived(uploadId, indices) {
    const session = this.uploadSessions.get(uploadId) || {
      chunks: new Map(),
      receivedIndices: new Set(),
    };
    for (const idx of indices) {
      session.receivedIndices.add(idx);
    }
    this.uploadSessions.set(uploadId, session);
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Router for handling mock fetch calls
   */
  async handleFetch(url, init = {}) {
    if (this.delayMs > 0) {
      await this.sleep(this.delayMs);
    }

    const path = typeof url === 'string' ? url : url.toString();
    const method = (init.method || 'GET').toUpperCase();

    // 1. Health check
    if (path.includes('/api/health')) {
      return new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
    }

    // 2. Consultation Creation: POST /api/consultations
    if (path.endsWith('/api/consultations') && method === 'POST') {
      const body = JSON.parse(init.body);
      this.consultations.set(body.consultationId, body);
      this.consultationsReceived.push(body);
      return new Response(JSON.stringify({
        status: 'received',
        consultationId: body.consultationId,
        receivedAt: new Date().toISOString()
      }), { status: 201 });
    }

    // 3. Upload Init: POST /api/uploads/init
    if (path.endsWith('/api/uploads/init') && method === 'POST') {
      const manifest = JSON.parse(init.body);
      const uploadId = manifest.componentId || `up-${Date.now()}`;
      
      let session = this.uploadSessions.get(uploadId);
      if (!session) {
        session = {
          uploadId,
          manifest,
          chunks: new Map(),
          receivedIndices: new Set(),
        };
        this.uploadSessions.set(uploadId, session);
      }

      return new Response(JSON.stringify({
        uploadId,
        receivedChunks: Array.from(session.receivedIndices),
        chunkSize: manifest.chunkSize,
        totalChunks: manifest.totalChunks,
      }), { status: 200 });
    }

    // 4. Upload Chunk: PUT /api/uploads/:uploadId/chunks/:index
    const chunkMatch = path.match(/\/api\/uploads\/([^/]+)\/chunks\/(\d+)/);
    if (chunkMatch && method === 'PUT') {
      const uploadId = chunkMatch[1];
      const index = parseInt(chunkMatch[2], 10);

      // Check drop switch
      if (this.dropAfterChunkIndex !== -1 && index > this.dropAfterChunkIndex) {
        throw new TypeError('Connection reset by mock server');
      }

      // Check failure switch
      if (this.failChunkCount > 0) {
        this.failChunkCount--;
        return new Response(JSON.stringify({ error: 'Service Unavailable' }), {
          status: this.failChunkStatus,
        });
      }

      // Inspect chunk data
      const formData = init.body;
      const chunkBlob = formData.get('chunk');
      const clientHash = formData.get('hash') || (init.headers && init.headers['X-Chunk-Hash']);

      // Verify chunk hash
      const computedHash = await computeSHA256(chunkBlob);
      if (index === this.corruptChunkIndex || (clientHash && clientHash !== computedHash)) {
        return new Response(JSON.stringify({ error: 'Chunk hash mismatch' }), { status: 400 });
      }

      const session = this.uploadSessions.get(uploadId) || {
        uploadId,
        chunks: new Map(),
        receivedIndices: new Set(),
      };

      session.chunks.set(index, chunkBlob);
      session.receivedIndices.add(index);
      this.uploadSessions.set(uploadId, session);
      this.chunksReceivedThisSession.push(index);

      return new Response(JSON.stringify({
        status: 'acknowledged',
        index,
        uploadId,
      }), { status: 200 });
    }

    // 5. Upload Complete: POST /api/uploads/:uploadId/complete
    const completeMatch = path.match(/\/api\/uploads\/([^/]+)\/complete/);
    if (completeMatch && method === 'POST') {
      const uploadId = completeMatch[1];
      const { fileHash, totalChunks } = JSON.parse(init.body);
      const session = this.uploadSessions.get(uploadId);

      if (this.rejectCompleteDueToHash) {
        return new Response(JSON.stringify({ error: 'Whole-file checksum mismatch' }), { status: 422 });
      }

      if (!session) {
        return new Response(JSON.stringify({ error: 'Upload session not found' }), { status: 404 });
      }

      if (session.receivedIndices.size !== totalChunks) {
        return new Response(JSON.stringify({
          error: 'Missing chunks',
          received: Array.from(session.receivedIndices),
          expected: totalChunks
        }), { status: 400 });
      }

      this.completedUploads.push({ uploadId, fileHash });
      return new Response(JSON.stringify({
        status: 'verified',
        uploadId,
        completedAt: new Date().toISOString()
      }), { status: 200 });
    }

    // 6. Doctor Responses: GET /api/sync/responses
    if (path.endsWith('/api/sync/responses') && method === 'GET') {
      const unackResponses = this.responses.filter(r => !this.acknowledgedResponses.has(r.id));
      return new Response(JSON.stringify(unackResponses), { status: 200 });
    }

    // 7. Acknowledge Response: PATCH /api/responses/:id/acknowledge
    const ackMatch = path.match(/\/api\/responses\/([^/]+)\/acknowledge/);
    if (ackMatch && method === 'PATCH') {
      const resId = ackMatch[1];
      this.acknowledgedResponses.add(resId);
      return new Response(JSON.stringify({ status: 'acknowledged', id: resId }), { status: 200 });
    }

    // Fallback 404
    return new Response(JSON.stringify({ error: 'Not found', path }), { status: 404 });
  }
}
