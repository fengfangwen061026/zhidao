const inlineFormat = (text) => {
  const parts = [];
  // 把 ``<br>`` 之类裸标签换成 ``\n``，统一在末尾按换行符拆 React <br/>
  let remaining = String(text || '').replace(/<br\s*\/?>(\s*)/gi, '\n');
  let key = 0;

  const pushText = (s) => {
    if (!s) return;
    const segs = s.split('\n');
    segs.forEach((seg, idx) => {
      if (seg) parts.push(seg);
      if (idx < segs.length - 1) parts.push(<br key={`br${key++}`} />);
    });
  };

  while (remaining.length) {
    const m = remaining.match(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/);
    if (!m) {
      pushText(remaining);
      break;
    }
    pushText(remaining.slice(0, m.index));
    const tok = m[0];
    if (tok.startsWith('**')) {
      parts.push(
        <strong key={`b${key++}`} className="text-[#1D1D1F] font-bold tracking-tight">
          {tok.slice(2, -2)}
        </strong>
      );
    } else if (tok.startsWith('`')) {
      parts.push(
        <code key={`c${key++}`} className="px-1.5 py-0.5 rounded-[6px] bg-black/[0.04] text-[0.9em] font-mono text-[#FF2D55]">
          {tok.slice(1, -1)}
        </code>
      );
    } else {
      const linkMatch = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        parts.push(
          <a
            key={`a${key++}`}
            href={linkMatch[2]}
            target="_blank"
            rel="noreferrer"
            className="text-[#0071E3] font-bold tracking-tight hover:underline underline-offset-4"
          >
            {linkMatch[1]}
          </a>
        );
      }
    }
    remaining = remaining.slice(m.index + tok.length);
  }

  return parts;
};

// 把一行 GFM 表格行 ``| a | b | c |`` 拆成 ['a','b','c']。允许首尾 pipe 缺省。
const splitTableRow = (line) => {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  // pipe 在反引号 / 链接里很罕见，不做转义处理；遇到 \\| 当字面量
  return s.split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, '|').trim());
};

const isTableSeparatorLine = (line) => {
  // | --- | :---: | ---: |
  const cells = splitTableRow(line);
  if (!cells.length) return false;
  return cells.every((c) => /^:?-{3,}:?$/.test(c));
};

const isTableLine = (line) => /^\s*\|.*\|\s*$/.test(line) || /\|/.test(line);

