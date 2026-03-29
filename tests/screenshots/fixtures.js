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
      formats: [{ name: 'Vinyl', descriptions: ['LP', 'Album'], text: '' }],
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
      formats: [{ name: 'Vinyl', descriptions: ['LP', 'Album', 'Reissue'], text: '' }],
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
      formats: [{ name: 'Vinyl', descriptions: ['LP', 'Album'], text: '' }],
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
  // Disable shuffle so Random Picks always render in collection order
  await page.addInitScript(() => {
    Math.random = () => 0.999;
  });

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

  // Mock Discogs release detail (returns same shape as discogs_release_full)
  await page.route('**/api/discogs/release/*', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        discogs_id: '123456',
        title: 'Discovery',
        artist: 'Daft Punk',
        year: '2001',
        label: 'Virgin',
        catalog_number: 'V2940',
        format: 'Vinyl',
        genres: JSON.stringify(['Electronic']),
        styles: JSON.stringify(['House', 'Disco']),
        country: 'France',
        cover_image_url: '',
        barcode: '',
        price_low: '20.00',
        price_median: '35.00',
        price_high: '60.00',
        price_currency: 'USD',
        num_for_sale: '15',
        rating_average: '4.2',
        rating_count: '500',
        already_in_discogs: false,
        discogs_extra: {
          tracklist: [
            { position: '1', title: 'One More Time', duration: '5:20', type_: 'track' },
            { position: '2', title: 'Aerodynamic', duration: '3:32', type_: 'track' },
          ],
          formats: [{ name: 'Vinyl', qty: '2', descriptions: ['LP', 'Album'] }],
          extraartists: [],
          notes: '',
          identifiers: [{ type: 'Barcode', value: '724384960650' }],
          companies: [{ entity_type_name: 'Pressed By', name: 'MPO' }],
          series: [],
        },
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

  // Mock setup endpoints
  await page.route('**/api/setup/validate', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ valid: true, username: 'testuser' }),
    });
  });

  await page.route('**/api/setup', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        discogs_connected: true,
        discogs_username: 'testuser',
        discogs_token_set: true,
        anthropic_key_set: false,
      }),
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
        anthropic_key_valid: true,
        vision_model: 'claude-sonnet-4-6',
        format_filter: 'Vinyl',
      }),
    });
  });

  // Mock settings endpoint
  await page.route('**/api/settings', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          discogs_token_set: true,
          discogs_token_masked: '••••abcd',
          anthropic_key_set: true,
          anthropic_key_masked: '••••xyz1',
          vision_model: 'claude-sonnet-4-6',
          supported_models: ['claude-sonnet-4-6', 'claude-haiku-4', 'claude-opus-4'],
          format_filter: 'Vinyl',
          google_client_id_set: false,
          google_client_secret_set: false,
          allowed_emails: '',
          sync_missing_master_ids: 0,
        }),
      });
    }
    // POST — return updated settings
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        discogs_token_set: true,
        discogs_token_masked: '••••abcd',
        anthropic_key_set: true,
        anthropic_key_masked: '••••xyz1',
        vision_model: 'claude-sonnet-4-6',
        supported_models: ['claude-sonnet-4-6', 'claude-haiku-4', 'claude-opus-4'],
        format_filter: 'Vinyl',
        google_client_id_set: false,
        google_client_secret_set: false,
        allowed_emails: '',
        sync_missing_master_ids: 0,
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
    anthropic_key_valid: true,
    vision_model: 'claude-sonnet-4-6',
    vinyl_only: true,
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

/**
 * Mock API with an empty collection.
 * Status endpoint still returns defaults (connected).
 */
async function mockEmptyApi(page) {
  await mockApi(page);
  await page.unroute('**/api/collection');
  await page.route('**/api/collection', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, id: 99 }),
    });
  });
}

const MOCK_SYNC_DIFF = [
  {
    discogs_id: '555001',
    title: 'Endtroducing.....',
    artist: 'DJ Shadow',
    year: '1996',
    label: 'Mo Wax',
    format: 'Vinyl',
    cover_image_url: '',
    thumb: '',
  },
  {
    discogs_id: '555002',
    title: 'Since I Left You',
    artist: 'The Avalanches',
    year: '2000',
    label: 'Modular Recordings',
    format: 'Vinyl',
    cover_image_url: '',
    thumb: '',
  },
  {
    discogs_id: '555003',
    title: 'Donuts',
    artist: 'J Dilla',
    year: '2006',
    label: 'Stones Throw Records',
    format: 'Vinyl',
    cover_image_url: '',
    thumb: '',
  },
  {
    discogs_id: '555004',
    title: 'Cosmogramma',
    artist: 'Flying Lotus',
    year: '2010',
    label: 'Warp Records',
    format: 'Vinyl',
    cover_image_url: '',
    thumb: '',
  },
  // Possible duplicate — same title/artist as MOCK_COLLECTION[0] but different pressing
  {
    discogs_id: '555005',
    title: 'Discovery',
    artist: 'Daft Punk',
    year: '2001',
    label: 'Parlophone',
    catalog_number: '0190295195014',
    format: 'Vinyl, LP, Album, Reissue',
    cover_image_url: '',
    thumb: '',
    _duplicate: true,
    _local_match: {
      id: 1,
      discogs_id: '123456',
      title: 'Discovery',
      artist: 'Daft Punk',
      year: '2001',
      label: 'Virgin',
      catalog_number: 'V2940',
      format: 'Vinyl, LP, Album',
      cover_image_url: '',
    },
  },
  // Second duplicate — different pressing of MOCK_COLLECTION[1]
  {
    discogs_id: '555006',
    title: 'Music Has the Right to Children',
    artist: 'Boards of Canada',
    year: '2013',
    label: 'Warp Records',
    catalog_number: 'WARPLP55R',
    format: 'Vinyl, LP, Album, Reissue, Remastered',
    cover_image_url: '',
    thumb: '',
    _duplicate: true,
    _local_match: {
      id: 2,
      discogs_id: '789012',
      title: 'Music Has the Right to Children',
      artist: 'Boards of Canada',
      year: '1998',
      label: 'Warp Records',
      catalog_number: 'WARPCD55',
      format: 'Vinyl, LP, Album',
      cover_image_url: '',
    },
  },
];

