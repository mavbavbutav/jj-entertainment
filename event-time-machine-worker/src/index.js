const EVENT_PRIVACY = new Set(['public', 'private_link', 'password_protected', 'invite_only']);
const DEFAULT_MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const STRIPE_API_VERSION = '2026-02-25.clover';
const LOGIN_TOKEN_MINUTES = 30;
const PASSWORD_RESET_TOKEN_MINUTES = 30;
const ACCOUNT_SESSION_DAYS = 30;
const PASSWORD_ALGORITHM = 'pbkdf2_sha256';
const PASSWORD_ITERATIONS = 100000;
const PASSWORD_SALT_BYTES = 16;
const PASSWORD_MIN_LENGTH = 10;
const PASSWORD_MAX_LENGTH = 200;

const PACKAGE_LIMITS = {
  basic: {
    maxFiles: 300,
    maxStorageBytes: 2 * 1024 * 1024 * 1024
  },
  premium: {
    maxFiles: 1500,
    maxStorageBytes: 10 * 1024 * 1024 * 1024
  },
  film: {
    maxFiles: 0,
    maxStorageBytes: 0
  },
  pro: {
    maxFiles: 5000,
    maxStorageBytes: 50 * 1024 * 1024 * 1024
  }
};

const RATE_LIMITS = {
  signup: { limit: 8, windowSeconds: 60 * 60 },
  login: { limit: 12, windowSeconds: 15 * 60 },
  emailLink: { limit: 6, windowSeconds: 60 * 60 },
  passwordReset: { limit: 6, windowSeconds: 60 * 60 },
  checkout: { limit: 12, windowSeconds: 60 * 60 },
  eventCreate: { limit: 10, windowSeconds: 60 * 60 },
  upload: { limit: 120, windowSeconds: 60 * 60 },
  story: { limit: 60, windowSeconds: 60 * 60 }
};

const EVENT_PACKAGES = {
  basic: {
    key: 'basic',
    name: 'Basic Event Page',
    amount: 2900,
    currency: 'usd',
    description: 'Private event page, timeline sorting, captions, share link, and guest QR code.',
    canCreateEvent: true
  },
  premium: {
    key: 'premium',
    name: 'Premium Time Machine',
    amount: 7900,
    currency: 'usd',
    description: 'Custom themes, slideshow mode, guest stories, memory map, and best moments views.',
    canCreateEvent: true
  },
  film: {
    key: 'film',
    name: 'Highlight Film Add-on',
    amount: 14900,
    currency: 'usd',
    description: 'A concierge recap-film request after your event timeline is built. Delivery is coordinated after upload review.',
    canCreateEvent: false
  },
  pro: {
    key: 'pro',
    name: 'Wedding/Event Pro Package',
    amount: 29900,
    currency: 'usd',
    description: 'QR upload station, pro editing workflow, keepsake options, and event-day support.',
    canCreateEvent: true
  }
};

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const corsHeaders = getCorsHeaders(origin, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      return await routeRequest(request, env, corsHeaders);
    } catch (error) {
      console.error('Event Time Machine API error', error);
      return json({ ok: false, message: 'Something went wrong.' }, 500, corsHeaders);
    }
  }
};

async function routeRequest(request, env, corsHeaders) {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);

  if (pathParts[0] !== 'api') {
    return json({ ok: false, message: 'Not found.' }, 404, corsHeaders);
  }

  if (pathParts[1] === 'health' && request.method === 'GET') {
    return json({ ok: true, service: 'event-time-machine-api' }, 200, corsHeaders);
  }

  if (pathParts[1] === 'packages' && request.method === 'GET') {
    return json({ ok: true, packages: serializePackages() }, 200, corsHeaders);
  }

  if (pathParts[1] === 'auth' && pathParts[2] === 'request-link' && request.method === 'POST') {
    return requestLoginLink(request, env, corsHeaders);
  }

  if (pathParts[1] === 'auth' && pathParts[2] === 'signup' && request.method === 'POST') {
    return signupWithPassword(request, env, corsHeaders);
  }

  if (pathParts[1] === 'auth' && pathParts[2] === 'login' && request.method === 'POST') {
    return loginWithPassword(request, env, corsHeaders);
  }

  if (pathParts[1] === 'auth' && pathParts[2] === 'request-password-reset' && request.method === 'POST') {
    return requestPasswordReset(request, env, corsHeaders);
  }

  if (pathParts[1] === 'auth' && pathParts[2] === 'reset-password' && request.method === 'POST') {
    return resetPassword(request, env, corsHeaders);
  }

  if (pathParts[1] === 'auth' && pathParts[2] === 'change-password' && request.method === 'POST') {
    return changePassword(request, env, corsHeaders);
  }

  if (pathParts[1] === 'auth' && pathParts[2] === 'verify' && request.method === 'POST') {
    return verifyLoginToken(request, env, corsHeaders);
  }

  if (pathParts[1] === 'account' && request.method === 'GET') {
    return getAccount(request, env, corsHeaders);
  }

  if (pathParts[1] === 'checkout' && pathParts[2] === 'session' && request.method === 'POST') {
    return createCheckoutSession(request, env, corsHeaders);
  }

  if (pathParts[1] === 'checkout' && pathParts[2] === 'confirm' && request.method === 'POST') {
    return confirmCheckoutSession(request, env, corsHeaders);
  }

  if (pathParts[1] === 'stripe' && pathParts[2] === 'webhook' && request.method === 'POST') {
    return handleStripeWebhook(request, env, corsHeaders);
  }

  if (pathParts[1] === 'events' && pathParts.length === 2 && request.method === 'POST') {
    return createEvent(request, env, corsHeaders);
  }

  if (pathParts[1] === 'events' && pathParts[2]) {
    const slug = pathParts[2];

    if (pathParts.length === 3 && request.method === 'GET') {
      return getEventResponse(request, env, corsHeaders, slug);
    }

    if (pathParts.length === 3 && request.method === 'PATCH') {
      return updateEvent(request, env, corsHeaders, slug);
    }

    if (pathParts[3] === 'memories' && pathParts.length === 4 && request.method === 'POST') {
      return createMemories(request, env, corsHeaders, slug);
    }

    if (pathParts[3] === 'memories' && pathParts[4] && pathParts[5] === 'file' && request.method === 'GET') {
      return getMemoryFile(request, env, corsHeaders, slug, pathParts[4]);
    }

    if (pathParts[3] === 'memories' && pathParts[4] && pathParts.length === 5 && request.method === 'PATCH') {
      return updateMemory(request, env, corsHeaders, slug, pathParts[4]);
    }

    if (pathParts[3] === 'stories' && pathParts.length === 4 && request.method === 'POST') {
      return createStory(request, env, corsHeaders, slug);
    }
  }

  return json({ ok: false, message: 'Not found.' }, 404, corsHeaders);
}

async function signupWithPassword(request, env, corsHeaders) {
  const limited = await rateLimitResponse(request, env, corsHeaders, 'signup');

  if (limited) {
    return limited;
  }

  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  const name = cleanText(body.name, 160);
  const password = String(body.password || '');

  if (!isValidEmail(email)) {
    return json({ ok: false, message: 'A valid email is required.' }, 400, corsHeaders);
  }

  const passwordError = validatePassword(password);

  if (passwordError) {
    return json({ ok: false, message: passwordError }, 400, corsHeaders);
  }

  const existing = await getCustomerByEmail(env, email);

  if (existing?.password_hash) {
    return json({
      ok: false,
      message: 'An account already exists for this email. Sign in with your password instead.'
    }, 409, corsHeaders);
  }

  const credential = await createPasswordCredential(password);
  let customer = existing || await upsertCustomer(env, { email, name });
  const now = new Date().toISOString();

  await env.EVENT_DB.prepare(`
    UPDATE customers
    SET name = ?, password_hash = ?, password_salt = ?, password_algorithm = ?,
      password_iterations = ?, password_updated_at = ?, updated_at = ?, last_login_at = ?
    WHERE id = ?
  `)
    .bind(
      name || customer.name || null,
      credential.hash,
      credential.salt,
      credential.algorithm,
      credential.iterations,
      now,
      now,
      now,
      customer.id
    )
    .run();

  customer = await getCustomerById(env, customer.id);
  const sessionToken = await createAccountSession(env, customer.id);
  const account = await buildAccountPayload(env, customer);

  return json({ ...account, sessionToken, accountCreated: !existing }, 201, corsHeaders);
}

