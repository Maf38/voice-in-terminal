import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as cp from 'child_process';

export class AudioRecorder {
    private recordProcess: any = null;
    private soxProcess: cp.ChildProcess | null = null;
    private audioFilePath: string = '';
    private isRecording: boolean = false;
    private startTime: number = 0;
    private maxRecordingTime: number = 300; // seconds
    private isUsingWindows: boolean = false;
    private audioDeviceName: string = '';

    constructor(maxRecordingTime?: number, audioDeviceName?: string) {
        if (maxRecordingTime) {
            this.maxRecordingTime = maxRecordingTime;
        }
        if (audioDeviceName) {
            this.audioDeviceName = audioDeviceName;
        }
    }

    async startRecording(): Promise<void> {
        if (this.isRecording) {
            throw new Error('Recording already in progress');
        }

        // Create temporary file for audio
        const tempDir = os.tmpdir();
        const timestamp = Date.now();
        this.audioFilePath = path.join(tempDir, `voice-in-terminal-${timestamp}.wav`);

        const isWindows = os.platform() === 'win32';

        try {
            if (isWindows) {
                this.isUsingWindows = true;

                // On Windows, use SoX directly with waveaudio driver
                const deviceSpec = this.audioDeviceName || '-d';  // Use device name or default
                const soxArgs = [
                    '-t', 'waveaudio',  // Use Windows waveaudio driver
                    deviceSpec,         // Device name or -d for default
                    this.audioFilePath,
                    'rate', '16000',    // Sample rate
                    'channels', '1'     // Mono
                ];

                console.log(`[AudioRecorder] Starting SoX recording: sox ${soxArgs.join(' ')}`);

                this.soxProcess = cp.spawn('sox', soxArgs, {
                    stdio: ['ignore', 'pipe', 'pipe']
                });

                if (this.soxProcess.stderr) {
                    this.soxProcess.stderr.on('data', (data: Buffer) => {
                        console.log(`[AudioRecorder SoX] ${data.toString()}`);
                    });
                }

                this.soxProcess.on('error', (error: Error) => {
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
                if (this.isUsingWindows && this.soxProcess) {
                    // Kill SoX process on Windows
                    this.soxProcess.kill('SIGTERM');
                    this.soxProcess = null;
                } else if (this.recordProcess) {
                    // Stop node-record-lpcm16 on Linux/macOS
                    this.recordProcess.stop();
                    this.recordProcess = null;
                }

                this.isRecording = false;
                const duration = (Date.now() - this.startTime) / 1000;

                console.log(`[AudioRecorder] Recording stopped. Duration: ${duration.toFixed(2)}s`);

                // Wait a bit for the file to be fully written
                setTimeout(() => {
                    if (fs.existsSync(this.audioFilePath)) {
                        const stats = fs.statSync(this.audioFilePath);
                        if (stats.size === 0) {
                            this.cleanup();
                            reject(new Error('Recording file is empty. No audio detected.'));
                        } else {
                            console.log(`[AudioRecorder] Audio file saved: ${this.audioFilePath} (${stats.size} bytes)`);
                            resolve(this.audioFilePath);
                        }
                    } else {
                        reject(new Error('Recording file not found'));
                    }
                }, 500);
            } catch (error) {
                this.cleanup();
                reject(error);
            }
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
                this.soxProcess.kill('SIGTERM');
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
