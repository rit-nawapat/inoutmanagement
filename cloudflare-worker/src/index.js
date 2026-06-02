const DEFAULT_CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400',
};

function corsHeaders(origin = '*') {
  const headers = new Headers(DEFAULT_CORS_HEADERS);
  headers.set('Access-Control-Allow-Origin', origin || '*');
  headers.append('Vary', 'Origin');
  return headers;
}

function withCors(response, origin) {
  const headers = new Headers(response.headers);
  const cors = corsHeaders(origin);

  for (const [key, value] of cors.entries()) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function buildTargetUrl(request, env) {
  const target = new URL(env.APPS_SCRIPT_URL);
  const source = new URL(request.url);
  target.search = source.search;
  return target;
}

async function proxyRequest(request, env) {
  const targetUrl = buildTargetUrl(request, env);
  const headers = new Headers(request.headers);
  headers.delete('origin');
  headers.delete('host');
  headers.delete('referer');

  const init = {
    method: request.method,
    headers,
    redirect: 'follow',
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer();
  }

  const upstream = await fetch(targetUrl.toString(), init);
  return withCors(upstream, request.headers.get('Origin') || '*');
}

export default {
  async fetch(request, env) {
    if (!env.APPS_SCRIPT_URL) {
      return new Response('Missing APPS_SCRIPT_URL', {
        status: 500,
        headers: corsHeaders('*'),
      });
    }

    const origin = request.headers.get('Origin') || '*';

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    if (!['GET', 'POST'].includes(request.method)) {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: corsHeaders(origin),
      });
    }

    return proxyRequest(request, env);
  },
};
