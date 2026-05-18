const CONFIG = {
  AUTH_URL: 'https://auth-service-420166052416.asia-southeast2.run.app/auth',
  PRODUCT_URL: 'https://product-service-420166052416.asia-southeast2.run.app',
};

const api = {
  async request(url, options = {}) {
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401 && !url.includes('/login')) { localStorage.clear(); window.location.href = '/login.html'; return; }
    return res;
  },
  get: (url) => api.request(url),
  post: (url, body) => api.request(url, { method: 'POST', body: JSON.stringify(body) }),
  put: (url, body) => api.request(url, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (url) => api.request(url, { method: 'DELETE' }),
};
