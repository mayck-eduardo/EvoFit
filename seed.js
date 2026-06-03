/**
 * ⚠️ SEED SCRIPT - Configuração de Segurança
 *
 * Para rodar este script, crie um arquivo .env na raiz do projeto com:
 *   FIREBASE_API_KEY=sua_chave_aqui
 *   FIREBASE_PROJECT_ID=seu_project_id
 *
 * OU exporte as variáveis no terminal:
 *   $env:FIREBASE_API_KEY="sua_chave"; $env:FIREBASE_PROJECT_ID="seu_id"; node seed.js
 *
 * NUNCA hardcode chaves de API neste arquivo!
 */

const https = require('https');

function loadEnv() {
  try {
    const fs = require('fs');
    const envPath = require('path').join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf8').split('\n');
      for (const line of lines) {
        const match = line.match(/^\s*([^#=]+)=(.*)/);
        if (match) process.env[match[1].trim()] = match[2].trim();
      }
    }
  } catch (e) {}
}
loadEnv();

const API_KEY = process.env.FIREBASE_API_KEY || process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;

if (!API_KEY || !PROJECT_ID || API_KEY === 'AIzaSyExAmPlE_KEY_HERE') {
  console.error('❌ ERRO: Configure FIREBASE_API_KEY e FIREBASE_PROJECT_ID no .env ou nas variáveis de ambiente.');
  console.error('   Copie .env.example para .env e preencha com suas credenciais.');
  process.exit(1);
}

function apiPost(url, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const req = https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        } else {
          resolve(JSON.parse(data));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function createAuthUser(email, password) {
  const data = await apiPost(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    { email, password, returnSecureToken: true }
  );
  return data.localId;
}

async function createDocument(collectionPath, data, docIdOverride) {
  const docId = docIdOverride || (Date.now().toString(36) + Math.random().toString(36).substr(2, 5));
  await apiPost(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionPath}?documentId=${docId}`,
    { fields: toFirestoreFields(data) }
  );
  return docId;
}

async function createDocumentWithTimestamp(collectionPath, data, timestamp) {
  const docId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  const fields = {
    createdAt: { timestampValue: timestamp },
  };
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        fields[key] = { integerValue: value.toString() };
      } else {
        fields[key] = { doubleValue: value.toString() };
      }
    } else if (typeof value === 'string' && value !== '' && !isNaN(parseFloat(value)) && isFinite(value)) {
      const numVal = parseFloat(value);
      if (Number.isInteger(numVal)) {
        fields[key] = { integerValue: numVal.toString() };
      } else {
        fields[key] = { doubleValue: numVal.toString() };
      }
    } else {
      fields[key] = { stringValue: String(value) };
    }
  }

  const body = { fields };

  await new Promise((resolve, reject) => {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionPath}?documentId=${docId}`;
    const req = https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        } else {
          resolve(JSON.parse(data));
        }
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
  
  return docId;
}

function toFirestoreFields(data) {
  const fields = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === null) {
      fields[key] = { nullValue: null };
    } else if (typeof value === 'number') {
      fields[key] = { integerValue: value.toString() };
    } else if (typeof value === 'boolean') {
      fields[key] = { booleanValue: value };
    } else {
      fields[key] = { stringValue: value };
    }
  }
  return fields;
}

