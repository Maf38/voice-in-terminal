import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as cp from 'child_process';

// Import ctrlc-windows only on Windows (conditional import)
let ctrlc: ((pid: number) => void) | null = null;
if (os.platform() === 'win32') {
    try {
        const ctrlcModule = require('ctrlc-windows');
        // The module exports an object with a ctrlc method: { ctrlc: function(pid) {...} }
        ctrlc = ctrlcModule.ctrlc;
        console.log('[AudioRecorder] ctrlc-windows loaded successfully, type:', typeof ctrlc);
    } catch (err) {
        console.warn('[AudioRecorder] ctrlc-windows not available, falling back to taskkill:', err);
    }
}

export class AudioRecorder {
    private recordProcess: any = null;
    private soxProcess: cp.ChildProcess | null = null;
    private audioFilePath: string = '';
    private isRecording: boolean = false;
    private startTime: number = 0;
    private maxRecordingTime: number = 300; // seconds
    private isUsingWindows: boolean = false;
    private audioDeviceName: string = '';

    // Helper method for timestamps
    private timestamp(): string {
        const now = new Date();
        const ms = now.getMilliseconds().toString().padStart(3, '0');
        return `${now.toLocaleTimeString()}.${ms}`;
    }

    constructor(maxRecordingTime?: number, audioDeviceName?: string) {
        if (maxRecordingTime) {
            this.maxRecordingTime = maxRecordingTime;
        }
        if (audioDeviceName) {
            this.audioDeviceName = audioDeviceName;
        }
    }

