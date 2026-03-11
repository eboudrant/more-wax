// ─────────────────────────────────────────────────────────────────
//  IMAGE CONVERSION HELPER
//  Handles JPEG/PNG/WebP directly, HEIC via heic2any then native fallback
// ─────────────────────────────────────────────────────────────────
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = e => resolve(e.target.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

function nativeImageToDataUrl(file) {
  // Let the browser decode the image (works for HEIC on Safari/macOS),
  // then draw to canvas to get a universal JPEG data-URL.
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width  = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.88));
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Browser cannot decode this image format'));
    };
    img.src = url;
  });
}

async function imageFileToDataUrl(file) {
  const isHeic = file.type === 'image/heic' || file.type === 'image/heif'
              || /\.hei[cf]$/i.test(file.name);

  if (!isHeic) return blobToDataUrl(file);

  console.log('[HEIC] Starting conversion for:', file.name, file.size, 'bytes');

  // 1) Server-side conversion via sips/ImageMagick/ffmpeg
  try {
    console.log('[HEIC] Step 1: reading file as data-URL…');
    const rawDataUrl = await blobToDataUrl(file);
    console.log('[HEIC] Step 1: sending to /api/convert-image…', rawDataUrl.length, 'chars');
    const res = await fetch('/api/convert-image', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ image: rawDataUrl })
    });
    console.log('[HEIC] Step 1: server responded', res.status);
    const json = await res.json();
    if (json.success && json.image) {
      console.log('[HEIC] ✓ Server conversion succeeded');
      return json.image;
    }
    console.warn('[HEIC] Step 1 failed:', json.error);
  } catch (e) {
    console.warn('[HEIC] Step 1 error:', e.message);
  }

  // 2) Fallback: heic2any in browser
  if (typeof heic2any !== 'undefined') {
    try {
      console.log('[HEIC] Step 2: trying heic2any…');
      const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.88 });
      console.log('[HEIC] ✓ heic2any succeeded');
      return blobToDataUrl(Array.isArray(blob) ? blob[0] : blob);
    } catch (e) {
      console.warn('[HEIC] Step 2 failed:', e.message);
    }
  }

  // 3) Fallback: native browser decoder (Safari handles most HEIC)
  try {
    console.log('[HEIC] Step 3: trying native browser decoding…');
    const result = await nativeImageToDataUrl(file);
    console.log('[HEIC] ✓ Native decoding succeeded');
    return result;
  } catch (e) {
    console.warn('[HEIC] Step 3 failed:', e.message);
    throw new Error(
      'Could not convert HEIC file. Check browser console (F12) for details.'
    );
  }
}
