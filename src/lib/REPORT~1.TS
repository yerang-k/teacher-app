// 보고서 유형별 시스템 프롬프트와 사용자 프롬프트를 만들어 주는 헬퍼.
// 학교생활기록부에 그대로 옮길 수 있도록 사실 기반·완곡한 어조를 강조합니다.

import { db } from "@/db";
import type {
  AttendanceRecord,
  BehaviorNote,
  ReportType,
  SchoolClass,
  Student,
} from "@/types";

export const SYSTEM_PROMPT = `당신은 대한민국 고등학교 국어 교사를 돕는 보조 AI입니다.
교사가 제공한 사실 자료(출결, 행동특성 관찰 기록, 수업 활동 등)만을 근거로
학교생활기록부·세부능력 및 특기사항·종합의견에 사용할 수 있는 문장을 작성합니다.

규칙:
- 사실에 없는 내용을 추측하거나 미화하지 마세요.
- '~함', '~을 보임', '~하였음' 등 NEUC 문체(개조식)에 맞추되, 자연스러운 한국어로 작성하세요.
- 특정 종교·정치·외모·가정사에 대한 평가는 작성하지 않습니다.
- 학생을 비교(예: "다른 학생보다")하는 표현을 쓰지 않습니다.
- 결과물은 곧바로 학생부 또는 보고용 문서에 붙여넣을 수 있는 형식이어야 합니다.
- 출력 형식 안내가 주어지면 그 형식을 그대로 따릅니다.`;

/** 학생별 컨텍스트(출결+행동기록)를 문자열로 정리 */
async function buildStudentContext(studentId: string, from: string, to: string) {
  const [student, records, notes] = await Promise.all([
    db.students.get(studentId),
    db.attendance
      .where("studentId")
      .equals(studentId)
      .filter((r) => r.date >= from && r.date <= to)
      .toArray(),
    db.behaviorNotes
      .where("studentId")
      .equals(studentId)
      .filter((n) => n.date >= from && n.date <= to)
      .sortBy("date"),
  ]);

  if (!student) return "(학생 정보 없음)";

  const attendanceSummary = summarizeAttendance(records);
  const noteLines = notes
    .map(
      (n) =>
        `- [${n.date}] (${n.category}/${n.positive ? "긍정" : "관찰"}) ${n.content}`
    )
    .join("\n");

  return `## 학생 정보
- 이름: ${student.name}
- 출석번호: ${student.number}

## 출결 요약 (${from} ~ ${to})
${attendanceSummary}

## 행동특성·상담 기록
${noteLines || "(기록 없음)"}`;
}

function summarizeAttendance(records: AttendanceRecord[]): string {
  if (records.length === 0) return "(기록 없음)";
  const tally: Record<string, number> = {};
  for (const r of records) tally[r.status] = (tally[r.status] ?? 0) + 1;
  return Object.entries(tally)
    .map(([k, v]) => `- ${k}: ${v}회`)
    .join("\n");
}

async function buildClassContext(classId: string, from: string, to: string) {
  const [klass, students, notes] = await Promise.all([
    db.classes.get(classId),
    db.students.where("classId").equals(classId).toArray(),
    db.behaviorNotes
      .where("classId")
      .equals(classId)
      .filter((n) => n.date >= from && n.date <= to)
      .toArray(),
  ]);
  if (!klass) return "(학급 정보 없음)";

  const studentLines = students
    .sort((a, b) => a.number - b.number)
    .map((s) => `${s.number}. ${s.name}`)
    .join(", ");

  const noteByStudent = new Map<string, BehaviorNote[]>();
  for (const n of notes) {
    const arr = noteByStudent.get(n.studentId) ?? [];
    arr.push(n);
    noteByStudent.set(n.studentId, arr);
  }
  const highlights = students
    .map((s) => {
      const arr = noteByStudent.get(s.id) ?? [];
      if (arr.length === 0) return null;
      const top = arr.slice(0, 3).map((n) => `· ${n.content}`).join("\n");
      return `- ${s.name}\n${top}`;
    })
    .filter(Boolean)
    .join("\n\n");

  return `## 학급 정보
- ${klass.grade}학년 ${klass.classNumber}반 (${
    klass.homeroom ? "담임" : klass.subject
  })
- 인원: ${students.length}명

## 학생 명단
${studentLines}

## 학급 내 주요 관찰 기록 (${from} ~ ${to})
${highlights || "(기록 없음)"}`;
}

