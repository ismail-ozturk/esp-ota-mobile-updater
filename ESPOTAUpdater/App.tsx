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
import { pick, isErrorWithCode, errorCodes } from '@react-native-documents/picker';
import ESPOTAService from './src/services/ESPOTAService';

interface SelectedFile {
  uri: string;
  name: string;
  size: number;
  type?: string;
}

const App: React.FC = () => {
  const [espIP, setEspIP] = useState<string>('192.168.1.100');
  const [espPort, setEspPort] = useState<string>('3232');
  const [password, setPassword] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
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
    const result = await pick({
      allowMultiSelection: false,
    });
    
    const selectedFile = result[0];
    
    if (!selectedFile || !selectedFile.name || !selectedFile.size) {
      Alert.alert('Error', 'Invalid file selected');
      addLog('❌ Invalid file selected');
      return;
    }
    
    if (selectedFile.name.endsWith('.bin')) {
      const fileData: SelectedFile = {
        uri: selectedFile.uri,
        name: selectedFile.name,
        size: selectedFile.size,
        type: selectedFile.type || 'application/octet-stream'
      };
      
      setSelectedFile(fileData);
      addLog(`✅ File selected: ${selectedFile.name} (${Math.round(selectedFile.size / 1024)} KB)`);
    } else {
      Alert.alert('Error', 'Please select a .bin firmware file');
      addLog('❌ Invalid file type selected - .bin required');
    }
  } catch (err) {
    if (isErrorWithCode(err)) {
      switch (err.code) {
        case errorCodes.OPERATION_CANCELED:
          addLog('📁 File selection cancelled');
          break;
        case errorCodes.UNABLE_TO_OPEN_FILE_TYPE:
          Alert.alert('Error', 'Unable to open file type');
          addLog('❌ Unable to open file type');
          break;
        default:
          console.error('File picker error:', err);
          Alert.alert('Error', 'Could not select file');
          addLog(`❌ File picker error: ${err.message}`);
      }
    } else {
      console.error('Unknown error:', err);
      Alert.alert('Error', 'Unknown error occurred');
      addLog(`❌ Unknown error: ${err}`);
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
        Alert.alert('Failed', 'Could not connect to ESP device\n\nCheck:\n• ESP is powered on\n• WiFi connection\n• IP address is correct\n• ArduinoOTA is running');
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
    addLog(`🎯 Target: ${espIP}:${espPort}`);
    addLog(`📁 File: ${selectedFile.name}`);
    addLog(`📏 Size: ${Math.round(selectedFile.size / 1024)} KB`);

    // Progress callback ayarla
    ESPOTAService.setProgressCallback((progress: number) => {
      setUploadProgress(progress);
    });

    // Log callback ayarla
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
      addLog(`✅ Result: ${result.message}`);
      if (result.fileSize) {
        addLog(`📏 Uploaded: ${result.fileSize} bytes`);
      }
      if (result.fileMD5) {
        addLog(`🔐 MD5: ${result.fileMD5}`);
      }
      
      Alert.alert(
        'Upload Successful! 🎉', 
        `Firmware uploaded successfully!\n\nFile: ${selectedFile.name}\nSize: ${Math.round(selectedFile.size / 1024)} KB\n\nESP device should restart automatically with the new firmware.`,
        [{ text: 'OK', style: 'default' }]
      );
    } catch (error: any) {
      addLog(`❌ Upload error: ${error.message}`);
      Alert.alert(
        'Upload Failed ❌', 
        `Error: ${error.message}\n\nTroubleshooting:\n• Check ESP WiFi connection\n• Verify IP address is correct\n• Ensure ArduinoOTA is running\n• Check if file is valid .bin firmware\n• Try restarting ESP device`,
        [{ text: 'OK', style: 'default' }]
      );
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const clearLogs = (): void => {
    setLogs([]);
    addLog('🧹 Logs cleared');
  };

  const showFileInfo = (): void => {
    if (selectedFile) {
      Alert.alert(
        'File Information 📄',
        `Name: ${selectedFile.name}\n\nSize: ${Math.round(selectedFile.size / 1024)} KB (${selectedFile.size} bytes)\n\nType: ${selectedFile.type}\n\nPath: ${selectedFile.uri}`,
        [{ text: 'OK' }]
      );
    }
  };

  const showNetworkInfo = (): void => {
    Alert.alert(
      'Network Information 🌐',
      `ESP IP: ${espIP}\nPort: ${espPort}\nProtocol: UDP + TCP\n\nMake sure your mobile device and ESP are on the same WiFi network.`,
      [{ text: 'OK' }]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>🚀 ESP OTA Updater</Text>
        <Text style={styles.subtitle}>Over-The-Air Firmware Uploader</Text>
        
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🔧 ESP Device Configuration</Text>
            <TouchableOpacity onPress={showNetworkInfo} style={styles.infoButton}>
              <Text style={styles.infoButtonText}>ℹ️</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>📡 ESP IP Address:</Text>
            <TextInput
              style={styles.input}
              value={espIP}
              onChangeText={setEspIP}
              placeholder="192.168.1.100"
              autoCapitalize="none"
              keyboardType="default"
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
            <Text style={styles.label}>🔐 Password (Optional):</Text>
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
          <Text style={styles.sectionTitle}>📁 Firmware File Selection</Text>
          
          <TouchableOpacity style={styles.button} onPress={selectFile}>
            <Text style={styles.buttonText}>
              {selectedFile ? `📄 ${selectedFile.name}` : '📁 Select .bin Firmware File'}
            </Text>
          </TouchableOpacity>

          {selectedFile && (
            <TouchableOpacity style={styles.fileInfo} onPress={showFileInfo}>
              <Text style={styles.fileInfoText}>📄 File: {selectedFile.name}</Text>
              <Text style={styles.fileInfoText}>
                📏 Size: {Math.round(selectedFile.size / 1024)} KB
              </Text>
              <Text style={styles.fileInfoText}>📋 Type: {selectedFile.type}</Text>
              <Text style={styles.fileInfoTextSmall}>
                📍 {selectedFile.uri.length > 50 ? 
                  `...${selectedFile.uri.slice(-47)}` : 
                  selectedFile.uri}
              </Text>
              <Text style={styles.tapToViewText}>Tap for full details</Text>
            </TouchableOpacity>
          )}
        </View>

        {uploadProgress > 0 && (
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>
              📊 Upload Progress: {Math.round(uploadProgress * 100)}%
            </Text>
            <View style={styles.progressBar}>
              <View 
                style={[styles.progressFill, { width: `${uploadProgress * 100}%` }]} 
              />
            </View>
            <Text style={styles.progressSubtext}>
              {uploadProgress < 1 ? 
                'Uploading firmware to ESP device...' : 
                'Upload complete! ESP rebooting with new firmware...'}
            </Text>
          </View>
        )}

        <TouchableOpacity 
          style={[
            styles.button, 
            styles.uploadButton, 
            isUploading && styles.disabledButton
          ]}
          onPress={startUpload}
          disabled={isUploading}
        >
          <Text style={styles.buttonText}>
            {isUploading ? '⏳ Uploading Firmware...' : '🚀 Upload Firmware'}
          </Text>
        </TouchableOpacity>

        {logs.length > 0 && (
          <View style={styles.logContainer}>
            <View style={styles.logHeader}>
              <Text style={styles.logTitle}>📋 Process Logs</Text>
              <TouchableOpacity onPress={clearLogs} style={styles.clearButton}>
                <Text style={styles.clearButtonText}>🧹 Clear</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.logScrollView} nestedScrollEnabled>
              {logs.map((log, index) => (
                <Text key={index} style={styles.logText}>
                  {log}
                </Text>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.infoContainer}>
          <Text style={styles.infoTitle}>ℹ️ How ESP OTA Works</Text>
          <Text style={styles.infoText}>
            • Implements espota.py protocol for ESP32/ESP8266
          </Text>
          <Text style={styles.infoText}>
            • Uses UDP for invitation, TCP for file transfer
          </Text>
          <Text style={styles.infoText}>
            • Compatible with ArduinoOTA library
          </Text>
          <Text style={styles.infoText}>
            • Supports password authentication
          </Text>
          <Text style={styles.infoText}>
            • Platform: {Platform.OS} {Platform.Version}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: '#666',
    fontStyle: 'italic',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  infoButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoButtonText: {
    color: 'white',
    fontSize: 16,
  },
  inputContainer: {
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: '#333',
    fontWeight: '600',
  },
  input: {
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    color: '#333',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  testButton: {
    backgroundColor: '#FF9500',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  uploadButton: {
    backgroundColor: '#34C759',
    marginTop: 10,
  },
  disabledButton: {
    backgroundColor: '#ccc',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  fileInfo: {
    backgroundColor: '#f0f8ff',
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  fileInfoText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 5,
  },
  fileInfoTextSmall: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  tapToViewText: {
    fontSize: 12,
    color: '#007AFF',
    fontStyle: 'italic',
    marginTop: 5,
  },
  progressContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  progressText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  progressSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  progressBar: {
    height: 20,
    backgroundColor: '#e0e0e0',
    borderRadius: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#34C759',
    borderRadius: 10,
  },
  logContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
    maxHeight: 300,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  logTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  clearButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  clearButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  logScrollView: {
    maxHeight: 200,
  },
  logText: {
    color: '#00ff00',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 3,
  },
  infoContainer: {
    backgroundColor: '#E3F2FD',
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#1976D2',
    lineHeight: 20,
    marginBottom: 5,
  },
});

export default App;
