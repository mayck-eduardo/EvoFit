// app/utils/formulas.ts

/**
 * Calcula o 1RM (One-Rep Max) estimado usando a fórmula de Epley.
 * Retorna o valor arredondado.
 * @param weight O peso levantado (em kg).
 * @param reps O número de repetições.
 * @returns O 1RM estimado (number).
 */
export const calculateEpley1RM = (weight: number, reps: number): number => {
  // A fórmula não é confiável para repetições muito altas (ex: > 12)
  // Vamos limitar o cálculo para repetições de 1 a 12.
  if (reps < 1 || reps > 12 || !weight) {
    return 0; // Retorna 0 se não for calcular
  }
  
  const rm = weight * (1 + (reps / 30));
  return Math.round(rm); // Arredonda para o número inteiro mais próximo
};