export default function MarkdownView({ source = '', streaming = false, className = '' }) {
  const lines = String(source || '').split('\n');
  const blocks = [];
  let buf = [];

  const flushPara = () => {
    if (!buf.length) return;
    const text = buf.join(' ').trim();
    if (text) blocks.push({ type: 'p', text });
    buf = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();

    if (!line) {
      flushPara();
      continue;
    }

    // GFM 表格：第一行 ``|...|``，第二行 ``|---|---|`` 视为表头+分隔线，
    // 后续连续的 pipe 行作为 body。
    if (
      line.startsWith('|') &&
      i + 1 < lines.length &&
      isTableSeparatorLine(lines[i + 1].trim())
    ) {
      flushPara();
      const header = splitTableRow(line);
      const aligns = splitTableRow(lines[i + 1].trim()).map((c) => {
        const left = c.startsWith(':');
        const right = c.endsWith(':');
        if (left && right) return 'center';
        if (right) return 'right';
        return 'left';
      });
      const rows = [];
      let j = i + 2;
      while (j < lines.length) {
        const next = lines[j].trim();
        if (!next || !next.startsWith('|')) break;
        rows.push(splitTableRow(next));
        j += 1;
      }
      blocks.push({ type: 'table', header, aligns, rows });
      i = j - 1;
      continue;
    }

    if (/^#{1,6}\s/.test(line)) {
      flushPara();
      const level = line.match(/^#+/)[0].length;
      blocks.push({ type: `h${Math.min(level, 4)}`, text: line.replace(/^#+\s/, '') });
      continue;
    }

    if (/^>\s?/.test(line)) {
      flushPara();
      blocks.push({ type: 'quote', text: line.replace(/^>\s?/, '') });
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      flushPara();
      if (blocks.length && blocks[blocks.length - 1].type === 'ul') {
        blocks[blocks.length - 1].items.push(line.replace(/^[-*]\s+/, ''));
      } else {
        blocks.push({ type: 'ul', items: [line.replace(/^[-*]\s+/, '')] });
      }
      continue;
    }

    if (/^\d+[.)、]\s+/.test(line)) {
      flushPara();
      const cleaned = line.replace(/^\d+[.)、]\s+/, '');
      if (blocks.length && blocks[blocks.length - 1].type === 'ol') {
        blocks[blocks.length - 1].items.push(cleaned);
      } else {
        blocks.push({ type: 'ol', items: [cleaned] });
      }
      continue;
    }

    if (/^---+$/.test(line) || /^\*\*\*+$/.test(line)) {
      flushPara();
      blocks.push({ type: 'hr' });
      continue;
    }

    buf.push(raw.trim());
  }
  flushPara();

  return (
    <div className={`markdown-view text-[15px] font-medium leading-relaxed tracking-tight text-[#1D1D1F] ${className}`}>
      {blocks.map((b, i) => {
        if (b.type === 'h1') return <h1 key={i} className="text-[24px] font-bold tracking-tight text-[#1D1D1F] mt-8 mb-4">{inlineFormat(b.text)}</h1>;
        if (b.type === 'h2') return <h2 key={i} className="text-[20px] font-bold tracking-tight text-[#1D1D1F] mt-8 mb-4 pb-2 border-b border-black/[0.04]">{inlineFormat(b.text)}</h2>;
        if (b.type === 'h3') return <h3 key={i} className="text-[18px] font-bold tracking-tight text-[#1D1D1F] mt-6 mb-3">{inlineFormat(b.text)}</h3>;
        if (b.type === 'h4') return <h4 key={i} className="text-[16px] font-bold tracking-tight text-[#1D1D1F] mt-5 mb-2">{inlineFormat(b.text)}</h4>;
        if (b.type === 'quote') return (
          <blockquote key={i} className="my-4 border-l-[4px] border-[#0071E3] bg-[#0071E3]/5 pl-5 pr-4 py-3 rounded-r-[16px] text-[#1D1D1F]">
            {inlineFormat(b.text)}
          </blockquote>
        );
        if (b.type === 'hr') return <hr key={i} className="my-6 border-black/[0.04]" />;
        if (b.type === 'ul') return (
          <ul key={i} className="list-disc pl-6 my-3 space-y-2 marker:text-[#0071E3]">
            {b.items.map((it, j) => <li key={j}>{inlineFormat(it)}</li>)}
          </ul>
        );
        if (b.type === 'ol') return (
          <ol key={i} className="list-decimal pl-6 my-3 space-y-2 marker:text-[#86868B] font-bold">
            {b.items.map((it, j) => <li key={j} className="font-medium text-[#1D1D1F]">{inlineFormat(it)}</li>)}
          </ol>
        );
        if (b.type === 'table') {
          const alignClass = (k) => (
            b.aligns?.[k] === 'center' ? 'text-center'
              : b.aligns?.[k] === 'right' ? 'text-right'
                : 'text-left'
          );
          return (
            <div key={i} className="my-4 overflow-x-auto rounded-[12px] border border-black/[0.06]">
              <table className="w-full text-[14px] border-collapse">
                <thead className="bg-black/[0.03]">
                  <tr>
                    {b.header.map((h, k) => (
                      <th
                        key={k}
                        className={`px-3 py-2 font-bold text-[#1D1D1F] border-b border-black/[0.06] ${alignClass(k)}`}
                      >
                        {inlineFormat(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {b.rows.map((row, ri) => (
                    <tr key={ri} className={ri % 2 ? 'bg-black/[0.015]' : ''}>
                      {row.map((cell, ci) => (
                        <td
                          key={ci}
                          className={`px-3 py-2 align-top text-[#1D1D1F] border-b border-black/[0.04] ${alignClass(ci)}`}
                        >
                          {inlineFormat(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return (
          <p key={i} className="my-3">
            {inlineFormat(b.text)}
            {streaming && i === blocks.length - 1 ? (
              <span className="inline-block w-2 h-4 -mb-0.5 ml-1 bg-[#0071E3] animate-pulse rounded-sm" />
            ) : null}
          </p>
        );
      })}
      {!blocks.length && streaming && (
        <p className="text-[#86868B] text-[15px] font-medium tracking-tight">
          正在生成<span className="inline-block w-2 h-4 -mb-0.5 ml-1.5 bg-[#0071E3] animate-pulse rounded-sm" />
        </p>
      )}
    </div>
  );
}
