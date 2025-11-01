const cp = require('child_process');
const path = require('path');
const os = require('os');

console.log('=== Testing Whisper Process ===\n');

// Configuration
const whisperExec = 'C:\\Users\\mafal\\whisper.cpp\\build\\bin\\Release\\whisper-cli.exe';
const modelPath = 'C:\\Users\\mafal\\whisper.cpp\\models\\ggml-base.bin';
const audioFile = 'C:\\Users\\mafal\\AppData\\Local\\Temp\\voice-in-terminal-1762014371572.wav'; // Use extension file

const args = [
    '-m', modelPath,
    '-f', audioFile,
    '-l', 'fr',
    '--no-timestamps',
    '--print-colors'
];

console.log(`Running: ${whisperExec} ${args.join(' ')}\n`);

const childProcess = cp.spawn(whisperExec, args, {
    cwd: path.dirname(audioFile),
    windowsHide: true,
    shell: true  // CRITICAL on Windows for events to fire
});

let stdout = '';
let stderr = '';

childProcess.stdout.on('data', (data) => {
    const chunk = data.toString();
    stdout += chunk;
    console.log('[STDOUT]', chunk);
});

childProcess.stderr.on('data', (data) => {
    const chunk = data.toString();
    stderr += chunk;
    console.log('[STDERR]', chunk);
});

childProcess.on('close', (code) => {
    console.log(`\n=== Process closed with code: ${code} ===`);
    console.log(`\nStdout length: ${stdout.length}`);
    console.log(`Stderr length: ${stderr.length}`);

    console.log('\n=== Extracting transcription ===');
    // Transcription is ONLY in stdout, not stderr
    const transcription = extractTranscription(stdout);

    if (transcription) {
        console.log(`\n✅ SUCCESS! Transcription: "${transcription}"`);
    } else {
        console.log('\n❌ FAILED! No transcription found');
        console.log('\nFull stdout:', stdout);
        console.log('\nFull stderr:', stderr.substring(0, 200));
    }
});

childProcess.on('exit', (code) => {
    console.log(`\n=== Process exited with code: ${code} ===`);
});

childProcess.on('error', (error) => {
    console.error('❌ Error:', error);
});

// Timeout
setTimeout(() => {
    console.log('\n⏱️ TIMEOUT after 30s - killing process');
    childProcess.kill();
}, 30000);

function extractTranscription(output) {
    // Remove ANSI color codes - use comprehensive regex
    const cleanOutput = output.replace(/\[\d+;\d+;\d+m|\[\d+m/g, '');

    const lines = cleanOutput.split('\n');
    let transcriptionLines = [];

    for (const line of lines) {
        const trimmed = line.trim();

        // Skip debug/system info lines and empty lines
        if (trimmed.length === 0 ||
            trimmed.startsWith('whisper_') ||
            trimmed.startsWith('system_info') ||
            trimmed.startsWith('main:') ||
            trimmed.includes('processing') ||
            trimmed.includes('color scheme') ||
            trimmed.includes('output_')) {
            continue;
        }

        // This is likely transcription
        transcriptionLines.push(trimmed);
    }

    return transcriptionLines.join(' ').trim();
}
