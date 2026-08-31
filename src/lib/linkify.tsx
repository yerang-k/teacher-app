import type { ReactNode } from "react";

const URL_REGEX = /(https?:\/\/[^\s<>"'）)\]]+)/g;

/** 텍스트 안의 URL을 찾아 클릭 가능한 링크로 바꿔줍니다. (원문 그대로 보여줘야 하는 곳에서 사용) */
export function linkifyText(text: string): ReactNode[] {
  // capturing group이 하나이므로 split 결과는 [일반텍스트, URL, 일반텍스트, URL, ...] 순서가 됩니다.
  const parts = text.split(URL_REGEX);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 underline break-all hover:text-blue-800"
        onClick={(e) => e.stopPropagation()}
      >
        {part}
      </a>
    ) : (
      part
    )
  );
}
