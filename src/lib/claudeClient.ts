// Anthropic Claude API 클라이언트
// 브라우저에서 직접 호출합니다. (settingsStore에 보관된 API Key 사용)
//
// 주의:
// - API 키는 사용자 컴퓨터의 IndexedDB에만 저장됩니다.
// - 브라우저에서 직접 호출하려면 Anthropic 측에서 dangerously-allow-browser
//   헤더가 필요합니다. 학교 내부망에서만 사용하는 등 보안 환경을 고려하세요.
// - 운영 환경에서는 가급적 백엔드 프록시 경유를 권장합니다.

const ENDPOINT = "https://api.anthropic.com/v1/messages";

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ClaudeCallOptions {
  apiKey: string;
  model?: string;
  system?: string;
  messages: ClaudeMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface ClaudeResponse {
  text: string;
  model: string;
  raw: any;
}

export async function callClaude(opts: ClaudeCallOptions): Promise<ClaudeResponse> {
  const {
    apiKey,
    model = "claude-sonnet-4-6",
    system,
    messages,
    maxTokens = 2000,
    temperature = 0.7,
  } = opts;

  if (!apiKey) {
    throw new Error("API 키가 설정되어 있지 않습니다. 설정 페이지에서 입력해주세요.");
  }

  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    temperature,
    messages,
  };
  if (system) body.system = system;

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Claude API 오류 (${res.status}): ${text}`);
  }

  const data = await res.json();
  const text = (data.content ?? [])
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n")
    .trim();

  return { text, model: data.model ?? model, raw: data };
}