    /**
     * Enumerate all available audio input devices (Windows only)
     * @returns Promise<Array<{index: number, name: string}>> List of available devices
     */
    static async enumerateAudioDevices(): Promise<Array<{ index: number; name: string }>> {
        return new Promise((resolve, reject) => {
            const soxProcess = cp.spawn('sox', ['-V6', '-t', 'waveaudio', 'non-existent-device', '-n'], {
                shell: true,
                stdio: ['ignore', 'pipe', 'pipe']
            });

            let stderr = '';

            soxProcess.stderr?.on('data', (data: Buffer) => {
                stderr += data.toString();
            });

            soxProcess.on('close', () => {
                // Parse the enumeration lines
                const lines = stderr.split('\n');
                const inputDevices: Array<{ index: number; name: string }> = [];

                for (const line of lines) {
                    // Match: "Enumerating input device  1: "Microphone (K66)""
                    const match = line.match(/Enumerating input device\s+(-?\d+):\s+"([^"]+)"/);
                    if (match) {
                        const index = parseInt(match[1], 10);
                        const name = match[2];
                        inputDevices.push({ index, name });
                    }
                }

                resolve(inputDevices);
            });

            soxProcess.on('error', (error: Error) => {
                reject(error);
            });
        });
    }

    /**
     * Get the device index for a given device name (Windows only)
     * @param deviceName - The name of the device to find (can be partial, case-insensitive)
     * @returns Promise<number|null> The device index, or null if not found
     */
    private async getAudioDeviceIndex(deviceName: string): Promise<number | null> {
        return new Promise((resolve, reject) => {
            const soxProcess = cp.spawn('sox', ['-V6', '-t', 'waveaudio', 'non-existent-device', '-n'], {
                shell: true,
                stdio: ['ignore', 'pipe', 'pipe']
            });

            let stderr = '';

            soxProcess.stderr?.on('data', (data: Buffer) => {
                stderr += data.toString();
            });

            soxProcess.on('close', () => {
                // Parse the enumeration lines
                const lines = stderr.split('\n');
                const inputDevices: Array<{ index: number; name: string }> = [];

                for (const line of lines) {
                    // Match: "Enumerating input device  1: "Microphone (K66)""
                    const match = line.match(/Enumerating input device\s+(-?\d+):\s+"([^"]+)"/);
                    if (match) {
                        const index = parseInt(match[1], 10);
                        const name = match[2];
                        inputDevices.push({ index, name });
                    }
                }

                // Find device by name (case-insensitive partial match)
                const searchName = deviceName.toLowerCase();
                const found = inputDevices.find(device =>
                    device.name.toLowerCase().includes(searchName)
                );

                if (found) {
                    console.log(`[AudioRecorder] Found device: "${found.name}" at index ${found.index}`);
                    resolve(found.index);
                } else {
                    console.log(`[AudioRecorder] Device not found: "${deviceName}"`);
                    console.log('[AudioRecorder] Available input devices:');
                    inputDevices.forEach(device => {
                        console.log(`   [${device.index}] "${device.name}"`);
                    });
                    resolve(null);
                }
            });

            soxProcess.on('error', (error: Error) => {
                reject(error);
            });
        });
    }

    async startRecording(): Promise<void> {
        if (this.isRecording) {
            throw new Error('Recording already in progress');
        }

        // Create temporary file for audio (using WAV format for instant write)
        const tempDir = os.tmpdir();
        const timestamp = Date.now();
        this.audioFilePath = path.join(tempDir, `voice-in-terminal-${timestamp}.wav`);

        const isWindows = os.platform() === 'win32';

        try {
            if (isWindows) {
                this.isUsingWindows = true;

                // On Windows, use SoX directly with waveaudio driver
                // Resolve device name to index (more reliable than using names with special chars)
                const targetDeviceName = this.audioDeviceName || 'K66'; // Default to K66 microphone
                const deviceIndex = await this.getAudioDeviceIndex(targetDeviceName);

                let deviceSpec: string;
                if (deviceIndex !== null) {
                    deviceSpec = String(deviceIndex); // Use index for reliability
                } else {
                    console.log(`[AudioRecorder] Could not find device "${targetDeviceName}", falling back to system default`);
                    deviceSpec = '-d'; // System default
                }

                const soxArgs = [
                    '-t', 'waveaudio',  // Input: Windows waveaudio driver
                    deviceSpec,         // Microphone device index or '-d' for default
                    '-t', 'wav',        // Output: WAV format (instant write)
                    this.audioFilePath,
                    'rate', '16000',    // Sample rate
                    'channels', '1',    // Mono
                    'trim', '0', String(this.maxRecordingTime)  // Auto-stop after maxRecordingTime seconds
                ];

                console.log(`[AudioRecorder] Starting SoX recording with device ${deviceSpec}: sox ${soxArgs.join(' ')}`);

                this.soxProcess = cp.spawn('sox', soxArgs, {
                    stdio: ['ignore', 'pipe', 'pipe'],
                    shell: true  // shell:true creates cmd.exe wrapper, will use taskkill /T to kill entire process tree
                });

                // DIAGNOSTIC: Log process PID
                console.log(`[AudioRecorder] SoX process started with PID: ${this.soxProcess.pid}`);

                if (this.soxProcess.stderr) {
                    this.soxProcess.stderr.on('data', (data: Buffer) => {
                        // Silently consume stderr to avoid polluting logs
                        // (SoX outputs progress info to stderr)
                    });
                }

                // DIAGNOSTIC: Log ALL process events
                this.soxProcess.on('spawn', () => {
                    const ts = this.timestamp();
                    console.log(`[${ts}] [AudioRecorder] ✅ EVENT: spawn (PID: ${this.soxProcess?.pid})`);
                });

                this.soxProcess.on('exit', (code: number | null, signal: string | null) => {
                    const ts = this.timestamp();
                    console.log(`[${ts}] [AudioRecorder] ✅ EVENT: exit (code: ${code}, signal: ${signal}, PID: ${this.soxProcess?.pid})`);
                });

                this.soxProcess.on('close', (code: number | null, signal: string | null) => {
                    const ts = this.timestamp();
                    console.log(`[${ts}] [AudioRecorder] ✅ EVENT: close (code: ${code}, signal: ${signal}, PID: ${this.soxProcess?.pid}) - THIS EVENT SHOULD FIRE!`);
                });

                this.soxProcess.on('disconnect', () => {
                    const ts = this.timestamp();
                    console.log(`[${ts}] [AudioRecorder] ✅ EVENT: disconnect (PID: ${this.soxProcess?.pid})`);
                });

                this.soxProcess.on('error', (error: Error) => {
                    const ts = this.timestamp();
                    console.log(`[${ts}] [AudioRecorder] ❌ EVENT: error (${error.message}, PID: ${this.soxProcess?.pid})`);
                    throw new Error(`Failed to start SoX: ${error.message}. Make sure SoX is installed and in PATH.`);
                });

            } else {
                this.isUsingWindows = false;

                // On Linux/macOS, use node-record-lpcm16
                const record = require('node-record-lpcm16');

                const fileStream = fs.createWriteStream(this.audioFilePath, { encoding: 'binary' });

                this.recordProcess = record.record({
                    sampleRate: 16000,
                    channels: 1,
                    audioType: 'wav',
                    threshold: 0,
                    silence: '10.0'
                });

                this.recordProcess.stream()
                    .pipe(fileStream);
            }

            this.isRecording = true;
            this.startTime = Date.now();

            console.log(`[AudioRecorder] Recording started: ${this.audioFilePath}`);
        } catch (error) {
            this.cleanup();
            throw new Error(`Failed to start recording: ${error}`);
        }
    }

    async stopRecording(): Promise<string> {
        if (!this.isRecording) {
            throw new Error('No recording in progress');
        }

        return new Promise((resolve, reject) => {
            try {
                if (this.soxProcess) {
                    console.log(`[${this.timestamp()}] [AudioRecorder] ========== STOP RECORDING DIAGNOSTIC ==========`);
                    console.log(`[${this.timestamp()}] [AudioRecorder] Process state: PID=${this.soxProcess.pid}, killed=${this.soxProcess.killed}, exitCode=${this.soxProcess.exitCode}`);
                    console.log(`[${this.timestamp()}] [AudioRecorder] Platform: ${os.platform()}`);

                    // IMPORTANT: Use 'exit' instead of 'close' because 'close' doesn't fire in VS Code extension host
                    // (but works fine in standalone Node.js)
                    this.soxProcess.once('exit', (code) => {
                        const ts = this.timestamp();
                        console.log(`[${ts}] [AudioRecorder] 🎯 HANDLER: exit event fired! (code: ${code})`);
                        console.log(`[${ts}] [AudioRecorder] This handler was registered via once('exit')`);
                        const process = this.soxProcess;
                        this.soxProcess = null;  // CRITICAL: Nullify immediately to prevent fallback timeout from firing

                        console.log(`[${ts}] [AudioRecorder] Waiting 500ms for WAV file handle release...`);
                        // WAV files are written instantly, just need short delay for file handle release
                        setTimeout(() => {
                            const ts2 = this.timestamp();
                            console.log(`[${ts2}] [AudioRecorder] 500ms delay completed, calling finalizeRecording()`);
                            this.finalizeRecording(resolve, reject);
                        }, 500);  // 500ms delay for file handle release
                    });

                    const pid = this.soxProcess.pid;

                    if (this.isUsingWindows) {
                        // Windows: Use ctrlc-windows to send proper Ctrl+C signal
                        if (ctrlc && pid) {
                            console.log(`[${this.timestamp()}] [AudioRecorder] Sending Ctrl+C via ctrlc-windows to PID ${pid}...`);
                            try {
                                ctrlc(pid);  // Call the function directly with PID
                                console.log(`[${this.timestamp()}] [AudioRecorder] Ctrl+C sent successfully`);
                            } catch (err) {
                                console.error(`[${this.timestamp()}] [AudioRecorder] ctrlc-windows failed: ${err}`);
                                console.log(`[${this.timestamp()}] [AudioRecorder] Falling back to taskkill /F...`);
                                cp.exec(`taskkill /T /F /PID ${pid}`);
                            }
                        } else {
                            // Fallback to taskkill if ctrlc-windows not available
                            console.log(`[${this.timestamp()}] [AudioRecorder] ctrlc-windows not available, using taskkill /F...`);
                            cp.exec(`taskkill /T /F /PID ${pid}`);
                        }
                    } else {
                        // Linux/macOS: Use native SIGINT (Ctrl+C equivalent)
                        console.log(`[${this.timestamp()}] [AudioRecorder] Sending SIGINT (native Ctrl+C) to PID ${pid}...`);
                        const killResult = this.soxProcess.kill('SIGINT');
                        console.log(`[${this.timestamp()}] [AudioRecorder] SIGINT sent: ${killResult}`);
                    }

                    // Fallback timeout in case exit event doesn't fire (must be longer than the 5s delay above)
                    console.log('[AudioRecorder] Setting 10000ms fallback timeout...');
                    setTimeout(() => {
                        if (this.soxProcess) {
                            console.log('[AudioRecorder] ⚠️ FALLBACK TIMEOUT: exit event never fired after 10000ms!');
                            console.log(`[AudioRecorder] Process state: PID=${this.soxProcess.pid}, killed=${this.soxProcess.killed}, exitCode=${this.soxProcess.exitCode}`);
                            console.log('[AudioRecorder] Forcing SIGKILL...');
                            this.soxProcess.kill('SIGKILL');
                            this.soxProcess = null;
                            console.log('[AudioRecorder] Calling finalizeRecording() WITHOUT delay (this is the problem!)');
                            this.finalizeRecording(resolve, reject);
                        } else {
                            console.log('[AudioRecorder] ✅ FALLBACK TIMEOUT: Process already cleaned up by exit handler');
                        }
                    }, 10000);

                } else if (this.recordProcess) {
                    // Stop node-record-lpcm16 on Linux/macOS
                    this.recordProcess.stop();
                    this.recordProcess = null;
                    this.finalizeRecording(resolve, reject);
                }

            } catch (error) {
                this.cleanup();
                reject(error);
            }
        });
    }

    private finalizeRecording(resolve: (value: string) => void, reject: (reason?: any) => void): void {
        this.isRecording = false;
        const duration = (Date.now() - this.startTime) / 1000;

        console.log(`[${this.timestamp()}] [AudioRecorder] ========== FINALIZE RECORDING ==========`);
        console.log(`[${this.timestamp()}] [AudioRecorder] Recording stopped. Duration: ${duration.toFixed(2)}s`);
        console.log(`[${this.timestamp()}] [AudioRecorder] Audio file path: "${this.audioFilePath}"`);

        // Poll actively to check if file is ready (faster than blind wait)
        this.waitForFileReady(this.audioFilePath, 5000)
            .then(() => {
                const stats = fs.statSync(this.audioFilePath);
                if (stats.size === 0) {
                    this.cleanup();
                    reject(new Error('Recording file is empty. No audio detected.'));
                } else {
                    console.log(`[AudioRecorder] Audio file saved: ${this.audioFilePath} (${stats.size} bytes)`);
                    resolve(this.audioFilePath);
                }
            })
            .catch((error) => {
                this.cleanup();
                reject(error);
            });
    }

    private async waitForFileReady(filePath: string, timeout: number): Promise<void> {
        const startTime = Date.now();
        const pollInterval = 50; // Check every 50ms

        console.log(`[${this.timestamp()}] [AudioRecorder] waitForFileReady() START: checking "${filePath}" (timeout: ${timeout}ms)`);

        return new Promise((resolve, reject) => {
            const checkFile = () => {
                const elapsed = Date.now() - startTime;
                const ts = this.timestamp();

                // Check if we've exceeded timeout
                if (elapsed > timeout) {
                    console.log(`[${ts}] [AudioRecorder] ❌ waitForFileReady() TIMEOUT after ${elapsed}ms`);
                    reject(new Error(`Timeout waiting for file to be ready: ${filePath}`));
                    return;
                }

                // Check if file exists
                if (!fs.existsSync(filePath)) {
                    console.log(`[${ts}] [AudioRecorder] ⏳ File does not exist yet (${elapsed}ms elapsed)`);
                    setTimeout(checkFile, pollInterval);
                    return;
                }

                console.log(`[${ts}] [AudioRecorder] ✅ File exists! Checking if readable (${elapsed}ms elapsed)`);

                // Check if file is readable and not locked
                try {
                    // Try to open with 'r+' to check if we can get write access (file not locked)
                    const fd = fs.openSync(filePath, 'r+');
                    const stats = fs.fstatSync(fd);

                    console.log(`[${ts}] [AudioRecorder] File size: ${stats.size} bytes`);

                    // Read first 4 bytes to check audio file header (OggS or RIFF magic number)
                    const buffer = Buffer.alloc(4);
                    fs.readSync(fd, buffer, 0, 4, 0);
                    fs.closeSync(fd);

                    // File must have content and valid audio header (OGG or WAV)
                    const headerStr = buffer.toString('utf-8');
                    const isValidOgg = headerStr === 'OggS';
                    const isValidWav = headerStr === 'RIFF';
                    const isValid = isValidOgg || isValidWav;
                    const header = buffer.toString('hex');

                    console.log(`[${ts}] [AudioRecorder] Audio header: "${header}" (OGG: ${isValidOgg}, WAV: ${isValidWav})`);

                    if (stats.size > 0 && isValid) {
                        console.log(`[${ts}] [AudioRecorder] ✅ File ready after ${elapsed}ms (size: ${stats.size}, valid: ${isValid})`);
                        resolve();
                    } else {
                        console.log(`[${ts}] [AudioRecorder] ⏳ File exists but incomplete (size=${stats.size}, valid=${isValid}), waiting...`);
                        // File exists but incomplete, wait a bit more
                        setTimeout(checkFile, pollInterval);
                    }
                } catch (err) {
                    console.log(`[${ts}] [AudioRecorder] ⏳ File locked or not readable yet: ${err}`);
                    // File is locked or not readable yet, try again
                    setTimeout(checkFile, pollInterval);
                }
            };

            // Start checking
            checkFile();
        });
    }

    isCurrentlyRecording(): boolean {
        return this.isRecording;
    }

    getRecordingDuration(): number {
        if (!this.isRecording) {
            return 0;
        }
        return (Date.now() - this.startTime) / 1000;
    }

    cleanup(): void {
        if (this.isUsingWindows && this.soxProcess) {
            try {
                this.soxProcess.kill('SIGKILL');  // Force kill during cleanup
            } catch (e) {
                // Ignore errors during cleanup
            }
            this.soxProcess = null;
        } else if (this.recordProcess) {
            try {
                this.recordProcess.stop();
            } catch (e) {
                // Ignore errors during cleanup
            }
            this.recordProcess = null;
        }

        if (this.audioFilePath && fs.existsSync(this.audioFilePath)) {
            try {
                fs.unlinkSync(this.audioFilePath);
                console.log(`[AudioRecorder] Cleaned up audio file: ${this.audioFilePath}`);
            } catch (e) {
                console.error(`[AudioRecorder] Failed to delete audio file: ${e}`);
            }
        }

        this.isRecording = false;
        this.audioFilePath = '';
    }
}
