import { useEffect } from 'react';
import { AlertCircle, CheckCircle2, XIcon } from './Icons';

export default function Toast({ message, onClose }) {
  const text = String(message || '');
  const tone = (() => {
    // 简单启发式：成功提示走绿色；失败/错误走红色；其余保持中性。
    if (/失败|错误|异常|无法|无权限|不存在|超时/i.test(text)) return 'danger';
    if (/^已/.test(text) || /成功/.test(text)) return 'success';
    return 'neutral';
  })();

  useEffect(() => {
    if (!onClose) return;
    if (tone !== 'success') return;
    const t = window.setTimeout(() => onClose(), 3000);
    return () => window.clearTimeout(t);
  }, [tone, text, onClose]);

  if (!message) return null;

  const icon =
    tone === 'success' ? (
      <CheckCircle2 className="w-5 h-5 text-[#34C759] flex-shrink-0" />
    ) : (
      <AlertCircle className="w-5 h-5 text-[#FF3B30] flex-shrink-0" />
    );

  const wrapperClass = (() => {
    if (tone === 'success') return 'bg-[#34C759]/90 border-white/20';
    if (tone === 'danger') return 'bg-[#FF3B30]/90 border-white/20';
    return 'bg-[#1D1D1F]/90 border-white/10';
  })();

  const closeBtnClass = (() => {
    if (tone === 'success') return 'bg-white/15 hover:bg-white/25';
    if (tone === 'danger') return 'bg-white/15 hover:bg-white/25';
    return 'bg-white/10 hover:bg-white/20';
  })();

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[200] slide-fade">
      <div className={`${wrapperClass} backdrop-blur-2xl text-white pl-5 pr-2.5 py-3 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.12)] border flex items-center gap-3 max-w-[90vw]`}>
        {icon}
        <span className="font-bold tracking-tight text-[14px] truncate">{text}</span>
        <button
          onClick={onClose}
          className={`${closeBtnClass} transition-all active:scale-[0.95] p-2 rounded-full ml-1 flex-shrink-0`}
          aria-label="关闭"
        >
          <XIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
