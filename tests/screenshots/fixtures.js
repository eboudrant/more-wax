// @ts-check
/**
 * Mock API fixtures for screenshot tests.
 * Intercepts server-side API calls so tests are deterministic
 * and don't depend on Discogs credentials or network.
 */

const MOCK_COLLECTION = [
  {
    id: 1,
    discogs_id: 123456,
    artist: 'Daft Punk',
    title: 'Discovery',
    year: '2001',
    label: 'Virgin',
    catalog_number: 'V2940',
    format: 'Vinyl, LP, Album',
    genres: ['Electronic'],
    styles: ['House', 'Disco'],
    cover: '',
    rating: 4,
    notes: '',
    added: '2026-03-01T12:00:00Z',
    median_price: '$35.00',
    low_price: '$20.00',
    high_price: '$60.00',
  },
  {
    id: 2,
    discogs_id: 789012,
    artist: 'Boards of Canada',
    title: 'Music Has the Right to Children',
    year: '1998',
    label: 'Warp Records',
    catalog_number: 'WARPCD55',
    format: 'Vinyl, LP, Album',
    genres: ['Electronic'],
    styles: ['IDM', 'Ambient'],
    cover: '',
    rating: 5,
    notes: 'First pressing',
    added: '2026-03-10T08:30:00Z',
    median_price: '$45.00',
    low_price: '$30.00',
    high_price: '$80.00',
  },
  {
    id: 3,
    discogs_id: 345678,
    artist: 'Khruangbin',
    title: 'Con Todo El Mundo',
    year: '2018',
    label: 'Dead Oceans',
    catalog_number: 'DOC155',
    format: 'Vinyl, LP, Album',
    genres: ['Rock', 'Funk / Soul'],
    styles: ['Psychedelic Rock', 'Funk'],
    cover: '',
    rating: 3,
    notes: '',
    added: '2026-03-15T18:00:00Z',
    median_price: '$25.00',
    low_price: '$18.00',
    high_price: '$40.00',
  },
];

const MOCK_SEARCH_RESULTS = {
  results: [
    {
      id: 123456,
      title: 'Daft Punk - Discovery',
      year: '2001',
      label: ['Virgin'],
      format: ['Vinyl', 'LP'],
      cover_image: '',
      thumb: '',
      type: 'release',
    },
    {
      id: 999001,
      title: 'Daft Punk - Random Access Memories',
      year: '2013',
      label: ['Columbia'],
      format: ['Vinyl', 'LP'],
      cover_image: '',
      thumb: '',
      type: 'release',
    },
    {
      id: 999002,
      title: 'Daft Punk - Homework',
      year: '1997',
      label: ['Virgin'],
      format: ['Vinyl', 'LP'],
      cover_image: '',
      thumb: '',
      type: 'release',
    },
  ],
  pagination: { items: 3, pages: 1, page: 1 },
};

/**
 * Install API mocks on a Playwright page.
 * Call this before page.goto() in each test.
 */
async function mockApi(page) {
  // Mock collection endpoint
  await page.route('**/api/collection', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_COLLECTION),
      });
    }
    // POST (add record) — return success
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, id: 99 }),
    });
  });

  // Mock release details endpoint (/api/collection/{id}/details)
  await page.route('**/api/collection/*/details', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tracklist: [
          { position: '1', title: 'One More Time', duration: '5:20', type_: 'track' },
          { position: '2', title: 'Aerodynamic', duration: '3:32', type_: 'track' },
        ],
      }),
    });
  });

  // Mock individual record lookup
  await page.route('**/api/collection/*', (route) => {
    const id = Number(route.request().url().split('/').pop());
    const record = MOCK_COLLECTION.find((r) => r.id === id) || MOCK_COLLECTION[0];
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(record),
    });
  });

  // Mock Discogs search
  await page.route('**/api/discogs/search*', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_SEARCH_RESULTS),
    });
  });

  // Mock Discogs release detail
  await page.route('**/api/discogs/release/*', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 123456,
        title: 'Discovery',
        artists_sort: 'Daft Punk',
        year: 2001,
        labels: [{ name: 'Virgin', catno: 'V2940' }],
        formats: [{ name: 'Vinyl' }],
        genres: ['Electronic'],
        styles: ['House', 'Disco'],
        images: [],
        tracklist: [
          { position: '1', title: 'One More Time', duration: '5:20' },
          { position: '2', title: 'Aerodynamic', duration: '3:32' },
        ],
      }),
    });
  });

  // Mock Discogs prices
  await page.route('**/api/discogs/prices/*', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ median: '$35.00', low: '$20.00', high: '$60.00' }),
    });
  });

  // Mock status endpoint — default: everything configured
  await page.route('**/api/status', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        discogs_connected: true,
        discogs_username: 'testuser',
        discogs_token_set: true,
        anthropic_key_set: true,
      }),
    });
  });
}

/**
 * Mock /api/status with custom overrides.
 * Call BEFORE mockApi (or after, since last route wins with unroute+route).
 */
async function mockStatus(page, overrides) {
  const status = {
    discogs_connected: true,
    discogs_username: 'testuser',
    discogs_token_set: true,
    anthropic_key_set: true,
    ...overrides,
  };
  await page.unroute('**/api/status');
  await page.route('**/api/status', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(status),
    });
  });
}

module.exports = { mockApi, mockStatus, MOCK_COLLECTION, MOCK_SEARCH_RESULTS };
