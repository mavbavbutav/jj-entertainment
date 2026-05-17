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

const GENERAL_INQUIRY_FIELD_LABELS = [
  'Form type',
  'Full name',
  'Email',
  'Phone',
  'Service interest',
  'Project details'
];

const GENERAL_INQUIRY_REQUIRED_FIELDS = [
  'Full name',
  'Email',
  'Service interest',
  'Project details'
];

const PHOTOGRAPHY_INQUIRY_FIELD_LABELS = [
  'Form type',
  'First name',
  'Last name',
  'Email',
  'Subject',
  'Message'
];

const PHOTOGRAPHY_INQUIRY_REQUIRED_FIELDS = [
  'First name',
  'Last name',
  'Email',
  'Subject',
  'Message'
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
        return json({ ok: true, message: 'Submission received.' }, 200, corsHeaders);
      }

      const validationError = validateSubmission(submission);

      if (validationError) {
        return json({ ok: false, message: validationError }, 400, corsHeaders);
      }

      const emailResult = await sendInternalNotification(submission, env);

      if (emailResult.error) {
        console.error('Resend delivery failed', emailResult.error);
        return json({ ok: false, message: getEmailErrorMessage(emailResult.error) }, 502, corsHeaders);
      }

      const confirmationResult = await sendApplicantConfirmation(submission, env);

      if (confirmationResult.error) {
        console.error('Applicant confirmation failed', confirmationResult.error);
      }

      return json({ ok: true, message: getSuccessMessage(submission) }, 200, corsHeaders);
    } catch (error) {
      console.error('Form submission error', error);
      return json({ ok: false, message: 'Submission could not be sent right now.' }, 500, corsHeaders);
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
  const requiredFields = getRequiredFields(submission);

  for (const field of requiredFields) {
    if (!submission[field]) {
      return `Missing required field: ${field}`;
    }
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submission.Email)) {
    return 'Please enter a valid email address.';
  }

  return '';
}

function isGeneralInquiry(submission) {
  return String(submission['Form type'] || '').toLowerCase() === 'general inquiry';
}

function isPhotographyInquiry(submission) {
  return String(submission['Form type'] || '').toLowerCase() === 'photography inquiry';
}

function getRequiredFields(submission) {
  if (isGeneralInquiry(submission)) {
    return GENERAL_INQUIRY_REQUIRED_FIELDS;
  }

  if (isPhotographyInquiry(submission)) {
    return PHOTOGRAPHY_INQUIRY_REQUIRED_FIELDS;
  }

  return REQUIRED_FIELDS;
}

function getResendClient(env) {
  const resendApiKey = env.resend || env.RESEND_API_KEY || env.RESEND;

  if (!resendApiKey) {
    throw new Error('Missing resend, RESEND_API_KEY, or RESEND.');
  }

  return new Resend(resendApiKey);
}

async function sendInternalNotification(submission, env) {
  if (!env.TO_EMAIL || !env.FROM_EMAIL) {
    throw new Error('Missing TO_EMAIL or FROM_EMAIL.');
  }

  return getResendClient(env).emails.send({
    from: env.FROM_EMAIL,
    to: getInternalRecipients(submission, env),
    subject: getInternalSubject(submission),
    text: buildTextEmail(submission)
  });
}

async function sendApplicantConfirmation(submission, env) {
  if (!env.FROM_EMAIL) {
    throw new Error('Missing FROM_EMAIL.');
  }

  return getResendClient(env).emails.send({
    from: env.FROM_EMAIL,
    to: [submission.Email],
    subject: getApplicantSubject(submission),
    text: buildApplicantConfirmationText(submission)
  });
}

function buildTextEmail(submission) {
  const labels = getFieldLabels(submission);

  return labels
    .filter((label) => submission[label])
    .map((label) => `${label}: ${submission[label]}`)
    .join('\n\n');
}

function getFirstName(fullName) {
  return String(fullName || '').trim().split(/\s+/)[0] || 'there';
}

function getPhotographyFullName(submission) {
  return `${submission['First name'] || ''} ${submission['Last name'] || ''}`.trim();
}

function getFieldLabels(submission) {
  if (isGeneralInquiry(submission)) {
    return GENERAL_INQUIRY_FIELD_LABELS;
  }

  if (isPhotographyInquiry(submission)) {
    return PHOTOGRAPHY_INQUIRY_FIELD_LABELS;
  }

  return FIELD_LABELS;
}

function getInternalRecipients(submission, env) {
  if (isPhotographyInquiry(submission)) {
    return [env.PHOTOGRAPHY_TO_EMAIL || 'jamicarswell@gmail.com'];
  }

  return [env.TO_EMAIL];
}

function getInternalSubject(submission) {
  if (isGeneralInquiry(submission)) {
    return `JJ Entertainment Inquiry - ${submission['Full name']}`;
  }

  if (isPhotographyInquiry(submission)) {
    return `Photography Inquiry - ${getPhotographyFullName(submission) || submission.Email}`;
  }

  return `JJE Founding Five Application - ${submission['Business name']}`;
}

function getApplicantSubject(submission) {
  if (isGeneralInquiry(submission)) {
    return 'JJ Entertainment received your message';
  }

  if (isPhotographyInquiry(submission)) {
    return 'Jami Ferguson Photography received your message';
  }

  return 'JJE Digital received your Founding Five application';
}

function getSuccessMessage(submission) {
  if (isPhotographyInquiry(submission)) {
    return 'Message sent.';
  }

  if (isGeneralInquiry(submission)) {
    return 'Message sent.';
  }

  return 'Application sent.';
}

function buildApplicantConfirmationText(submission) {
  if (isGeneralInquiry(submission)) {
    return `Hi ${getFirstName(submission['Full name'])},

Thanks for reaching out to JJ Entertainment Solutions.

We received your message about ${submission['Service interest']} and will route it to the right specialist. You can expect a follow-up within one business day.

Quick summary:
Service interest: ${submission['Service interest']}
Project details: ${submission['Project details']}

JJ Entertainment Solutions
Nashville creative studio
contact@jjentertainmentsolutions.com`;
  }

  if (isPhotographyInquiry(submission)) {
    return `Hi ${submission['First name'] || 'there'},

Thanks for reaching out to Jami Ferguson Photography.

Jami received your message and will review the details soon.

Quick summary:
Subject: ${submission.Subject}
Message: ${submission.Message}

Jami Ferguson Photography
Nashville, TN
jamicarswell@gmail.com`;
  }

  return `Hi ${getFirstName(submission['Full name'])},

Thanks for applying for the JJE Founding Five.

We received your application for ${submission['Business name']} and will review it for one of the first five launch slots. If your project looks like a strong fit, JJE Digital will follow up with next steps.

Quick summary:
Package interest: ${submission['Package interest']}
Ideal timeline: ${submission['Ideal timeline']}
Primary automation opportunity: ${submission['Automation opportunity']}

JJE Digital
Web, AI, and Automation
contact@jjentertainmentsolutions.com`;
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
