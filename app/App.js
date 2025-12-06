import { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View, FlatList } from 'react-native';
import ScannerSheet from './src/components/ScannerSheet';
import {
  checkoutCart,
  deleteListItem,
  fetchList,
  fetchProduct,
  fetchReceipts,
  getApiUrl,
  pushReceipt,
  searchProducts,
  syncList,
  upsertProduct
} from './src/api/client';
import { loadState, persistState } from './src/storage/localStore';

const sampleReceipt = [
  { barcode: '6281040048144', name: 'TANMIAH FRESH CHICK LEG 690G', price: 1.7 },
  { barcode: '6281011135866', name: 'AFIA OLIVE OIL EXTRA VIRGIN 500ML', price: 2.85 },
  { barcode: '6084001211409', name: 'AWAL SWEETENED CONDENSED MILK 500G', price: 1.43 }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('list');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [pendingProduct, setPendingProduct] = useState(null);
  const [catalog, setCatalog] = useState({});
  const [listItems, setListItems] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [status, setStatus] = useState('Connecting to API...');

  useEffect(() => {
    (async () => {
      const cached = await loadState();
      if (cached) {
        setCatalog(cached.catalog || {});
        setListItems(cached.listItems || []);
        setReceipts(cached.receipts || []);
      }
      setHydrated(true);
      await refreshFromApi();
    })();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    persistState({ catalog, listItems, receipts });
  }, [catalog, listItems, receipts, hydrated]);

  useEffect(() => {
    if (search.length < 2) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const results = await searchProducts(search);
        if (!cancelled) setSearchResults(results || []);
      } catch (err) {
        if (!cancelled) setSearchResults([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [search]);

  const cartItems = useMemo(() => listItems.filter((i) => i.bought), [listItems]);
  const plannedItems = useMemo(() => listItems.filter((i) => !i.bought), [listItems]);

  const plannedTotal = useMemo(
    () => plannedItems.reduce((sum, item) => sum + (catalog[item.barcode]?.price || 0) * item.qty, 0),
    [plannedItems, catalog]
  );
  const cartTotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + (catalog[item.barcode]?.price || 0) * item.qty, 0),
    [cartItems, catalog]
  );

  const refreshFromApi = async () => {
    try {
      const [listResponse, receiptResponse] = await Promise.all([fetchList(), fetchReceipts()]);
      setListItems(listResponse.items || []);
      setReceipts(receiptResponse || []);
      setStatus('Live connection to backend');
      setLastSyncAt(new Date().toISOString());
    } catch (err) {
      setStatus('Offline: using cached data');
    }
  };

  const persistList = async (nextList) => {
    setListItems(nextList);
    try {
      await syncList(nextList);
      setStatus('Synced to backend');
      setLastSyncAt(new Date().toISOString());
    } catch (err) {
      setStatus('Offline: changes queued locally');
    }
  };

  const addToList = (barcode, markBought = false) => {
    setListItems((prev) => {
      const existing = prev.find((item) => item.barcode === barcode);
      if (existing) {
        const next = prev.map((item) =>
          item.barcode === barcode
            ? { ...item, qty: item.qty + 1, bought: markBought ? true : item.bought }
            : item
        );
        persistList(next);
        return next;
      }
      const next = [{ barcode, qty: 1, bought: markBought }, ...prev];
      persistList(next);
      return next;
    });
  };

  const toggleBought = (item) => {
    const next = listItems.map((entry) =>
      entry.barcode === item.barcode ? { ...entry, bought: !entry.bought } : entry
    );
    persistList(next);
  };

  const removeItem = (barcode) => {
    const next = listItems.filter((i) => i.barcode !== barcode);
    setListItems(next);
    deleteListItem(barcode).catch(() => setStatus('Offline: removal pending'));
  };

  const handleScan = async (barcode) => {
    try {
      const product = await fetchProduct(barcode);
      setCatalog((prev) => ({ ...prev, [product.barcode]: product }));
      addToList(product.barcode, true);
      setScannerOpen(false);
    } catch (err) {
      setPendingProduct({ barcode, name: '', price: '' });
      setScannerOpen(false);
    }
  };

  const savePendingProduct = async () => {
    if (!pendingProduct?.barcode || !pendingProduct.name) return;
    const payload = {
      barcode: pendingProduct.barcode,
      name: pendingProduct.name,
      price: parseFloat(pendingProduct.price) || 0
    };
    try {
      const saved = await upsertProduct(payload);
      setCatalog((prev) => ({ ...prev, [saved.barcode]: saved }));
      addToList(saved.barcode, true);
      setPendingProduct(null);
    } catch (err) {
      setCatalog((prev) => ({ ...prev, [payload.barcode]: payload }));
      addToList(payload.barcode, true);
      setPendingProduct(null);
      setStatus('Saved locally; will sync later');
    }
  };

  const handleCheckout = async () => {
    const remaining = listItems.filter((i) => !i.bought);
    setListItems(remaining);
    try {
      const result = await checkoutCart();
      setListItems(result.items || remaining);
    } catch (err) {
      setStatus('Checkout stored locally until back online');
    }
  };

  const importSampleReceipt = async () => {
    try {
      await pushReceipt('sample-receipt.csv', sampleReceipt, 'sample');
      sampleReceipt.forEach((item) => setCatalog((prev) => ({ ...prev, [item.barcode]: item })));
      await refreshFromApi();
      setStatus('Receipt synced');
    } catch (err) {
      setStatus('Could not reach backend; receipt cached locally');
      setReceipts((prev) => [
        {
          id: `local-${Date.now()}`,
          fileName: 'sample-receipt.csv',
          source: 'sample',
          importedAt: Date.now() / 1000,
          itemCount: sampleReceipt.length,
          total: sampleReceipt.reduce((sum, item) => sum + item.price, 0)
        },
        ...prev
      ]);
      sampleReceipt.forEach((item) => setCatalog((prev) => ({ ...prev, [item.barcode]: item })));
    }
  };

  const renderListItem = ({ item }) => {
    const product = catalog[item.barcode];
    return (
      <View style={styles.card}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{product?.name || 'Unknown item'}</Text>
          <Text style={styles.cardSubtitle}>{item.qty} × {(product?.price || 0).toFixed(3)} BHD</Text>
        </View>
        <TouchableOpacity onPress={() => toggleBought(item)} style={styles.secondaryButton}>
          <Text style={styles.secondaryLabel}>{item.bought ? 'Return' : 'Found'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => removeItem(item.barcode)} style={styles.dangerButton}>
          <Text style={styles.dangerLabel}>Delete</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderReceipt = ({ item }) => (
    <View style={styles.card}>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{item.fileName}</Text>
        <Text style={styles.cardSubtitle}>
          {item.itemCount} items • {(item.total || 0).toFixed(3)} BHD
        </Text>
      </View>
      <Text style={styles.tag}>{item.source}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Grocery Scanner (iOS)</Text>
          <Text style={styles.subtitle}>API: {getApiUrl()}</Text>
        </View>
        <TouchableOpacity style={styles.scannerButton} onPress={() => setScannerOpen(true)}>
          <Text style={styles.scannerText}>Scan</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statusBar}>
        <Text style={styles.statusText}>{status}</Text>
        {lastSyncAt && <Text style={styles.statusMeta}>Last sync: {lastSyncAt}</Text>}
      </View>

      <View style={styles.tabRow}>
        {['list', 'cart', 'receipts'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={activeTab === tab ? styles.tabLabelActive : styles.tabLabel}>{tab.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'list' && (
        <View style={{ flex: 1 }}>
          <View style={styles.inputRow}>
            <TextInput
              placeholder="Search products"
              value={search}
              onChangeText={setSearch}
              style={styles.input}
            />
            <TouchableOpacity style={styles.primaryButton} onPress={() => setScannerOpen(true)}>
              <Text style={styles.primaryLabel}>Scan</Text>
            </TouchableOpacity>
          </View>
          {searchResults.length > 0 && (
            <View style={styles.resultsBox}>
              {searchResults.map((product) => (
                <TouchableOpacity
                  key={product.barcode}
                  style={styles.resultRow}
                  onPress={() => {
                    setCatalog((prev) => ({ ...prev, [product.barcode]: product }));
                    addToList(product.barcode, false);
                    setSearch('');
                    setSearchResults([]);
                  }}
                >
                  <Text style={styles.cardTitle}>{product.name}</Text>
                  <Text style={styles.cardSubtitle}>{product.price.toFixed(3)} BHD</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={styles.summaryBox}>
            <Text style={styles.summaryText}>Planned: {plannedTotal.toFixed(3)} BHD</Text>
            <Text style={styles.summaryText}>In Cart: {cartTotal.toFixed(3)} BHD</Text>
          </View>
          <FlatList
            data={plannedItems}
            keyExtractor={(item) => item.barcode}
            renderItem={renderListItem}
            contentContainerStyle={{ paddingBottom: 100 }}
            ListEmptyComponent={<Text style={styles.empty}>No items yet. Scan or search to add.</Text>}
          />
        </View>
      )}

      {activeTab === 'cart' && (
        <View style={{ flex: 1 }}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryText}>Cart total: {cartTotal.toFixed(3)} BHD</Text>
            <Text style={styles.summaryText}>{cartItems.length} items</Text>
          </View>
          <FlatList
            data={cartItems}
            keyExtractor={(item) => item.barcode}
            renderItem={renderListItem}
            contentContainerStyle={{ paddingBottom: 100 }}
            ListEmptyComponent={<Text style={styles.empty}>Nothing bought yet.</Text>}
          />
          {cartItems.length > 0 && (
            <TouchableOpacity style={styles.checkoutButton} onPress={handleCheckout}>
              <Text style={styles.checkoutText}>Checkout</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {activeTab === 'receipts' && (
        <View style={{ flex: 1 }}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryText}>Receipt imports</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={importSampleReceipt}>
              <Text style={styles.primaryLabel}>Import sample</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={receipts}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderReceipt}
            ListEmptyComponent={<Text style={styles.empty}>No receipts yet.</Text>}
          />
          <Text style={styles.helper}>Use the backend to POST parsed receipts to /api/receipts.</Text>
        </View>
      )}

      <ScannerSheet visible={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleScan} />

      {pendingProduct && (
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.title}>New product</Text>
            <Text style={styles.subtitle}>{pendingProduct.barcode}</Text>
            <TextInput
              placeholder="Name"
              value={pendingProduct.name}
              onChangeText={(name) => setPendingProduct({ ...pendingProduct, name })}
              style={styles.input}
            />
            <TextInput
              placeholder="Price"
              keyboardType="decimal-pad"
              value={pendingProduct.price}
              onChangeText={(price) => setPendingProduct({ ...pendingProduct, price })}
              style={styles.input}
            />
            <TouchableOpacity style={styles.primaryButton} onPress={savePendingProduct}>
              <Text style={styles.primaryLabel}>Save and add</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dangerButton} onPress={() => setPendingProduct(null)}>
              <Text style={styles.dangerLabel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  title: { fontSize: 20, fontWeight: '800', color: '#111827' },
  subtitle: { color: '#6b7280', fontSize: 12 },
  scannerButton: {
    backgroundColor: '#1d4ed8',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10
  },
  scannerText: { color: 'white', fontWeight: '700' },
  statusBar: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb'
  },
  statusText: { fontSize: 13, color: '#111827' },
  statusMeta: { fontSize: 11, color: '#6b7280' },
  tabRow: {
    flexDirection: 'row',
    padding: 8,
    gap: 8,
    backgroundColor: '#f9fafb'
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  tabButtonActive: {
    borderColor: '#1d4ed8',
    backgroundColor: '#e0e7ff'
  },
  tabLabel: { textAlign: 'center', color: '#6b7280', fontWeight: '700' },
  tabLabelActive: { textAlign: 'center', color: '#1d4ed8', fontWeight: '800' },
  inputRow: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    flexDirection: 'row',
    gap: 8
  },
  input: {
    flex: 1,
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  primaryButton: {
    backgroundColor: '#111827',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10
  },
  primaryLabel: { color: 'white', fontWeight: '700' },
  secondaryButton: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginHorizontal: 4
  },
  secondaryLabel: { color: '#111827', fontWeight: '700' },
  dangerButton: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 6
  },
  dangerLabel: { color: '#b91c1c', fontWeight: '700' },
  resultsBox: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  resultRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#f3f4f6'
  },
  summaryBox: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 12,
    backgroundColor: 'white',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  summaryText: { fontWeight: '700', color: '#111827' },
  card: {
    backgroundColor: 'white',
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  cardTitle: { fontWeight: '700', color: '#111827' },
  cardSubtitle: { color: '#6b7280', fontSize: 12 },
  tag: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    color: '#111827',
    fontWeight: '700'
  },
  empty: {
    textAlign: 'center',
    color: '#9ca3af',
    marginTop: 24
  },
  checkoutButton: {
    backgroundColor: '#16a34a',
    margin: 16,
    padding: 14,
    borderRadius: 12
  },
  checkoutText: { color: 'white', textAlign: 'center', fontWeight: '800' },
  helper: {
    textAlign: 'center',
    color: '#6b7280',
    marginVertical: 12,
    paddingHorizontal: 16
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  modalContent: {
    width: '100%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    gap: 10
  }
});
