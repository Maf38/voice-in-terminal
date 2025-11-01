# CLAUDE.MD - Context du projet Voice in Terminal

## Objectif du projet

Créer une extension VS Code qui permet de dicter des commandes vocales en français directement dans le terminal Claude Code, afin de gagner du temps lors de l'interaction avec Claude.

## Besoin utilisateur

L'utilisateur souhaite :
- Parler dans son micro (en français)
- Que la transcription soit automatiquement insérée dans le terminal/chat Claude actif
- Déclencher l'enregistrement vocal via un raccourci clavier ou un bouton
- Avoir un indicateur visuel pendant l'acquisition vocale
- Arrêter l'enregistrement et insérer automatiquement le texte transcrit

## Solution technique choisie

- **Extension VS Code native** pour intégration parfaite avec l'environnement
- **Architecture hybride pour SSH** :
  - Audio capturé sur la machine locale (où est le micro)
  - Transcription via Whisper (local ou API selon disponibilité)
  - Texte inséré dans le terminal distant
- **Whisper en local** (gratuit, open-source, pas de coûts API) ou **API Whisper** en fallback
- **Raccourci clavier personnalisable** pour démarrer/arrêter l'enregistrement
- **Indicateur visuel** dans la barre d'état VS Code
- **Modal de preview** (optionnel) pour corriger avant insertion
- **Insertion directe ou avec validation** dans le terminal Claude Code actif

## Technologies envisagées

- **TypeScript** pour l'extension VS Code
- **whisper.cpp** ou **faster-whisper** pour la transcription locale
- **Node.js** pour l'enregistrement audio
- **VS Code Extension API** pour l'intégration

## Contraintes

