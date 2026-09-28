export type SiteUser = { id: string; username: string; name: string };
type User = SiteUser;
type Session = { user: User };
type AuthResult = {
  data: { session: Session | null; user: User | null };
  error: Error | null;
};
const listeners = new Set<(event: string, session: Session | null) => void>();
export async function renderRequest<T>(
  path: string,
  body?: unknown,
  method?: string,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: "same-origin",
    method: method ?? (body ? "POST" : "GET"),
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60000),
  });
  const value = await response
    .json()
    .catch(() => ({ error: "서버에 연결하지 못했습니다." }));
  if (!response.ok) throw new Error(value.error ?? "서버 요청이 실패했습니다.");
  return value as T;
}
async function authAction(
  path: string,
  body?: unknown,
  event?: string,
): Promise<AuthResult> {
  try {
    const { user } = await renderRequest<{ user: User | null }>(path, body);
    const session = user ? { user } : null;
    if (event) for (const listener of listeners) listener(event, session);
    return { data: { session, user }, error: null };
  } catch (error) {
    return { data: { session: null, user: null }, error: error as Error };
  }
}
export const renderCloud = {
  auth: {
    getSession: () => authAction("/auth/session"),
    onAuthStateChange(
      callback: (event: string, session: Session | null) => void,
    ) {
      listeners.add(callback);
      return {
        data: {
          subscription: { unsubscribe: () => listeners.delete(callback) },
        },
      };
    },
    signInWithPassword: ({
      username,
      password,
    }: {
      username: string;
      password: string;
    }) => authAction("/auth/login", { username, password }, "SIGNED_IN"),
    signUp: ({
      username,
      name,
      password,
    }: {
      username: string;
      name: string;
      password: string;
      options?: unknown;
    }) => authAction("/auth/signup", { username, name, password }, "SIGNED_IN"),
    async signOut() {
      try {
        await renderRequest("/auth/logout", {});
        for (const callback of listeners) callback("SIGNED_OUT", null);
        return { error: null };
      } catch (e) {
        return { error: e as Error };
      }
    },
    async resetPasswordForEmail(_email: string, _options?: unknown) {
      return {
        error: new Error(
          "Render 테스트 서버는 이메일 비밀번호 재설정을 제공하지 않습니다.",
        ),
      };
    },
    async updateUser(_options: unknown) {
      return {
        error: new Error("이 배포에서는 비밀번호 변경을 제공하지 않습니다."),
      };
    },
  },
};
