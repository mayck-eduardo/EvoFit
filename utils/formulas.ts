export const calculateEpley1RM = (weight: number, reps: number): number => {
  if (reps < 1 || reps > 12 || !weight) return 0;
  return Math.round(weight * (1 + reps / 30));
};

export const calculateWilksScore = (weight: number, bodyweight: number, gender: 'male' | 'female' = 'male'): number => {
  if (!bodyweight || !weight) return 0;
  const bw = bodyweight;
  const coeffs = gender === 'male'
    ? { a: -216.0475144, b: 16.2606339, c: -0.002388645, d: -0.00113732, e: 7.01863e-6, f: -1.291e-8 }
    : { a: 594.31747775582, b: -27.23842536447, c: 0.82112226871, d: -0.00930733913, e: 4.731582e-5, f: -9.054e-8 };
  const denom = coeffs.a + coeffs.b * bw + coeffs.c * bw * bw + coeffs.d * bw * bw * bw + coeffs.e * bw * bw * bw * bw + coeffs.f * bw * bw * bw * bw * bw;
  return Math.round((weight / denom) * 100) / 100;
};

export const formatNumber = (num: number, decimals: number = 0): string => {
  return num.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

export const getPersonalBest = (logs: { weight: number; reps: number }[]): { weight: number; reps: number } | null => {
  if (logs.length === 0) return null;
  return logs.reduce((best, log) => {
    const current1RM = calculateEpley1RM(log.weight, log.reps);
    const best1RM = calculateEpley1RM(best.weight, best.reps);
    return current1RM > best1RM ? log : best;
  });
};