- Doit fonctionner en local (pas de dépendance internet obligatoire)
- Gratuit (pas de coûts récurrents)
- Support du français
- Performance acceptable pour des phrases courtes (commandes/questions)
- Compatible avec le terminal Claude Code
- **Interface en anglais** pour permettre l'usage international
- Compatible avec VS Code en mode SSH/Remote (l'utilisateur développe principalement sur VM distante)

## Configuration utilisateur

L'utilisateur a activé l'auto-approval des commandes bash en sandbox :
```json
{
  "sandbox": {
    "autoAllowBashIfSandboxed": true
  }
}
```

## Commandes SoX importantes

### Lister les périphériques audio d'entrée (microphones)
```bash
sox -V6 -t waveaudio non-existent-device -n 2>&1 | grep "Enumerating input"
```

Cette commande liste tous les microphones disponibles avec leur index et leur nom.

Exemple de sortie :
```
Enumerating input device -1: "Microsoft Sound Mapper"
Enumerating input device  0: "SteelSeries Sonar - Microphone "
Enumerating input device  1: "Microphone (K66)"
Enumerating input device  2: "Microphone sur casque (3- Arcti"
```

### Configuration microphone pour ce projet
- **Microphone utilisé** : "Microphone (K66)" ou "Microphone" (nom court qui fonctionne)
- **Index du device** : 1
- Le nom "Microphone" sans spécifier le modèle fonctionne car c'est le périphérique par défaut

## Problèmes rencontrés et solutions (à ne PAS reproduire!)

### 1. **shell: false sur Windows = PROBLÈMES DE PROCESSUS**

**❌ NE JAMAIS UTILISER `shell: false` avec SoX sur Windows!**

Problèmes observés avec `shell: false`:
- `process.kill('SIGINT')` → Le processus ne meurt pas, crée des processus orphelins qui continuent d'enregistrer indéfiniment
- `process.kill('SIGKILL')` → Le processus meurt mais le fichier WAV est corrompu (headers non finalisés)
- `process.kill('SIGTERM')` → Même problème que SIGINT, le signal POSIX ne fonctionne pas sur Windows

**Raison**: Les signaux POSIX (SIGINT, SIGTERM, SIGKILL) ne fonctionnent pas correctement sur les processus Windows natifs lancés avec `shell: false`.

**✅ SOLUTION CROSS-PLATFORM**:
- **Windows**: Utiliser `shell: true` + package `ctrlc-windows` pour envoyer un vrai signal Ctrl+C
- **Linux/macOS**: Utiliser `shell: true` + `process.kill('SIGINT')` natif

```typescript
// Import conditionnel pour Windows
let ctrlc: ((pid: number) => void) | null = null;
if (os.platform() === 'win32') {
    const ctrlcModule = require('ctrlc-windows');
    ctrlc = ctrlcModule.ctrlc;
}

// Spawn avec shell:true
this.soxProcess = cp.spawn('sox', soxArgs, {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true  // OBLIGATOIRE pour ctrlc-windows et SIGINT
});

// Arrêt gracieux cross-platform
const pid = this.soxProcess.pid;
if (os.platform() === 'win32' && ctrlc && pid) {
    // Windows: Envoie Ctrl+C via GenerateConsoleCtrlEvent
    ctrlc(pid);
} else {
    // Linux/macOS: Signal POSIX natif
    this.soxProcess.kill('SIGINT');
}
```

**Dépendance**: `npm install ctrlc-windows`

### 2. **Format audio: WAV vs OGG**

**Problème avec OGG**: Perte de 3-5 secondes à la fin de l'enregistrement car la compression Vorbis nécessite une finalisation qui ne se fait pas si le processus est tué brutalement.

**✅ Solution adoptée**: Format WAV
- Écriture instantanée sans compression
- Pas de finalisation nécessaire (si terminaison gracieuse)
- Whisper peut lire directement

**ATTENTION**: Même le WAV nécessite une terminaison gracieuse pour finaliser les headers (taille, nombre de samples). Utiliser `taskkill /T` SANS `/F` pour permettre à SoX de finaliser.

### 3. **Encodage UTF-8 pour le français**

**Problème initial**: La console Windows utilise CP1252 par défaut, pas UTF-8.

**Problème découvert**: Les codes ANSI de couleur (`\x1b`) de Whisper corrompaient le texte UTF-8.

**✅ Solution finale**:
1. **NE PAS** utiliser `--print-colors` avec Whisper
2. Forcer UTF-8 dans l'environnement du processus:
```typescript
{
    env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        LANG: 'en_US.UTF-8',
        LC_ALL: 'en_US.UTF-8'
    }
}
```
3. Décoder stdout avec UTF-8: `data.toString('utf-8')`
4. Nettoyer les codes ANSI si présents dans `extractTranscriptionFromOutput()`

### 4. **Événements de processus dans VS Code Extension Host**

**Problème découvert**: L'événement `close` ne se déclenche pas toujours dans le VS Code Extension Host, alors qu'il fonctionne en Node.js standalone.

**✅ Solution**: Utiliser l'événement `exit` au lieu de `close` pour détecter la fin du processus.

```typescript
// ✅ BON: Utiliser 'exit' dans VS Code Extension
this.soxProcess.once('exit', (code) => {
    // Traiter la fin du processus
});

// ❌ MAUVAIS: 'close' ne se déclenche pas toujours
this.soxProcess.once('close', (code) => {
    // Peut ne jamais se déclencher!
});
```

### 5. **Délais de finalisation**

**Délais nécessaires après arrêt du processus**:
- **WAV**: 500ms (juste pour que Windows libère le file handle)
- **OGG**: 2000ms (pour la finalisation de la compression Vorbis) - **format abandonné**

### 6. **Arguments Whisper avec shell: true**

**Problème découvert**: Avec `shell: true`, Node.js gère automatiquement l'échappement des chemins. Ajouter manuellement des guillemets cause des erreurs de parsing.

**✅ Solution**: NE PAS mettre de guillemets manuels, Node.js s'en occupe:
```typescript
const args = [
    '-m', this.getModelPath(),  // Pas de guillemets
    '-f', audioFilePath,        // Pas de guillemets
    '-l', 'fr',
    '--no-timestamps'           // PAS --print-colors (codes ANSI)
];
```

## Prochaines étapes

1. ✅ Initialiser le repository git
2. ✅ Rédiger les spécifications fonctionnelles (README.md)
3. ⏳ Validation des specs par l'utilisateur
4. ⏳ Implémentation de l'extension
5. ⏳ Tests et ajustements
