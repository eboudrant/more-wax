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
      setTimeout(resolve, 2000);
    });
    if (errEl) errEl.classList.add('hidden');
    if (frameEl) frameEl.classList.remove('hidden');
  } catch (err) {
    console.warn('Camera unavailable:', err.message);
    if (errEl) {
      errEl.classList.remove('hidden');
      const hint = _httpsHint();
      if (hint) errEl.innerHTML = `<p class="text-on-surface-v text-sm mb-3">${t('scanner.camera.unavailableWithError', { error: esc(err.message) })}${hint}</p>
        <button onclick="document.getElementById('scanner-file-input').click()" class="btn-primary-new"><i class="bi bi-upload mr-1"></i>${t('scanner.camera.uploadInstead')}</button>`;
    }
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


// ── Quagga LiveStream barcode scanning ───────────────────────
let _quaggaRunning   = false;
let _quaggaLastCode  = null;
let _quaggaLastCount = 0;

function startQuaggaPolling() {
  stopQuaggaPolling();
  _quaggaLastCode  = null;
  _quaggaLastCount = 0;
  isScanning = true;

  // Hidden container for Quagga's own video element
  let container = document.getElementById('quagga-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'quagga-container';
    container.style.cssText = 'position:absolute;top:-9999px;left:-9999px;width:320px;height:240px;overflow:hidden';
    document.body.appendChild(container);
  }

  Quagga.init({
    inputStream: {
      name:        'Live',
      type:        'LiveStream',
      target:      container,
      constraints: {
        facingMode: 'environment',
        width:  { ideal: 1280 },
        height: { ideal: 720 }
      }
    },
    decoder: {
      readers: ['ean_reader', 'ean_8_reader', 'upc_reader', 'upc_e_reader',
                'code_128_reader', 'code_39_reader']
    },
    locate: true
  }, err => {
    if (err) {
      console.warn('Quagga init error:', err);
      return;
    }
    _quaggaRunning = true;
    Quagga.start();
  });

  Quagga.offDetected();
  Quagga.onDetected(result => {
    if (!isScanning) return;
    const code = result?.codeResult?.code;
    if (!code) return;

    if (code === _quaggaLastCode) {
      _quaggaLastCount++;
    } else {
      _quaggaLastCode  = code;
      _quaggaLastCount = 1;
    }

    // Require 3 consistent reads to avoid false positives
    if (_quaggaLastCount >= 3) {
      isScanning = false;
      stopQuaggaPolling();
      toast(t('scanner.barcode.detected', { code }));
      scannerFetchAndShowResults(code, true);
    }
  });
}

function stopQuaggaPolling() {
  if (_quaggaRunning) {
    try { Quagga.stop(); } catch (_) {}
    _quaggaRunning = false;
  }
  try { Quagga.offDetected(); } catch (_) {}
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
