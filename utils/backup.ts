import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { collection, doc, getDocs, query, orderBy, writeBatch } from 'firebase/firestore';
import { db, appId } from '../firebaseConfig';

interface RoutineData {
  name: string;
  order: number;
  createdAt?: string;
}

interface ExerciseData {
  name: string;
  sets: string;
  order: number;
  createdAt?: string;
}

interface LogData {
  weight: number;
  reps: number;
  note?: string;
  createdAt?: string;
}

interface BackupData {
  version: string;
  exportedAt: string;
  routines: {
    routine: RoutineData;
    exercises: {
      exercise: ExerciseData;
      logs: LogData[];
    }[];
  }[];
}

export async function exportBackup(uid: string): Promise<string> {
  const backup: BackupData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    routines: [],
  };

  const routinesSnap = await getDocs(
    query(collection(db, 'artifacts', appId, 'users', uid, 'routines'), orderBy('order', 'asc'))
  );

  for (const routineDoc of routinesSnap.docs) {
    const routine = { id: routineDoc.id, ...routineDoc.data() } as any;
    const exercises: BackupData['routines'][0]['exercises'] = [];

    const exercisesSnap = await getDocs(
      query(collection(routineDoc.ref, 'exercises'), orderBy('order', 'asc'))
    );

    for (const exerciseDoc of exercisesSnap.docs) {
      const exercise = { id: exerciseDoc.id, ...exerciseDoc.data() } as any;
      const logs: LogData[] = [];

      const logsSnap = await getDocs(
        query(collection(exerciseDoc.ref, 'logs'), orderBy('createdAt', 'asc'))
      );

      logsSnap.forEach((logDoc) => {
        const log = logDoc.data() as LogData;
        logs.push({
          weight: log.weight,
          reps: log.reps,
          note: log.note,
          createdAt: log.createdAt,
        });
      });

      exercises.push({
        exercise: {
          name: exercise.name,
          sets: exercise.sets,
          order: exercise.order,
          createdAt: exercise.createdAt,
        },
        logs,
      });
    }

    backup.routines.push({
      routine: {
        name: routine.name,
        order: routine.order,
        createdAt: routine.createdAt,
      },
      exercises,
    });
  }

  const json = JSON.stringify(backup, null, 2);
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `EvoFit-backup-${timestamp}.json`;
  const backupFile = new File(Paths.cache, filename);

  await backupFile.write(json);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(backupFile.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Salvar backup EvoFit',
    });
  }

  return backupFile.uri;
}

export async function importBackup(uid: string): Promise<{ routines: number; exercises: number; logs: number }> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });

  if (result.canceled) {
    throw new Error('Importação cancelada');
  }

  const file = result.assets[0];
  const sourceFile = new File(file.uri);
  const content = await sourceFile.text();
  const backup: BackupData = JSON.parse(content);

  if (!backup.version || !backup.routines) {
    throw new Error('Arquivo de backup inválido');
  }

  let routineCount = 0;
  let exerciseCount = 0;
  let logCount = 0;

  for (const item of backup.routines) {
    const routineRef = doc(collection(db, 'artifacts', appId, 'users', uid, 'routines'));
    const batch = writeBatch(db);

    const routineData: any = { name: item.routine.name, order: item.routine.order };
    if (item.routine.createdAt) {
      routineData.createdAt = item.routine.createdAt;
    }
    batch.set(routineRef, routineData);
    routineCount++;

    for (const exItem of item.exercises) {
      const exerciseRef = doc(collection(routineRef, 'exercises'));
      const exerciseData: any = { name: exItem.exercise.name, sets: exItem.exercise.sets, order: exItem.exercise.order };
      if (exItem.exercise.createdAt) {
        exerciseData.createdAt = exItem.exercise.createdAt;
      }
      batch.set(exerciseRef, exerciseData);
      exerciseCount++;

      for (const log of exItem.logs) {
        const logRef = doc(collection(exerciseRef, 'logs'));
        batch.set(logRef, { weight: log.weight, reps: log.reps, note: log.note || '' });
        logCount++;
      }
    }

    await batch.commit();
  }

  return { routines: routineCount, exercises: exerciseCount, logs: logCount };
}
