import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(scryptCallback);
export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${hash.toString("hex")}`;
}
export async function verifyPassword(password, stored) {
  const [algorithm, salt, hash] = stored.split(":");
  if (algorithm !== "scrypt" || !salt || !hash) return false;
  const computed = await scrypt(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return (
    computed.length === expected.length && timingSafeEqual(computed, expected)
  );
}
export const tokenHash = (token) =>
  createHash("sha256").update(token).digest("hex");
export function credentials(body, signup = false) {
  const username =
    typeof body?.username === "string"
      ? body.username.trim().toLowerCase()
      : "";
  const password = body?.password;
  if (
    !username ||
    username.length > 254 ||
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 128
  )
    throw Object.assign(
      new Error("아이디와 8~128자의 비밀번호를 입력하세요."),
      { status: 400 },
    );
  if (signup && !/^[a-z0-9][a-z0-9_]{2,23}$/.test(username))
    throw Object.assign(
      new Error(
        "아이디는 영문·숫자·밑줄 3~24자로 입력하세요. 첫 글자는 영문 또는 숫자여야 합니다.",
      ),
      { status: 400 },
    );
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (
    signup &&
    (!name || name.length > 30 || /[\u0000-\u001f\u007f]/.test(name))
  )
    throw Object.assign(new Error("이름은 1~30자로 입력하세요."), {
      status: 400,
    });
  return { username, password, ...(signup ? { name } : {}) };
}