async function loginWithPassword(request, env, corsHeaders) {
  const limited = await rateLimitResponse(request, env, corsHeaders, 'login');

  if (limited) {
    return limited;
  }

  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');

  if (!isValidEmail(email) || !password) {
    return json({ ok: false, message: 'Email and password are required.' }, 400, corsHeaders);
  }

  const customer = await getCustomerByEmail(env, email);

  if (!customer?.password_hash) {
    return json({ ok: false, message: 'Email or password is incorrect.' }, 401, corsHeaders);
  }

  const isValid = await verifyPassword(password, customer);

  if (!isValid) {
    return json({ ok: false, message: 'Email or password is incorrect.' }, 401, corsHeaders);
  }

  const now = new Date().toISOString();

  await env.EVENT_DB.prepare('UPDATE customers SET last_login_at = ?, updated_at = ? WHERE id = ?')
    .bind(now, now, customer.id)
    .run();

  const updatedCustomer = await getCustomerById(env, customer.id);
  const sessionToken = await createAccountSession(env, customer.id);
  const account = await buildAccountPayload(env, updatedCustomer);

  return json({ ...account, sessionToken }, 200, corsHeaders);
}

async function requestPasswordReset(request, env, corsHeaders) {
  const limited = await rateLimitResponse(request, env, corsHeaders, 'passwordReset');

  if (limited) {
    return limited;
  }

  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  const message = 'If an Event Time Machine account exists for that email, we sent password reset instructions.';
  const payload = { ok: true, emailSent: false, message };

  if (!isValidEmail(email)) {
    return json(payload, 200, corsHeaders);
  }

  const customer = await getCustomerByEmail(env, email);

  if (!customer) {
    return json(payload, 200, corsHeaders);
  }

  const token = createToken();
  const tokenHash = await hashToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + PASSWORD_RESET_TOKEN_MINUTES * 60 * 1000).toISOString();

  await env.EVENT_DB.prepare(`
    INSERT INTO password_reset_tokens (id, customer_id, token_hash, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `)
    .bind(crypto.randomUUID(), customer.id, tokenHash, now.toISOString(), expiresAt)
    .run();

  const resetUrl = buildSitePageUrl(env, 'reset-password/', { token });
  const emailSent = await sendPasswordResetEmail(env, customer, resetUrl);
  payload.emailSent = emailSent;

  if (!emailSent && env.RETURN_LOGIN_LINKS === 'true') {
    payload.resetUrl = resetUrl;
  }

  return json(payload, 200, corsHeaders);
}

async function resetPassword(request, env, corsHeaders) {
  const body = await readJson(request);
  const token = cleanText(body.token, 300);
  const password = String(body.password || '');

  if (!token) {
    return json({ ok: false, message: 'Password reset token is required.' }, 400, corsHeaders);
  }

  const passwordError = validatePassword(password);

  if (passwordError) {
    return json({ ok: false, message: passwordError }, 400, corsHeaders);
  }

  const tokenHash = await hashToken(token);
  const now = new Date().toISOString();
  const row = await env.EVENT_DB.prepare(`
    SELECT password_reset_tokens.*, customers.id AS customer_id
    FROM password_reset_tokens
    JOIN customers ON customers.id = password_reset_tokens.customer_id
    WHERE password_reset_tokens.token_hash = ?
      AND password_reset_tokens.used_at IS NULL
      AND password_reset_tokens.expires_at > ?
  `)
    .bind(tokenHash, now)
    .first();

  if (!row) {
    return json({ ok: false, message: 'This password reset link has expired or was already used.' }, 401, corsHeaders);
  }

  const credential = await createPasswordCredential(password);

  await env.EVENT_DB.batch([
    env.EVENT_DB.prepare(`
      UPDATE customers
      SET password_hash = ?, password_salt = ?, password_algorithm = ?,
        password_iterations = ?, password_updated_at = ?, updated_at = ?, last_login_at = ?
      WHERE id = ?
    `)
      .bind(
        credential.hash,
        credential.salt,
        credential.algorithm,
        credential.iterations,
        now,
        now,
        now,
        row.customer_id
      ),
    env.EVENT_DB.prepare('UPDATE password_reset_tokens SET used_at = ? WHERE customer_id = ? AND used_at IS NULL')
      .bind(now, row.customer_id),
    env.EVENT_DB.prepare('DELETE FROM account_sessions WHERE customer_id = ?')
      .bind(row.customer_id)
  ]);

  const customer = await getCustomerById(env, row.customer_id);
  const sessionToken = await createAccountSession(env, customer.id);
  const account = await buildAccountPayload(env, customer);

  return json({ ...account, sessionToken, passwordReset: true }, 200, corsHeaders);
}

async function changePassword(request, env, corsHeaders) {
  const auth = await requireAuthenticatedCustomer(request, env, corsHeaders);

  if (auth.response) {
    return auth.response;
  }

  const body = await readJson(request);
  const currentPassword = String(body.currentPassword || '');
  const newPassword = String(body.newPassword || body.password || '');
  const passwordError = validatePassword(newPassword);

  if (passwordError) {
    return json({ ok: false, message: passwordError }, 400, corsHeaders);
  }

  const customer = await getCustomerById(env, auth.customer.id);

  if (!customer) {
    return json({ ok: false, message: 'Sign in to change your password.' }, 401, corsHeaders);
  }

  if (customer.password_hash) {
    if (!currentPassword) {
      return json({ ok: false, message: 'Current password is required.' }, 400, corsHeaders);
    }

    const currentPasswordValid = await verifyPassword(currentPassword, customer);

    if (!currentPasswordValid) {
      return json({ ok: false, message: 'Current password is incorrect.' }, 401, corsHeaders);
    }

    if (await verifyPassword(newPassword, customer)) {
      return json({ ok: false, message: 'Choose a new password that is different from your current password.' }, 400, corsHeaders);
    }
  }

  const credential = await createPasswordCredential(newPassword);
  const now = new Date().toISOString();

  await env.EVENT_DB.batch([
    env.EVENT_DB.prepare(`
      UPDATE customers
      SET password_hash = ?, password_salt = ?, password_algorithm = ?,
        password_iterations = ?, password_updated_at = ?, updated_at = ?
      WHERE id = ?
    `)
      .bind(
        credential.hash,
        credential.salt,
        credential.algorithm,
        credential.iterations,
        now,
        now,
        customer.id
      ),
    env.EVENT_DB.prepare('UPDATE password_reset_tokens SET used_at = ? WHERE customer_id = ? AND used_at IS NULL')
      .bind(now, customer.id),
    env.EVENT_DB.prepare('DELETE FROM account_sessions WHERE customer_id = ?')
      .bind(customer.id)
  ]);

  const updatedCustomer = await getCustomerById(env, customer.id);
  const sessionToken = await createAccountSession(env, updatedCustomer.id);
  const account = await buildAccountPayload(env, updatedCustomer);

  return json({ ...account, sessionToken, passwordChanged: true }, 200, corsHeaders);
}

async function requestLoginLink(request, env, corsHeaders) {
  const limited = await rateLimitResponse(request, env, corsHeaders, 'emailLink');

  if (limited) {
    return limited;
  }

  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  const name = cleanText(body.name, 160);

  if (!isValidEmail(email)) {
    return json({ ok: false, message: 'A valid email is required.' }, 400, corsHeaders);
  }

  const customer = await upsertCustomer(env, { email, name });
  const token = createToken();
  const tokenHash = await hashToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LOGIN_TOKEN_MINUTES * 60 * 1000).toISOString();

  await env.EVENT_DB.prepare(`
    INSERT INTO login_tokens (id, customer_id, token_hash, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `)
    .bind(crypto.randomUUID(), customer.id, tokenHash, now.toISOString(), expiresAt)
    .run();

  const signInUrl = buildSiteActionUrl(env, { login_token: token }, 'account');
  const emailSent = await sendLoginEmail(env, customer, signInUrl);
  const payload = {
    ok: true,
    emailSent,
    message: emailSent
      ? 'Check your email for a secure sign-in link.'
      : 'Email delivery is not configured yet. Paid checkout can still create an account after purchase.'
  };

  if (!emailSent && env.RETURN_LOGIN_LINKS === 'true') {
    payload.signInUrl = signInUrl;
  }

  return json(payload, 200, corsHeaders);
}

