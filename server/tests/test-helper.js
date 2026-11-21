const { Readable } = require('stream');
const { EventEmitter } = require('events');
const app = require('../src/app');
const db = require('../src/models/db');
const { generateToken } = require('../src/middleware/auth');

function request(method, urlPath, { headers = {}, body = null, isRaw = false } = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(urlPath, 'http://127.0.0.1:5000');
    const reqHeaders = {};
    for (const [k, v] of Object.entries(headers)) {
      reqHeaders[k.toLowerCase()] = String(v);
    }

    let bodyBuffer = null;
    if (body !== null && body !== undefined) {
      if (isRaw || Buffer.isBuffer(body)) {
        bodyBuffer = body;
        if (!reqHeaders['content-type']) reqHeaders['content-type'] = 'application/octet-stream';
      } else if (typeof body === 'object') {
        bodyBuffer = Buffer.from(JSON.stringify(body));
        if (!reqHeaders['content-type']) reqHeaders['content-type'] = 'application/json';
      } else {
        bodyBuffer = Buffer.from(String(body));
      }
      reqHeaders['content-length'] = String(bodyBuffer.length);
    }

    let sent = false;
    const req = new Readable({
      read() {
        if (!sent && bodyBuffer) {
          this.push(bodyBuffer);
          sent = true;
        }
        this.push(null);
      },
    });

    const mockSocket = new EventEmitter();
    mockSocket.remoteAddress = '127.0.0.1';
    mockSocket.encrypted = false;
    mockSocket.writable = true;
    mockSocket.destroy = () => {};
    mockSocket.setTimeout = () => {};

    req.method = method.toUpperCase();
    req.url = parsedUrl.pathname + parsedUrl.search;
    req.originalUrl = req.url;
    req.headers = reqHeaders;
    req.connection = mockSocket;
    req.socket = mockSocket;
    req.complete = true;

    const res = new EventEmitter();
    res.statusCode = 200;
    res.headers = {};
    const resChunks = [];

    res.setHeader = (name, value) => {
      res.headers[name.toLowerCase()] = value;
    };
    res.getHeader = (name) => res.headers[name.toLowerCase()];
    res.removeHeader = (name) => {
      delete res.headers[name.toLowerCase()];
    };

    res.status = (code) => {
      res.statusCode = code;
      return res;
    };

    res.write = (chunk) => {
      if (chunk) resChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return true;
    };

    res.end = (chunk) => {
      if (chunk) resChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const raw = Buffer.concat(resChunks).toString('utf8');
      let json = null;
      try {
        json = JSON.parse(raw);
      } catch (e) {
        json = null;
      }
      resolve({
        statusCode: res.statusCode,
        headers: res.headers,
        body: json || raw,
        raw,
      });
    };

    res.writeHead = (code, headers) => {
      res.statusCode = code;
      if (headers) {
        Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
      }
      return res;
    };

    try {
      app.handle(req, res, (err) => {
        if (err) reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function assertRejects(promise, expectedErrorPattern, message) {
  let threw = false;
  try {
    await promise;
  } catch (err) {
    threw = true;
    if (expectedErrorPattern) {
      const match = typeof expectedErrorPattern === 'string'
        ? err.message.includes(expectedErrorPattern)
        : expectedErrorPattern.test(err.message);
      assert(match, `${message}: Expected error message to match ${expectedErrorPattern}, got "${err.message}"`);
    }
  }
  assert(threw, `${message}: Expected function to throw an error, but it succeeded.`);
}

module.exports = {
  request,
  assert,
  assertRejects,
  generateToken,
};
