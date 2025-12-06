import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:4000';

async function http(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }

  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return res.json();
  }
  return res.text();
}

export async function searchProducts(query) {
  const q = query ? `?q=${encodeURIComponent(query)}` : '';
  return http(`/api/products${q}`);
}

export async function fetchProduct(barcode) {
  return http(`/api/products/${barcode}`);
}

export async function upsertProduct(product) {
  return http('/api/products', {
    method: 'POST',
    body: JSON.stringify(product)
  });
}

export async function fetchList() {
  return http('/api/list');
}

export async function syncList(items) {
  return http('/api/list', {
    method: 'POST',
    body: JSON.stringify({ items })
  });
}

export async function deleteListItem(barcode) {
  return http(`/api/list/${barcode}`, { method: 'DELETE' });
}

export async function checkoutCart() {
  return http('/api/cart/checkout', { method: 'POST' });
}

export async function pushReceipt(fileName, items, source = 'uploaded') {
  return http('/api/receipts', {
    method: 'POST',
    body: JSON.stringify({ fileName, items, source })
  });
}

export async function fetchReceipts() {
  return http('/api/receipts');
}

export function getApiUrl() {
  return API_URL;
}