async function verifyLoginToken(request, env, corsHeaders) {
  const body = await readJson(request);
  const token = cleanText(body.token, 300);

  if (!token) {
    return json({ ok: false, message: 'Sign-in token is required.' }, 400, corsHeaders);
  }

  const tokenHash = await hashToken(token);
  const now = new Date().toISOString();
  const row = await env.EVENT_DB.prepare(`
    SELECT login_tokens.*, customers.email, customers.name, customers.stripe_customer_id, customers.created_at AS customer_created_at
    FROM login_tokens
    JOIN customers ON customers.id = login_tokens.customer_id
    WHERE login_tokens.token_hash = ? AND login_tokens.used_at IS NULL AND login_tokens.expires_at > ?
  `)
    .bind(tokenHash, now)
    .first();

  if (!row) {
    return json({ ok: false, message: 'This sign-in link has expired or was already used.' }, 401, corsHeaders);
  }

  await env.EVENT_DB.batch([
    env.EVENT_DB.prepare('UPDATE login_tokens SET used_at = ? WHERE id = ?').bind(now, row.id),
    env.EVENT_DB.prepare('UPDATE customers SET last_login_at = ?, updated_at = ? WHERE id = ?').bind(now, now, row.customer_id)
  ]);

  const customer = await getCustomerById(env, row.customer_id);
  const sessionToken = await createAccountSession(env, customer.id);
  const account = await buildAccountPayload(env, customer);

  return json({ ...account, sessionToken }, 200, corsHeaders);
}

async function getAccount(request, env, corsHeaders) {
  const auth = await requireAuthenticatedCustomer(request, env, corsHeaders);

  if (auth.response) {
    return auth.response;
  }

  return json(await buildAccountPayload(env, auth.customer), 200, corsHeaders);
}

