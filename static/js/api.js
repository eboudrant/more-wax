// ─────────────────────────────────────────────────────────────────
//  SERVER API  (all Discogs + business logic lives on the backend)
// ─────────────────────────────────────────────────────────────────
const searchDiscogs   = (q)       => apiGet(`/api/discogs/search?q=${encodeURIComponent(q)}`);
const searchByBarcode = (barcode) => apiGet(`/api/discogs/search?barcode=${encodeURIComponent(barcode)}`);
const getReleaseFull  = (id)      => apiGet(`/api/discogs/release/${id}`);
const getReleasePrices= (id)      => apiGet(`/api/discogs/prices/${id}`);
const getCollectionDetails = (id) => apiGet(`/api/collection/${id}/details`);

async function addToDiscogsCollection(releaseId) {
  if (!releaseId) return false;
  try {
    const res = await apiPost(`/api/discogs/add-to-collection/${releaseId}`, {});
    return res.success === true;
  } catch (e) {
    console.warn('Could not add to Discogs collection:', e.message);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────
//  LOCAL API  (Python backend on localhost)
// ─────────────────────────────────────────────────────────────────
async function apiGet(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error('Backend error ' + res.status);
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(path, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body)
  });
  if (!res.ok && res.status !== 409) throw new Error('Backend error ' + res.status);
  return res.json();
}

async function apiDelete(path) {
  const res = await fetch(path, { method: 'DELETE' });
  if (!res.ok) throw new Error('Backend error ' + res.status);
  return res.json();
}

async function apiPut(path, body) {
  const res = await fetch(path, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body)
  });
  if (!res.ok) throw new Error('Backend error ' + res.status);
  return res.json();
}
