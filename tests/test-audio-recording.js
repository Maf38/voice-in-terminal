const cp = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

console.log('=== Testing Audio Recording & Transcription End-to-End ===\n');

// Configuration
const whisperExec = 'C:\\Users\\mafal\\whisper.cpp\\build\\bin\\Release\\whisper-cli.exe';
const modelPath = 'C:\\Users\\mafal\\whisper.cpp\\models\\ggml-base.bin';
const tempDir = os.tmpdir();
const timestamp = Date.now();
const audioFile = path.join(tempDir, `test-recording-${timestamp}.ogg`);

console.log('Step 1: Recording 5 seconds of audio...');

// Record audio with SoX
const soxArgs = [
    '-t', 'waveaudio',  // Input: Windows waveaudio driver
    '-d',               // Default device
    '-t', 'ogg',        // Output: OGG/Vorbis format
    '-C', '3',          // Quality level 3
    audioFile,
    'rate', '16000',    // Sample rate
    'channels', '1',    // Mono
    'trim', '0', '5'    // Record 5 seconds
];

console.log(`Running: sox ${soxArgs.join(' ')}\n`);

const soxProcess = cp.spawn('sox', soxArgs, {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true
});

let soxOutput = '';

if (soxProcess.stderr) {
    soxProcess.stderr.on('data', (data) => {
        const chunk = data.toString();
        soxOutput += chunk;
        process.stdout.write('.');  // Progress indicator
    });
}

soxProcess.on('error', (error) => {
    console.error('\n❌ SoX Error:', error);
    process.exit(1);
});

soxProcess.on('close', (code) => {
    console.log(`\n\nSoX finished with code: ${code}`);

    // Wait for file to be fully written and handle released
    setTimeout(() => {
        // Check if file exists and has content
        if (!fs.existsSync(audioFile)) {
            console.error('❌ Audio file not found!');
            process.exit(1);
        }

        const stats = fs.statSync(audioFile);
        console.log(`✅ Audio file created: ${audioFile}`);
        console.log(`   Size: ${stats.size} bytes`);

        if (stats.size === 0) {
            console.error('❌ Audio file is empty!');
            process.exit(1);
        }

        // Test if file is readable and not locked
        try {
            const fd = fs.openSync(audioFile, 'r');
            fs.closeSync(fd);
            console.log('✅ File is readable and not locked\n');
        } catch (err) {
            console.error('❌ File is locked:', err.message);
            process.exit(1);
        }

        // Step 2: Transcribe
        console.log('Step 2: Transcribing audio...\n');

        const whisperArgs = [
            '-m', modelPath,
            '-f', audioFile,
            '-l', 'fr',
            '--no-timestamps',
            '--print-colors'
        ];

        console.log(`Running: ${whisperExec} ${whisperArgs.join(' ')}\n`);

        const whisperProcess = cp.spawn(whisperExec, whisperArgs, {
            cwd: path.dirname(audioFile),
            windowsHide: true,
            shell: true
        });

        let stdout = '';
        let stderr = '';

        whisperProcess.stdout.on('data', (data) => {
            const chunk = data.toString();
            stdout += chunk;
            console.log('[STDOUT]', chunk.substring(0, 100));
        });

        whisperProcess.stderr.on('data', (data) => {
            const chunk = data.toString();
            stderr += chunk;
            if (chunk.includes('error')) {
                console.log('[STDERR ERROR]', chunk);
            }
        });

        whisperProcess.on('close', (code) => {
            console.log(`\n=== Whisper closed with code: ${code} ===`);
            console.log(`Stdout length: ${stdout.length}`);
            console.log(`Stderr length: ${stderr.length}`);

            // Extract transcription
            const transcription = extractTranscription(stdout);

            if (transcription) {
                console.log(`\n✅ SUCCESS! Transcription: "${transcription}"`);
            } else {
                console.log('\n❌ FAILED! No transcription found');
                console.log('\nFull stdout:', stdout.substring(0, 500));
                console.log('\nFull stderr:', stderr.substring(0, 500));
            }

            // Cleanup
            try {
                fs.unlinkSync(audioFile);
                console.log('\n✅ Cleaned up audio file');
            } catch (err) {
                console.log('\n⚠️ Failed to cleanup:', err.message);
            }
        });

        whisperProcess.on('error', (error) => {
            console.error('❌ Whisper Error:', error);
        });

        // Timeout
        setTimeout(() => {
            console.log('\n⏱️ TIMEOUT after 30s - killing process');
            whisperProcess.kill();
        }, 30000);

    }, 2000);  // Wait 2 seconds for file to be fully written
});

function extractTranscription(output) {
    const cleanOutput = output.replace(/\[\d+;\d+;\d+m|\[\d+m/g, '');
    const lines = cleanOutput.split('\n');
    let transcriptionLines = [];

    for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.length === 0 ||
            trimmed.startsWith('whisper_') ||
            trimmed.startsWith('system_info') ||
            trimmed.startsWith('main:') ||
            trimmed.includes('processing') ||
            trimmed.includes('color scheme') ||
            trimmed.includes('output_')) {
            continue;
        }

        transcriptionLines.push(trimmed);
    }

    return transcriptionLines.join(' ').trim();
}
