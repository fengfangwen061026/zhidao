import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { booksApi } from '../api/client';
import Presentation from '../components/Presentation';
import { ResolvedImg } from '../components/Resolved';
import {
  Loader2,
  AlertCircle,
  Presentation as PresentationIcon,
  PlayIcon,
  Sparkles,
} from '../components/Icons';

/**
 * 公开分享落地页。
 *
 * 打开 `/share/:bookId` 时先渲染一个"课程概览"页（封面 + 页面列表 + 投屏播放按钮），
 * 用户点击"投屏播放" / "继续播放" / 点击某页卡片后，才用原 `<Presentation />`
 * 进入全屏播放。这一下点击同时：
 * 1) 触发浏览器 Fullscreen API 所需的 user gesture
 * 2) 解锁 autoplay 策略，让音频能自动播放
 * 3) 让用户先看一眼课程有几页、是啥内容，再决定从哪儿开始
 */
export default function SharePresentPage() {
  const { bookId } = useParams();
  const [book, setBook] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [entered, setEntered] = useState(false);
  const [startIndex, setStartIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    booksApi
      .share(bookId)
      .then((r) => {
        if (cancelled) return;
        const data = r.data;
        if (
          data &&
          typeof data === 'object' &&
          data.book &&
          Array.isArray(data.characters)
        ) {
          setBook(data.book);
          setCharacters(data.characters);
        } else {
          setBook(data);
          setCharacters([]);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.response?.data?.detail || '课程加载失败或链接无效');
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  useEffect(() => {
    if (book) document.title = `${book.original_filename || '未命名绘本'} · 投屏播放`;
  }, [book]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-white/80" />
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6 text-center">
        <AlertCircle className="w-14 h-14 text-[#FF3B30] mb-5" />
        <h1 className="text-[22px] font-black tracking-tight mb-2">无法打开这个分享</h1>
        <p className="text-[14px] font-medium text-white/60 max-w-sm leading-relaxed">
          {error || '链接已失效，请联系分享者重新复制链接。'}
        </p>
      </div>
    );
  }

  if (!book.pages?.length) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-6 text-center">
        <p className="text-[14px] font-medium text-white/60">这门课程还没有任何内容。</p>
      </div>
    );
  }

  if (entered) {
    return (
      <Presentation
        pages={book.pages}
        startIndex={startIndex}
        onExit={() => setEntered(false)}
        bookId={bookId}
        characters={characters}
      />
    );
  }

  const handlePlay = (idx = 0) => {
    setStartIndex(idx);
    setEntered(true);
  };

  return (
    <ShareOverview
      book={book}
      onPlay={handlePlay}
    />
  );
}

