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
  const fields = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (key === 'createdAt') {
      fields.createdAt = { timestampValue: new Date(value).toISOString() };
    } else if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        fields[key] = { integerValue: value.toString() };
      } else {
        fields[key] = { doubleValue: value.toString() };
      }
    } else if (typeof value === 'boolean') {
      fields[key] = { booleanValue: value };
    } else if (value === null) {
      fields[key] = { nullValue: null };
    } else {
      fields[key] = { stringValue: String(value) };
    }
  }

  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionPath}?documentId=${docId}`;
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 400) reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        else resolve(docId);
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify({ fields }));
    req.end();
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createExerciseLog(exerciseLogPath, data, timestamp) {
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

  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${exerciseLogPath}?documentId=${docId}`;
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 400) reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        else resolve(docId);
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify({ fields }));
    req.end();
  });
}

const routines = [
  {
    name: 'A - Peito / Tríceps',
    order: 1,
    exercises: [
      { name: 'Supino Reto com Barra', sets: '4x10', baseWeight: 60, order: 1 },
      { name: 'Supino Inclinado com Halteres', sets: '3x12', baseWeight: 22, order: 2 },
      { name: 'Crucifixo na Máquina', sets: '3x12', baseWeight: 35, order: 3 },
      { name: 'Tríceps Corda', sets: '3x15', baseWeight: 15, order: 4 },
      { name: 'Tríceps Francês', sets: '3x12', baseWeight: 12, order: 5 },
      { name: 'Tríceps Testa', sets: '3x10', baseWeight: 10, order: 6 },
    ],
  },
  {
    name: 'B - Costas / Bíceps',
    order: 2,
    exercises: [
      { name: 'Barra Fixa', sets: '4x8', baseWeight: 0, order: 1 },
      { name: 'Remada Curvada', sets: '4x10', baseWeight: 50, order: 2 },
      { name: 'Remada Baixa', sets: '3x12', baseWeight: 45, order: 3 },
      { name: 'Pulldown', sets: '3x12', baseWeight: 40, order: 4 },
      { name: 'Rosca Direta', sets: '3x12', baseWeight: 15, order: 5 },
      { name: 'Rosca Alternada', sets: '3x10', baseWeight: 10, order: 6 },
      { name: 'Rosca Martelo', sets: '3x12', baseWeight: 10, order: 7 },
    ],
  },
  {
    name: 'C - Pernas / Glúteos',
    order: 3,
    exercises: [
      { name: 'Agachamento Livre', sets: '4x10', baseWeight: 70, order: 1 },
      { name: 'Leg Press 45°', sets: '4x12', baseWeight: 120, order: 2 },
      { name: 'Cadeira Extensora', sets: '3x15', baseWeight: 40, order: 3 },
      { name: 'Mesa Flexora', sets: '3x12', baseWeight: 35, order: 4 },
      { name: 'Stiff', sets: '3x10', baseWeight: 50, order: 5 },
      { name: 'Panturrilha em Pé', sets: '4x20', baseWeight: 60, order: 6 },
      { name: 'Hip Thrust', sets: '3x12', baseWeight: 60, order: 7 },
    ],
  },
  {
    name: 'D - Ombros / Trapézio',
    order: 4,
    exercises: [
      { name: 'Desenvolvimento Militar', sets: '4x10', baseWeight: 30, order: 1 },
      { name: 'Elevação Lateral', sets: '4x15', baseWeight: 8, order: 2 },
      { name: 'Elevação Frontal', sets: '3x12', baseWeight: 8, order: 3 },
      { name: 'Face Pull', sets: '3x15', baseWeight: 15, order: 4 },
      { name: 'Remada Alta', sets: '3x12', baseWeight: 25, order: 5 },
      { name: 'Encolhimento com Halteres', sets: '3x15', baseWeight: 20, order: 6 },
    ],
  },
  {
    name: 'E - Full Body',
    order: 5,
    exercises: [
      { name: 'Agachamento', sets: '3x10', baseWeight: 65, order: 1 },
      { name: 'Supino Reto', sets: '3x10', baseWeight: 55, order: 2 },
      { name: 'Remada Curvada', sets: '3x10', baseWeight: 45, order: 3 },
      { name: 'Desenvolvimento', sets: '3x10', baseWeight: 25, order: 4 },
      { name: 'Levantamento Terra', sets: '3x8', baseWeight: 80, order: 5 },
      { name: 'Rosca Direta', sets: '3x12', baseWeight: 12, order: 6 },
      { name: 'Prancha', sets: '3x60s', baseWeight: 0, order: 7 },
    ],
  },
];

async function deleteCollection(collectionPath) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionPath}`;
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        } else {
          try {
            const data = JSON.parse(body);
            resolve(data.documents || []);
          } catch (e) {
            resolve([]);
          }
        }
      });
    }).on('error', reject);
  });
}

async function deleteDocument(docPath) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${docPath}`;
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'DELETE' }, (res) => {
      resolve();
    });
    req.on('error', reject);
    req.end();
  });
}