async function createCheckoutSession(request, env, corsHeaders) {
  const limited = await rateLimitResponse(request, env, corsHeaders, 'checkout');

  if (limited) {
    return limited;
  }

  if (!env.STRIPE_SECRET_KEY) {
    return json({
      ok: false,
      message: 'Stripe is not configured yet. Add STRIPE_SECRET_KEY before taking payments.'
    }, 503, corsHeaders);
  }

  const body = await readJson(request);
  const packageKey = cleanText(body.packageKey, 60);
  const selectedPackage = EVENT_PACKAGES[packageKey];

  if (!selectedPackage) {
    return json({ ok: false, message: 'Choose a valid package.' }, 400, corsHeaders);
  }

  const auth = await requireAuthenticatedCustomer(request, env, corsHeaders);

  if (auth.response) {
    return auth.response;
  }

  const customer = await getCustomerById(env, auth.customer.id);
  const purchaseId = crypto.randomUUID();
  const params = new URLSearchParams();
  const successUrl = buildSiteActionUrl(env, {
    checkout: 'success',
    session_id: '{CHECKOUT_SESSION_ID}'
  }, 'account').replace('%7BCHECKOUT_SESSION_ID%7D', '{CHECKOUT_SESSION_ID}');
  const cancelUrl = buildSiteActionUrl(env, { checkout: 'cancel' }, 'pricing');

  params.set('mode', 'payment');
  params.set('success_url', successUrl);
  params.set('cancel_url', cancelUrl);
  params.set('client_reference_id', customer.id);
  params.set('line_items[0][price_data][currency]', selectedPackage.currency);
  params.set('line_items[0][price_data][unit_amount]', String(selectedPackage.amount));
  params.set('line_items[0][price_data][product_data][name]', selectedPackage.name);
  params.set('line_items[0][price_data][product_data][description]', selectedPackage.description);
  params.set('line_items[0][quantity]', '1');
  params.set('metadata[purchase_id]', purchaseId);
  params.set('metadata[customer_id]', customer.id);
  params.set('metadata[package_key]', selectedPackage.key);
  params.set('payment_intent_data[metadata][purchase_id]', purchaseId);
  params.set('payment_intent_data[metadata][customer_id]', customer.id);
  params.set('payment_intent_data[metadata][package_key]', selectedPackage.key);

  if (customer.stripe_customer_id) {
    params.set('customer', customer.stripe_customer_id);
  } else {
    params.set('customer_creation', 'always');
    params.set('customer_email', customer.email);
  }

  try {
    const session = await stripeRequest(env, 'POST', '/v1/checkout/sessions', params);
    const now = new Date().toISOString();

    await env.EVENT_DB.prepare(`
      INSERT INTO purchases (
        id, customer_id, package_key, package_name, amount, currency, status,
        stripe_checkout_session_id, stripe_customer_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        purchaseId,
        customer.id,
        selectedPackage.key,
        selectedPackage.name,
        selectedPackage.amount,
        selectedPackage.currency,
        'pending',
        session.id,
        session.customer || customer.stripe_customer_id || null,
        now,
        now
      )
      .run();

    return json({
      ok: true,
      checkoutUrl: session.url,
      sessionId: session.id,
      purchaseId,
      package: selectedPackage
    }, 200, corsHeaders);
  } catch (error) {
    console.error('Stripe checkout session failed', error);
    return json({ ok: false, message: error.message || 'Stripe checkout could not be started.' }, 502, corsHeaders);
  }
}

async function confirmCheckoutSession(request, env, corsHeaders) {
  if (!env.STRIPE_SECRET_KEY) {
    return json({
      ok: false,
      message: 'Stripe is not configured yet. Add STRIPE_SECRET_KEY before confirming checkout.'
    }, 503, corsHeaders);
  }

  const body = await readJson(request);
  const sessionId = cleanText(body.sessionId, 140);

  if (!sessionId) {
    return json({ ok: false, message: 'Checkout session id is required.' }, 400, corsHeaders);
  }

  const auth = await requireAuthenticatedCustomer(request, env, corsHeaders);

  if (auth.response) {
    return auth.response;
  }

  try {
    const session = await stripeRequest(env, 'GET', `/v1/checkout/sessions/${encodeURIComponent(sessionId)}`);
    const result = await fulfillCheckoutSession(env, session);

    if (!result.purchase || result.purchase.status !== 'paid') {
      return json({ ok: false, message: 'Checkout is not paid yet.' }, 402, corsHeaders);
    }

    if (result.customer.id !== auth.customer.id) {
      return json({ ok: false, message: 'This checkout belongs to a different account.' }, 403, corsHeaders);
    }

    const sessionToken = await createAccountSession(env, result.customer.id);
    const account = await buildAccountPayload(env, result.customer);

    return json({ ...account, sessionToken, purchase: serializePurchase(result.purchase) }, 200, corsHeaders);
  } catch (error) {
    console.error('Stripe checkout confirmation failed', error);
    return json({ ok: false, message: error.message || 'Checkout could not be confirmed.' }, 502, corsHeaders);
  }
}

async function handleStripeWebhook(request, env, corsHeaders) {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return json({ ok: false, message: 'Stripe webhook secret is not configured.' }, 503, corsHeaders);
  }

  const signature = request.headers.get('Stripe-Signature') || '';
  const payload = await request.text();
  const verified = await verifyStripeSignature(payload, signature, env.STRIPE_WEBHOOK_SECRET);

  if (!verified) {
    return json({ ok: false, message: 'Invalid Stripe signature.' }, 400, corsHeaders);
  }

  const event = JSON.parse(payload);

  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    await fulfillCheckoutSession(env, event.data.object);
  }

  if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
    await markCheckoutSessionFailed(env, event.data.object);
  }

  return json({ ok: true, received: true }, 200, corsHeaders);
}

async function createEvent(request, env, corsHeaders) {
  const limited = await rateLimitResponse(request, env, corsHeaders, 'eventCreate');

  if (limited) {
    return limited;
  }

  const body = await readJson(request);
  const name = cleanText(body.name, 140);
  const privacy = normalizePrivacy(body.privacy);
  const password = cleanText(body.password, 200);
  const requestedPurchaseId = cleanText(body.purchaseId, 80);
  const requestedPackageKey = cleanText(body.packageKey, 60);
  const auth = await requireAuthenticatedCustomer(request, env, corsHeaders);

  if (auth.response) {
    return auth.response;
  }

  const purchase = await getUsablePurchase(env, auth.customer.id, requestedPurchaseId, requestedPackageKey);

  if (name.length < 2) {
    return json({ ok: false, message: 'Event name is required.' }, 400, corsHeaders);
  }

  if (!purchase) {
    return json({
      ok: false,
      message: 'Complete checkout for an event package before creating a saved event workspace.'
    }, 402, corsHeaders);
  }

  const purchasedPackage = EVENT_PACKAGES[purchase.package_key];

  if (!purchasedPackage?.canCreateEvent) {
    return json({
      ok: false,
      message: 'That purchase is an add-on, not an event workspace credit.'
    }, 402, corsHeaders);
  }

  if (privacy === 'password_protected' && !password) {
    return json({ ok: false, message: 'Add an event password before choosing password-protected privacy.' }, 400, corsHeaders);
  }

  const id = crypto.randomUUID();
  const slug = await createUniqueSlug(env, name);
  const ownerToken = createToken();
  const uploadToken = createToken();
  const now = new Date().toISOString();

  await env.EVENT_DB.prepare(`
    INSERT INTO events (
      id, slug, name, privacy, owner_token_hash, upload_token_hash, password_hash,
      customer_id, purchase_id, package_key, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
    .bind(
      id,
      slug,
      name,
      privacy,
      await hashToken(ownerToken),
      await hashToken(uploadToken),
      password ? await hashToken(password) : null,
      auth.customer.id,
      purchase.id,
      purchase.package_key || requestedPackageKey || null,
      now,
      now
    )
    .run();

  if (purchase) {
    await env.EVENT_DB.prepare(`
      UPDATE purchases
      SET event_id = ?, status = 'fulfilled', fulfilled_at = ?, updated_at = ?
      WHERE id = ? AND customer_id = ?
    `)
      .bind(id, now, now, purchase.id, auth.customer.id)
      .run();
  }

  const event = await getEventBySlug(env, slug);

  return json({
    ok: true,
    event: serializeEvent(event, request, env, uploadToken),
    ownerToken,
    uploadToken
  }, 201, corsHeaders);
}

async function getEventResponse(request, env, corsHeaders, slug) {
  const event = await getEventBySlug(env, slug);

  if (!event) {
    return json({ ok: false, message: 'Event not found.' }, 404, corsHeaders);
  }

  const token = getAccessToken(request);
  const password = getEventPassword(request);
  const account = await getAuthenticatedCustomer(request, env);
  const access = await getAccessLevel(event, token, password, account?.customer?.id);

  if (!canViewEvent(event, access)) {
    return json({ ok: false, message: 'This event requires an invite link or password.' }, 401, corsHeaders);
  }

  const [memories, stories] = await Promise.all([
    getMemories(env, event, request, token),
    getStories(env, event.id)
  ]);

  return json({
    ok: true,
    event: serializeEvent(event, request, env, token),
    access,
    memories,
    stories
  }, 200, corsHeaders);
}

async function updateEvent(request, env, corsHeaders, slug) {
  const event = await getEventBySlug(env, slug);

  if (!event) {
    return json({ ok: false, message: 'Event not found.' }, 404, corsHeaders);
  }

  const token = getAccessToken(request);
  const account = await getAuthenticatedCustomer(request, env);
  const access = await getAccessLevel(event, token, '', account?.customer?.id);

  if (access !== 'owner') {
    return json({ ok: false, message: 'Only the event owner can update event settings.' }, 403, corsHeaders);
  }

  const body = await readJson(request);
  const name = cleanText(body.name, 140) || event.name;
  const privacy = normalizePrivacy(body.privacy || event.privacy);
  const password = cleanText(body.password, 200);
  const passwordHash = password ? await hashToken(password) : event.password_hash;
  const now = new Date().toISOString();

  if (privacy === 'password_protected' && !passwordHash) {
    return json({ ok: false, message: 'Add an event password before choosing password-protected privacy.' }, 400, corsHeaders);
  }

  await env.EVENT_DB.prepare(`
    UPDATE events
    SET name = ?, privacy = ?, password_hash = ?, updated_at = ?
    WHERE id = ?
  `)
    .bind(name, privacy, passwordHash, now, event.id)
    .run();

  const updated = await getEventBySlug(env, slug);

  return json({ ok: true, event: serializeEvent(updated, request, env, token) }, 200, corsHeaders);
}

async function createMemories(request, env, corsHeaders, slug) {
  const limited = await rateLimitResponse(request, env, corsHeaders, 'upload');

  if (limited) {
    return limited;
  }

  const event = await getEventBySlug(env, slug);

  if (!event) {
    return json({ ok: false, message: 'Event not found.' }, 404, corsHeaders);
  }

  const formData = await request.formData();
  const token = cleanText(formData.get('token'), 300) || getAccessToken(request);
  const account = await getAuthenticatedCustomer(request, env);
  const access = await getAccessLevel(event, token, '', account?.customer?.id);

  if (!canUploadToEvent(access)) {
    return json({ ok: false, message: 'Upload link is missing or invalid.' }, 401, corsHeaders);
  }

  const files = formData.getAll('files').filter((item) => item && typeof item === 'object' && 'arrayBuffer' in item);
  const maxUploadBytes = Number(env.MAX_UPLOAD_BYTES || DEFAULT_MAX_UPLOAD_BYTES);
  const overLimit = files.find((file) => file.size > maxUploadBytes);

  if (overLimit) {
    return json({ ok: false, message: `Upload is too large: ${overLimit.name || 'file'}.` }, 413, corsHeaders);
  }

  const quotaCheck = await checkEventQuota(env, event, files);

  if (quotaCheck) {
    return json({ ok: false, message: quotaCheck }, 402, corsHeaders);
  }

  const capturedAt = normalizeDateTime(cleanText(formData.get('capturedAt'), 80));
  const guestName = cleanText(formData.get('guestName'), 120);
  const location = cleanText(formData.get('location'), 120);
  const type = cleanText(formData.get('type'), 40) || 'emotional';
  const submittedCaption = cleanText(formData.get('caption'), 1200);
  const created = [];

  if (!files.length) {
    created.push(await insertMemory(env, request, event, {
      capturedAt,
      guestName,
      location,
      type,
      caption: submittedCaption,
      mediaKind: 'note'
    }, token));
  }

  for (const file of files) {
    const memoryId = crypto.randomUUID();
    const fileName = sanitizeFileName(file.name || 'memory-upload');
    const mediaKind = getMediaKind(file.type || '');
    const fileKey = `events/${event.id}/memories/${memoryId}/${fileName}`;

    await env.MEMORY_BUCKET.put(fileKey, file.stream(), {
      httpMetadata: {
        contentType: file.type || 'application/octet-stream'
      },
      customMetadata: {
        eventId: event.id,
        memoryId,
        originalName: file.name || fileName
      }
    });

    created.push(await insertMemory(env, request, event, {
      id: memoryId,
      capturedAt,
      guestName,
      location,
      type,
      caption: submittedCaption,
      mediaKind,
      fileKey,
      fileName,
      fileType: file.type || 'application/octet-stream',
      fileSize: file.size || 0
    }, token));
  }

  return json({ ok: true, memories: created }, 201, corsHeaders);
}

async function updateMemory(request, env, corsHeaders, slug, memoryId) {
  const event = await getEventBySlug(env, slug);

  if (!event) {
    return json({ ok: false, message: 'Event not found.' }, 404, corsHeaders);
  }

  const token = getAccessToken(request);
  const account = await getAuthenticatedCustomer(request, env);
  const access = await getAccessLevel(event, token, '', account?.customer?.id);

  if (access !== 'owner') {
    return json({ ok: false, message: 'Only the event owner can save caption edits.' }, 403, corsHeaders);
  }

  const body = await readJson(request);
  const caption = cleanText(body.caption, 1200);
  const location = cleanText(body.location, 120);
  const guestName = cleanText(body.guestName, 120);
  const now = new Date().toISOString();

  const existing = await env.EVENT_DB.prepare('SELECT * FROM memories WHERE id = ? AND event_id = ?')
    .bind(memoryId, event.id)
    .first();

  if (!existing) {
    return json({ ok: false, message: 'Memory not found.' }, 404, corsHeaders);
  }

  await env.EVENT_DB.prepare(`
    UPDATE memories
    SET caption = ?, location = ?, guest_name = ?, updated_at = ?
    WHERE id = ? AND event_id = ?
  `)
    .bind(
      caption || existing.caption,
      location || existing.location,
      guestName || existing.guest_name,
      now,
      memoryId,
      event.id
    )
    .run();

  const updated = await env.EVENT_DB.prepare('SELECT * FROM memories WHERE id = ? AND event_id = ?')
    .bind(memoryId, event.id)
    .first();

  return json({ ok: true, memory: serializeMemory(updated, event.slug, request) }, 200, corsHeaders);
}

async function createStory(request, env, corsHeaders, slug) {
  const limited = await rateLimitResponse(request, env, corsHeaders, 'story');

  if (limited) {
    return limited;
  }

  const event = await getEventBySlug(env, slug);

  if (!event) {
    return json({ ok: false, message: 'Event not found.' }, 404, corsHeaders);
  }

  const body = await readJson(request);
  const token = cleanText(body.token, 300) || getAccessToken(request);
  const account = await getAuthenticatedCustomer(request, env);
  const access = await getAccessLevel(event, token, cleanText(body.password, 200), account?.customer?.id);

  if (!canAddStory(event, access)) {
    return json({ ok: false, message: 'This event requires the guest link before stories can be added.' }, 401, corsHeaders);
  }

  const guestName = cleanText(body.name, 120);
  const message = cleanText(body.message, 1600);

  if (!guestName || !message) {
    return json({ ok: false, message: 'Name and memory are required.' }, 400, corsHeaders);
  }

  const story = {
    id: crypto.randomUUID(),
    event_id: event.id,
    guest_name: guestName,
    message,
    created_at: new Date().toISOString()
  };

  await env.EVENT_DB.prepare(`
    INSERT INTO stories (id, event_id, guest_name, message, created_at)
    VALUES (?, ?, ?, ?, ?)
  `)
    .bind(story.id, story.event_id, story.guest_name, story.message, story.created_at)
    .run();

  return json({ ok: true, story: serializeStory(story) }, 201, corsHeaders);
}

async function getMemoryFile(request, env, corsHeaders, slug, memoryId) {
  const event = await getEventBySlug(env, slug);

  if (!event) {
    return json({ ok: false, message: 'Event not found.' }, 404, corsHeaders);
  }

  const token = getAccessToken(request);
  const password = getEventPassword(request);
  const account = await getAuthenticatedCustomer(request, env);
  const access = await getAccessLevel(event, token, password, account?.customer?.id);

  if (!canViewEvent(event, access)) {
    return json({ ok: false, message: 'This file requires event access.' }, 401, corsHeaders);
  }

  const memory = await env.EVENT_DB.prepare('SELECT * FROM memories WHERE id = ? AND event_id = ?')
    .bind(memoryId, event.id)
    .first();

  if (!memory || !memory.file_key) {
    return json({ ok: false, message: 'File not found.' }, 404, corsHeaders);
  }

  const object = await env.MEMORY_BUCKET.get(memory.file_key);

  if (!object) {
    return json({ ok: false, message: 'File not found.' }, 404, corsHeaders);
  }

  return new Response(object.body, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': object.httpMetadata?.contentType || memory.file_type || 'application/octet-stream',
      'Cache-Control': event.privacy === 'public' ? 'public, max-age=3600' : 'private, max-age=300',
      'Content-Disposition': `inline; filename="${safeDispositionFileName(memory.file_name || 'memory')}"`
    }
  });
}

async function insertMemory(env, request, event, input, accessToken = '') {
  const id = input.id || crypto.randomUUID();
  const capturedAt = input.capturedAt || new Date().toISOString();
  const guestName = input.guestName || 'Guest';
  const location = input.location || 'Event';
  const type = input.type || 'emotional';
  const chapter = inferChapter(capturedAt, type, input.fileName || '');
  const caption = input.caption || buildCaptionSuggestion(event.name, chapter, guestName, location, type);
  const now = new Date().toISOString();

  await env.EVENT_DB.prepare(`
    INSERT INTO memories (
      id, event_id, chapter, captured_at, guest_name, location, type, caption,
      media_kind, file_key, file_name, file_type, file_size, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
    .bind(
      id,
      event.id,
      chapter,
      capturedAt,
      guestName,
      location,
      type,
      caption,
      input.mediaKind || 'note',
      input.fileKey || null,
      input.fileName || null,
      input.fileType || null,
      input.fileSize || null,
      now,
      now
    )
    .run();

  const memory = await env.EVENT_DB.prepare('SELECT * FROM memories WHERE id = ?')
    .bind(id)
    .first();

  return serializeMemory(memory, event.slug, request, accessToken);
}

async function getEventBySlug(env, slug) {
  return env.EVENT_DB.prepare('SELECT * FROM events WHERE slug = ?')
    .bind(slug)
    .first();
}

async function getMemories(env, event, request, accessToken = '') {
  const result = await env.EVENT_DB.prepare('SELECT * FROM memories WHERE event_id = ? ORDER BY captured_at ASC, created_at ASC')
    .bind(event.id)
    .all();

  return (result.results || []).map((memory) => serializeMemory(memory, event.slug, request, accessToken));
}

async function getStories(env, eventId) {
  const result = await env.EVENT_DB.prepare('SELECT * FROM stories WHERE event_id = ? ORDER BY created_at DESC')
    .bind(eventId)
    .all();

  return (result.results || []).map(serializeStory);
}

function serializePackages() {
  return Object.values(EVENT_PACKAGES).map((item) => ({
    ...item,
    displayPrice: `$${Math.round(item.amount / 100)}`,
    limits: PACKAGE_LIMITS[item.key] || null
  }));
}

async function upsertCustomer(env, input) {
  const email = normalizeEmail(input.email);
  const stripeCustomerId = cleanText(input.stripeCustomerId, 120);
  const name = cleanText(input.name, 160);

  if (!isValidEmail(email)) {
    throw new Error('A valid customer email is required.');
  }

  let customer = null;

  if (stripeCustomerId) {
    customer = await env.EVENT_DB.prepare('SELECT * FROM customers WHERE stripe_customer_id = ?')
      .bind(stripeCustomerId)
      .first();
  }

  if (!customer) {
    customer = await env.EVENT_DB.prepare('SELECT * FROM customers WHERE email = ?')
      .bind(email)
      .first();
  }

  const now = new Date().toISOString();

  if (customer) {
    await env.EVENT_DB.prepare(`
      UPDATE customers
      SET email = ?, name = ?, stripe_customer_id = ?, updated_at = ?
      WHERE id = ?
    `)
      .bind(
        email,
        name || customer.name || null,
        stripeCustomerId || customer.stripe_customer_id || null,
        now,
        customer.id
      )
      .run();

    return getCustomerById(env, customer.id);
  }

  const id = crypto.randomUUID();

  await env.EVENT_DB.prepare(`
    INSERT INTO customers (id, email, name, stripe_customer_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
    .bind(id, email, name || null, stripeCustomerId || null, now, now)
    .run();

  return getCustomerById(env, id);
}

async function getCustomerById(env, customerId) {
  if (!customerId) {
    return null;
  }

  return env.EVENT_DB.prepare('SELECT * FROM customers WHERE id = ?')
    .bind(customerId)
    .first();
}

async function getCustomerByEmail(env, email) {
  const normalized = normalizeEmail(email);

  if (!isValidEmail(normalized)) {
    return null;
  }

  return env.EVENT_DB.prepare('SELECT * FROM customers WHERE email = ?')
    .bind(normalized)
    .first();
}

async function getAuthenticatedCustomer(request, env) {
  const token = getBearerToken(request);

  if (!token) {
    return null;
  }

  const tokenHash = await hashToken(token);
  const now = new Date().toISOString();
  const row = await env.EVENT_DB.prepare(`
    SELECT
      customers.id,
      customers.email,
      customers.name,
      customers.stripe_customer_id,
      customers.password_hash,
      customers.created_at,
      customers.updated_at,
      customers.last_login_at,
      account_sessions.id AS session_id
    FROM account_sessions
    JOIN customers ON customers.id = account_sessions.customer_id
    WHERE account_sessions.token_hash = ? AND account_sessions.expires_at > ?
  `)
    .bind(tokenHash, now)
    .first();

  if (!row) {
    return null;
  }

  await env.EVENT_DB.prepare('UPDATE account_sessions SET last_seen_at = ? WHERE id = ?')
    .bind(now, row.session_id)
    .run();

  return {
    sessionId: row.session_id,
    customer: {
      id: row.id,
      email: row.email,
      name: row.name,
      stripe_customer_id: row.stripe_customer_id,
      password_hash: row.password_hash,
      created_at: row.created_at,
      updated_at: row.updated_at,
      last_login_at: row.last_login_at
    }
  };
}

async function requireAuthenticatedCustomer(request, env, corsHeaders) {
  const auth = await getAuthenticatedCustomer(request, env);

  if (!auth) {
    return {
      response: json({ ok: false, message: 'Sign in to view this account.' }, 401, corsHeaders)
    };
  }

  return auth;
}

async function createAccountSession(env, customerId) {
  const token = createToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ACCOUNT_SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await env.EVENT_DB.prepare(`
    INSERT INTO account_sessions (id, customer_id, token_hash, created_at, expires_at, last_seen_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
    .bind(crypto.randomUUID(), customerId, await hashToken(token), now.toISOString(), expiresAt, now.toISOString())
    .run();

  return token;
}

async function buildAccountPayload(env, customer) {
  const [purchaseRows, eventRows] = await Promise.all([
    env.EVENT_DB.prepare(`
      SELECT purchases.*, events.slug AS event_slug, events.name AS event_name
      FROM purchases
      LEFT JOIN events ON events.id = purchases.event_id
      WHERE purchases.customer_id = ?
      ORDER BY purchases.created_at DESC
    `)
      .bind(customer.id)
      .all(),
    env.EVENT_DB.prepare('SELECT * FROM events WHERE customer_id = ? ORDER BY created_at DESC')
      .bind(customer.id)
      .all()
  ]);

  return {
    ok: true,
    customer: serializeCustomer(customer),
    packages: serializePackages(),
    purchases: (purchaseRows.results || []).map(serializePurchase),
    events: (eventRows.results || []).map((event) => ({
      id: event.id,
      slug: event.slug,
      name: event.name,
      privacy: event.privacy,
      packageKey: event.package_key || '',
      purchaseId: event.purchase_id || '',
      eventUrl: buildShareUrl(env, event.slug, ''),
      createdAt: event.created_at,
      updatedAt: event.updated_at
    }))
  };
}

function serializeCustomer(customer) {
  return {
    id: customer.id,
    email: customer.email,
    name: customer.name || '',
    stripeCustomerId: customer.stripe_customer_id || '',
    hasPassword: Boolean(customer.password_hash),
    createdAt: customer.created_at,
    updatedAt: customer.updated_at,
    lastLoginAt: customer.last_login_at || ''
  };
}

function serializePurchase(purchase) {
  const packageInfo = EVENT_PACKAGES[purchase.package_key] || {
    key: purchase.package_key,
    name: purchase.package_name,
    amount: purchase.amount,
    currency: purchase.currency
  };

  return {
    id: purchase.id,
    packageKey: purchase.package_key,
    packageName: purchase.package_name,
    amount: purchase.amount,
    currency: purchase.currency,
    displayPrice: `$${Math.round(purchase.amount / 100)}`,
    status: purchase.status,
    canCreateEvent: purchase.status === 'paid' && !purchase.event_id && packageInfo.canCreateEvent !== false,
    stripeCheckoutSessionId: purchase.stripe_checkout_session_id || '',
    createdAt: purchase.created_at,
    updatedAt: purchase.updated_at,
    fulfilledAt: purchase.fulfilled_at || '',
    package: packageInfo,
    event: purchase.event_id
      ? {
          id: purchase.event_id,
          slug: purchase.event_slug || '',
          name: purchase.event_name || ''
        }
      : null
  };
}

async function getUsablePurchase(env, customerId, purchaseId, packageKey) {
  const selectedPackageKey = cleanText(packageKey, 60);
  let query = `
    SELECT * FROM purchases
    WHERE customer_id = ? AND status = 'paid' AND event_id IS NULL
  `;
  const params = [customerId];

  if (purchaseId) {
    query += ' AND id = ?';
    params.push(purchaseId);
  }

  if (selectedPackageKey) {
    query += ' AND package_key = ?';
    params.push(selectedPackageKey);
  }

  query += ' ORDER BY created_at ASC LIMIT 1';

  const purchase = await env.EVENT_DB.prepare(query)
    .bind(...params)
    .first();

  if (!purchase) {
    return null;
  }

  const packageInfo = EVENT_PACKAGES[purchase.package_key];
  return packageInfo?.canCreateEvent === false ? null : purchase;
}

async function fulfillCheckoutSession(env, session) {
  const metadata = session.metadata || {};
  const packageKey = cleanText(metadata.package_key, 60);
  const selectedPackage = EVENT_PACKAGES[packageKey];

  if (!selectedPackage) {
    throw new Error('Checkout session package is not recognized.');
  }

  let customer = metadata.customer_id ? await getCustomerById(env, metadata.customer_id) : null;
  const email = normalizeEmail(session.customer_details?.email || session.customer_email || customer?.email);

  if (!customer) {
    customer = await upsertCustomer(env, {
      email,
      name: session.customer_details?.name || '',
      stripeCustomerId: session.customer || ''
    });
  } else {
    customer = await upsertCustomer(env, {
      email: email || customer.email,
      name: session.customer_details?.name || customer.name || '',
      stripeCustomerId: session.customer || customer.stripe_customer_id || ''
    });
  }

  const existing = await env.EVENT_DB.prepare(`
    SELECT * FROM purchases
    WHERE stripe_checkout_session_id = ? OR id = ?
  `)
    .bind(session.id, cleanText(metadata.purchase_id, 80))
    .first();

  const now = new Date().toISOString();
  const paid = session.payment_status === 'paid' || session.status === 'complete';
  const nextStatus = existing?.event_id ? existing.status : (paid ? 'paid' : 'pending');
  const purchaseId = existing?.id || cleanText(metadata.purchase_id, 80) || crypto.randomUUID();

  if (existing) {
    await env.EVENT_DB.prepare(`
      UPDATE purchases
      SET customer_id = ?, package_key = ?, package_name = ?, amount = ?, currency = ?,
        status = ?, stripe_payment_intent_id = ?, stripe_customer_id = ?, updated_at = ?,
        fulfilled_at = COALESCE(fulfilled_at, ?)
      WHERE id = ?
    `)
      .bind(
        customer.id,
        selectedPackage.key,
        selectedPackage.name,
        selectedPackage.amount,
        selectedPackage.currency,
        nextStatus,
        session.payment_intent || existing.stripe_payment_intent_id || null,
        session.customer || existing.stripe_customer_id || null,
        now,
        paid ? now : null,
        existing.id
      )
      .run();
  } else {
    await env.EVENT_DB.prepare(`
      INSERT INTO purchases (
        id, customer_id, package_key, package_name, amount, currency, status,
        stripe_checkout_session_id, stripe_payment_intent_id, stripe_customer_id,
        created_at, updated_at, fulfilled_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        purchaseId,
        customer.id,
        selectedPackage.key,
        selectedPackage.name,
        selectedPackage.amount,
        selectedPackage.currency,
        nextStatus,
        session.id,
        session.payment_intent || null,
        session.customer || null,
        now,
        now,
        paid ? now : null
      )
      .run();
  }

  const purchase = await env.EVENT_DB.prepare('SELECT * FROM purchases WHERE id = ?')
    .bind(purchaseId)
    .first();

  return { customer, purchase };
}

async function markCheckoutSessionFailed(env, session) {
  const nextStatus = session.status === 'expired' ? 'expired' : 'failed';
  const now = new Date().toISOString();

  await env.EVENT_DB.prepare(`
    UPDATE purchases
    SET status = ?, updated_at = ?
    WHERE stripe_checkout_session_id = ? AND status = 'pending'
  `)
    .bind(nextStatus, now, session.id)
    .run();
}

async function stripeRequest(env, method, path, params = null) {
  const init = {
    method,
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Stripe-Version': STRIPE_API_VERSION
    }
  };

  if (method !== 'GET') {
    init.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    init.body = params;
  }

  const response = await fetch(`https://api.stripe.com${path}`, init);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error?.message || `Stripe request failed with status ${response.status}.`);
  }

  return payload;
}

