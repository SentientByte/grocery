import express from 'express';
import cors from 'cors';
import {
  checkoutBoughtItems,
  deleteListItem,
  getList,
  getProduct,
  getReceipts,
  recordReceipt,
  saveListItems,
  searchProducts,
  upsertProduct
} from './db.js';

const app = express();
const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/api/products/:barcode', (req, res) => {
  const product = getProduct(req.params.barcode);
  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }
  res.json(product);
});

app.get('/api/products', (req, res) => {
  const products = searchProducts(req.query.q || null);
  res.json(products);
});

app.post('/api/products', (req, res) => {
  const { barcode, name, price } = req.body || {};
  if (!barcode || !name) {
    res.status(400).json({ error: 'barcode and name are required' });
    return;
  }
  const product = upsertProduct({ barcode, name, price: Number(price) || 0 });
  res.status(201).json(product);
});

app.get('/api/list', (req, res) => {
  res.json({ items: getList() });
});

app.post('/api/list', (req, res) => {
  const { items = [] } = req.body || {};
  if (!Array.isArray(items)) {
    res.status(400).json({ error: 'items must be an array' });
    return;
  }
  const nextList = saveListItems(items.filter((item) => item.barcode));
  res.json({ items: nextList });
});

app.delete('/api/list/:barcode', (req, res) => {
  const items = deleteListItem(req.params.barcode);
  res.json({ items });
});

app.post('/api/cart/checkout', (req, res) => {
  const items = checkoutBoughtItems();
  res.json({ items });
});

app.post('/api/receipts', (req, res) => {
  const { fileName = 'uploaded-receipt', items = [], source = 'uploaded' } = req.body || {};
  if (!Array.isArray(items)) {
    res.status(400).json({ error: 'items must be an array' });
    return;
  }
  const normalizedItems = items
    .filter((item) => item && (item.barcode || item.id) && item.name)
    .map((item) => ({
      barcode: item.barcode || item.id,
      name: item.name,
      price: Number(item.price) || 0
    }));

  const receipt = recordReceipt(fileName, normalizedItems, source);
  res.status(201).json(receipt);
});

app.get('/api/receipts', (req, res) => {
  res.json(getReceipts());
});

app.listen(PORT, HOST, () => {
  console.log(`Backend API listening on http://${HOST}:${PORT}`);
});
