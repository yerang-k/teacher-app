// 서비스워커: 설치형 앱(PWA) 조건 충족 + 삼성노트 등의 '공유' 수신 처리.
// 앱 셸은 캐싱하지 않는다(예전 버전이 남아 업데이트가 안 보이는 문제 방지).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// 공유(Web Share Target)로 넘어온 파일만 가로챈다.
// multipart POST를 받아 shared-inbox 캐시에 넣고, 앱의 /memos로 리디렉션한다.
// 그 외 요청은 respondWith를 호출하지 않아 네트워크가 그대로 처리한다(캐싱 없음).
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === "POST" && url.pathname === "/share-target") {
    event.respondWith(handleShare(event.request));
  }
});

async function handleShare(request) {
  try {
    const form = await request.formData();
    // 필드 이름과 무관하게 넘어온 모든 파일을 받는다(삼성노트가 다른 이름으로 보내는 경우 대비)
    const entries = [...form.entries()];
    const ct = (request.headers.get("content-type") || "").split(";")[0];
    const files = entries.map(([, v]) => v).filter((v) => typeof v !== "string" && v.size > 0);
    // 진단용: 실제로 무엇이 왔는지 (필드명:형식:크기)
    const info = entries.map(([k, v]) => (typeof v === "string" ? `${k}=텍스트${v.length}자` : `${k}=${v.type || "?"}/${v.size}B`)).join(", ");
    const diag = `SW v11, 요청형식=${ct || "없음"}, 항목=${entries.length}개${info ? ", " + info : ""}`;
    // 삼성노트 '텍스트로 공유'는 파일 없이 title/text만 온다 → 함께 보관
    const text = [form.get("title"), form.get("text")].filter((v) => typeof v === "string" && v.trim());
    const cache = await caches.open("shared-inbox");
    // 이전에 남은 공유 파일 정리
    for (const req of await cache.keys()) await cache.delete(req);
    let i = 0;
    for (const f of files) {
      await cache.put(
        new Request(`/__shared__/${i++}`),
        new Response(f, {
          headers: {
            "content-type": f.type || "application/octet-stream",
            "x-filename": encodeURIComponent(f.name || "삼성노트 필기"),
          },
        })
      );
    }
    if (text.length) {
      await cache.put(
        new Request("/__shared_text__"),
        new Response(JSON.stringify({ title: text.length > 1 ? text[0] : "", text: text[text.length - 1] }), {
          headers: { "content-type": "application/json" },
        })
      );
    }
    return Response.redirect("/memos?shared=1&info=" + encodeURIComponent(diag), 303);
  } catch (e) {
    return Response.redirect("/memos?shared=error&msg=" + encodeURIComponent(String(e && e.message || e)), 303);
  }
}