async function verifyStripeSignature(payload, signatureHeader, secret) {
  const pieces = signatureHeader.split(',').reduce((acc, item) => {
    const [key, value] = item.split('=');
    if (!key || !value) return acc;
    acc[key] = acc[key] || [];
    acc[key].push(value);
    return acc;
  }, {});
  const timestamp = pieces.t?.[0];
  const signatures = pieces.v1 || [];

  if (!timestamp || !signatures.length) {
    return false;
  }

  const signedPayload = `${timestamp}.${payload}`;
  const expected = await hmacSha256Hex(secret, signedPayload);

  return signatures.some((signature) => timingSafeEqual(expected, signature));
}

async function hmacSha256Hex(secret, value) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sendLoginEmail(env, customer, signInUrl) {
  if (!env.RESEND_API_KEY || !env.AUTH_EMAIL_FROM) {
    return false;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: env.AUTH_EMAIL_FROM,
      to: customer.email,
      subject: 'Your Event Time Machine sign-in link',
      text: `Open this secure link to sign in to Event Time Machine: ${signInUrl}`,
      html: `
        <p>Open this secure link to sign in to Event Time Machine:</p>
        <p><a href="${escapeHtml(signInUrl)}">Sign in to Event Time Machine</a></p>
        <p>This link expires in ${LOGIN_TOKEN_MINUTES} minutes.</p>
      `
    })
  });

  if (!response.ok) {
    console.warn('Resend email failed', await response.text());
    return false;
  }

  return true;
}