/**
 * Mock sync API endpoints for screenshot tests.
 * Call after mockApi().
 */
async function mockSyncApi(page, { diff = MOCK_SYNC_DIFF, importResult = null } = {}) {
  await page.route('**/api/sync/fetch', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        diff,
        total_in_discogs: MOCK_COLLECTION.length + diff.length,
        already_in_morewax: MOCK_COLLECTION.length,
      }),
    });
  });

  const importCount = importResult ? importResult.imported : diff.length;
  const skipCount = importResult ? (importResult.skipped || 0) : 0;

  await page.route('**/api/sync/import', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'importing', total: importCount }),
    });
  });

  await page.route('**/api/sync/status', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'done',
        imported: importCount,
        skipped: skipCount,
        replaced: 0,
        total: importCount,
        progress: importCount,
      }),
    });
  });
}

/**
 * Mock sync API with failed records for screenshot tests.
 */
async function mockSyncWithFailed(page) {
  const diff = MOCK_SYNC_DIFF;
  const failed = [
    { title: 'Broken Record', artist: 'Missing Data', year: '2024', format: 'LP' },
    { title: 'Bad Import', artist: 'No Discogs ID', year: '2023', format: 'CD' },
  ];

  await page.route('**/api/sync/fetch', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        diff,
        total_in_discogs: MOCK_COLLECTION.length + diff.length,
        already_in_morewax: MOCK_COLLECTION.length,
      }),
    });
  });

  await page.route('**/api/sync/import', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'importing', total: diff.length }),
    });
  });

  await page.route('**/api/sync/status', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'done',
        imported: diff.length - failed.length,
        skipped: 0,
        replaced: 0,
        total: diff.length,
        progress: diff.length,
        failed,
      }),
    });
  });
}

/**
 * Mock auth endpoint. By default auth is not required (local access).
 * Call with authRequired=true to simulate remote access with auth enabled.
 */
async function mockAuth(page, { authRequired = false, email = '', avatar = '' } = {}) {
  await page.route('**/auth/status', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        auth_enabled: authRequired,
        authenticated: authRequired ? !!email : true,
        email: email || null,
        name: email ? email.split('@')[0] : null,
        picture: avatar || null,
      }),
    });
  });
}

/**
 * Override settings mock to include Google OAuth credentials (auth active).
 * Call AFTER mockApi.
 */
async function mockSettingsWithAuth(page) {
  await page.unroute('**/api/settings');
  await page.route('**/api/settings', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          discogs_token_set: true,
          discogs_token_masked: '••••abcd',
          anthropic_key_set: true,
          anthropic_key_masked: '••••xyz1',
          vision_model: 'claude-sonnet-4-6',
          supported_models: ['claude-sonnet-4-6', 'claude-haiku-4', 'claude-opus-4'],
          format_filter: 'Vinyl',
          google_client_id_set: true,
          google_client_id_masked: '••••.com',
          google_client_secret_set: true,
          google_client_secret_masked: '••••qA_-',
          allowed_emails: 'user@example.com',
          sync_missing_master_ids: 0,
        }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        discogs_token_set: true,
        discogs_token_masked: '••••abcd',
        anthropic_key_set: true,
        anthropic_key_masked: '••••xyz1',
        vision_model: 'claude-sonnet-4-6',
        supported_models: ['claude-sonnet-4-6', 'claude-haiku-4', 'claude-opus-4'],
        format_filter: 'Vinyl',
        google_client_id_set: false,
        google_client_secret_set: false,
        allowed_emails: '',
        sync_missing_master_ids: 0,
      }),
    });
  });
}

module.exports = { mockApi, mockEmptyApi, mockStatus, mockAuth, mockSettingsWithAuth, mockSyncApi, mockSyncWithFailed, MOCK_COLLECTION, MOCK_SEARCH_RESULTS, MOCK_SYNC_DIFF };
