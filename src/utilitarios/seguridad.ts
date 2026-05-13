import argon2 from 'argon2';

const PARAMS_ARGON2 = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1
} as const;

export async function cifrarCredencial(plano: string): Promise<string> {
  return argon2.hash(plano, PARAMS_ARGON2);
}

export async function compararCredencial(hash: string, plano: string): Promise<boolean> {
  return argon2.verify(hash, plano);
}