function ShareOverview({ book, onPlay }) {
  const createdLabel = useMemo(() => formatCreatedAt(book.created_at), [book.created_at]);
  const title = book.original_filename || '未命名绘本';
  const pages = book.pages || [];
  const coverPage = pages[0];

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      {/* 顶栏 */}
      <header className="max-w-[1040px] mx-auto px-8 pt-10 pb-6 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-[28px] font-black tracking-tight truncate">{title}</h1>
          <p className="text-[13px] font-medium text-white/50 mt-2">
            {pages.length} 页{createdLabel ? ` · 创建于 ${createdLabel}` : ''}
          </p>
        </div>
        <button
          onClick={() => onPlay(0)}
          className="shrink-0 flex items-center gap-2 px-4 h-10 rounded-full bg-white text-[#0A0A0F] text-[13px] font-bold tracking-tight hover:bg-white/90 active:scale-[0.98] transition-all"
        >
          <PresentationIcon className="w-4 h-4" />
          投屏播放
        </button>
      </header>

      {/* 主体 */}
      <main className="max-w-[1040px] mx-auto px-8 pb-10 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        {/* 封面 + 简介 */}
        <section className="rounded-[28px] bg-white/[0.04] border border-white/[0.06] overflow-hidden">
          <CoverPreview page={coverPage} onPlay={() => onPlay(0)} />
          <div className="p-6 flex items-start gap-5">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/40 mb-1.5">
                课程简介
              </p>
              <p className="text-[13px] font-medium leading-relaxed text-white/70">
                这是一个公开分享的课程，点击右上角「投屏播放」即可
                进入全屏演示。
              </p>
            </div>
            <button
              onClick={() => onPlay(0)}
              className="shrink-0 flex items-center gap-2 px-4 h-10 rounded-full bg-gradient-to-r from-[#0071E3] to-[#5AC8FA] text-white text-[13px] font-bold tracking-tight shadow-[0_10px_28px_-8px_rgba(0,113,227,0.7)] hover:brightness-110 active:scale-[0.98] transition-all"
            >
              <PlayIcon className="w-3.5 h-3.5" />
              继续播放
            </button>
          </div>
        </section>

        {/* 页面列表 */}
        <aside className="rounded-[28px] bg-white/[0.04] border border-white/[0.06] p-3 h-fit lg:max-h-[560px] lg:overflow-y-auto thin-scroll">
          <p className="px-3 pt-2 pb-3 text-[13px] font-black tracking-tight text-white/80">页面列表</p>
          <ul className="flex flex-col gap-1.5">
            {pages.map((p, idx) => (
              <li key={p.id ?? p.page_number}>
                <button
                  onClick={() => onPlay(idx)}
                  className="group w-full flex items-center gap-3 pl-2 pr-3 py-2.5 rounded-2xl hover:bg-white/[0.05] transition-colors text-left"
                >
                  <PageThumbBadge page={p} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold tracking-tight text-white/90 truncate">
                      第 {p.page_number} 页
                    </p>
                    <p className="text-[11px] font-medium text-white/40 truncate">
                      {describePageType(p)}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </main>

      <footer className="max-w-[1040px] mx-auto px-8 pb-10 text-center">
        <p className="text-[12px] font-medium text-white/30">
          提示：这是公开分享页面，无需登录即可访问。
        </p>
      </footer>
    </div>
  );
}

function CoverPreview({ page, onPlay }) {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
  }, [page?.page_number, page?.image_url, page?.thumbnail_url, page?.video_url, page?.page_type]);

  const baseClass = 'relative aspect-[16/10] w-full overflow-hidden';
  if (!page) {
    return <div className={`${baseClass} bg-white/5`} />;
  }

  // 互动网页：小尺寸 srcdoc 预览容易变形，用素雅渐变 + 文案代替
  if (page.page_type === 'interactive') {
    return (
      <div
        className={`${baseClass} bg-gradient-to-br from-violet-600 via-fuchsia-500 to-pink-500 flex items-center justify-center`}
      >
        <div className="text-center px-6">
          <Sparkles className="w-10 h-10 mx-auto mb-3 text-white/90" />
          <p className="text-[18px] font-black tracking-tight">
            {page.step_title || 'AI 互动网页'}
          </p>
          {page.step_description && (
            <p className="text-[12px] font-medium text-white/75 mt-2 line-clamp-2 max-w-[420px]">
              {page.step_description}
            </p>
          )}
        </div>
        <PlayOverlay onClick={onPlay} />
      </div>
    );
  }

  if (page.page_type === 'video' && page.video_url) {
    const VIDEO_PLACEHOLDER_POSTER =
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">' +
          '<defs>' +
            '<linearGradient id="g" x1="0" x2="1" y1="0" y2="1">' +
              '<stop offset="0" stop-color="#0B1220"/>' +
              '<stop offset="1" stop-color="#111827"/>' +
            '</linearGradient>' +
          '</defs>' +
          '<rect width="640" height="360" fill="url(#g)"/>' +
          '<circle cx="320" cy="180" r="56" fill="rgba(255,255,255,0.10)"/>' +
          '<path d="M308 154 L308 206 L356 180 Z" fill="rgba(255,255,255,0.75)"/>' +
        '</svg>'
      );
    return (
      <div className={`${baseClass} bg-black`}>
        {/* 概览页不主动加载视频：避免出现“黑屏 + 抢带宽”。只展示 poster 占位即可。 */}
        <div className="relative w-full h-full">
          <ResolvedImg
            src={page.image_url || page.thumbnail_url || VIDEO_PLACEHOLDER_POSTER}
            alt="视频封面"
            className="w-full h-full object-cover opacity-95"
            onLoad={() => setLoading(false)}
            onError={() => setLoading(false)}
          />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <Loader2 className="w-10 h-10 animate-spin text-white/80" />
            </div>
          )}
        </div>
        <PlayOverlay onClick={onPlay} />
      </div>
    );
  }

  if (page.image_url) {
    return (
      <div className={`${baseClass} bg-black`}>
        <div className="relative w-full h-full">
          <ResolvedImg
            src={page.image_url}
            alt="封面"
            className="w-full h-full object-cover"
            onLoad={() => setLoading(false)}
            onError={() => setLoading(false)}
          />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <Loader2 className="w-10 h-10 animate-spin text-white/80" />
            </div>
          )}
        </div>
        <PlayOverlay onClick={onPlay} />
      </div>
    );
  }

  return <div className={`${baseClass} bg-white/5`} />;
}

function PlayOverlay({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="group absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/30 transition-colors"
      aria-label="开始播放"
    >
      <span className="opacity-80 group-hover:opacity-100 scale-95 group-hover:scale-100 transition-all w-16 h-16 rounded-full bg-white/90 text-[#0A0A0F] flex items-center justify-center shadow-2xl">
        <PlayIcon className="w-7 h-7" />
      </span>
    </button>
  );
}

function PageThumbBadge({ page }) {
  const badge = `P${page.page_number}`;
  if (page.page_type === 'interactive') {
    return (
      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white text-[11px] font-black tracking-tight shrink-0">
        {badge}
      </div>
    );
  }
  if (page.page_type === 'video') {
    return (
      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-[11px] font-black tracking-tight shrink-0">
        {badge}
      </div>
    );
  }
  if (page.image_url) {
    return (
      <div className="w-11 h-11 rounded-xl overflow-hidden relative shrink-0 bg-black">
        <ResolvedImg src={page.image_url} alt="" className="w-full h-full object-cover" />
        <span className="absolute inset-0 bg-black/30 flex items-center justify-center text-[10px] font-black text-white">
          {badge}
        </span>
      </div>
    );
  }
  return (
    <div className="w-11 h-11 rounded-xl bg-white/[0.06] flex items-center justify-center text-white/60 text-[11px] font-black tracking-tight shrink-0">
      {badge}
    </div>
  );
}

function describePageType(page) {
  switch (page.page_type) {
    case 'interactive':
      return page.step_title ? `互动 · ${page.step_title}` : 'AI 互动网页';
    case 'video':
      return '视频页';
    default:
      return '绘本页';
  }
}

function formatCreatedAt(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
