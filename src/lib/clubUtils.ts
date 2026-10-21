import type { ClubMember } from "@/types";

/** "3-6-12" 형태의 학년-반-번호 표시. 학년·반 정보가 없으면 빈 문자열. */
export function memberOriginLabel(m: Pick<ClubMember, "grade" | "classNumber" | "number">): string {
  if (!m.grade || !m.classNumber) return "";
  return `${m.grade}-${m.classNumber}${m.number ? `-${m.number}` : ""}`;
}

/** 학년 → 반 → 번호 → 이름 순 정렬 (정보 없는 부원은 뒤로) */
export function sortMembers<T extends ClubMember>(list: T[]): T[] {
  const big = 9999;
  return [...list].sort(
    (a, b) =>
      (a.grade ?? big) - (b.grade ?? big) ||
      (a.classNumber ?? big) - (b.classNumber ?? big) ||
      (a.number ?? big) - (b.number ?? big) ||
      a.name.localeCompare(b.name, "ko")
  );
}

/** 같은 사람으로 볼 키 (중복 추가 방지) */
export function memberKey(m: Pick<ClubMember, "name" | "grade" | "classNumber" | "number">): string {
  return `${m.grade ?? ""}|${m.classNumber ?? ""}|${m.number ?? ""}|${m.name}`;
}

/**
 * 한 줄에 한 명씩 적은 텍스트를 부원 목록으로 바꾼다.
 *   "3-6-12 홍길동" / "3-6 홍길동" / "홍길동"
 */
export function parseMemberLines(text: string): Omit<ClubMember, "id">[] {
  const re = /^\s*(?:(\d)\s*[-\s]\s*(\d{1,2})(?:\s*[-\s]\s*(\d{1,2}))?\s+)?(.+?)\s*$/;
  const out: Omit<ClubMember, "id">[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const m = line.match(re);
    if (!m) continue;
    out.push({
      name: m[4],
      grade: m[1] ? Number(m[1]) : undefined,
      classNumber: m[2] ? Number(m[2]) : undefined,
      number: m[3] ? Number(m[3]) : undefined,
    });
  }
  return out;
}