export interface ReportRequest {
  type: ReportType;
  title: string;
  targetIds: string[]; // 학생 또는 학급 id
  period: { from: string; to: string };
  userInstruction?: string;
}

export async function buildReportMessages(req: ReportRequest): Promise<{
  system: string;
  userPrompt: string;
}> {
  const { type, targetIds, period, userInstruction } = req;
  const { from, to } = period;

  let context = "";
  let formatHint = "";

  switch (type) {
    case "학생개별": {
      const parts = await Promise.all(
        targetIds.map((id) => buildStudentContext(id, from, to))
      );
      context = parts.join("\n\n---\n\n");
      formatHint = `위 자료를 바탕으로 학생별로 다음 항목을 작성하세요.
1) 학습태도 및 수업 참여
2) 행동특성 및 교우관계
3) 종합 의견 (3~5문장, 개조식)
각 학생을 H2 헤더("## 학생이름")로 구분합니다.`;
      break;
    }
    case "학급전체": {
      const parts = await Promise.all(
        targetIds.map((id) => buildClassContext(id, from, to))
      );
      context = parts.join("\n\n---\n\n");
      formatHint = `위 자료를 바탕으로 학급 전체에 대한 종합 보고서를 작성하세요.
- 학급의 강점과 보완점
- 주목할 학생 사례 3~5명 (개인정보 보호: 학생부 가능 수준의 표현)
- 다음 달 지도 계획 제안 (불릿 3~5개)`;
      break;
    }
    case "행동특성요약": {
      const parts = await Promise.all(
        targetIds.map((id) => buildStudentContext(id, from, to))
      );
      context = parts.join("\n\n---\n\n");
      formatHint = `학교생활기록부 "행동특성 및 종합의견"란에 사용 가능한 형태로
학생별로 250~400자 이내의 한 문단으로 작성하세요. 학생을 H2로 구분.`;
      break;
    }
    case "출결분석": {
      const parts = await Promise.all(
        targetIds.map((id) => buildStudentContext(id, from, to))
      );
      context = parts.join("\n\n---\n\n");
      formatHint = `각 학생의 출결 패턴을 분석하고, 우려되는 부분과
추가 상담이 필요한지 여부를 정리하세요. 마지막에 학급 단위 요약 추가.`;
      break;
    }
    case "수업분석": {
      // 수업 데이터를 컨텍스트에 추가
      const lessons = await db.lessons
        .where("classId")
        .anyOf(targetIds)
        .filter((l) => l.date >= from && l.date <= to)
        .toArray();
      context = `## 수업 기록 (${from} ~ ${to})
총 ${lessons.length}차시

${lessons
  .sort((a, b) => a.date.localeCompare(b.date))
  .map(
    (l) =>
      `- [${l.date} ${l.period}교시] ${l.unit} / ${l.topic} (${l.status})${
        l.reflection ? `\n  성찰: ${l.reflection}` : ""
      }`
  )
  .join("\n")}`;
      formatHint = `위 수업 기록을 바탕으로
1) 진도 진행 상황
2) 단원별 학습 활동 요약
3) 다음 차시 개선 제안
순서로 보고서를 작성하세요.`;
      break;
    }
    case "학기말종합": {
      const studentParts = await Promise.all(
        targetIds.map((id) => buildStudentContext(id, from, to))
      );
      context = studentParts.join("\n\n---\n\n");
      formatHint = `학기말 학부모 안내용 종합 의견을 작성하세요.
- 학생별 H2 헤더
- 학습·생활·진로 영역별 1~2문장
- 마지막에 가정에서의 협조 요청 1문장`;
      break;
    }
  }

  const userPrompt = `${context}

# 작성 지침
${formatHint}

${userInstruction ? `# 추가 요청\n${userInstruction}` : ""}`;

  return { system: SYSTEM_PROMPT, userPrompt };
}

/** 보고서 유형별 한국어 라벨 */
export const REPORT_TYPE_LABEL: Record<ReportType, string> = {
  학생개별: "학생 개별 보고",
  학급전체: "학급 전체 종합",
  수업분석: "수업·진도 분석",
  출결분석: "출결 분석",
  행동특성요약: "행동특성·종합의견 초안",
  학기말종합: "학기말 종합 보고",
};
