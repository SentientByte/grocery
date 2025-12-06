import { useEffect, useState } from 'react';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function ScannerSheet({ visible, onClose, onScan }) {
  const [hasPermission, setHasPermission] = useState(null);
  const [cooldown, setCooldown] = useState(false);

  useEffect(() => {
    BarCodeScanner.requestPermissionsAsync().then(({ status }) => {
      setHasPermission(status === 'granted');
    });
  }, []);

  const handleScanned = ({ data }) => {
    if (cooldown) return;
    setCooldown(true);
    onScan(data);
    setTimeout(() => setCooldown(false), 1200);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <BarCodeScanner
          onBarCodeScanned={handleScanned}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.overlay}>
          {hasPermission === false && <Text style={styles.banner}>Camera permission denied</Text>}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000'
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 60,
    paddingHorizontal: 16
  },
  closeButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#111827',
    borderRadius: 8
  },
  closeText: {
    color: 'white',
    fontWeight: '600'
  },
  banner: {
    color: 'white',
    fontWeight: '700',
    marginBottom: 12
  }
});
