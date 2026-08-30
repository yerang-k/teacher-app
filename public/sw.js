// 최소 서비스워커: 설치형 앱(PWA) 조건만 충족시키고 캐싱은 하지 않는다.
// (캐싱하면 예전 버전이 남아 업데이트가 안 보이는 문제가 생기므로 일부러 안 함.
//  fetch 이벤트는 아무 것도 가로채지 않고 네트워크가 그대로 처리하게 둔다.)
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
