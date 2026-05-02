import { useState } from 'react';
import { BookOpen, ImageIcon } from './Icons';
import { useResolvedFileUrl } from '../hooks/useResolvedFileUrl';

const ICON_MAP = {
  book: BookOpen,
  image: ImageIcon,
};

export default function Cover({
  src,
  alt = '',
  label = '',
  variant = 'book',
  className = '',
  imgClassName = '',
  fit = 'contain',
  children,
}) {
  const [brokenSrc, setBrokenSrc] = useState(null);
  const Icon = ICON_MAP[variant] || BookOpen;
  const resolvedSrc = useResolvedFileUrl(src);
  const isBroken = resolvedSrc && brokenSrc === resolvedSrc;
  const showFallback = isBroken || !resolvedSrc;

  const isCover = fit === 'cover';
  const imgClasses = isCover
    ? 'absolute inset-0 w-full h-full object-cover'
    : 'max-w-full max-h-full object-contain mix-blend-multiply';

  // 同时出现 `relative` 和 `absolute` 时，Tailwind 编译出的 `.relative` 在 `.absolute`
  // 之后声明会覆盖后者，导致 Cover 外层 div 变成 relative、尺寸塌成 0，内部绝对定位
  // 的 <img> 跟着缩成 0x0（肉眼看不见但 onLoad 仍会触发）。所以只有当调用方没有自
  // 己指定定位方式时，才补一个 `relative` 作为默认，保证 inset-0 / absolute 子元素
  // 有合适的包含块。
  const callerHasPosition = /(^|\s)(absolute|fixed|sticky|relative|static)(\s|$)/.test(className);
  const positionClass = callerHasPosition ? '' : 'relative';

  return (
    <div className={`${positionClass} overflow-hidden bg-black/[0.03] flex items-center justify-center ${className}`}>
      {showFallback ? (
        <div className="w-full h-full flex flex-col items-center justify-center text-[#86868B]/40 gap-2 px-3">
          <Icon className="w-8 h-8" />
          {label ? <span className="text-[12px] font-bold text-[#86868B]/60 text-center line-clamp-1">{label}</span> : null}
        </div>
      ) : (
        <img
          key={resolvedSrc}
          src={resolvedSrc}
          alt={alt}
          className={`${imgClasses} ${imgClassName}`}
          onError={() => setBrokenSrc(resolvedSrc)}
          loading="lazy"
        />
      )}
      {children}
    </div>
  );
}
