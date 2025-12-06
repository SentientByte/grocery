import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Scan,
  FileText,
  Trash2,
  Search,
  X,
  ShoppingCart,
  UploadCloud,
  ChevronLeft
} from 'lucide-react';
import LiteSQL from './litesql';

const appId = typeof __app_id !== 'undefined' ? __app_id : import.meta.env.VITE_APP_ID || 'default-app-id';

const IMPORTED_RECEIPT_DATA = [
  { barcode: '6281040048144', name: 'TANMIAH FRESH CHICK LEG 690G', price: 1.7 },
  { barcode: '6281011135866', name: 'AFIA OLIVE OIL EXTRA VIRGIN 500ML', price: 2.85 },
  { barcode: '6084001211409', name: 'AWAL SWEETENED CONDENSED MILK 500G', price: 1.43 },
  { barcode: '6082012017379', name: 'ALFARES LEMON SALT 400G', price: 0.73 },
  { barcode: '6084000088576', name: 'MAZA SALT 737G', price: 0.28 },
  { barcode: '6084001233364', name: 'FARM CHICKEN FRESH FILET 400G', price: 1.45 },
  { barcode: '80340430', name: 'LONGAN (THA) RED PKT', price: 0.91 },
  { barcode: '80104230', name: 'STRAWBERRY FRESH EGYPT PKT', price: 0.32 },
  { barcode: '9501041608138', name: 'AWAL FRE FF YOGH 170G', price: 0.6 },
  { barcode: '9110695003604', name: 'CAPSICUM GREEN JOR (KG)', price: 0.54 },
  { barcode: '6084010930933', name: 'MEAT TOWN BEEF BURGER 600G', price: 2.24 },
  { barcode: '8690565016411', name: 'PINAR LABNEH 750G+200G', price: 3.05 },
  { barcode: '6281057500000', name: 'NADEC UHT MILK FF 1L', price: 1.89 },
  { barcode: '054881017916', name: 'AHMAD MINT GREEN TEA 100S', price: 1.85 },
  { barcode: '6281039703665', name: 'SAUDI TOMATO PASTE 135G', price: 1.02 },
  { barcode: '9501040010116', name: 'DANA ALUM. FOIL 30CM', price: 0.9 }
];

