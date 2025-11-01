import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface WhisperConfig {
    mode: 'local' | 'api';
    model: string;
    language: string;
    apiKey?: string;
}

export class WhisperService {
    private config: WhisperConfig;
    private whisperPath: string | null = null;

    constructor(config: WhisperConfig) {
        this.config = config;
    }

    async initialize(): Promise<boolean> {
        if (this.config.mode === 'api') {
            if (!this.config.apiKey || this.config.apiKey.trim() === '') {
                throw new Error('Whisper API key is required for API mode');
            }
            return true;
        }

        // For local mode, try to find whisper.cpp or faster-whisper
        this.whisperPath = await this.findWhisperExecutable();

        if (!this.whisperPath) {
            throw new Error('Whisper not found. Please install whisper.cpp or faster-whisper, or use API mode.');
        }

        return true;
    }

    async transcribe(audioFilePath: string): Promise<string> {
        if (!fs.existsSync(audioFilePath)) {
            throw new Error(`Audio file not found: ${audioFilePath}`);
        }

        if (this.config.mode === 'api') {
            return await this.transcribeWithAPI(audioFilePath);
        } else {
            return await this.transcribeLocally(audioFilePath);
        }
    }

    private async transcribeWithAPI(audioFilePath: string): Promise<string> {
        // For now, we'll implement a placeholder
        // In a real implementation, we'd use the OpenAI API
        throw new Error('API mode not yet implemented. Please use local mode or contribute API implementation!');
    }

    private async transcribeLocally(audioFilePath: string): Promise<string> {
        const whisperExec = this.whisperPath;
        if (!whisperExec) {
            throw new Error('Whisper executable not found');
        }

        return new Promise((resolve, reject) => {
            const args = [
                '-m', this.getModelPath(),
                '-f', audioFilePath,
                '-l', this.config.language,
                '--output-txt',
                '--no-timestamps'
            ];

            console.log(`[WhisperService] Running: ${whisperExec} ${args.join(' ')}`);

            const childProcess = cp.spawn(whisperExec, args, {
                cwd: path.dirname(audioFilePath)
            }) as cp.ChildProcess;

            let stdout = '';
            let stderr = '';

            if (childProcess.stdout) {
                childProcess.stdout.on('data', (data: Buffer) => {
                    stdout += data.toString();
                });
            }

            if (childProcess.stderr) {
                childProcess.stderr.on('data', (data: Buffer) => {
                    stderr += data.toString();
                });
            }

            childProcess.on('close', (code: number | null) => {
                if (code !== 0) {
                    console.error(`[WhisperService] Error: ${stderr}`);
                    reject(new Error(`Whisper transcription failed with code ${code}`));
                    return;
                }

                // whisper.cpp writes output to a .txt file
                const txtFile = audioFilePath.replace('.wav', '.wav.txt');

                if (fs.existsSync(txtFile)) {
                    try {
                        const transcription = fs.readFileSync(txtFile, 'utf-8').trim();

                        // Clean up the txt file
                        fs.unlinkSync(txtFile);

                        if (transcription.length === 0) {
                            reject(new Error('Transcription is empty. No speech detected.'));
                        } else {
                            console.log(`[WhisperService] Transcription: "${transcription}"`);
                            resolve(transcription);
                        }
                    } catch (error) {
                        reject(new Error(`Failed to read transcription: ${error}`));
                    }
                } else {
                    // Try to extract from stdout if txt file wasn't created
                    const transcription = this.extractTranscriptionFromOutput(stdout);
                    if (transcription) {
                        resolve(transcription);
                    } else {
                        reject(new Error('No transcription output found'));
                    }
                }
            });

            childProcess.on('error', (error: Error) => {
                reject(new Error(`Failed to start Whisper: ${error.message}`));
            });
        });
    }

