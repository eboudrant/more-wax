// ─────────────────────────────────────────────────────────────────
//  CAMERA — persistent stream for scanner view
// ─────────────────────────────────────────────────────────────────

// ── Start / Stop camera ──────────────────────────────────────
async function startScannerCamera() {
  const video   = document.getElementById('scanner-video');
  const errEl   = document.getElementById('scanner-cam-error');
  const frameEl = document.getElementById('scanner-frame-wrap');

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width:  { ideal: 1920 },
        height: { ideal: 1080 }
      }
    });
    video.srcObject = cameraStream;
    await video.play();
    // Wait until the video actually has decodable frame data
    await new Promise(resolve => {
      const check = () => {
        if (video.readyState >= video.HAVE_CURRENT_DATA && video.videoWidth > 0) {
          resolve();
        } else {
          requestAnimationFrame(check);
        }
      };
      check();
      // Hard fallback — don't wait forever
      setTimeout(resolve, 2000);
    });
    if (errEl) errEl.classList.add('hidden');
    if (frameEl) frameEl.classList.remove('hidden');
  } catch (err) {
    console.warn('Camera unavailable:', err.message);
    if (errEl) {
      errEl.classList.remove('hidden');
      const hint = _httpsHint();
      if (hint) errEl.innerHTML = `<p class="text-on-surface-v text-sm mb-3">Camera unavailable: ${esc(err.message)}${hint}</p>
        <button onclick="document.getElementById('scanner-file-input').click()" class="btn-primary-new"><i class="bi bi-upload mr-1"></i>Upload a photo instead</button>`;
    }
    // Keep frame visible for layout, just hide the scan line
    const sl = document.getElementById('scanner-scan-line');
    if (sl) sl.style.display = 'none';
  }
}

function stopScannerCamera() {
  stopQuaggaPolling();
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
  const video = document.getElementById('scanner-video');
  if (video) video.srcObject = null;
}


// ── Quagga barcode scanning (shared camera) ─────────────────
let _quaggaLastCode  = null;
let _quaggaLastCount = 0;

function startQuaggaPolling() {
  stopQuaggaPolling();
  _quaggaLastCode  = null;
  _quaggaLastCount = 0;
  isScanning = true;

  const video  = document.getElementById('scanner-video');
  const canvas = document.getElementById('scanner-canvas');
  if (!video || !canvas || !cameraStream) return;

  // Scan center region of the frame, scaled down for speed
  const SCAN_W = 640;
  const SCAN_H = 480;
  const ctx = canvas.getContext('2d');
  let _decoding = false;

  quaggaPollTimer = setInterval(() => {
    if (!isScanning || !cameraStream) { stopQuaggaPolling(); return; }
    if (video.readyState < video.HAVE_CURRENT_DATA) return;
    if (_decoding) return;

    // Crop center 70% of the video frame
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;         // video dimensions not ready yet
    const sx = vw * 0.15;
    const sy = vh * 0.15;
    const sw = vw * 0.7;
    const sh = vh * 0.7;

    canvas.width  = SCAN_W;
    canvas.height = SCAN_H;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, SCAN_W, SCAN_H);

    _decoding = true;
    Quagga.decodeSingle({
      decoder: {
        readers: ['ean_reader', 'ean_8_reader', 'upc_reader', 'upc_e_reader',
                  'code_128_reader', 'code_39_reader']
      },
      locate:    true,
      locator:   { halfSample: true, patchSize: 'medium' },
      src: canvas.toDataURL('image/jpeg', 0.85)
    }, result => {
      _decoding = false;
      const code = result?.codeResult?.code;
      if (!code || !isScanning) return;

      if (code === _quaggaLastCode) {
        _quaggaLastCount++;
      } else {
        _quaggaLastCode  = code;
        _quaggaLastCount = 1;
      }

      // Require 2 consistent reads
      if (_quaggaLastCount >= 2) {
        isScanning = false;
        stopQuaggaPolling();
        toast(`Barcode detected: ${code}`);
        scannerFetchAndShowResults(code, true);
      }
    });
  }, 200);
}

function stopQuaggaPolling() {
  if (quaggaPollTimer) {
    clearInterval(quaggaPollTimer);
    quaggaPollTimer = null;
  }
  isScanning = false;
}


// ── Frame capture ────────────────────────────────────────────
function captureFromScanner() {
  const video  = document.getElementById('scanner-video');
  const canvas = document.getElementById('scanner-canvas');
  if (!video || !canvas || !cameraStream) return null;
  if (video.readyState < video.HAVE_CURRENT_DATA) return null;

  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.92);
}


// ── Flashlight toggle ────────────────────────────────────────
let _flashOn = false;

async function toggleFlashlight() {
  if (!cameraStream) return;
  try {
    const track = cameraStream.getVideoTracks()[0];
    _flashOn = !_flashOn;
    await track.applyConstraints({ advanced: [{ torch: _flashOn }] });
    const btn = document.getElementById('scanner-flash-btn');
    if (btn) btn.classList.toggle('text-amber', _flashOn);
  } catch (_) {
    // torch not supported on this device
  }
}