async function sendPasswordResetEmail(env, customer, resetUrl) {
  if (!env.RESEND_API_KEY || !env.AUTH_EMAIL_FROM) {
    return false;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: env.AUTH_EMAIL_FROM,
      to: customer.email,
      subject: 'Reset your Event Time Machine password',
      text: `Use this secure link to reset your Event Time Machine password: ${resetUrl}`,
      html: `
        <p>Use this secure link to reset your Event Time Machine password:</p>
        <p><a href="${escapeHtml(resetUrl)}">Reset your password</a></p>
        <p>This link expires in ${PASSWORD_RESET_TOKEN_MINUTES} minutes. If you did not request it, you can ignore this email.</p>
      `
    })
  });

  if (!response.ok) {
    console.warn('Resend password reset email failed', await response.text());
    return false;
  }

  return true;
}

function serializeEvent(event, request, env, token = '') {
  return {
    id: event.id,
    slug: event.slug,
    name: event.name,
    privacy: event.privacy,
    customerId: event.customer_id || '',
    purchaseId: event.purchase_id || '',
    packageKey: event.package_key || '',
    createdAt: event.created_at,
    updatedAt: event.updated_at,
    shareUrl: buildShareUrl(env, event.slug, token)
  };
}

function serializeMemory(memory, slug, request, accessToken = '') {
  const fileUrl = memory.file_key
    ? buildMemoryFileUrl(request, slug, memory.id, accessToken)
    : '';

  return {
    id: memory.id,
    chapter: memory.chapter,
    capturedAt: memory.captured_at,
    guestName: memory.guest_name || '',
    guests: memory.guest_name ? [memory.guest_name] : [],
    location: memory.location || '',
    type: memory.type || '',
    caption: memory.caption || '',
    mediaKind: memory.media_kind || 'note',
    mediaType: memory.media_kind || 'note',
    fileName: memory.file_name || '',
    fileType: memory.file_type || '',
    fileSize: memory.file_size || 0,
    fileUrl,
    src: fileUrl,
    time: memory.captured_at,
    createdAt: memory.created_at,
    updatedAt: memory.updated_at
  };
}

