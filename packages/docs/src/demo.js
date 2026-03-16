// Hide loading overlay once the iframe has loaded
const loading = document.getElementById('loading');
const iframe = document.getElementById('demo-iframe');

iframe.addEventListener('load', () => {
  loading.classList.add('hidden');
});

// Fallback: hide after 8 seconds in case load event fires early
setTimeout(() => loading.classList.add('hidden'), 8000);
