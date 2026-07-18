import type { CSSProperties } from "react";

type SplitTextProps = {
  className?: string;
  lines: readonly string[];
};

type SplitCharacterStyle = CSSProperties & {
  "--split-index": number;
};

export function SplitText({ className = "", lines }: SplitTextProps) {
  let characterIndex = 0;

  return <span className={`split-text ${className}`.trim()} aria-hidden="true">
    {lines.map((line, lineIndex) => <span className="split-text-line" key={`${line}-${lineIndex}`}>
      {Array.from(line).map((character) => {
        const index = characterIndex++;
        const style: SplitCharacterStyle = { "--split-index": index };
        return <span className="split-text-character" style={style} key={`${character}-${index}`}>{character}</span>;
      })}
    </span>)}
  </span>;
}
