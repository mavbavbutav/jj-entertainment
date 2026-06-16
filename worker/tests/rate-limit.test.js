import assert from 'node:assert/strict';
import test from 'node:test';

import worker from '../src/index.js';

test('form worker rate limits repeated submissions from the same IP', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ id: 'email_mock' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });

  try {
    const env = createEnv();
    for (let index = 0; index < 5; index += 1) {
      const response = await worker.fetch(createRequest({
        Email: `rate-limit-${index}@example.com`,
        'Business name': `Rate Limit Co ${index}`
      }), env);
      assert.equal(response.status, 200);
    }

    const blocked = await worker.fetch(createRequest({
      Email: 'blocked@example.com',
      'Business name': 'Blocked Co'
    }), env);
    const payload = await blocked.json();

    assert.equal(blocked.status, 429);
    assert.equal(payload.ok, false);
    assert.match(payload.message, /too many/i);
    assert.equal(blocked.headers.get('Retry-After') !== null, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('form worker rejects POST submissions without an Origin header by default', async () => {
  let fetchCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    fetchCalled = true;
    return new Response(JSON.stringify({ id: 'email_mock' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  try {
    const response = await worker.fetch(createRequest({}, { includeOrigin: false }), createEnv());
    const payload = await response.json();

    assert.equal(response.status, 403);
    assert.equal(payload.ok, false);
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function createRequest(overrides = {}, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'CF-Connecting-IP': '203.0.113.80'
  };
  if (options.includeOrigin !== false) {
    headers.Origin = 'https://jjecreative.com';
  }

  return new Request('https://jje-founding-five-form.johnmartinferguson.workers.dev', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      'Full name': 'Jordan Smith',
      'Business name': 'Smith Plumbing',
      Email: 'jordan@example.com',
      Phone: '615-555-0100',
      'Website or social link': 'https://smithplumbing.example',
      'Business location': 'Franklin, TN',
      'Package interest': 'Growth Package',
      'Ideal timeline': 'Within 30 days',
      'Estimated budget': '$3,500-$6,500',
      'Current website status': 'Existing site needs refresh',
      'Project goals': 'Book more qualified repair calls.',
      'Automation opportunity': 'Follow up with new leads faster.',
      'Founding Five consent': 'I understand this application does not guarantee one of the five Founding Five slots.',
      ...overrides
    })
  });
}

function createEnv() {
  return {
    ALLOWED_ORIGINS: 'https://jjecreative.com',
    FROM_EMAIL: 'JJ Entertainment Solutions <noreply@example.com>',
    TO_EMAIL: 'contact@example.com',
    RESEND_API_KEY: 'test_resend_key'
  };
}