function serializeStory(story) {
  return {
    id: story.id,
    name: story.guest_name,
    message: story.message,
    createdAt: story.created_at
  };
}

async function getAccessLevel(event, token, password, customerId = '') {
  if (customerId && event.customer_id && timingSafeEqual(String(customerId), String(event.customer_id))) {
    return 'owner';
  }

  if (token) {
    const tokenHash = await hashToken(token);

    if (timingSafeEqual(tokenHash, event.owner_token_hash)) {
      return 'owner';
    }

    if (timingSafeEqual(tokenHash, event.upload_token_hash)) {
      return 'guest';
    }
  }

  if (password && event.password_hash && timingSafeEqual(await hashToken(password), event.password_hash)) {
    return 'password';
  }

  return 'viewer';
}

function canViewEvent(event, access) {
  if (event.privacy === 'public' || event.privacy === 'private_link') {
    return true;
  }

  if (event.privacy === 'password_protected') {
    return access === 'password' || access === 'guest' || access === 'owner';
  }

  if (event.privacy === 'invite_only') {
    return access === 'guest' || access === 'owner';
  }

  return false;
}

function canUploadToEvent(access) {
  return access === 'guest' || access === 'owner';
}

function canAddStory(event, access) {
  if (event.privacy === 'public' || event.privacy === 'private_link') {
    return true;
  }

  return access === 'guest' || access === 'owner' || access === 'password';
}

function getAccessToken(request) {
  const bearer = getBearerToken(request);

  if (bearer) {
    return bearer;
  }

  const url = new URL(request.url);
  return url.searchParams.get('token') || '';
}

function getEventPassword(request) {
  const url = new URL(request.url);
  return cleanText(request.headers.get('X-Event-Password') || url.searchParams.get('password'), 200);
}

function getBearerToken(request) {
  const auth = request.headers.get('Authorization') || '';

  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }

  return '';
}

async function checkEventQuota(env, event, files) {
  const packageKey = event.package_key || 'basic';
  const limits = PACKAGE_LIMITS[packageKey] || PACKAGE_LIMITS.basic;

  if (!limits.maxFiles && !limits.maxStorageBytes) {
    return 'This package does not include an event upload workspace.';
  }

  const incomingFiles = files.length;
  const incomingBytes = files.reduce((total, file) => total + Number(file.size || 0), 0);
  const current = await env.EVENT_DB.prepare(`
    SELECT COUNT(*) AS file_count, COALESCE(SUM(file_size), 0) AS storage_bytes
    FROM memories
    WHERE event_id = ? AND file_key IS NOT NULL
  `)
    .bind(event.id)
    .first();

  const nextFiles = Number(current?.file_count || 0) + incomingFiles;
  const nextBytes = Number(current?.storage_bytes || 0) + incomingBytes;

  if (limits.maxFiles && nextFiles > limits.maxFiles) {
    return `This package includes up to ${limits.maxFiles} uploaded files.`;
  }

  if (limits.maxStorageBytes && nextBytes > limits.maxStorageBytes) {
    return `This package includes up to ${formatBytes(limits.maxStorageBytes)} of uploaded media.`;
  }

  return '';
}

async function rateLimitResponse(request, env, corsHeaders, action) {
  const result = await checkRateLimit(request, env, action);

  if (!result?.limited) {
    return null;
  }

  return json({
    ok: false,
    message: 'Too many attempts. Please wait a bit and try again.'
  }, 429, {
    ...corsHeaders,
    'Retry-After': String(result.retryAfterSeconds)
  });
}