async function seedUser30Days() {
  try {
    const appId = 'default-app-id';
    let uid;
    try {
      uid = await createAuthUser('1@gmail.com', '123456');
      console.log('Usuário criado:', uid);
    } catch (e) {
      console.log('Usuário já existe, buscando ID...');
      const signInData = await apiPost(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
        { email: '1@gmail.com', password: '123456', returnSecureToken: true }
      );
      uid = signInData.localId;
      console.log('Usuário encontrado:', uid);
    }

    // Clean old data
    const basePath = `artifacts/${appId}/users/${uid}/routines`;
    const oldRoutines = await deleteCollection(basePath);
    if (oldRoutines.length > 0) {
      console.log(`  Limpando ${oldRoutines.length} rotinas antigas...`);
      for (const doc of oldRoutines) {
        const docPath = doc.name.replace(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/`, '');
        await deleteDocument(docPath);
        await sleep(100);
      }
      console.log('  Dados antigos removidos');
    }

    // 1) Create all routines and exercises first
    const allRoutines = [];
    for (const routine of routines) {
      const { exercises, ...routineData } = routine;
      const routineId = await createDocument(basePath, {
        name: routine.name,
        order: routine.order,
        createdAt: new Date().toISOString(),
      });
      console.log(`  Ficha criada: ${routine.name} (id: ${routineId})`);

      const exerciseIds = [];
      for (const exercise of exercises) {
        const { baseWeight, ...exerciseData } = exercise;
        const exId = await createDocument(`${basePath}/${routineId}/exercises`, {
          ...exerciseData,
          createdAt: new Date().toISOString(),
        });
        exerciseIds.push({ id: exId, name: exercise.name, sets: exercise.sets, baseWeight: exercise.baseWeight, order: exercise.order });
      }
      console.log(`    ${exercises.length} exercícios criados`);
      allRoutines.push({ id: routineId, name: routine.name, order: routine.order, exercises: exerciseIds });
    }

    // 2) Create training logs for each session
    const schedule = [
      { routineIndex: 0, daysAgo: 29 },
      { routineIndex: 1, daysAgo: 27 },
      { routineIndex: 2, daysAgo: 25 },
      { routineIndex: 3, daysAgo: 23 },
      { routineIndex: 4, daysAgo: 21 },
      { routineIndex: 0, daysAgo: 19 },
      { routineIndex: 1, daysAgo: 17 },
      { routineIndex: 2, daysAgo: 15 },
      { routineIndex: 3, daysAgo: 13 },
      { routineIndex: 4, daysAgo: 11 },
      { routineIndex: 0, daysAgo: 9 },
      { routineIndex: 1, daysAgo: 7 },
      { routineIndex: 2, daysAgo: 5 },
      { routineIndex: 3, daysAgo: 3 },
      { routineIndex: 4, daysAgo: 1 },
      { routineIndex: 0, daysAgo: 0 },
    ];

    let totalLogs = 0;
    for (const entry of schedule) {
      const routineData = allRoutines[entry.routineIndex];
      const logDate = new Date();
      logDate.setDate(logDate.getDate() - entry.daysAgo);
      logDate.setHours(9 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60), 0, 0);
      const timestamp = logDate.toISOString();

      for (const ex of routineData.exercises) {
        const sets = ex.sets.split('x');
        const numSets = parseInt(sets[0]) || 3;
        const targetReps = parseInt(sets[1]) || 10;

        const weekFactor = (30 - entry.daysAgo) / 30;
        const weightIncrease = weekFactor * 5;

        for (let s = 0; s < numSets; s++) {
          let weight = ex.baseWeight + weightIncrease - s * 2.5;
          if (ex.baseWeight === 0) weight = 0;

          const reps = Math.max(1, targetReps - s * 2 + Math.floor(Math.random() * 4));
          const logTimestamp = new Date(logDate.getTime() + s * 120000 + Math.random() * 60000).toISOString();

          await createExerciseLog(
            `${basePath}/${routineData.id}/exercises/${ex.id}/logs`,
            {
              weight: Math.round(weight * 10) / 10,
              reps,
              note: s === 0 && Math.random() > 0.8 ? 'Peso bom' : '',
            },
            logTimestamp
          );
          totalLogs++;
        }
      }
      console.log(`    ${routineData.name} - ${logDate.toLocaleDateString('pt-BR')} (${routineData.exercises.length} exercícios)`);
      await sleep(200);
    }

    console.log(`\n✅ Seed completo!`);
    console.log(`Email: 1@gmail.com`);
    console.log(`Senha: 123456`);
    console.log(`${schedule.length} sessões de treino nos últimos 30 dias`);
    console.log(`${totalLogs} registros de série criados`);
  } catch (err) {
    console.error('Erro:', err.message);
    console.error(err.stack);
  }
}

seedUser30Days();
