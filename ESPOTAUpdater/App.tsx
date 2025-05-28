import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Platform,
} from 'react-native';
import DocumentPicker from 'react-native-document-picker';
import ESPOTAService from './src/services/ESPOTAService';

const App: React.FC = () => {
  const [espIP, setEspIP] = useState<string>('192.168.1.100');
  const [espPort, setEspPort] = useState<string>('3232');
  const [password, setPassword] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isTestingConnection, setIsTestingConnection] = useState<boolean>(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string): void => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const selectFile = async (): Promise<void> => {
    try {
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.allFiles],
      });
      
      const selectedFile = result[0];
      
      if (!selectedFile || !selectedFile.name || !selectedFile.size) {
        Alert.alert('Error', 'Invalid file selected');
        return;
      }
      
      if (selectedFile.name.endsWith('.bin')) {
        setSelectedFile(selectedFile);
        addLog(`✅ File selected: ${selectedFile.name} (${Math.round(selectedFile.size / 1024)} KB)`);
      } else {
        Alert.alert('Error', 'Please select a .bin firmware file');
        addLog('❌ Invalid file type selected');
      }
    } catch (err) {
      if (!DocumentPicker.isCancel(err)) {
        console.error('File picker error:', err);
        Alert.alert('Error', 'Could not select file');
      }
    }
  };

  const testConnection = async (): Promise<void> => {
    if (!espIP) {
      Alert.alert('Error', 'Please enter ESP IP address');
      return;
    }

    setIsTestingConnection(true);
    addLog(`🔍 Testing connection to ${espIP}:${espPort}`);

    try {
      const isConnected = await ESPOTAService.testConnection(espIP, parseInt(espPort));
      
      if (isConnected) {
        addLog('✅ Connection test successful!');
        Alert.alert('Success', 'ESP device is reachable and responding');
      } else {
        addLog('❌ Connection test failed');
        Alert.alert('Failed', 'Could not connect to ESP device');
      }
    } catch (error: any) {
      addLog(`❌ Connection test error: ${error.message}`);
      Alert.alert('Error', `Connection test failed: ${error.message}`);
    } finally {
      setIsTestingConnection(false);
    }
  };

  const startUpload = async (): Promise<void> => {
    if (!selectedFile) {
      Alert.alert('Error', 'Please select a firmware file');
      return;
    }

    if (!espIP) {
      Alert.alert('Error', 'Please enter ESP IP address');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setLogs([]);
    addLog('🚀 Starting ESP OTA upload...');

    ESPOTAService.setProgressCallback((progress: number) => {
      setUploadProgress(progress);
    });

    ESPOTAService.setLogCallback((message: string) => {
      addLog(message);
    });

    try {
      const result = await ESPOTAService.uploadFirmware(
        espIP,
        parseInt(espPort),
        selectedFile.uri,
        password
      );
      
      addLog('🎉 Firmware uploaded successfully!');
      Alert.alert('Success', 'Firmware uploaded successfully!\nESP device should restart now.');
    } catch (error: any) {
      addLog(`❌ Upload error: ${error.message}`);
      Alert.alert('Upload Failed', `Error: ${error.message}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const clearLogs = (): void => {
    setLogs([]);
    addLog('🧹 Logs cleared');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <Text style={styles.title}>🚀 ESP OTA Updater</Text>
        <Text style={styles.subtitle}>Mobile Firmware Uploader</Text>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔧 ESP Configuration</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>📡 ESP IP Address:</Text>
            <TextInput
              style={styles.input}
              value={espIP}
              onChangeText={setEspIP}
              placeholder="192.168.1.100"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>🔌 ESP Port:</Text>
            <TextInput
              style={styles.input}
              value={espPort}
              onChangeText={setEspPort}
              placeholder="3232"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>🔐 Password:</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="OTA Password"
              secureTextEntry
            />
          </View>

          <TouchableOpacity 
            style={[styles.testButton, isTestingConnection && styles.disabledButton]} 
            onPress={testConnection}
            disabled={isTestingConnection}
          >
            <Text style={styles.buttonText}>
              {isTestingConnection ? '⏳ Testing...' : '🔍 Test Connection'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📁 Firmware File</Text>
          
          <TouchableOpacity style={styles.button} onPress={selectFile}>
            <Text style={styles.buttonText}>
              {selectedFile ? `📄 ${selectedFile.name}` : '📁 Select .bin File'}
            </Text>
          </TouchableOpacity>

          {selectedFile && (
            <View style={styles.fileInfo}>
              <Text style={styles.fileInfoText}>📄 {selectedFile.name}</Text>
              <Text style={styles.fileInfoText}>📏 {Math.round(selectedFile.size / 1024)} KB</Text>
            </View>
          )}
        </View>

        {uploadProgress > 0 && (
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>
              Progress: {Math.round(uploadProgress * 100)}%
            </Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${uploadProgress * 100}%` }]} />
            </View>
          </View>
        )}

        <TouchableOpacity 
          style={[styles.button, styles.uploadButton, isUploading && styles.disabledButton]}
          onPress={startUpload}
          disabled={isUploading}
        >
          <Text style={styles.buttonText}>
            {isUploading ? '⏳ Uploading...' : '🚀 Upload Firmware'}
          </Text>
        </TouchableOpacity>

        {logs.length > 0 && (
          <View style={styles.logContainer}>
            <View style={styles.logHeader}>
              <Text style={styles.logTitle}>📋 Logs</Text>
              <TouchableOpacity onPress={clearLogs} style={styles.clearButton}>
                <Text style={styles.clearButtonText}>🧹 Clear</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.logScrollView} nestedScrollEnabled>
              {logs.slice(-15).map((log, index) => (
                <Text key={index} style={styles.logText}>{log}</Text>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.infoContainer}>
          <Text style={styles.infoTitle}>ℹ️ Information</Text>
          <Text style={styles.infoText}>• Compatible with ArduinoOTA library</Text>
          <Text style={styles.infoText}>• Uses UDP + TCP protocol (espota.py)</Text>
          <Text style={styles.infoText}>• Platform: {Platform.OS}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollView: { flex: 1, padding: 20 },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 5, color: '#333' },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: 30, color: '#666', fontStyle: 'italic' },
  section: { backgroundColor: 'white', borderRadius: 12, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: '#333' },
  inputContainer: { marginBottom: 15 },
  label: { fontSize: 16, marginBottom: 8, color: '#333', fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 15, fontSize: 16, backgroundColor: '#f9f9f9' },
  button: { backgroundColor: '#007AFF', padding: 18, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  testButton: { backgroundColor: '#FF9500', padding: 15, borderRadius: 10, alignItems: 'center' },
  uploadButton: { backgroundColor: '#34C759', marginTop: 10 },
  disabledButton: { backgroundColor: '#ccc' },
  buttonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  fileInfo: { backgroundColor: '#f0f8ff', padding: 15, borderRadius: 8, marginTop: 10 },
  fileInfoText: { fontSize: 14, color: '#333', marginBottom: 5 },
  progressContainer: { backgroundColor: 'white', padding: 20, borderRadius: 12, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  progressText: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 10, textAlign: 'center' },
  progressBar: { height: 15, backgroundColor: '#e0e0e0', borderRadius: 8 },
  progressFill: { height: '100%', backgroundColor: '#34C759', borderRadius: 8 },
  logContainer: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 15, marginBottom: 20 },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  logTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  clearButton: { backgroundColor: '#FF3B30', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  clearButtonText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  logScrollView: { maxHeight: 200 },
  logText: { color: '#00ff00', fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginBottom: 3 },
  infoContainer: { backgroundColor: '#E3F2FD', padding: 20, borderRadius: 12, marginBottom: 20 },
  infoTitle: { fontSize: 16, fontWeight: 'bold', color: '#1976D2', marginBottom: 10 },
  infoText: { fontSize: 14, color: '#1976D2', lineHeight: 20, marginBottom: 5 },
});

export default App;
