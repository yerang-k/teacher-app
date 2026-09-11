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
    const files = form.getAll("file").filter((f) => f && f.size > 0);
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
    return Response.redirect("/memos?shared=1", 303);
  } catch {
    return Response.redirect("/memos", 303);
  }
}
