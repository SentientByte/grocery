export default {
  name: 'Grocery Scanner',
  slug: 'grocery-scanner',
  scheme: 'groceryscanner',
  version: '0.1.0',
  orientation: 'portrait',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.example.groceryscanner'
  },
  android: {
    package: 'com.example.groceryscanner'
  },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000'
  }
};
