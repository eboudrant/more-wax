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
let currentView     = 'dashboard'; // active view: dashboard | collection
let scannerMode     = 'barcode';   // barcode | photo | search
let quaggaPollTimer = null;        // interval ID for barcode polling
let scannerOpen     = false;       // is scanner view visible?