async function seed() {
  try {
    let uid;
    try {
      uid = await createAuthUser('teste@evofit.com', '123456');
      console.log('Usuário criado:', uid);
    } catch (e) {
      console.log('Usuário já existe, buscando ID...');
      const signInData = await apiPost(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
        { email: 'teste@evofit.com', password: '123456', returnSecureToken: true }
      );
      uid = signInData.localId;
      console.log('Usuário encontrado:', uid);
    }

    const appId = 'default-app-id';
    const basePath = `artifacts/${appId}/users/${uid}/routines`;

    const routines = [
      {
        name: 'A - Peito / Tríceps',
        order: 1,
        exercises: [
          { name: 'Supino Reto com Barra', sets: '4x10', order: 1 },
          { name: 'Supino Inclinado com Halteres', sets: '3x12', order: 2 },
          { name: 'Crucifixo na Máquina', sets: '3x12', order: 3 },
          { name: 'Tríceps Corda', sets: '3x15', order: 4 },
          { name: 'Tríceps Francês', sets: '3x12', order: 5 },
          { name: 'Tríceps Testa', sets: '3x10', order: 6 },
        ],
      },
      {
        name: 'B - Costas / Bíceps',
        order: 2,
        exercises: [
          { name: 'Barra Fixa', sets: '4x8', order: 1 },
          { name: 'Remada Curvada', sets: '4x10', order: 2 },
          { name: 'Remada Baixa', sets: '3x12', order: 3 },
          { name: 'Pulldown', sets: '3x12', order: 4 },
          { name: 'Rosca Direta', sets: '3x12', order: 5 },
          { name: 'Rosca Alternada', sets: '3x10', order: 6 },
          { name: 'Rosca Martelo', sets: '3x12', order: 7 },
        ],
      },
      {
        name: 'C - Pernas / Glúteos',
        order: 3,
        exercises: [
          { name: 'Agachamento Livre', sets: '4x10', order: 1 },
          { name: 'Leg Press 45°', sets: '4x12', order: 2 },
          { name: 'Cadeira Extensora', sets: '3x15', order: 3 },
          { name: 'Mesa Flexora', sets: '3x12', order: 4 },
          { name: 'Stiff', sets: '3x10', order: 5 },
          { name: 'Panturrilha em Pé', sets: '4x20', order: 6 },
          { name: 'Hip Thrust', sets: '3x12', order: 7 },
        ],
      },
      {
        name: 'D - Ombros / Trapézio',
        order: 4,
        exercises: [
          { name: 'Desenvolvimento Militar', sets: '4x10', order: 1 },
          { name: 'Elevação Lateral', sets: '4x15', order: 2 },
          { name: 'Elevação Frontal', sets: '3x12', order: 3 },
          { name: 'Face Pull', sets: '3x15', order: 4 },
          { name: 'Remada Alta', sets: '3x12', order: 5 },
          { name: 'Encolhimento com Halteres', sets: '3x15', order: 6 },
        ],
      },
      {
        name: 'E - Full Body',
        order: 5,
        exercises: [
          { name: 'Agachamento', sets: '3x10', order: 1 },
          { name: 'Supino Reto', sets: '3x10', order: 2 },
          { name: 'Remada Curvada', sets: '3x10', order: 3 },
          { name: 'Desenvolvimento', sets: '3x10', order: 4 },
          { name: 'Levantamento Terra', sets: '3x8', order: 5 },
          { name: 'Rosca Direta', sets: '3x12', order: 6 },
          { name: 'Prancha', sets: '3x60s', order: 7 },
        ],
      },
    ];

    for (const routine of routines) {
      const { exercises, ...routineData } = routine;
      const routineId = await createDocument(basePath, routineData);
      console.log(`  Ficha criada: ${routine.name}`);

      const exerciseIds = [];
      for (const exercise of exercises) {
        const exId = await createDocument(`${basePath}/${routineId}/exercises`, exercise);
        exerciseIds.push({ id: exId, ...exercise });
      }
      console.log(`    ${exercises.length} exercícios adicionados`);

      // Create logs directly under each exercise
      const daysAgo = [0, 2, 4, 7, 9, 12, 14];
      let logCount = 0;
      for (const days of daysAgo) {
        const logDate = new Date();
        logDate.setDate(logDate.getDate() - days);
        logDate.setHours(9 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60), 0, 0);

        for (const ex of exerciseIds) {
          const sets = ex.sets.split('x');
          const numSets = parseInt(sets[0]) || 3;
          const baseReps = parseInt(sets[1]) || 10;
          const idx = exerciseIds.indexOf(ex);

          for (let s = 0; s < numSets; s++) {
            const logTimestamp = new Date(logDate.getTime() + s * 120000 + Math.random() * 60000).toISOString();
            await createDocumentWithTimestamp(
              `${basePath}/${routineId}/exercises/${ex.id}/logs`,
              {
                weight: (10 + idx * 5 + s * 2.5).toFixed(1),
                reps: Math.max(1, baseReps - s * 2 + Math.floor(Math.random() * 3)),
                note: s === 0 && Math.random() > 0.8 ? 'Peso bom' : '',
              },
              logTimestamp
            );
            logCount++;
          }
        }
      }
      console.log(`    ${logCount} logs de treino criados para ${routine.name}`);
    }

    console.log('\n✅ Seed completo!');
    console.log('Email: teste@evofit.com');
    console.log('Senha: 123456');
  } catch (err) {
    console.error('Erro:', err.message);
  }
}

seed();
