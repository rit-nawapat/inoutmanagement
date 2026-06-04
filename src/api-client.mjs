export function createApiClient(baseUrl, fetchImpl = globalThis.fetch) {
  if (!baseUrl) {
    throw new Error('Missing VITE_GOOGLE_SHEET_API_URL');
  }

  async function request(url, options = {}, { timeoutMs = 30000, expectJson = true } = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(url, {
        ...options,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      return expectJson ? response.json() : response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return {
    async getJson(query = null, options = {}) {
      const url = new URL(baseUrl);
      if (query) {
        Object.entries(query).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            url.searchParams.set(key, value);
          }
        });
      }
      url.searchParams.set('_t', Date.now().toString());
      return request(url, { method: 'GET', cache: 'no-store' }, { ...options, expectJson: true });
    },

    async postJson(payload, options = {}) {
      return request(
        baseUrl,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
        { ...options, expectJson: options.expectJson ?? true }
      );
    },
  };
}
