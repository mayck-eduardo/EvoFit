const https = require('https');

const API_KEY = 'AIzaSyD9xHz8kwXMwCryF3_NvLXpx550jqgcbJk';
const PROJECT_ID = 'evofit-app-d2e47';

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

async function createDocumentWithTimestamp(collectionPath, data, docIdOverride) {
  const docId = docIdOverride || (Date.now().toString(36) + Math.random().toString(36).substr(2, 5));
  const body = { fields: toFirestoreFields(data) };
  
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

      // Create workout logs for this routine
      const logsPath = `artifacts/${appId}/users/${uid}/workout_logs`;
      const daysAgo = [0, 2, 4, 7, 9, 12, 14];
      for (const days of daysAgo) {
        const logDate = new Date();
        logDate.setDate(logDate.getDate() - days);
        const logSets = exerciseIds.map((ex, idx) => {
          const sets = ex.sets.split('x');
          const numSets = parseInt(sets[0]) || 3;
          const baseReps = parseInt(sets[1]) || 10;
          const setsData = [];
          for (let s = 0; s < numSets; s++) {
            setsData.push({
              weight: (10 + idx * 5 + s * 2.5).toFixed(1),
              reps: Math.max(1, baseReps - s * 2 + Math.floor(Math.random() * 3)),
            });
          }
          return {
            exerciseId: ex.id,
            exerciseName: ex.name,
            sets: JSON.stringify(setsData),
          };
        });

        await createDocumentWithTimestamp(logsPath, {
          routineId,
          routineName: routine.name,
          date: logDate.toISOString().split('T')[0],
          timestamp: logDate.toISOString(),
          exercises: JSON.stringify(logSets),
          completed: 'true',
        });
      }
      console.log(`    7 logs de treino criados para ${routine.name}`);
    }

    console.log('\n✅ Seed completo!');
    console.log('Email: teste@evofit.com');
    console.log('Senha: 123456');
  } catch (err) {
    console.error('Erro:', err.message);
  }
}

seed();