const Scanner = ({ onScan, onClose, lastScannedItem }) => {
  const [error, setError] = useState(null);
  const scannerRef = useRef(null);
  const lastCodeRef = useRef(null);
  const lastTimeRef = useRef(0);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/html5-qrcode';
    script.async = true;
    script.onload = () => startScanner();
    document.body.appendChild(script);

    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.clear();
        } catch (e) {
          console.error(e);
        }
      }
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  const startScanner = () => {
    try {
      if (!window.Html5QrcodeScanner) {
        setError('Scanner library failed to load.');
        return;
      }

      const scanner = new window.Html5QrcodeScanner(
        'reader',
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );

      scanner.render((decodedText) => {
        const now = Date.now();
        if (decodedText === lastCodeRef.current && now - lastTimeRef.current < 2000) {
          return;
        }

        lastCodeRef.current = decodedText;
        lastTimeRef.current = now;
        onScan(decodedText);
      }, () => {});

      scannerRef.current = scanner;
    } catch (err) {
      setError('Camera access denied. Ensure you are on HTTPS.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex justify-between items-center p-4 bg-black/80 text-white absolute top-0 w-full z-10">
        <h2 className="text-lg font-semibold">Shopping Scanner</h2>
        <button onClick={onClose} className="px-4 py-2 bg-gray-800 rounded-full text-sm font-medium">
          Done
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center bg-gray-900 relative">
        <div id="reader" className="w-full h-full object-cover" />
        {error && <div className="text-red-400 absolute bottom-32 px-4 text-center">{error}</div>}

        {lastScannedItem && (
          <div className="absolute bottom-10 left-4 right-4 bg-green-600 text-white p-4 rounded-xl shadow-2xl animate-in slide-in-from-bottom-5 fade-in duration-300">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs opacity-75 uppercase font-bold">Just Added</div>
                <div className="font-bold text-lg">{lastScannedItem.name}</div>
              </div>
              <div className="text-2xl font-bold">{lastScannedItem.price.toFixed(3)}</div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-gray-900 pb-10 flex justify-center">
        <button
          onClick={() => onScan('6281040048144')}
          className="text-gray-500 text-xs underline"
        >
          Simulate Scan (Demo)
        </button>
      </div>
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState('list');
  const [showScanner, setShowScanner] = useState(false);
  const [groceryList, setGroceryList] = useState([]);
  const [catalog, setCatalog] = useState({});
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [listTotal, setListTotal] = useState(0);
  const [cartTotal, setCartTotal] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  const [lastScanned, setLastScanned] = useState(null);
  const [newProductBarcode, setNewProductBarcode] = useState(null);
  const [newProductForm, setNewProductForm] = useState({ name: '', price: '' });
  const isHydratedRef = useRef(false);
  const dbRef = useRef(null);

  useEffect(() => {
    const db = new LiteSQL(appId);
    dbRef.current = db;

    db.init().then((state) => {
      setGroceryList(state.groceryList || []);
      setCatalog(state.catalog || {});
      setReceipts(state.receipts || []);
      setLoading(false);
      isHydratedRef.current = true;
    });
  }, []);

  useEffect(() => {
    if (!isHydratedRef.current) return;
    if (!dbRef.current) return;
    dbRef.current.persist({ groceryList, catalog, receipts });
  }, [groceryList, catalog, receipts]);

  useEffect(() => {
    let planned = 0;
    let inCart = 0;

    groceryList.forEach((item) => {
      const product = catalog[item.barcode];
      const cost = product ? product.price * item.qty : 0;

      if (item.bought) {
        inCart += cost;
      } else {
        planned += cost;
      }
    });

    setListTotal(planned);
    setCartTotal(inCart);
  }, [groceryList, catalog]);

  useEffect(() => {
    if (searchQuery.length > 1) {
      const lower = searchQuery.toLowerCase();
      const results = Object.values(catalog)
        .filter((p) => p.name.toLowerCase().includes(lower))
        .slice(0, 5);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, catalog]);

  const handleScan = async (barcode) => {
    const product = catalog[barcode];

    if (product) {
      setLastScanned(product);
      addToGroceryList(barcode, true);
      setTimeout(() => setLastScanned(null), 3000);
    } else {
      setShowScanner(false);
      setNewProductBarcode(barcode);
    }
  };

  const parseReceiptText = (text) => {
    if (!text) return [];

    try {
      const parsed = JSON.parse(text);
      const items = Array.isArray(parsed) ? parsed : parsed.items;
      if (Array.isArray(items)) {
        return items
          .map((item) => ({
            barcode: item.barcode || item.id,
            name: item.name,
            price: parseFloat(item.price) || 0
          }))
          .filter((item) => item.barcode && item.name);
      }
    } catch (err) {
      // not JSON, continue to CSV/text parsing
    }

    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split(',').map((part) => part.trim()))
      .filter((parts) => parts.length >= 3)
      .map((parts) => {
        const [barcode, ...rest] = parts;
        const price = parseFloat(rest.pop()) || 0;
        const name = rest.join(', ') || 'Unknown Item';
        return { barcode, name, price };
      });
  };

  const parseReceiptFile = async (file) => {
    try {
      const text = await file.text();
      return parseReceiptText(text);
    } catch (err) {
      console.error('Failed to parse receipt file', err);
      return [];
    }
  };

  const addToGroceryList = (barcode, markAsBought = false) => {
    setGroceryList((prev) => {
      const existing = prev.find((i) => i.barcode === barcode);
      if (existing) {
        return prev.map((item) => {
          if (item.barcode !== barcode) return item;
          if (markAsBought && !item.bought) {
            return { ...item, bought: true };
          }
          return {
            ...item,
            qty: item.qty + 1,
            bought: markAsBought ? true : item.bought
          };
        });
      }
      return [
        ...prev,
        { barcode, id: barcode, qty: 1, bought: markAsBought, createdAt: Date.now() }
      ];
    });
  };

  const mergeReceiptItems = (items) => {
    setCatalog((prev) => {
      const next = { ...prev };
      items.forEach((item) => {
        if (!item.barcode || !item.name) return;
        next[item.barcode] = {
          barcode: item.barcode,
          name: item.name,
          price: parseFloat(item.price) || 0
        };
      });
      return next;
    });
  };

  const recordReceipt = (fileName, items, source) => {
    const total = items.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
    setReceipts((prev) => [
      {
        id: `receipt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        fileName,
        itemCount: items.length,
        total,
        importedAt: Date.now(),
        source
      },
      ...prev
    ]);
  };

  const toggleBought = (item) => {
    setGroceryList((prev) =>
      prev.map((entry) => (entry.id === item.id ? { ...entry, bought: !entry.bought } : entry))
    );
  };

  const deleteItem = (id) => {
    setGroceryList((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCart = () => {
    const boughtItems = groceryList.filter((i) => i.bought);

    if (confirm(`Checkout ${boughtItems.length} items? This will remove them from your list.`)) {
      setGroceryList((prev) => prev.filter((item) => !item.bought));
      setCartTotal(0);
    }
  };

  const saveNewProduct = () => {
    if (!newProductBarcode) return;
    const productData = {
      barcode: newProductBarcode,
      name: newProductForm.name,
      price: parseFloat(newProductForm.price) || 0,
      createdAt: Date.now()
    };

    setCatalog((prev) => ({ ...prev, [newProductBarcode]: productData }));
    addToGroceryList(newProductBarcode, true);

    setNewProductBarcode(null);
    setNewProductForm({ name: '', price: '' });
    setShowScanner(true);
  };

  const handlePDFUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    const parsedItems = await parseReceiptFile(file);
    const items = parsedItems.length ? parsedItems : IMPORTED_RECEIPT_DATA;

    mergeReceiptItems(items);
    recordReceipt(file.name, items, parsedItems.length ? 'file' : 'sample');

    setLoading(false);
    alert(
      `Success! Imported ${items.length} items from ${
        parsedItems.length ? 'your file' : 'sample receipt data'
      }.`
    );
    setActiveTab('list');
    e.target.value = '';
  };

  const renderList = () => (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white px-4 pt-12 pb-4 shadow-sm sticky top-0 z-10">
        <h1 className="text-3xl font-bold text-gray-900">Planning List</h1>
        <p className="text-gray-400 text-sm mb-4">Items to find</p>

        <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 flex justify-between items-center mb-4">
          <div>
            <div className="text-xs text-orange-600 font-bold uppercase">Estimated Cost</div>
            <div className="text-2xl font-bold text-orange-900">{listTotal.toFixed(3)} BHD</div>
          </div>
          <div className="h-8 w-8 bg-orange-200 rounded-full flex items-center justify-center text-orange-700">
            <FileText size={16} />
          </div>
        </div>

        <div className="relative z-20">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Add to list..."
            className="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border overflow-hidden">
              {searchResults.map((prod) => (
                <div
                  key={prod.barcode}
                  onClick={() => {
                    addToGroceryList(prod.barcode, false);
                    setSearchQuery('');
                  }}
                  className="p-3 border-b hover:bg-orange-50 flex justify-between"
                >
                  <span>{prod.name}</span>
                  <span className="text-gray-400">{prod.price.toFixed(3)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
        {groceryList.filter((i) => !i.bought).length === 0 ? (
          <div className="text-center text-gray-400 mt-10">All planned items found!</div>
        ) : (
          groceryList
            .filter((i) => !i.bought)
            .map((item) => {
              const product = catalog[item.barcode] || { name: 'Unknown', price: 0 };
              return (
                <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button onClick={() => toggleBought(item)} className="w-6 h-6 rounded-full border-2 border-gray-300" />
                    <div>
                      <div className="font-medium">{product.name}</div>
                      <div className="text-xs text-gray-500">{product.price.toFixed(3)} BHD</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {item.qty > 1 && <span className="bg-gray-100 px-2 py-1 rounded text-xs font-bold">x{item.qty}</span>}
                    <button onClick={() => deleteItem(item.id)} className="text-gray-300 hover:text-red-500">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              );
            })
        )}
      </div>
    </div>
  );

  const renderCart = () => {
    const cartItems = groceryList.filter((i) => i.bought);
    return (
      <div className="flex flex-col h-full bg-gray-900 text-white">
        <div className="px-6 pt-12 pb-6 bg-gray-800 rounded-b-3xl shadow-lg z-10">
          <div className="flex justify-between items-start mb-4">
            <h1 className="text-3xl font-bold">My Cart</h1>
            <div className="bg-green-600 px-3 py-1 rounded-full text-xs font-bold">Live Total</div>
          </div>
          <div className="flex justify-between items-end">
            <div className="text-gray-400 text-sm">{cartItems.length} items scanned</div>
            <div className="text-4xl font-bold text-green-400">
              {cartTotal.toFixed(3)} <span className="text-lg text-white">BHD</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-32">
          {cartItems.length === 0 ? (
            <div className="text-center text-gray-600 mt-20 flex flex-col items-center">
              <Scan size={64} className="mb-4 opacity-20" />
              <p>Your cart is empty.</p>
              <p className="text-sm">Tap the blue button to start scanning!</p>
            </div>
          ) : (
            cartItems.map((item) => {
              const product = catalog[item.barcode] || { name: 'Unknown', price: 0 };
              return (
                <div
                  key={item.id}
                  className="bg-gray-800 p-4 rounded-xl flex items-center justify-between animate-in slide-in-from-bottom-2"
                >
                  <div>
                    <div className="font-medium text-gray-200">{product.name}</div>
                    <div className="text-xs text-gray-500">{product.price.toFixed(3)} each</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-green-400 font-bold">{(product.price * item.qty).toFixed(3)}</div>
                    <div className="flex items-center gap-2 bg-gray-700 rounded-lg px-2 py-1">
                      <span className="text-xs text-gray-400">Qty:</span>
                      <span className="font-mono">{item.qty}</span>
                    </div>
                    <button onClick={() => toggleBought(item)} className="text-gray-500 hover:text-white" title="Move back to list">
                      <ChevronLeft size={18} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="absolute bottom-24 left-0 right-0 px-6 flex justify-between items-end pointer-events-none">
          {cartItems.length > 0 && (
            <button
              onClick={clearCart}
              className="pointer-events-auto bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white backdrop-blur-md px-6 py-3 rounded-2xl font-bold transition-all"
            >
              Checkout
            </button>
          )}
          <button
            onClick={() => setShowScanner(true)}
            className="pointer-events-auto bg-blue-600 text-white h-16 w-16 rounded-full shadow-lg shadow-blue-600/50 flex items-center justify-center hover:scale-105 transition-transform"
          >
            <Scan size={32} />
          </button>
        </div>
      </div>
    );
  };

  const renderUpload = () => (
    <div className="h-full bg-gray-50 p-6 pt-12 flex flex-col gap-4">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Tools</h1>
      <div className="bg-white p-6 rounded-2xl shadow-sm">
        <h3 className="font-bold flex items-center gap-2 mb-2">
          <UploadCloud size={20} /> Import Receipt
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          Upload a PDF, CSV, or JSON invoice to bulk add items and prices to your LiteSQL-backed catalog.
        </p>
        <label className="block w-full bg-gray-100 hover:bg-gray-200 text-center py-3 rounded-xl cursor-pointer transition-colors font-medium text-gray-700">
          Choose File
          <input type="file" accept=".pdf,.csv,.json,text/plain" className="hidden" onChange={handlePDFUpload} />
        </label>
        <p className="text-[11px] text-gray-400 mt-3">
          Expected formats: CSV rows of <strong>barcode,name,price</strong> or JSON array/`items` field with barcode, name, and price values.
        </p>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm flex-1 overflow-y-auto">
        <h3 className="font-bold mb-3">Recent receipt imports</h3>
        {receipts.length === 0 ? (
          <p className="text-sm text-gray-500">No receipts imported yet.</p>
        ) : (
          <div className="space-y-3">
            {receipts.map((receipt) => (
              <div key={receipt.id} className="border border-gray-100 rounded-xl p-4">
                <div className="flex justify-between items-center mb-1">
                  <div className="font-semibold text-gray-800">{receipt.fileName}</div>
                  <div className="text-xs text-gray-400 uppercase">{receipt.source === 'sample' ? 'Sample' : 'Uploaded'}</div>
                </div>
                <div className="text-sm text-gray-600 flex justify-between">
                  <span>{receipt.itemCount} items</span>
                  <span className="font-mono font-semibold">{receipt.total.toFixed(3)} BHD</span>
                </div>
                <div className="text-[11px] text-gray-400 mt-1">
                  Imported {new Date(receipt.importedAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="font-sans text-gray-800 h-screen w-full max-w-md mx-auto bg-white shadow-2xl overflow-hidden flex flex-col relative">
      <style>{"body { font-family: 'Inter', sans-serif; -webkit-tap-highlight-color: transparent; }"}</style>

      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'list' && renderList()}
        {activeTab === 'cart' && renderCart()}
        {activeTab === 'upload' && renderUpload()}
      </div>

      {showScanner && (
        <Scanner onScan={handleScan} onClose={() => setShowScanner(false)} lastScannedItem={lastScanned} />
      )}

      {newProductBarcode && !showScanner && (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-6">
          <div className="bg-gray-800 w-full rounded-2xl p-6 text-white">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Unknown Product</h3>
              <button
                onClick={() => {
                  setNewProductBarcode(null);
                  setShowScanner(true);
                }}
              >
                <X />
              </button>
            </div>
            <div className="bg-gray-900 p-3 rounded-lg mb-4 text-center font-mono text-sm tracking-widest">
              {newProductBarcode}
            </div>
            <input
              className="w-full bg-gray-700 p-4 rounded-xl mb-3 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Product Name"
              value={newProductForm.name}
              onChange={(e) => setNewProductForm({ ...newProductForm, name: e.target.value })}
            />
            <input
              type="number"
              className="w-full bg-gray-700 p-4 rounded-xl mb-6 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Price (BHD)"
              value={newProductForm.price}
              onChange={(e) => setNewProductForm({ ...newProductForm, price: e.target.value })}
            />
            <button
              onClick={saveNewProduct}
              disabled={!newProductForm.name || !newProductForm.price}
              className="w-full bg-blue-600 py-4 rounded-xl font-bold disabled:opacity-50"
            >
              Save & Continue Shopping
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border-t border-gray-100 px-6 py-4 flex justify-between items-center pb-8 z-20">
        <button
          onClick={() => setActiveTab('list')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'list' ? 'text-orange-500' : 'text-gray-400'}`}
        >
          <FileText size={24} /> <span className="text-[10px] font-bold">Plan</span>
        </button>
        <button
          onClick={() => setActiveTab('cart')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'cart' ? 'text-blue-500' : 'text-gray-400'}`}
        >
          <ShoppingCart size={24} />
          <span className="text-[10px] font-bold">Cart ({groceryList.filter((i) => i.bought).length})</span>
        </button>
        <button
          onClick={() => setActiveTab('upload')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'upload' ? 'text-gray-900' : 'text-gray-400'}`}
        >
          <UploadCloud size={24} /> <span className="text-[10px] font-bold">Tools</span>
        </button>
      </div>

      {loading && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center text-gray-600">
          <div className="flex items-center gap-3">
            <Camera className="animate-pulse" />
            <span>Loading your groceries...</span>
          </div>
        </div>
      )}
    </div>
  );
}
