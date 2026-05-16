const API_LEADS = '/api/leads';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const form = document.getElementById('lead-form');
const submitBtn = document.getElementById('submit-btn');
const statusPanel = document.getElementById('status-panel');
const statusTitle = document.getElementById('status-title');
const statusMessage = document.getElementById('status-message');

const fields = ['name', 'email', 'companyName', 'companyWebsite'];

function normalizeWebsiteUrl(input) {
  const trimmed = String(input || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function isValidWebsite(url) {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol) && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

function validateLead(data) {
  const errors = {};
  const name = String(data.name || '').trim();
  const email = String(data.email || '').trim().toLowerCase();
  const companyName = String(data.companyName || '').trim();
  const companyWebsiteRaw = String(data.companyWebsite || '').trim();
  const companyWebsite = normalizeWebsiteUrl(companyWebsiteRaw);

  if (!name || name.length < 2) {
    errors.name = 'Name is required (at least 2 characters).';
  }

  if (!email || !EMAIL_REGEX.test(email)) {
    errors.email = 'A valid email address is required.';
  }

  if (!companyName || companyName.length < 2) {
    errors.companyName = 'Company name is required (at least 2 characters).';
  }

  if (!companyWebsiteRaw) {
    errors.companyWebsite = 'Company website is required.';
  } else if (!isValidWebsite(companyWebsite)) {
    errors.companyWebsite = 'Enter a valid URL (e.g. https://example.com or example.com).';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    lead: { name, email, companyName, companyWebsite },
  };
}

function clearFieldErrors() {
  fields.forEach((field) => {
    const el = document.getElementById(`error-${field}`);
    const input = document.getElementById(field);
    if (el) el.textContent = '';
    if (input) input.classList.remove('input-invalid');
  });
}

function showFieldErrors(errors) {
  Object.entries(errors).forEach(([field, message]) => {
    const el = document.getElementById(`error-${field}`);
    const input = document.getElementById(field);
    if (el) el.textContent = message;
    if (input) input.classList.add('input-invalid');
  });
}

function hideStatus() {
  statusPanel.classList.add('hidden');
  statusPanel.classList.remove('is-success', 'is-error');
}

function showStatus(type, title, message) {
  statusPanel.classList.remove('hidden', 'is-success', 'is-error');
  statusPanel.classList.add(type === 'success' ? 'is-success' : 'is-error');
  statusTitle.textContent = title;
  statusMessage.textContent = message;
}

function setLoading(loading) {
  submitBtn.disabled = loading;
  submitBtn.classList.toggle('is-loading', loading);
  submitBtn.setAttribute('aria-busy', loading ? 'true' : 'false');

  fields.forEach((field) => {
    const input = document.getElementById(field);
    if (input) input.disabled = loading;
  });
}

function getFormData() {
  return {
    name: document.getElementById('name').value,
    email: document.getElementById('email').value,
    companyName: document.getElementById('companyName').value,
    companyWebsite: document.getElementById('companyWebsite').value,
  };
}

function buildResultUI(result) {
  const status = result.workflow?.status;
  const message =
    result.message ||
    'Thank you. We are processing your request and will follow up shortly.';

  if (status === 'complete') {
    return { type: 'success', title: 'Audit delivered', message };
  }

  if (status === 'partial') {
    return {
      type: 'success',
      title: 'Audit delivered (limited data)',
      message:
        message +
        ' Some website details could not be retrieved, but your report was still generated and emailed.',
    };
  }

  if (status === 'email_failed') {
    return {
      type: 'error',
      title: 'Email delivery issue',
      message:
        message +
        ' Your PDF was saved on our server. Please contact support if you do not receive it.',
    };
  }

  if (status === 'pdf_failed') {
    return {
      type: 'error',
      title: 'Report could not be finalized',
      message,
    };
  }

  if (result.success) {
    return { type: 'success', title: 'Request received', message };
  }

  return {
    type: 'error',
    title: 'Something went wrong',
    message: message || 'Please try again in a few minutes.',
  };
}

async function submitLead(lead) {
  const response = await fetch(API_LEADS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lead),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const serverErrors = Array.isArray(data.errors) ? data.errors.join(' ') : '';
    const message = data.message || serverErrors || 'Submission failed. Please try again.';
    const err = new Error(message);
    err.status = response.status;
    err.errors = data.errors;
    throw err;
  }

  return data;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideStatus();
  clearFieldErrors();

  const validation = validateLead(getFormData());
  if (!validation.valid) {
    showFieldErrors(validation.errors);
    showStatus('error', 'Please fix the errors below', 'Check the highlighted fields and try again.');
    return;
  }

  setLoading(true);

  try {
    const result = await submitLead(validation.lead);

    if (localStorage.getItem('DEBUG_PIPELINE') === 'true') {
      console.log('[DEBUG] API response:', result);
    }

    const ui = buildResultUI(result);

    showStatus(ui.type, ui.title, ui.message);

    if (ui.type === 'success') {
      form.reset();
      clearFieldErrors();
    }
  } catch (err) {
    if (Array.isArray(err.errors)) {
      const fieldMap = {};
      err.errors.forEach((msg) => {
        const lower = msg.toLowerCase();
        if (lower.includes('company name')) fieldMap.companyName = msg;
        else if (lower.includes('website')) fieldMap.companyWebsite = msg;
        else if (lower.includes('email')) fieldMap.email = msg;
        else if (lower.includes('name')) fieldMap.name = msg;
      });
      if (Object.keys(fieldMap).length) showFieldErrors(fieldMap);
    }

    showStatus(
      'error',
      err.status === 400 ? 'Validation failed' : 'Something went wrong',
      err.message || 'Unable to submit your request. Please try again later.'
    );
  } finally {
    setLoading(false);
  }
});

fields.forEach((field) => {
  const input = document.getElementById(field);
  if (!input) return;
  input.addEventListener('input', () => {
    input.classList.remove('input-invalid');
    const errEl = document.getElementById(`error-${field}`);
    if (errEl) errEl.textContent = '';
  });
});
