const cp = require('child_process');

/**
 * Get the device index for a given device name
 * @param {string} deviceName - The name of the device to find (can be partial)
 * @returns {Promise<number|null>} The device index, or null if not found
 */
function getAudioDeviceIndex(deviceName) {
    return new Promise((resolve, reject) => {
        const soxProcess = cp.spawn('sox', ['-V6', '-t', 'waveaudio', 'non-existent-device', '-n'], {
            shell: true,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        let stderr = '';

        soxProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        soxProcess.on('close', () => {
            // Parse the enumeration lines
            const lines = stderr.split('\n');
            const inputDevices = [];

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
                console.log(`✅ Found device: "${found.name}" at index ${found.index}`);
                resolve(found.index);
            } else {
                console.log(`❌ Device not found: "${deviceName}"`);
                console.log('\n📋 Available input devices:');
                inputDevices.forEach(device => {
                    console.log(`   [${device.index}] "${device.name}"`);
                });
                resolve(null);
            }
        });

        soxProcess.on('error', (error) => {
            reject(error);
        });
    });
}

// Test the function
(async () => {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🔍 TEST: Recherche d\'index de périphérique');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Test 1: Search for K66
    console.log('Test 1: Recherche "K66"');
    const index1 = await getAudioDeviceIndex('K66');
    console.log(`Résultat: ${index1}\n`);

    // Test 2: Search for "Microphone"
    console.log('Test 2: Recherche "Microphone"');
    const index2 = await getAudioDeviceIndex('Microphone');
    console.log(`Résultat: ${index2}\n`);

    // Test 3: Search for non-existent device
    console.log('Test 3: Recherche "Non-existent device"');
    const index3 = await getAudioDeviceIndex('Non-existent');
    console.log(`Résultat: ${index3}\n`);

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✅ TESTS TERMINÉS');
    console.log('═══════════════════════════════════════════════════════════════');
})();
