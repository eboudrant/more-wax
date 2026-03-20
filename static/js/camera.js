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
    // Wait until the video actually has frame data (videoWidth > 0)
    if (!video.videoWidth) {
      await new Promise(resolve => {
        video.addEventListener('loadeddata', resolve, { once: true });
        // Fallback in case event already fired
        setTimeout(resolve, 1000);
      });
    }
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

  // Crop center 60% of the frame (where the scanner frame is) and scale down
  const SCAN_W = 640;
  const SCAN_H = 300;
  const ctx = canvas.getContext('2d');
  let _decoding = false;

  quaggaPollTimer = setInterval(() => {
    if (!isScanning || !cameraStream) { stopQuaggaPolling(); return; }
    if (video.readyState < video.HAVE_CURRENT_DATA) return;
    if (_decoding) return;

    // Crop center region of the video frame
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const sx = vw * 0.2;            // start at 20% from left
    const sy = vh * 0.25;           // start at 25% from top
    const sw = vw * 0.6;            // 60% width
    const sh = vh * 0.35;           // 35% height

    canvas.width  = SCAN_W;
    canvas.height = SCAN_H;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, SCAN_W, SCAN_H);

    _decoding = true;
    Quagga.decodeSingle({
      decoder: {
        readers: ['ean_reader', 'ean_8_reader', 'upc_reader', 'upc_e_reader',
                  'code_128_reader', 'code_39_reader']
      },
      locate:    false,           // barcode fills most of the cropped area
      locator:   { halfSample: true },
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
