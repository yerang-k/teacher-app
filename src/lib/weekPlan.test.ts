// 실행: node src/lib/weekPlan.test.ts   (Node 24 타입 스트리핑, 프레임워크 없음)
import assert from "node:assert";
import { planWeek, type PlanInput } from "./weekPlan.ts";

// 월~금. 실제 요일: 월=1 ... 금=5
const WEEK = ["01-mon", "02-tue", "03-wed", "04-thu", "05-fri"];
const weekdayOf = (d: string) => WEEK.indexOf(d) + 1; // 1~5

const items = [
  { unit: "1단원", topic: "차시A" },
  { unit: "1단원", topic: "차시B" },
  { unit: "2단원", topic: "차시C" },
  { unit: "2단원", topic: "차시D" },
];

// 6반(c6)만 놓고 본다: 월2교시, 수3교시, 금1교시 수업
const slots = [
  { dayOfWeek: 1, period: 2, classId: "c6" },
  { dayOfWeek: 3, period: 3, classId: "c6" },
  { dayOfWeek: 5, period: 1, classId: "c6" },
];
const base: PlanInput = {
  weekDays: WEEK,
  dayApplied: {},
  slots,
  classLabels: { c6: "1-6" },
  existing: new Set(),
  skip: {},
  items,
  progress: {},
  weekdayOf,
};

const assigned = (blocks: ReturnType<typeof planWeek>) =>
  blocks.flatMap((b) => b.rows).filter((r) => r.status === "assign");

// 1) 기본: 3칸에 차시 A,B,C 순서대로
{
  const a = assigned(planWeek(base));
  assert.deepStrictEqual(
    a.map((r) => r.item!.topic),
    ["차시A", "차시B", "차시C"],
    "기본 배치 순서"
  );
}

// 2) 쉬는 날: 수요일(수3교시) 건너뛰면 그 칸은 차시 소비 안 함 → 금요일이 차시B
{
  const skip = { "03-wed|c6|3": true };
  const a = assigned(planWeek({ ...base, skip }));
  assert.deepStrictEqual(
    a.map((r) => `${r.slotKey.split("|")[0]}:${r.item!.topic}`),
    ["01-mon:차시A", "05-fri:차시B"],
    "건너뛴 칸은 차시를 소비하지 않고 다음 차시로 밀림"
  );
}

// 3) 진도 밀림 이어가기: 이미 1차시 나간 반은 progress=1 → B,C,D
{
  const a = assigned(planWeek({ ...base, progress: { c6: 1 } }));
  assert.deepStrictEqual(
    a.map((r) => r.item!.topic),
    ["차시B", "차시C", "차시D"],
    "시작 진도 위치부터 이어짐"
  );
}

// 4) 요일 교체: 수요일에 금요일 시간표 운영, 금요일에 수요일 시간표 운영
//    → 수요일에 금(1교시) 수업, 금요일에 수(3교시) 수업. 날짜 순서대로 A,B,C 유지
{
  const dayApplied = { "03-wed": 5, "05-fri": 3 };
  const blocks = planWeek({ ...base, dayApplied });
  const wed = blocks.find((b) => b.date === "03-wed")!;
  const fri = blocks.find((b) => b.date === "05-fri")!;
  assert.strictEqual(wed.rows[0].period, 1, "수요일에 금요일 시간표(1교시) 적용");
  assert.strictEqual(fri.rows[0].period, 3, "금요일에 수요일 시간표(3교시) 적용");
  assert.deepStrictEqual(
    assigned(blocks).map((r) => r.item!.topic),
    ["차시A", "차시B", "차시C"],
    "요일 교체해도 날짜 순 차시 순서 유지"
  );
}

// 5) 휴업(0): 월요일 통째로 건너뛰면 화~금만, 남은 두 칸은 A,B
{
  const dayApplied = { "01-mon": 0 };
  const a = assigned(planWeek({ ...base, dayApplied }));
  assert.deepStrictEqual(
    a.map((r) => r.item!.topic),
    ["차시A", "차시B"],
    "휴업일은 통째로 제외"
  );
}

// 6) 이미 등록된 칸: 월2교시 이미 있으면 소비 안 하고 exists, 수·금이 A,B
{
  const existing = new Set(["01-mon|c6|2"]);
  const blocks = planWeek({ ...base, existing });
  const mon = blocks.find((b) => b.date === "01-mon")!;
  assert.strictEqual(mon.rows[0].status, "exists", "이미 등록된 칸 표시");
  assert.deepStrictEqual(
    assigned(blocks).map((r) => r.item!.topic),
    ["차시A", "차시B"],
    "이미 등록된 칸은 차시 소비 안 함"
  );
}

// 7) 진도 순서 부족: 항목 2개뿐이면 세 번째 칸은 noitem
{
  const a = planWeek({ ...base, items: items.slice(0, 2) });
  const rows = a.flatMap((b) => b.rows);
  assert.strictEqual(
    rows.filter((r) => r.status === "assign").length,
    2,
    "항목 수만큼만 배치"
  );
  assert.strictEqual(
    rows.filter((r) => r.status === "noitem").length,
    1,
    "부족분은 noitem"
  );
}

console.log("weekPlan: 모든 검증 통과 ✅");
