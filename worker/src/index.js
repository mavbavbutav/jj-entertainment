import { Resend } from 'resend';

const FIELD_LABELS = [
  'Full name',
  'Business name',
  'Email',
  'Phone',
  'Website or social link',
  'Business location',
  'Package interest',
  'Ideal timeline',
  'Estimated budget',
  'Current website status',
  'Project goals',
  'Automation opportunity',
  'Founding Five consent'
];

const REQUIRED_FIELDS = [
  'Full name',
  'Business name',
  'Email',
  'Phone',
  'Business location',
  'Package interest',
  'Ideal timeline',
  'Estimated budget',
  'Current website status',
  'Project goals',
  'Automation opportunity',
  'Founding Five consent'
];

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const corsHeaders = getCorsHeaders(origin, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return json({ ok: false, message: 'Method not allowed.' }, 405, corsHeaders);
    }

    if (!isAllowedOrigin(origin, env)) {
      return json({ ok: false, message: 'This form cannot be submitted from that origin.' }, 403, corsHeaders);
    }

    try {
      const submission = await readSubmission(request);

      if (submission._honey) {
        return json({ ok: true, message: 'Application received.' }, 200, corsHeaders);
      }

      const validationError = validateSubmission(submission);

      if (validationError) {
        return json({ ok: false, message: validationError }, 400, corsHeaders);
      }

      const emailResult = await sendEmail(submission, env);

      if (emailResult.error) {
        console.error('Resend delivery failed', emailResult.error);
        return json({ ok: false, message: getEmailErrorMessage(emailResult.error) }, 502, corsHeaders);
      }

      return json({ ok: true, message: 'Application sent.' }, 200, corsHeaders);
    } catch (error) {
      console.error('Founding Five form error', error);
      return json({ ok: false, message: 'Application could not be sent right now.' }, 500, corsHeaders);
    }
  }
};

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
  const allowedOrigin = isAllowedOrigin(origin, env) && origin ? origin : 'https://jjentertainmentsolutions.com';

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Vary': 'Origin'
  };
}

async function readSubmission(request) {
  const contentType = request.headers.get('Content-Type') || '';

  if (contentType.includes('application/json')) {
    return request.json();
  }

  const formData = await request.formData();
  const submission = {};

  formData.forEach((value, key) => {
    submission[key] = String(value).trim();
  });

  return submission;
}

function validateSubmission(submission) {
  for (const field of REQUIRED_FIELDS) {
    if (!submission[field]) {
      return `Missing required field: ${field}`;
    }
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submission.Email)) {
    return 'Please enter a valid email address.';
  }

  return '';
}

async function sendEmail(submission, env) {
  const resendApiKey = env.RESEND_API_KEY || env.resend || env.RESEND;

  if (!resendApiKey || !env.TO_EMAIL || !env.FROM_EMAIL) {
    throw new Error('Missing resend, RESEND_API_KEY, TO_EMAIL, or FROM_EMAIL.');
  }

  const resend = new Resend(resendApiKey);

  return resend.emails.send({
    from: env.FROM_EMAIL,
    to: [env.TO_EMAIL],
    subject: `JJE Founding Five Application - ${submission['Business name']}`,
    text: buildTextEmail(submission),
    html: buildHtmlEmail(submission)
  });
}

function buildTextEmail(submission) {
  return FIELD_LABELS
    .filter((label) => submission[label])
    .map((label) => `${label}: ${submission[label]}`)
    .join('\n\n');
}

function buildHtmlEmail(submission) {
  const rows = FIELD_LABELS
    .filter((label) => submission[label])
    .map((label) => {
      return `<tr><th align="left" style="padding:8px 12px;border-bottom:1px solid #e6ded5;">${escapeHtml(label)}</th><td style="padding:8px 12px;border-bottom:1px solid #e6ded5;">${escapeHtml(submission[label])}</td></tr>`;
    })
    .join('');

  return `
    <h1 style="font-family: Georgia, serif; color: #2f2b28;">JJE Founding Five Application</h1>
    <table style="border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; color: #2f2b28;">
      ${rows}
    </table>
  `;
}

function getEmailErrorMessage(error) {
  const status = error.statusCode || error.status || 0;
  const detail = error.message || JSON.stringify(error);
  const normalizedDetail = detail.toLowerCase();

  if (status === 401 || normalizedDetail.includes('api key')) {
    return 'Email delivery is not configured correctly yet. Check the Resend API key secret in Cloudflare.';
  }

  if (status === 403 || normalizedDetail.includes('domain') || normalizedDetail.includes('sender')) {
    return 'Email delivery is not configured correctly yet. Verify contact@jjentertainmentsolutions.com or the jjentertainmentsolutions.com domain in Resend.';
  }

  return 'Email delivery is temporarily unavailable. Please check the Resend sender/domain setup or email contact@jjentertainmentsolutions.com directly.';
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
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
