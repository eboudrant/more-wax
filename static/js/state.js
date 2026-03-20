'use strict';

// ─────────────────────────────────────────────────────────────────
//  STATE  (no tokens here — all API keys live on the server)
// ─────────────────────────────────────────────────────────────────
let collection      = [];
let currentSort     = 'added';
let selectedRelease = null;   // Discogs release chosen by user
let cameraStream    = null;   // MediaStream for camera
let capturedPhoto   = null;   // base64 jpeg taken by user
let isScanning      = false;  // Quagga active?
let addModal        = null;   // modal reference (unused, kept for compat)
let currentView     = 'dashboard'; // active view: dashboard | collection

// Temp store for search results (avoids global pollution)
window._searchResults    = [];
window._detectedBarcode  = null;
