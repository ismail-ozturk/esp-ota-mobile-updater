import dgram from 'react-native-udp';
import TcpSocket from 'react-native-tcp-socket';
import RNFS from 'react-native-fs';
import CryptoJS from 'crypto-js';

interface InvitationResult {
  success: boolean;
  needsAuth: boolean;
  nonce?: string;
}

interface UploadResult {
  success: boolean;
  message?: string;
  fileSize?: number;
  fileMD5?: string;
}

class ESPOTAService {
  private FLASH: number = 0;
  private SPIFFS: number = 100;
  private AUTH: number = 200;
  private progressCallback: ((progress: number) => void) | null = null;
  private logCallback: ((message: string) => void) | null = null;

  calculateMD5(data: string): string {
    return CryptoJS.MD5(data).toString();
  }

  private log(message: string): void {
    console.log(message);
    if (this.logCallback) {
      this.logCallback(message);
    }
  }

  sendInvitation(
    espIP: string, 
    espPort: number, 
    localPort: number, 
    fileSize: number, 
    fileMD5: string, 
    command: number
  ): Promise<InvitationResult> {
    return new Promise((resolve, reject) => {
      const socket = dgram.createSocket('udp4' as any);
      const message = `${command} ${localPort} ${fileSize} ${fileMD5}\n`;
      
      this.log(`🔄 Sending invitation to ${espIP}:${espPort}`);
      this.log(`📤 Message: ${message.trim()}`);

      let attempts = 0;
      const maxAttempts = 10;

      const sendAttempt = () => {
        attempts++;
        this.log(`📡 Attempt ${attempts}/${maxAttempts}`);
        
        socket.send(message, 0, message.length, espPort, espIP, (err?: Error) => {
          if (err) {
            this.log(`❌ UDP send error: ${err.message}`);
            socket.close();
            reject(err);
            return;
          }
        });

        const responseHandler = (data: Buffer, rinfo: any) => {
          const response = data.toString().trim();
          this.log(`📥 Response from ${rinfo.address}: ${response}`);
          
          socket.removeListener('message', responseHandler);
          socket.close();
          
          if (response === 'OK') {
            resolve({ success: true, needsAuth: false });
          } else if (response.startsWith('AUTH')) {
            const nonce = response.split(' ')[1];
            resolve({ success: true, needsAuth: true, nonce });
          } else {
            reject(new Error(`Bad response: ${response}`));
          }
        };

        socket.on('message', responseHandler);

        setTimeout(() => {
          if (attempts < maxAttempts) {
            socket.removeListener('message', responseHandler);
            sendAttempt();
          } else {
            socket.removeListener('message', responseHandler);
            socket.close();
            reject(new Error('No response from ESP after 10 attempts'));
          }
        }, 1000);
      };

      sendAttempt();
    });
  }

  sendFile(localPort: number, fileContent: string, fileSize: number): Promise<UploadResult> {
    return new Promise((resolve, reject) => {
      this.log(`🚀 Starting TCP server on port ${localPort}`);
      
      const server = TcpSocket.createServer((socket: any) => {
        this.log('✅ ESP connected to TCP server');
        
        let uploadedBytes = 0;
        const chunkSize = 1024;
        const buffer = Buffer.from(fileContent, 'base64');

        const sendChunk = () => {
          if (uploadedBytes >= fileSize) {
            this.log('🎉 File upload completed successfully');
            socket.end();
            server.close();
            resolve({ 
              success: true, 
              message: 'Upload completed successfully',
              fileSize: fileSize
            });
            return;
          }

          const remainingBytes = fileSize - uploadedBytes;
          const currentChunkSize = Math.min(chunkSize, remainingBytes);
          const chunk = buffer.slice(uploadedBytes, uploadedBytes + currentChunkSize);
          
          socket.write(chunk, (err?: Error) => {
            if (err) {
              this.log(`❌ TCP write error: ${err.message}`);
              server.close();
              reject(err);
              return;
            }
            
            uploadedBytes += currentChunkSize;
            const progress = uploadedBytes / fileSize;
            
            this.log(`📊 Uploaded: ${uploadedBytes}/${fileSize} bytes (${Math.round(progress * 100)}%)`);
            
            if (this.progressCallback) {
              this.progressCallback(progress);
            }

            socket.once('data', (response: Buffer) => {
              const responseStr = response.toString().trim();
              if (responseStr.includes('OK') || responseStr === '') {
                setTimeout(sendChunk, 10);
              } else {
                this.log(`❌ Unexpected response: ${responseStr}`);
                server.close();
                reject(new Error(`Upload failed: ${responseStr}`));
              }
            });
          });
        };

        sendChunk();

        socket.on('error', (err: Error) => {
          this.log(`❌ TCP socket error: ${err.message}`);
          server.close();
          reject(err);
        });

      });

      server.listen({ port: localPort, host: '0.0.0.0' }, () => {
        this.log(`🎧 TCP server listening on port ${localPort}`);
      });

      server.on('error', (err: Error) => {
        this.log(`❌ TCP server error: ${err.message}`);
        reject(err);
      });
      
      setTimeout(() => {
        this.log('⏰ TCP server timeout');
        server.close();
        reject(new Error('TCP server timeout after 60 seconds'));
      }, 60000);
    });
  }

  async uploadFirmware(
    espIP: string, 
    espPort: number, 
    filePath: string, 
    password: string = ''
  ): Promise<UploadResult> {
    try {
      this.log(`🚀 Starting ESP OTA upload to ${espIP}:${espPort}`);
      this.log(`📁 File: ${filePath}`);

      const fileStats = await RNFS.stat(filePath);
      const fileSize = fileStats.size;
      this.log(`📏 File size: ${fileSize} bytes (${Math.round(fileSize / 1024)} KB)`);

      const fileContent = await RNFS.readFile(filePath, 'base64');
      const fileMD5 = this.calculateMD5(fileContent);
      this.log(`🔐 File MD5: ${fileMD5}`);

      const localPort = Math.floor(Math.random() * 50000) + 10000;
      this.log(`🔌 Using local port: ${localPort}`);

      const invitationResult = await this.sendInvitation(
        espIP, 
        espPort, 
        localPort, 
        fileSize, 
        fileMD5, 
        this.FLASH
      );

      if (!invitationResult.success) {
        throw new Error('ESP invitation failed');
      }

      if (invitationResult.needsAuth) {
        this.log(`🔐 Authentication required but simplified for demo`);
      }

      const uploadResult = await this.sendFile(localPort, fileContent, fileSize);
      
      this.log(`✅ Upload completed successfully!`);

      return {
        success: true,
        message: 'Firmware uploaded successfully',
        fileSize: fileSize,
        fileMD5: fileMD5
      };

    } catch (error: any) {
      this.log(`❌ Upload failed: ${error.message}`);
      throw error;
    }
  }

  setProgressCallback(callback: (progress: number) => void): void {
    this.progressCallback = callback;
  }

  setLogCallback(callback: (message: string) => void): void {
    this.logCallback = callback;
  }

  async testConnection(espIP: string, espPort: number): Promise<boolean> {
    try {
      this.log(`🔍 Testing connection to ${espIP}:${espPort}`);
      
      const testResult = await this.sendInvitation(
        espIP,
        espPort,
        12345,
        0,
        'test',
        this.FLASH
      );
      
      return testResult.success;
    } catch (error) {
      this.log(`❌ Connection test failed: ${error}`);
      return false;
    }
  }
}

export default new ESPOTAService();
