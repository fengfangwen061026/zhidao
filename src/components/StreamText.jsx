import { useRef, useEffect } from 'react';

export default function StreamText({ text, streaming }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [text]);

  return (
    <div ref={containerRef} className="stream-box overflow-y-auto w-full">
      <pre className="whitespace-pre-wrap font-sans text-[16px] font-medium leading-relaxed tracking-tight text-[#1D1D1F] m-0 w-full">
        {text}
        {streaming && <span className="inline-block w-2.5 h-5 -mb-1 ml-1.5 bg-[#0071E3] animate-pulse rounded-sm" />}
      </pre>
    </div>
  );
}
