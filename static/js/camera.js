// ─────────────────────────────────────────────────────────────────
//  CAMERA / BARCODE SCANNING
// ─────────────────────────────────────────────────────────────────
async function startCameraScan() {
  const statusEl = document.getElementById('barcode-status');
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width:  { ideal: 1280 },
        height: { ideal: 720 }
      }
    });
    const video = document.getElementById('camera-video');
    video.srcObject = cameraStream;
    await video.play();
    if (statusEl) statusEl.textContent = 'Point the barcode at the yellow frame…';
    initQuagga();
  } catch (err) {
    const httpsHint = _httpsHint();
    if (statusEl) statusEl.innerHTML =
      `⚠ Camera unavailable: ${esc(err.message)}${httpsHint}`;
  }
}

function initQuagga() {
  Quagga.init({
    inputStream: {
      name:        'Live',
      type:        'LiveStream',
      target:      document.getElementById('camera-viewport'),
      constraints: { facingMode: 'environment' }
    },
    decoder: {
      readers: ['ean_reader', 'ean_8_reader', 'upc_reader', 'upc_e_reader',
                'code_128_reader', 'code_39_reader']
    },
    locate: true
  }, err => {
    if (err) {
      const s = document.getElementById('barcode-status');
      if (s) s.textContent = 'Barcode engine error: ' + err;
      return;
    }
    isScanning = true;
    Quagga.start();
  });

  // confidence threshold to avoid false positives
  let lastCode = null, lastCount = 0;
  Quagga.onDetected(async result => {
    if (!isScanning) return;
    const code = result.codeResult.code;
    if (!code) return;

    if (code === lastCode) {
      lastCount++;
    } else {
      lastCode  = code;
      lastCount = 1;
    }
    if (lastCount < 3) return;   // require 3 consistent reads

    isScanning = false;
    Quagga.stop();
    stopCamera();

    const s = document.getElementById('barcode-status');
    if (s) s.textContent = `✓ Barcode: ${code}`;

    toast(`Barcode detected: ${code}`);
    await fetchAndShowResults(code, true);
  });
}

function stopCamera() {
  isScanning = false;
  try { Quagga.stop(); } catch (_) {}
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
}

// ─────────────────────────────────────────────────────────────────
//  COVER PHOTO CAPTURE
// ─────────────────────────────────────────────────────────────────
async function openCaptureCamera() {
  const captureSection = document.getElementById('capture-section');
  const video          = document.getElementById('capture-video');
  const snapBtn        = document.getElementById('snap-btn');
  if (!video) return;

  captureSection.style.display = 'none';
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } }
    });
    video.srcObject = cameraStream;
    video.style.display = 'block';
    snapBtn.style.display = 'block';
    await video.play();
  } catch (e) {
    captureSection.style.display = 'block';
    toast('Camera error: ' + e.message + _httpsHintPlain(), 'error');
  }
}

function snapPhoto() {
  const video = document.getElementById('capture-video');
  if (!video) return;

  const canvas = document.createElement('canvas');
  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  capturedPhoto = canvas.toDataURL('image/jpeg', 0.85);

  // Stop camera
  stopCamera();
  video.style.display = 'none';
  document.getElementById('snap-btn').style.display = 'none';

  // Show preview
  document.getElementById('cover-preview-wrap').innerHTML = `
    <img src="${capturedPhoto}"
         style="width:100%;border-radius:8px;max-height:200px;object-fit:cover">`;

  toast('Cover photo captured ✓', 'success');
}
