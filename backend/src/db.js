import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const dataDir = path.join(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'grocery.db');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    barcode TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price REAL DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  );
  CREATE TABLE IF NOT EXISTS receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_name TEXT,
    source TEXT,
    imported_at INTEGER,
    item_count INTEGER,
    total REAL
  );
  CREATE TABLE IF NOT EXISTS receipt_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    receipt_id INTEGER REFERENCES receipts(id) ON DELETE CASCADE,
    barcode TEXT,
    name TEXT,
    price REAL
  );
  CREATE TABLE IF NOT EXISTS list_items (
    barcode TEXT PRIMARY KEY,
    qty INTEGER DEFAULT 1,
    bought INTEGER DEFAULT 0,
    updated_at INTEGER DEFAULT (strftime('%s','now'))
  );
`);

const upsertProductStmt = db.prepare(
  `INSERT INTO products (barcode, name, price) VALUES (@barcode, @name, @price)
   ON CONFLICT(barcode) DO UPDATE SET name=excluded.name, price=excluded.price`
);

const getProductStmt = db.prepare('SELECT barcode, name, price FROM products WHERE barcode = ?');
const searchProductsStmt = db.prepare(
  `SELECT barcode, name, price FROM products
   WHERE (:q IS NULL OR lower(name) LIKE lower('%' || :q || '%') OR barcode LIKE '%' || :q || '%')
   ORDER BY created_at DESC LIMIT 50`
);

const upsertListItemStmt = db.prepare(
  `INSERT INTO list_items (barcode, qty, bought, updated_at)
   VALUES (@barcode, @qty, @bought, strftime('%s','now'))
   ON CONFLICT(barcode) DO UPDATE SET qty=excluded.qty, bought=excluded.bought, updated_at=strftime('%s','now')`
);

const getListItemsStmt = db.prepare(
  `SELECT li.barcode, li.qty, li.bought, p.name, p.price
   FROM list_items li
   LEFT JOIN products p ON p.barcode = li.barcode
   ORDER BY li.updated_at DESC`
);

const deleteBoughtStmt = db.prepare('DELETE FROM list_items WHERE bought = 1');
const deleteListItemStmt = db.prepare('DELETE FROM list_items WHERE barcode = ?');

const insertReceiptStmt = db.prepare(
  `INSERT INTO receipts (file_name, source, imported_at, item_count, total)
   VALUES (@file_name, @source, @imported_at, @item_count, @total)`
);

const insertReceiptItemStmt = db.prepare(
  `INSERT INTO receipt_items (receipt_id, barcode, name, price)
   VALUES (@receipt_id, @barcode, @name, @price)`
);

const getReceiptsStmt = db.prepare(
  `SELECT id, file_name, source, imported_at, item_count, total
   FROM receipts
   ORDER BY imported_at DESC`
);

export function upsertProduct(product) {
  if (!product.barcode || !product.name) {
    throw new Error('Product requires a barcode and name');
  }
  const price = Number.isFinite(product.price) ? product.price : 0;
  upsertProductStmt.run({ ...product, price });
  return getProduct(product.barcode);
}

export function getProduct(barcode) {
  return getProductStmt.get(barcode);
}

export function searchProducts(query) {
  const q = query ? query.trim() : null;
  return searchProductsStmt.all({ q });
}

export function saveListItems(items = []) {
  const tx = db.transaction((payload) => {
    payload.forEach((item) => {
      const qty = Number.isFinite(item.qty) ? item.qty : 1;
      const bought = item.bought ? 1 : 0;
      upsertListItemStmt.run({ barcode: item.barcode, qty, bought });
      if (item.name) {
        upsertProduct({ barcode: item.barcode, name: item.name, price: Number(item.price) || 0 });
      }
    });
  });

  tx(items);
  return getList();
}

export function getList() {
  return getListItemsStmt.all().map((item) => ({
    ...item,
    bought: Boolean(item.bought)
  }));
}

export function deleteListItem(barcode) {
  deleteListItemStmt.run(barcode);
  return getList();
}

export function checkoutBoughtItems() {
  deleteBoughtStmt.run();
  return getList();
}

export function recordReceipt(fileName, items = [], source = 'uploaded') {
  const imported_at = Math.floor(Date.now() / 1000);
  const item_count = items.length;
  const total = items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);

  const receiptResult = insertReceiptStmt.run({ file_name: fileName, source, imported_at, item_count, total });
  const receipt_id = receiptResult.lastInsertRowid;

  const tx = db.transaction((payload) => {
    payload.forEach((item) => {
      insertReceiptItemStmt.run({
        receipt_id,
        barcode: item.barcode || item.id,
        name: item.name,
        price: Number(item.price) || 0
      });
      if (item.barcode && item.name) {
        upsertProduct({ barcode: item.barcode, name: item.name, price: Number(item.price) || 0 });
      }
    });
  });
  tx(items);

  return {
    id: Number(receipt_id),
    fileName,
    source,
    importedAt: imported_at,
    itemCount: item_count,
    total
  };
}

export function getReceipts() {
  return getReceiptsStmt.all().map((receipt) => ({
    id: receipt.id,
    fileName: receipt.file_name,
    source: receipt.source,
    importedAt: receipt.imported_at,
    itemCount: receipt.item_count,
    total: receipt.total
  }));
}

export default db;
