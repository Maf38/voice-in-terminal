const cp = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

console.log('=== Full Flow Test: Recording -> Polling -> Transcription ===\n');

// Configuration
const whisperExec = 'C:\\Users\\mafal\\whisper.cpp\\build\\bin\\Release\\whisper-cli.exe';
const modelPath = 'C:\\Users\\mafal\\whisper.cpp\\models\\ggml-base.bin';
const tempDir = os.tmpdir();
const timestamp = Date.now();
const audioFile = path.join(tempDir, `test-full-flow-${timestamp}.ogg`);

let soxProcess = null;

// Step 1: Start recording
console.log('Step 1: Starting SoX recording (5 seconds)...');

const soxArgs = [
    '-t', 'waveaudio',
    '-d',
    '-t', 'ogg',
    '-C', '3',
    audioFile,
    'rate', '16000',
    'channels', '1',
    'trim', '0', '5'
];

console.log(`Command: sox ${soxArgs.join(' ')}\n`);

soxProcess = cp.spawn('sox', soxArgs, {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true
});

if (soxProcess.stderr) {
    soxProcess.stderr.on('data', (data) => {
        process.stdout.write('.');
    });
}

soxProcess.on('error', (error) => {
    console.error('\n❌ SoX Error:', error);
    process.exit(1);
});

// Simulate user stopping recording after ~3 seconds
setTimeout(() => {
    console.log('\n\nStep 2: User stops recording (sending SIGINT)...');

    soxProcess.once('close', (code) => {
        console.log(`SoX closed with code: ${code}`);

        // Step 3: Wait for file to be ready (active polling)
        console.log('\nStep 3: Polling for file to be ready...');

        waitForFileReady(audioFile, 5000)
            .then((elapsed) => {
                console.log(`✅ File ready after ${elapsed}ms\n`);

                // Check file
                const stats = fs.statSync(audioFile);
                console.log(`File size: ${stats.size} bytes`);

                if (stats.size === 0) {
                    console.error('❌ File is empty!');
                    process.exit(1);
                }

                // Step 4: Transcribe
                console.log('\nStep 4: Starting transcription...\n');
                transcribe();
            })
            .catch((error) => {
                console.error('❌ Polling failed:', error.message);
                process.exit(1);
            });
    });

    soxProcess.kill('SIGINT');

    // Fallback
    setTimeout(() => {
        if (soxProcess) {
            console.log('Close event timeout, forcing SIGKILL');
            soxProcess.kill('SIGKILL');
        }
    }, 2000);

}, 3000);

function waitForFileReady(filePath, timeout) {
    const startTime = Date.now();
    const pollInterval = 50;

    return new Promise((resolve, reject) => {
        const checkFile = () => {
            const elapsed = Date.now() - startTime;

            if (elapsed > timeout) {
                reject(new Error(`Timeout after ${elapsed}ms`));
                return;
            }

            if (!fs.existsSync(filePath)) {
                process.stdout.write('w');  // Waiting for file
                setTimeout(checkFile, pollInterval);
                return;
            }

            try {
                const fd = fs.openSync(filePath, 'r');
                const stats = fs.fstatSync(fd);
                fs.closeSync(fd);

                if (stats.size > 0) {
                    resolve(elapsed);
                } else {
                    process.stdout.write('e');  // Empty file
                    setTimeout(checkFile, pollInterval);
                }
            } catch (err) {
                process.stdout.write('l');  // Locked
                setTimeout(checkFile, pollInterval);
            }
        };

        checkFile();
    });
}

function transcribe() {
    const whisperArgs = [
        '-m', modelPath,
        '-f', audioFile,
        '-l', 'fr',
        '--no-timestamps',
        '--print-colors'
    ];

    console.log(`Command: ${whisperExec} ${whisperArgs.join(' ')}\n`);

    const whisperProcess = cp.spawn(whisperExec, whisperArgs, {
        cwd: path.dirname(audioFile),
        windowsHide: true,
        shell: true
    });

    let stdout = '';
    let stderr = '';

    whisperProcess.stdout.on('data', (data) => {
        stdout += data.toString();
    });

    whisperProcess.stderr.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;

        if (chunk.includes('error')) {
            console.log('[ERROR]', chunk);
        }
    });

    whisperProcess.on('close', (code) => {
        console.log(`\n=== Whisper closed with code: ${code} ===`);

        const transcription = extractTranscription(stdout);

        if (transcription) {
            console.log(`\n✅✅✅ SUCCESS! Transcription: "${transcription}"\n`);
        } else {
            console.log('\n❌❌❌ FAILED! No transcription found');
            console.log('\nStdout:', stdout.substring(0, 300));
            console.log('\nStderr:', stderr.substring(0, 300));
        }

        // Cleanup
        try {
            fs.unlinkSync(audioFile);
            console.log('✅ Cleaned up audio file');
        } catch (err) {
            console.log('⚠️ Cleanup failed:', err.message);
        }

        process.exit(transcription ? 0 : 1);
    });

    whisperProcess.on('error', (error) => {
        console.error('❌ Whisper error:', error);
        process.exit(1);
    });

    setTimeout(() => {
        console.log('\n⏱️ TIMEOUT - killing whisper');
        whisperProcess.kill();
    }, 30000);
}

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
