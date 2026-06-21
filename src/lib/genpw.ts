// Local CSPRNG password generator used by the entry form's "generate" key.
// (Distinct from `pass generate`, which writes straight to the store; here we
// only want to fill an input the user can still edit before saving.)

import { randomInt } from "node:crypto";

const LOWER = "abcdefghijkmnpqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%^&*()-_=+[]{};:,.?";

export function generatePassword(length = 25, useSymbols = true): string {
  const pool = LOWER + UPPER + DIGITS + (useSymbols ? SYMBOLS : "");
  let out = "";
  for (let i = 0; i < length; i++) {
    out += pool[randomInt(pool.length)];
  }
  return out;
}
