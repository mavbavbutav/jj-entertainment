const yearTargets = document.querySelectorAll('[data-year]');
yearTargets.forEach((target) => {
  target.textContent = new Date().getFullYear();
});

const navToggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');

if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    const isOpen = navToggle.getAttribute('aria-expanded') === 'true';
    navToggle.setAttribute('aria-expanded', String(!isOpen));
    navLinks.classList.toggle('is-open', !isOpen);
  });

  navLinks.addEventListener('click', (event) => {
    if (event.target.closest('a')) {
      navToggle.setAttribute('aria-expanded', 'false');
      navLinks.classList.remove('is-open');
    }
  });
}

const galleryGrid = document.querySelector('[data-gallery]');
const galleryStatus = document.querySelector('[data-gallery-status]');
let activeGalleryImages = [];
let activeImageIndex = 0;
let lastFocusedElement = null;

async function loadManifest() {
  const response = await fetch('/photography/assets/manifest.json', {
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    throw new Error('Image manifest could not be loaded.');
  }

  return response.json();
}

function renderGallery(images) {
  if (!galleryGrid) {
    return;
  }

  const fragment = document.createDocumentFragment();

  images.forEach((image, index) => {
    const figure = document.createElement('figure');
    figure.className = 'gallery-item';

    const button = document.createElement('button');
    button.className = 'gallery-button';
    button.type = 'button';
    button.dataset.index = String(index);
    button.setAttribute('aria-label', `Open image ${index + 1} of ${images.length}`);

    const img = document.createElement('img');
    img.src = image.src;
    img.alt = image.alt;
    img.loading = 'eager';
    img.decoding = 'async';

    button.append(img);
    figure.append(button);
    fragment.append(figure);
  });

  galleryGrid.replaceChildren(fragment);

  if (galleryStatus) {
    galleryStatus.textContent = `${images.length} images loaded.`;
  }
}

async function initGallery() {
  if (!galleryGrid) {
    return;
  }

  const galleryName = galleryGrid.dataset.gallery;

  try {
    const manifest = await loadManifest();
    activeGalleryImages = manifest[galleryName] || [];
    renderGallery(activeGalleryImages);
  } catch (error) {
    if (galleryStatus) {
      galleryStatus.textContent = 'The gallery could not be loaded. Please refresh the page.';
    }
  }
}

const lightbox = document.querySelector('#gallery-lightbox');
const lightboxImage = document.querySelector('.lightbox-image');
const lightboxCaption = document.querySelector('.lightbox-caption');
const lightboxCloseControls = document.querySelectorAll('[data-lightbox-close]');
const lightboxPrev = document.querySelector('[data-lightbox-prev]');
const lightboxNext = document.querySelector('[data-lightbox-next]');

function updateLightbox() {
  if (!lightboxImage || !lightboxCaption || !activeGalleryImages.length) {
    return;
  }

  const image = activeGalleryImages[activeImageIndex];
  lightboxImage.src = image.src;
  lightboxImage.alt = image.alt;
  lightboxCaption.textContent = `${activeImageIndex + 1} / ${activeGalleryImages.length}`;
}

function openLightbox(index) {
  if (!lightbox || !activeGalleryImages.length) {
    return;
  }

  activeImageIndex = index;
  lastFocusedElement = document.activeElement;
  updateLightbox();
  lightbox.hidden = false;
  document.body.classList.add('modal-open');

  const closeButton = lightbox.querySelector('.lightbox-close');
  if (closeButton) {
    closeButton.focus();
  }
}

function closeLightbox() {
  if (!lightbox || lightbox.hidden) {
    return;
  }

  lightbox.hidden = true;
  document.body.classList.remove('modal-open');
  if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
    lastFocusedElement.focus();
  }
}

function stepLightbox(direction) {
  if (!activeGalleryImages.length) {
    return;
  }

  activeImageIndex = (activeImageIndex + direction + activeGalleryImages.length) % activeGalleryImages.length;
  updateLightbox();
}

if (galleryGrid) {
  galleryGrid.addEventListener('click', (event) => {
    const button = event.target.closest('.gallery-button');
    if (!button) {
      return;
    }

    openLightbox(Number(button.dataset.index || 0));
  });
}

lightboxCloseControls.forEach((control) => {
  control.addEventListener('click', closeLightbox);
});

if (lightboxPrev) {
  lightboxPrev.addEventListener('click', () => stepLightbox(-1));
}

if (lightboxNext) {
  lightboxNext.addEventListener('click', () => stepLightbox(1));
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeLightbox();
    closeConfirmationModal();
  }

  if (!lightbox || lightbox.hidden) {
    return;
  }

  if (event.key === 'ArrowLeft') {
    stepLightbox(-1);
  }

  if (event.key === 'ArrowRight') {
    stepLightbox(1);
  }
});

initGallery();

const photographyForm = document.querySelector('#photography-inquiry-form');
const photographyStatus = document.querySelector('#photography-inquiry-status');
const confirmationModal = document.querySelector('#photography-confirmation');
const confirmationCloseControls = document.querySelectorAll('[data-confirmation-close]');

function buildPhotographyEmail(formData, fallbackEmail) {
  const fields = [];

  formData.forEach((value, key) => {
    if (!key.startsWith('_') && value) {
      fields.push(`${key}: ${value}`);
    }
  });

  return `mailto:${fallbackEmail}?subject=${encodeURIComponent('Photography Inquiry')}&body=${encodeURIComponent(fields.join('\n\n'))}`;
}

function openConfirmationModal() {
  if (!confirmationModal) {
    return;
  }

  lastFocusedElement = document.activeElement;
  confirmationModal.hidden = false;
  document.body.classList.add('modal-open');
  const closeButton = confirmationModal.querySelector('.confirmation-close');

  if (closeButton) {
    closeButton.focus();
  }
}

function closeConfirmationModal() {
  if (!confirmationModal || confirmationModal.hidden) {
    return;
  }

  confirmationModal.hidden = true;
  document.body.classList.remove('modal-open');

  if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
    lastFocusedElement.focus();
  }
}

confirmationCloseControls.forEach((control) => {
  control.addEventListener('click', closeConfirmationModal);
});

if (photographyForm) {
  photographyForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const fallbackEmail = photographyForm.dataset.emailFallback || 'jamicarswell@gmail.com';
    const formData = new FormData(photographyForm);

    if (formData.get('_honey')) {
      return;
    }

    if (photographyStatus) {
      photographyStatus.textContent = 'Sending your message...';
    }

    try {
      const response = await fetch(photographyForm.action, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: formData
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (photographyStatus) {
          photographyStatus.textContent = result.message || 'Message could not be sent right now. Please email Jami directly.';
        }
        return;
      }

      photographyForm.reset();
      if (photographyStatus) {
        photographyStatus.textContent = result.message || 'Message sent. Jami will follow up soon.';
      }
      openConfirmationModal();
    } catch (error) {
      if (photographyStatus) {
        photographyStatus.textContent = 'We could not reach the message service. Opening an email draft so your inquiry can still be sent.';
      }
      window.location.href = buildPhotographyEmail(formData, fallbackEmail);
    }
  });
}