    private extractTranscriptionFromOutput(output: string): string | null {
        // Try to extract text from whisper output
        const lines = output.split('\n');
        for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (line.length > 0 && !line.startsWith('[') && !line.includes('whisper')) {
                return line;
            }
        }
        return null;
    }

    private async findWhisperExecutable(): Promise<string | null> {
        const isWindows = os.platform() === 'win32';

        // Try common locations for whisper.cpp
        const possiblePaths = isWindows ? [
            // Windows paths
            path.join(os.homedir(), 'whisper.cpp', 'main.exe'),
            path.join(os.homedir(), 'whisper.cpp', 'build', 'bin', 'Release', 'main.exe'),
            path.join(os.homedir(), 'whisper.cpp', 'build', 'Release', 'main.exe'),
            'C:\\whisper.cpp\\main.exe',
            'C:\\whisper.cpp\\build\\bin\\Release\\main.exe',
            path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'whisper.cpp', 'main.exe')
        ] : [
            // Linux/macOS paths
            path.join(os.homedir(), 'whisper.cpp', 'main'),
            path.join(os.homedir(), '.local', 'bin', 'whisper'),
            '/usr/local/bin/whisper',
            '/usr/bin/whisper'
        ];

        // Also check in PATH
        try {
            const whichCommand = isWindows ? 'where' : 'which';
            const result = cp.execSync(`${whichCommand} ${isWindows ? 'main.exe' : 'whisper'}`, { encoding: 'utf-8' }).trim();
            if (result) {
                const firstPath = result.split('\n')[0]; // 'where' can return multiple paths
                possiblePaths.unshift(firstPath);
            }
        } catch (e) {
            // Command failed, continue with other paths
        }

        // Try whisper.cpp 'main' executable in PATH
        if (!isWindows) {
            try {
                const result = cp.execSync('which main', { encoding: 'utf-8' }).trim();
                if (result && result.includes('whisper')) {
                    possiblePaths.unshift(result);
                }
            } catch (e) {
                // Ignore
            }
        }

        for (const whisperPath of possiblePaths) {
            if (fs.existsSync(whisperPath)) {
                console.log(`[WhisperService] Found Whisper at: ${whisperPath}`);
                return whisperPath;
            }
        }

        return null;
    }

    private getModelPath(): string {
        const isWindows = os.platform() === 'win32';

        // Try to find the model file
        const modelName = `ggml-${this.config.model}.bin`;
        const possiblePaths = isWindows ? [
            // Windows paths
            path.join(os.homedir(), 'whisper.cpp', 'models', modelName),
            path.join('C:', 'whisper.cpp', 'models', modelName),
            path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'whisper.cpp', 'models', modelName)
        ] : [
            // Linux/macOS paths
            path.join(os.homedir(), 'whisper.cpp', 'models', modelName),
            path.join(os.homedir(), '.local', 'share', 'whisper', modelName),
            `/usr/local/share/whisper/models/${modelName}`
        ];

        for (const modelPath of possiblePaths) {
            if (fs.existsSync(modelPath)) {
                console.log(`[WhisperService] Found model at: ${modelPath}`);
                return modelPath;
            }
        }

        // If not found, return the expected path and let whisper.cpp handle the error
        const defaultPath = path.join(os.homedir(), 'whisper.cpp', 'models', modelName);
        console.warn(`[WhisperService] Model not found, using default path: ${defaultPath}`);
        return defaultPath;
    }

    async checkInstallation(): Promise<{ installed: boolean; message: string }> {
        if (this.config.mode === 'api') {
            if (!this.config.apiKey || this.config.apiKey.trim() === '') {
                return {
                    installed: false,
                    message: 'API key not configured. Please set voiceInTerminal.whisperApiKey in settings.'
                };
            }
            return { installed: true, message: 'API mode configured' };
        }

        const whisperPath = await this.findWhisperExecutable();
        if (!whisperPath) {
            return {
                installed: false,
                message: `Whisper not found. Install whisper.cpp:\n\ngit clone https://github.com/ggerganov/whisper.cpp\ncd whisper.cpp\nmake\n./models/download-ggml-model.sh ${this.config.model}`
            };
        }

        const modelPath = this.getModelPath();
        if (!fs.existsSync(modelPath)) {
            return {
                installed: false,
                message: `Whisper model '${this.config.model}' not found at ${modelPath}.\n\nDownload it with:\ncd ~/whisper.cpp && ./models/download-ggml-model.sh ${this.config.model}`
            };
        }

        return { installed: true, message: `Whisper installed at ${whisperPath}` };
    }
}
