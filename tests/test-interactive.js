const cp = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

console.log('\x1b[1m'); // Bold
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║  Test Interactif - Voice in Terminal                        ║');
console.log('║                                                              ║');
console.log('║  Ce test va enregistrer votre voix pendant 30 secondes      ║');
console.log('║  puis transcrire ce que vous avez dit.                      ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log('\x1b[0m\n'); // Reset

// Configuration
const whisperExec = 'C:\\Users\\mafal\\whisper.cpp\\build\\bin\\Release\\whisper-cli.exe';
const modelPath = 'C:\\Users\\mafal\\whisper.cpp\\models\\ggml-tiny.bin';  // Using tiny model for 2-3x better performance
const tempDir = os.tmpdir();
const timestamp = Date.now();
const audioFile = path.join(tempDir, `voice-test-${timestamp}.ogg`);

let soxProcess = null;
let recordingStartTime = 0;

console.log('📍 Répertoire temporaire:', tempDir);
console.log('🎤 Fichier audio:', path.basename(audioFile));
console.log('');
console.log('\x1b[1m\x1b[36m'); // Bold cyan
console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log('║ 📂 CHEMIN COMPLET DU FICHIER (pour test VLC):                ║');
console.log('╚═══════════════════════════════════════════════════════════════╝');
console.log('\x1b[0m');
console.log(audioFile);
console.log('');

// Countdown before recording
console.log('═══════════════════════════════════════════════════════════════');
console.log('⏰ PRÉPARATION');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');
console.log('\x1b[1m\x1b[33m'); // Bold yellow
console.log('    L\'enregistrement va commencer dans...');
console.log('\x1b[0m');
console.log('');

// Countdown
for (let i = 5; i >= 1; i--) {
    process.stdout.write(`\r    \x1b[1m\x1b[36m⏱️  ${i} seconde${i > 1 ? 's' : ''}...\x1b[0m `);
    // Synchronous sleep
    const start = Date.now();
    while (Date.now() - start < 1000) { }
}

console.log('\r    \x1b[1m\x1b[32m✅ C\'EST PARTI!\x1b[0m                    ');
console.log('');

// Step 1: Start recording
console.log('═══════════════════════════════════════════════════════════════');
console.log('🎙️  ÉTAPE 1: ENREGISTREMENT DÉMARRÉ');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');
console.log('\x1b[1m\x1b[31m'); // Bold red
console.log('    ╔═════════════════════════════════════════════════════════╗');
console.log('    ║  🔴 PARLEZ MAINTENANT DANS LE MICRO! (30 secondes)    ║');
console.log('    ║                                                         ║');
console.log('    ║  Vous pouvez dire un prompt long, par exemple:         ║');
console.log('    ║  "Crée-moi une fonction qui calcule la suite..."       ║');
console.log('    ╚═════════════════════════════════════════════════════════╝');
console.log('\x1b[0m'); // Reset
console.log('');

const soxArgs = [
    '-t', 'waveaudio',
    '1',  // Index du microphone K66 (Device 1 dans la liste SoX)
    '-t', 'ogg',
    '-C', '3',
    audioFile,
    'rate', '16000',
    'channels', '1',
    'trim', '0', '30'  // Auto-stop after 30 seconds
];

soxProcess = cp.spawn('sox', soxArgs, {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true
});

// DIAGNOSTIC: Log process PID
console.log(`    [DIAGNOSTIC] SoX process started with PID: ${soxProcess.pid}`);

recordingStartTime = Date.now();

let progressInterval = setInterval(() => {
    const elapsed = ((Date.now() - recordingStartTime) / 1000).toFixed(1);
    process.stdout.write(`\r    ⏱️  Enregistrement: ${elapsed}s / 4.0s `);
}, 100);

if (soxProcess.stderr) {
    soxProcess.stderr.on('data', () => {
        // Silently consume stderr to avoid buffer issues
    });
}

// DIAGNOSTIC: Log ALL process events
soxProcess.on('spawn', () => {
    console.log(`\n    [DIAGNOSTIC] ✅ EVENT: spawn (PID: ${soxProcess.pid})`);
});

soxProcess.on('exit', (code, signal) => {
    console.log(`\n    [DIAGNOSTIC] ✅ EVENT: exit (code: ${code}, signal: ${signal}, PID: ${soxProcess.pid})`);
});

soxProcess.on('close', (code, signal) => {
    console.log(`\n    [DIAGNOSTIC] ✅ EVENT: close (code: ${code}, signal: ${signal}, PID: ${soxProcess.pid}) - THIS EVENT SHOULD FIRE!`);
});

soxProcess.on('disconnect', () => {
    console.log(`\n    [DIAGNOSTIC] ✅ EVENT: disconnect (PID: ${soxProcess.pid})`);
});

soxProcess.on('error', (error) => {
    clearInterval(progressInterval);
    console.log(`\n    [DIAGNOSTIC] ❌ EVENT: error (${error.message}, PID: ${soxProcess.pid})`);
    console.error('\n\n❌ Erreur SoX:', error);
    process.exit(1);
});

// Auto-stop after 30 seconds
setTimeout(() => {
    clearInterval(progressInterval);
    const duration = ((Date.now() - recordingStartTime) / 1000).toFixed(2);
    console.log(`\r    ✅ Enregistrement: ${duration}s / 30.0s `);
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('⏹️  ÉTAPE 2: ARRÊT DE L\'ENREGISTREMENT');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log(`    [DIAGNOSTIC] ========== STOP RECORDING DIAGNOSTIC ==========`);
    console.log(`    [DIAGNOSTIC] Process state: PID=${soxProcess.pid}, killed=${soxProcess.killed}, exitCode=${soxProcess.exitCode}`);
    console.log(`    [DIAGNOSTIC] Sending SIGINT to SoX for graceful shutdown`);

    soxProcess.once('close', (code) => {
        console.log(`    [DIAGNOSTIC] 🎯 HANDLER: close event fired! (code: ${code})`);
        console.log(`    [DIAGNOSTIC] This handler was registered via once('close')`);
        soxProcess = null;  // CRITICAL: Nullify to prevent fallback timeout from firing
        console.log(`    📦 SoX terminé (code: ${code})`);
        console.log('');

        // Step 3: Wait for file to be ready
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('⏳ ÉTAPE 3: ATTENTE DU FICHIER (polling actif)');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('');
        process.stdout.write('    🔍 Vérification: ');

        const pollStart = Date.now();

        waitForFileReady(audioFile, 5000)
            .then((elapsed) => {
                console.log(`\n    ✅ Fichier prêt après ${elapsed}ms`);

                const stats = fs.statSync(audioFile);
                console.log(`    📊 Taille: ${stats.size} bytes (${(stats.size / 1024).toFixed(1)} KB)`);

                // Check OGG header
                const fd = fs.openSync(audioFile, 'r');
                const buffer = Buffer.alloc(4);
                fs.readSync(fd, buffer, 0, 4, 0);
                fs.closeSync(fd);
                const isValidOgg = buffer.toString('utf-8') === 'OggS';
                console.log(`    🎵 Format OGG valide: ${isValidOgg ? '✅' : '❌'}`);
                console.log('');

                if (stats.size === 0) {
                    console.error('❌ Fichier vide!');
                    process.exit(1);
                }

                if (!isValidOgg) {
                    console.error('❌ Header OGG invalide!');
                    process.exit(1);
                }

                // Step 4: Transcribe
                console.log('═══════════════════════════════════════════════════════════════');
                console.log('🤖 ÉTAPE 4: TRANSCRIPTION WHISPER');
                console.log('═══════════════════════════════════════════════════════════════');
                console.log('');
                transcribe();
            })
            .catch((error) => {
                console.error('\n❌ Échec polling:', error.message);
                cleanup();
                process.exit(1);
            });
    });

    console.log('    [DIAGNOSTIC] Calling kill(SIGINT)...');
    console.log('    📤 Envoi signal SIGINT à SoX...');
    const killResult = soxProcess.kill('SIGINT');
    console.log(`    [DIAGNOSTIC] kill(SIGINT) returned: ${killResult}`);

    // Fallback timeout in case close event doesn't fire
    console.log('    [DIAGNOSTIC] Setting 2000ms fallback timeout...');
    setTimeout(() => {
        if (soxProcess) {
            console.log('    [DIAGNOSTIC] ⚠️ FALLBACK TIMEOUT: close event never fired after 2000ms!');
            console.log(`    [DIAGNOSTIC] Process state: PID=${soxProcess.pid}, killed=${soxProcess.killed}, exitCode=${soxProcess.exitCode}`);
            console.log('    [DIAGNOSTIC] Forcing SIGKILL...');
            console.log('    ⚠️  Timeout, envoi SIGKILL...');
            soxProcess.kill('SIGKILL');
            soxProcess = null;
        } else {
            console.log('    [DIAGNOSTIC] ✅ FALLBACK TIMEOUT: Process already cleaned up by close handler');
        }
    }, 2000);

}, 30000); // 30 seconds

function waitForFileReady(filePath, timeout) {
    const startTime = Date.now();
    const pollInterval = 50;
    let lastIndicator = '';

    return new Promise((resolve, reject) => {
        const checkFile = () => {
            const elapsed = Date.now() - startTime;

            if (elapsed > timeout) {
                reject(new Error(`Timeout après ${elapsed}ms`));
                return;
            }

            if (!fs.existsSync(filePath)) {
                if (lastIndicator !== 'w') {
                    process.stdout.write('⏰');
                    lastIndicator = 'w';
                }
                setTimeout(checkFile, pollInterval);
                return;
            }

            try {
                const fd = fs.openSync(filePath, 'r');
                const stats = fs.fstatSync(fd);

                // Check OGG header
                const buffer = Buffer.alloc(4);
                fs.readSync(fd, buffer, 0, 4, 0);
                fs.closeSync(fd);

                const isValidOgg = buffer.toString('utf-8') === 'OggS';

                if (stats.size > 0 && isValidOgg) {
                    resolve(elapsed);
                } else {
                    if (lastIndicator !== 'e') {
                        process.stdout.write('📝');
                        lastIndicator = 'e';
                    }
                    setTimeout(checkFile, pollInterval);
                }
            } catch (err) {
                if (lastIndicator !== 'l') {
                    process.stdout.write('🔒');
                    lastIndicator = 'l';
                }
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

    console.log(`    🚀 Commande: whisper-cli.exe -m ... -f ${path.basename(audioFile)} -l fr`);
    console.log('');
    process.stdout.write('    🧠 Traitement en cours');

    const whisperStart = Date.now();
    const whisperProcess = cp.spawn(whisperExec, whisperArgs, {
        cwd: path.dirname(audioFile),
        windowsHide: true,
        shell: true
    });

    let stdout = '';
    let stderr = '';

    // Progress indicator
    const progressDots = setInterval(() => {
        process.stdout.write('.');
    }, 500);

    whisperProcess.stdout.on('data', (data) => {
        stdout += data.toString();
    });

    whisperProcess.stderr.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;

        if (chunk.includes('error')) {
            console.log('\n    ❌ ERREUR:', chunk.substring(0, 200));
        }
    });

    whisperProcess.on('close', (code) => {
        clearInterval(progressDots);
        const whisperDuration = ((Date.now() - whisperStart) / 1000).toFixed(2);

        console.log(`\n    ⏱️  Durée: ${whisperDuration}s`);
        console.log(`    📋 Code retour: ${code}`);
        console.log('');

        const transcription = extractTranscription(stdout);

        console.log('═══════════════════════════════════════════════════════════════');
        console.log('📝 RÉSULTAT');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('');

        if (transcription) {
            console.log('\x1b[1m\x1b[32m'); // Bold green
            console.log('    ╔═════════════════════════════════════════════════════════╗');
            console.log('    ║  ✅ TRANSCRIPTION RÉUSSIE!                             ║');
            console.log('    ╚═════════════════════════════════════════════════════════╝');
            console.log('\x1b[0m');
            console.log('');
            console.log(`    📝 Texte reconnu: "${transcription}"`);
            console.log('');
            console.log('═══════════════════════════════════════════════════════════════');
            console.log('🎉 SUCCÈS TOTAL! L\'EXTENSION DEVRAIT FONCTIONNER!');
            console.log('═══════════════════════════════════════════════════════════════\n');
        } else {
            console.log('\x1b[1m\x1b[33m'); // Bold yellow
            console.log('    ╔═════════════════════════════════════════════════════════╗');
            console.log('    ║  ⚠️  PAS DE TEXTE DÉTECTÉ                              ║');
            console.log('    ║                                                         ║');
            console.log('    ║  Possibles raisons:                                    ║');
            console.log('    ║  - Vous n\'avez pas parlé                               ║');
            console.log('    ║  - Micro coupé ou volume trop bas                      ║');
            console.log('    ║  - Parlez plus fort et plus clairement                 ║');
            console.log('    ╚═════════════════════════════════════════════════════════╝');
            console.log('\x1b[0m');
            console.log('');
            console.log('    📄 Stdout (premiers 300 chars):');
            console.log('    ' + stdout.substring(0, 300).replace(/\n/g, '\n    '));
            console.log('');
            console.log('    📄 Stderr (premiers 300 chars):');
            console.log('    ' + stderr.substring(0, 300).replace(/\n/g, '\n    '));
            console.log('');
            console.log('═══════════════════════════════════════════════════════════════');
            console.log('❌ RELANCEZ LE TEST ET PARLEZ CLAIREMENT!');
            console.log('═══════════════════════════════════════════════════════════════\n');
        }

        cleanup();
        process.exit(transcription ? 0 : 1);
    });

    whisperProcess.on('error', (error) => {
        clearInterval(progressDots);
        console.error('\n❌ Erreur Whisper:', error);
        cleanup();
        process.exit(1);
    });

    setTimeout(() => {
        clearInterval(progressDots);
        console.log('\n⏱️ TIMEOUT (30s) - Abandon');
        whisperProcess.kill();
        cleanup();
        process.exit(1);
    }, 30000);
}

function extractTranscription(output) {
    // Remove ALL ANSI codes comprehensively
    const cleanOutput = output.replace(/\x1b\[[0-9;]*m/g, '').replace(/\[\d+;\d+;\d+m/g, '').replace(/\[\d+m/g, '');

    console.log('\n[DEBUG] Clean output (first 500 chars):');
    console.log(cleanOutput.substring(0, 500));
    console.log('\n[DEBUG] All lines:');

    const lines = cleanOutput.split('\n');
    let transcriptionLines = [];

    for (const line of lines) {
        const trimmed = line.trim();
        console.log(`  "${trimmed}"`);

        if (trimmed.length === 0 ||
            trimmed.startsWith('whisper_') ||
            trimmed.startsWith('system_info') ||
            trimmed.startsWith('main:') ||
            trimmed.includes('processing') ||
            trimmed.includes('color scheme') ||
            trimmed.includes('output_') ||
            trimmed === '[Musique]' ||  // Filter Whisper's "no speech" marker
            trimmed === '[BLANK_AUDIO]') {  // Filter other common markers
            continue;
        }

        // This is likely transcription
        console.log(`  -> KEEPING: "${trimmed}"`);
        transcriptionLines.push(trimmed);
    }

    const result = transcriptionLines.join(' ').trim();
    console.log(`\n[DEBUG] Final result: "${result}"\n`);
    return result;
}

function cleanup() {
    // DÉSACTIVÉ pour permettre la vérification du fichier avec VLC
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📂 FICHIER AUDIO CONSERVÉ');
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('\x1b[1m\x1b[36m'); // Bold cyan
    console.log('Chemin complet:');
    console.log(audioFile);
    console.log('\x1b[0m\n');
    console.log('💡 PROCHAINE ÉTAPE:');
    console.log('   1. Ouvrez ce fichier avec VLC');
    console.log('   2. Vérifiez que votre voix a été enregistrée clairement');
    console.log('');
    console.log('📊 DIAGNOSTIC:');
    console.log('   ✅ Si vous entendez votre voix = le problème est dans Whisper');
    console.log('   ❌ Si le fichier est vide/silencieux = problème microphone\n');

    // Décommenter cette ligne pour réactiver le nettoyage plus tard:
    // fs.unlinkSync(audioFile);
}

// Handle Ctrl+C
process.on('SIGINT', () => {
    console.log('\n\n⚠️  Interruption utilisateur');
    if (soxProcess) soxProcess.kill('SIGKILL');
    cleanup();
    process.exit(1);
});
