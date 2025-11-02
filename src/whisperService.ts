import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Helper function for timestamps
function timestamp(): string {
    const now = new Date();
    const ms = now.getMilliseconds().toString().padStart(3, '0');
    return `${now.toLocaleTimeString()}.${ms}`;
}

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
        if (!this.config.apiKey) {
            throw new Error('OpenAI API key is required for API mode');
        }

        try {
            // Dynamic import of OpenAI SDK
            const { default: OpenAI } = await import('openai');

            const openai = new OpenAI({
                apiKey: this.config.apiKey
            });

            console.log('[WhisperService] Transcribing with OpenAI API...');
            console.log('[WhisperService] Audio file:', audioFilePath);
            console.log('[WhisperService] Language:', this.config.language);

            // Read the audio file
            const audioFile = fs.createReadStream(audioFilePath);

            // Call OpenAI Whisper API
            const transcription = await openai.audio.transcriptions.create({
                file: audioFile,
                model: 'whisper-1',
                language: this.config.language,
                response_format: 'text'
            });

            console.log('[WhisperService] API transcription successful');

            // The response is a string when using response_format: 'text'
            return transcription.trim();

        } catch (error: any) {
            console.error('[WhisperService] API transcription failed:', error);

            // Provide user-friendly error messages
            if (error.code === 'invalid_api_key') {
                throw new Error('Invalid OpenAI API key. Please check your settings.');
            } else if (error.code === 'insufficient_quota') {
                throw new Error('OpenAI API quota exceeded. Please check your billing.');
            } else if (error.message) {
                throw new Error(`OpenAI API error: ${error.message}`);
            } else {
                throw new Error('Failed to transcribe audio with OpenAI API');
            }
        }
    }

    private async transcribeLocally(audioFilePath: string): Promise<string> {
        const whisperExec = this.whisperPath;
        if (!whisperExec) {
            throw new Error('Whisper executable not found');
        }

        return new Promise((resolve, reject) => {
            // DIAGNOSTIC LOGS
            const ts1 = timestamp();
            console.log(`[${ts1}] [WhisperService] ========== DIAGNOSTIC START ==========`);
            console.log(`[${ts1}] [WhisperService] Audio file path: "${audioFilePath}"`);
            console.log(`[${ts1}] [WhisperService] File exists: ${fs.existsSync(audioFilePath)}`);
            if (fs.existsSync(audioFilePath)) {
                const stats = fs.statSync(audioFilePath);
                console.log(`[${ts1}] [WhisperService] File size: ${stats.size} bytes`);

                // Check file header (OGG or WAV)
                const fd = fs.openSync(audioFilePath, 'r');
                const buffer = Buffer.alloc(4);
                fs.readSync(fd, buffer, 0, 4, 0);
                fs.closeSync(fd);
                const headerStr = buffer.toString('utf-8');
                const isValidOgg = headerStr === 'OggS';
                const isValidWav = headerStr === 'RIFF';
                console.log(`[${ts1}] [WhisperService] File header: "${buffer.toString('hex')}" (OGG: ${isValidOgg}, WAV: ${isValidWav})`);
            }
            console.log(`[${ts1}] [WhisperService] Whisper executable: "${whisperExec}"`);
            console.log(`[${ts1}] [WhisperService] Model path: "${this.getModelPath()}"`);
            console.log(`[${ts1}] [WhisperService] Language: "${this.config.language}"`);

            // Simple approach: read directly from stdout with UTF-8 encoding
            const args = [
                '-m', this.getModelPath(),
                '-f', audioFilePath,
                '-l', this.config.language,
                '--no-timestamps'
                // NO --print-colors: ANSI escape codes corrupt the output
            ];

            console.log(`[${ts1}] [WhisperService] Full command: ${whisperExec} ${args.join(' ')}`);
            console.log(`[${ts1}] [WhisperService] ========== DIAGNOSTIC END ==========`);

            const childProcess = cp.spawn(whisperExec, args, {
                cwd: path.dirname(audioFilePath),
                windowsHide: true,
                shell: true,  // CRITICAL on Windows for close/exit events to fire properly
                env: {
                    ...process.env,
                    PYTHONIOENCODING: 'utf-8',  // Force UTF-8 for Python-based tools
                    LANG: 'en_US.UTF-8',        // Force UTF-8 locale
                    LC_ALL: 'en_US.UTF-8'       // Force UTF-8 for all locale categories
                }
            }) as cp.ChildProcess;

            let stdout = '';
            let stderr = '';

            if (childProcess.stdout) {
                childProcess.stdout.on('data', (data: Buffer) => {
                    const chunk = data.toString('utf-8');
                    stdout += chunk;
                    // Log progress to console to keep buffer flowing
                    if (chunk.includes('whisper_print_timings') || chunk.includes('processing')) {
                        console.log('[WhisperService] Progress:', chunk.substring(0, 100));
                    }
                });
            }

            if (childProcess.stderr) {
                childProcess.stderr.on('data', (data: Buffer) => {
                    const chunk = data.toString('utf-8');
                    stderr += chunk;
                    // Log stderr to keep buffer flowing
                    console.log('[WhisperService] Stderr chunk:', chunk.substring(0, 100));
                });
            }

            // Add timeout (30 seconds)
            const timeout = setTimeout(() => {
                console.error('[WhisperService] Transcription timeout after 30s');
                childProcess.kill();
                reject(new Error('Transcription timeout. Please try again.'));
            }, 30000);

            childProcess.on('close', (code: number | null) => {
                clearTimeout(timeout);

                const ts = timestamp();
                console.log(`[${ts}] [WhisperService] Process closed with code: ${code}`);
                console.log(`[${ts}] [WhisperService] Stdout length: ${stdout.length}`);
                console.log(`[${ts}] [WhisperService] Stderr length: ${stderr.length}`);

                // Extract transcription directly from stdout (UTF-8 encoded)
                if (code !== 0) {
                    console.error(`[WhisperService] Process failed with code ${code}`);
                    console.log('[WhisperService] Stderr:', stderr.substring(0, 500));
                    reject(new Error('Transcription failed. Please try again.'));
                    return;
                }

                const transcription = this.extractTranscriptionFromOutput(stdout);

                if (transcription && transcription.length > 0) {
                    console.log(`[WhisperService] Transcription: "${transcription}"`);
                    resolve(transcription);
                } else {
                    console.error('[WhisperService] No transcription found in stdout');
                    console.log('[WhisperService] Full stdout:', stdout.substring(0, 500));
                    console.log('[WhisperService] Full stderr:', stderr.substring(0, 500));
                    reject(new Error('No transcription found in output. Please try again.'));
                }
            });

            childProcess.on('error', (error: Error) => {
                clearTimeout(timeout);
                reject(new Error(`Failed to start Whisper: ${error.message}`));
            });
        });
    }

    private extractTranscriptionFromOutput(output: string): string | null {
        // Remove ANSI color codes (support all formats)
        const cleanOutput = output.replace(/\[\d+;\d+;\d+m|\[\d+m/g, '');

        // Whisper-cli prints transcription to stdout (separate from stderr debug info)
        // Look for non-empty lines that aren't debug messages
        const lines = cleanOutput.split('\n');
        let transcriptionLines: string[] = [];

        for (const line of lines) {
            const trimmed = line.trim();

            // Skip debug/system info lines, empty lines, and Whisper markers
            if (trimmed.length === 0 ||
                trimmed.startsWith('whisper_') ||
                trimmed.startsWith('system_info') ||
                trimmed.startsWith('main:') ||
                trimmed.includes('processing') ||
                trimmed.includes('color scheme') ||
                trimmed.includes('output_') ||
                trimmed === '[Musique]' ||  // Filter Whisper's "no speech" marker (French)
                trimmed === '[Music]' ||     // Filter English version
                trimmed === '[BLANK_AUDIO]') {  // Filter other common markers
                continue;
            }

            // This is likely transcription
            transcriptionLines.push(trimmed);
        }

        const result = transcriptionLines.join(' ').trim();
        return result.length > 0 ? result : null;
    }

    private async findWhisperExecutable(): Promise<string | null> {
        const isWindows = os.platform() === 'win32';

        // Try common locations for whisper.cpp
        const possiblePaths = isWindows ? [
            // Windows paths - prefer whisper-cli.exe (new) over main.exe (deprecated)
            path.join(os.homedir(), 'whisper.cpp', 'build', 'bin', 'Release', 'whisper-cli.exe'),
            path.join(os.homedir(), 'whisper.cpp', 'build', 'Release', 'whisper-cli.exe'),
            path.join(os.homedir(), 'whisper.cpp', 'whisper-cli.exe'),
            'C:\\whisper.cpp\\build\\bin\\Release\\whisper-cli.exe',
            path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'whisper.cpp', 'whisper-cli.exe'),
            // Fallback to deprecated main.exe
            path.join(os.homedir(), 'whisper.cpp', 'main.exe'),
            path.join(os.homedir(), 'whisper.cpp', 'build', 'bin', 'Release', 'main.exe'),
            path.join(os.homedir(), 'whisper.cpp', 'build', 'Release', 'main.exe'),
            'C:\\whisper.cpp\\main.exe',
            'C:\\whisper.cpp\\build\\bin\\Release\\main.exe'
        ] : [
            // Linux/macOS paths
            path.join(os.homedir(), 'whisper.cpp', 'whisper-cli'),
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
