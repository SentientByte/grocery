class LiteSQL {
  constructor(appId) {
    this.storageKey = `litesql-${appId}`;
    this.state = {
      catalog: {},
      groceryList: [],
      receipts: []
    };
  }

  async init() {
    const stored = localStorage.getItem(this.storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        this.state = {
          catalog: parsed.catalog || {},
          groceryList: parsed.groceryList || [],
          receipts: parsed.receipts || []
        };
      } catch (err) {
        console.error('LiteSQL: failed to parse state', err);
      }
    }
    return this.state;
  }

  getState() {
    return this.state;
  }

  async persist(partial) {
    this.state = { ...this.state, ...partial };
    localStorage.setItem(this.storageKey, JSON.stringify(this.state));
  }
}

export default LiteSQL;