async function checkRateLimit(request, env, action) {
  const config = RATE_LIMITS[action];

  if (!config || !env.EVENT_DB) {
    return { limited: false };
  }

  const nowDate = new Date();
  const now = nowDate.toISOString();
  const identity = await hashToken(`${action}:${getClientIdentity(request)}`);
  const key = `${action}:${identity}`;
  const existing = await env.EVENT_DB.prepare('SELECT * FROM rate_limits WHERE key = ?')
    .bind(key)
    .first();

  if (!existing || existing.reset_at <= now) {
    const resetAt = new Date(nowDate.getTime() + config.windowSeconds * 1000).toISOString();

    await env.EVENT_DB.prepare(`
      INSERT OR REPLACE INTO rate_limits (key, action, count, reset_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `)
      .bind(key, action, 1, resetAt, now)
      .run();

    return { limited: false };
  }

  if (Number(existing.count || 0) >= config.limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((new Date(existing.reset_at).getTime() - nowDate.getTime()) / 1000));
    return { limited: true, retryAfterSeconds };
  }

  await env.EVENT_DB.prepare('UPDATE rate_limits SET count = count + 1, updated_at = ? WHERE key = ?')
    .bind(now, key)
    .run();

  return { limited: false };
}

function getClientIdentity(request) {
  return request.headers.get('CF-Connecting-IP')
    || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
    || 'unknown';
}

async function createUniqueSlug(env, name) {
  const base = slugify(name) || 'event';

  for (let index = 0; index < 8; index += 1) {
    const suffix = randomSlugSuffix();
    const slug = `${base}-${suffix}`.slice(0, 96);
    const existing = await getEventBySlug(env, slug);

    if (!existing) {
      return slug;
    }
  }

  return `${base}-${crypto.randomUUID().slice(0, 8)}`.slice(0, 96);
}

function randomSlugSuffix() {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
}

function createToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function hashToken(token) {
  const bytes = new TextEncoder().encode(String(token || ''));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function validatePassword(password) {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`;
  }

  return '';
}

async function createPasswordCredential(password) {
  const saltBytes = new Uint8Array(PASSWORD_SALT_BYTES);
  crypto.getRandomValues(saltBytes);
  const salt = base64Url(saltBytes);
  const hash = await derivePasswordHash(password, salt, PASSWORD_ITERATIONS);

  return {
    hash,
    salt,
    algorithm: PASSWORD_ALGORITHM,
    iterations: PASSWORD_ITERATIONS
  };
}

async function verifyPassword(password, customer) {
  if (!customer.password_hash || !customer.password_salt) {
    return false;
  }

  const algorithm = customer.password_algorithm || PASSWORD_ALGORITHM;

  if (algorithm !== PASSWORD_ALGORITHM) {
    return false;
  }

  const iterations = Number(customer.password_iterations || PASSWORD_ITERATIONS);
  const expected = await derivePasswordHash(password, customer.password_salt, iterations);

  return timingSafeEqual(expected, customer.password_hash);
}

async function derivePasswordHash(password, salt, iterations) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: encoder.encode(salt),
      iterations
    },
    key,
    256
  );

  return base64Url(new Uint8Array(bits));
}

function base64Url(bytes) {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function timingSafeEqual(a, b) {
  const left = String(a || '');
  const right = String(b || '');

  if (left.length !== right.length) {
    return false;
  }

  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return result === 0;
}

function normalizePrivacy(value) {
  const normalized = String(value || 'private_link').toLowerCase().replace(/[\s-]+/g, '_');
  return EVENT_PRIVACY.has(normalized) ? normalized : 'private_link';
}

function normalizeDateTime(value) {
  if (!value) {
    return new Date().toISOString();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase().slice(0, 254);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ''));
}

function cleanText(value, maxLength = 500) {
  return String(value || '').trim().slice(0, maxLength);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeFileName(value) {
  const clean = String(value || 'memory-upload')
    .replace(/[^\w.\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);

  return clean || 'memory-upload';
}

function safeDispositionFileName(value) {
  return sanitizeFileName(value).replace(/"/g, '');
}

function formatBytes(value) {
  const bytes = Number(value || 0);

  if (bytes >= 1024 * 1024 * 1024) {
    return `${Math.round(bytes / (1024 * 1024 * 1024))} GB`;
  }

  if (bytes >= 1024 * 1024) {
    return `${Math.round(bytes / (1024 * 1024))} MB`;
  }

  return `${bytes} bytes`;
}

function getMediaKind(contentType) {
  if (contentType.startsWith('video/')) return 'video';
  if (contentType.startsWith('audio/')) return 'audio';
  if (contentType.startsWith('image/')) return 'image';
  return 'file';
}

function inferChapter(capturedAt, type, fileName = '') {
  const lowerName = fileName.toLowerCase();
  const hour = new Date(capturedAt).getHours();

  if (type === 'funny' || lowerName.includes('funny')) return 'Funny moments';
  if (type === 'food' || lowerName.includes('food')) return 'Food';
  if (type === 'dance' || lowerName.includes('dance')) return 'Dancing';
  if (type === 'group' || lowerName.includes('group')) return 'Group photos';
  if (hour < 10) return 'Morning setup';
  if (hour < 12) return 'Guests arriving';
  if (hour < 14) return 'Speeches';
  if (hour < 18) return 'Shared moments';
  return 'Final memories';
}

function buildCaptionSuggestion(eventName, chapter, guest, location, type) {
  const person = guest || 'everyone';
  const templates = {
    emotional: `${chapter} captured the part of ${eventName} that felt most like home - ${person} right in the middle of it at the ${location}.`,
    funny: `This is the moment ${person} made sure nobody at the ${location} could keep a straight face.`,
    food: `The ${location} turned into its own chapter, full plates, familiar voices, and one more reason to linger.`,
    dance: `${person} helped turn the ${location} into the scene everyone will remember when the music comes back on.`,
    group: `${chapter} brought the whole story into one frame, proof that the day belonged to everybody.`
  };

  return templates[type] || templates.emotional;
}

function buildShareUrl(env, slug, token = '') {
  const base = env.SITE_BASE_URL || 'https://jjecreative.com/event-time-machine/';
  const url = new URL(base);
  url.searchParams.set('event', slug);

  if (token) {
    url.searchParams.set('token', token);
  }

  return url.toString();
}

function buildSiteActionUrl(env, query = {}, hash = '') {
  const url = new URL(env.SITE_BASE_URL || 'https://jjecreative.com/event-time-machine/');

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  if (hash) {
    url.hash = hash;
  }

  return url.toString();
}

function buildSitePageUrl(env, pagePath = '', query = {}, hash = '') {
  const url = new URL(env.SITE_BASE_URL || 'https://jjecreative.com/event-time-machine/');
  const basePath = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
  const cleanPagePath = String(pagePath || '').replace(/^\/+/, '');
  url.pathname = cleanPagePath ? `${basePath}${cleanPagePath}` : basePath;

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  if (hash) {
    url.hash = hash;
  }

  return url.toString();
}

function buildMemoryFileUrl(request, slug, memoryId, accessToken = '') {
  const url = new URL(buildApiUrl(request, `/api/events/${slug}/memories/${memoryId}/file`));

  if (accessToken) {
    url.searchParams.set('token', accessToken);
  }

  return url.toString();
}

function buildApiUrl(request, path) {
  const url = new URL(request.url);
  return `${url.origin}${path}`;
}

async function readJson(request) {
  if (!request.body) {
    return {};
  }

  return request.json().catch(() => ({}));
}

function getAllowedOrigins(env) {
  return (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isAllowedOrigin(origin, env) {
  if (!origin) {
    return true;
  }

  return getAllowedOrigins(env).includes(origin);
}

function getCorsHeaders(origin, env) {
  const fallbackOrigin = 'https://jjecreative.com';
  const allowedOrigin = isAllowedOrigin(origin, env) && origin ? origin : fallbackOrigin;

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Event-Password',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff',
    'Vary': 'Origin'
  };
}

function json(payload, status, headers) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...headers,
      'Content-Type': 'application/json; charset=utf-8'
    }
  });
}
