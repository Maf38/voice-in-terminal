const cp = require('child_process');

console.log('═══════════════════════════════════════════════════════════════');
console.log('🎤 LISTE DES PÉRIPHÉRIQUES AUDIO POUR SOX');
console.log('═══════════════════════════════════════════════════════════════\n');

// Try to record with an invalid device to force SoX to list all available devices
const soxProcess = cp.spawn('sox', ['-t', 'waveaudio', '--show-available-devices'], {
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe']
});

let stdout = '';
let stderr = '';

soxProcess.stdout.on('data', (data) => {
    stdout += data.toString();
});

soxProcess.stderr.on('data', (data) => {
    stderr += data.toString();
});

soxProcess.on('close', (code) => {
    console.log('📋 SORTIE SOX:\n');

    if (stdout) {
        console.log('STDOUT:');
        console.log(stdout);
        console.log('');
    }

    if (stderr) {
        console.log('STDERR:');
        console.log(stderr);
        console.log('');
    }

    // Si l'option n'existe pas, essayons avec un device invalide pour forcer la liste
    if (stderr.includes('not recognized') || stderr.includes('invalid')) {
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('⚠️  L\'option --show-available-devices n\'existe pas');
        console.log('Essayons de forcer l\'affichage des périphériques...\n');

        // Try with invalid device to trigger device list
        const sox2 = cp.spawn('sox', [
            '-t', 'waveaudio',
            'INVALID_DEVICE_NAME',
            'test.wav'
        ], {
            shell: true,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        let stderr2 = '';

        sox2.stderr.on('data', (data) => {
            stderr2 += data.toString();
        });

        sox2.on('close', () => {
            console.log('📋 PÉRIPHÉRIQUES DÉTECTÉS:\n');
            console.log(stderr2);
            console.log('\n═══════════════════════════════════════════════════════════════');
            console.log('💡 INSTRUCTIONS:');
            console.log('═══════════════════════════════════════════════════════════════\n');
            console.log('Cherchez votre microphone K66 dans la liste ci-dessus.');
            console.log('Copiez le nom EXACT tel qu\'il apparaît (avec guillemets si besoin).\n');
        });
    } else {
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('💡 INSTRUCTIONS:');
        console.log('═══════════════════════════════════════════════════════════════\n');
        console.log('Cherchez votre microphone K66 dans la liste ci-dessus.');
        console.log('Copiez le nom EXACT tel qu\'il apparaît.\n');
    }
});

soxProcess.on('error', (error) => {
    console.error('❌ Erreur:', error.message);
});
