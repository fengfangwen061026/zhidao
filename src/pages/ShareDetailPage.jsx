import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { booksApi } from '../api/client';
import { AlertCircle, Loader2, Presentation as PresentationIcon } from '../components/Icons';
import { ResolvedImg } from '../components/Resolved';

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

export default function ShareDetailPage() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    booksApi
      .share(bookId)
      .then((r) => {
        if (cancelled) return;
        const data = r.data;
        if (data && typeof data === 'object' && data.book) {
          setBook(data.book);
        } else {
          setBook(data);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.response?.data?.detail || '课程详情加载失败或链接无效');
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  useEffect(() => {
    if (book) document.title = `${book.original_filename} · 课程详情`;
  }, [book]);

  const pageCount = book?.pages?.length || book?.pages_count || 0;
  const hasContent = Boolean(pageCount);

  const preview = useMemo(() => {
    const pages = book?.pages || [];
    const first = pages.find((p) => p?.image_url || p?.thumbnail_url) || pages[0];
    if (!first) return null;
    if (first.page_type === 'interactive') return { kind: 'interactive', title: first.step_title || 'AI 互动网页' };
    if (first.page_type === 'video') return { kind: 'video', url: first.image_url || first.thumbnail_url || null };
    return { kind: 'image', url: first.image_url || first.thumbnail_url || null };
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
        <h1 className="text-[22px] font-black tracking-tight mb-2">无法打开课程详情</h1>
        <p className="text-[14px] font-medium text-white/60 max-w-sm leading-relaxed">
          {error || '链接已失效，请联系分享者重新复制链接。'}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-[960px] mx-auto px-5 py-10">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[26px] sm:text-[32px] font-black tracking-tight truncate">
              {book.original_filename}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] font-semibold text-white/60">
              <span>{pageCount} 页</span>
              {book.updated_at && <span>更新于 {formatDate(book.updated_at)}</span>}
              {book.created_at && <span>创建于 {formatDate(book.created_at)}</span>}
            </div>
          </div>
          <button
            onClick={() => navigate(`/share/${bookId}`)}
            disabled={!hasContent}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white text-black font-black tracking-tight shadow-sm hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            title="进入投屏播放"
          >
            <PresentationIcon className="w-5 h-5" />
            投屏播放
          </button>
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-12 gap-6">
          <div className="sm:col-span-7">
            <div className="rounded-[28px] overflow-hidden border border-white/12 bg-white/5 shadow-[0_28px_80px_rgba(0,0,0,0.45)]">
              <div className="aspect-[16/10] bg-black flex items-center justify-center">
                {preview?.url ? (
                  <ResolvedImg src={preview.url} alt="" className="w-full h-full object-contain" draggable="false" />
                ) : (
                  <div className="text-center px-6">
                    <div className="text-[14px] font-black text-white/80">暂无封面预览</div>
                    <div className="text-[12px] font-semibold text-white/45 mt-1">
                      {preview?.kind === 'interactive' ? (preview.title || 'AI 互动网页') : '打开后可直接播放'}
                    </div>
                  </div>
                )}
              </div>
              <div className="px-6 py-5 border-t border-white/10">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[14px] font-black tracking-tight">课程简介</div>
                    <div className="text-[13px] font-semibold text-white/60 mt-1 leading-relaxed">
                      这是一个公开分享的课程。点击右上角「投屏播放」即可进入全屏演示。
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/share/${bookId}`)}
                    disabled={!hasContent}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-white text-black font-black tracking-tight shadow-sm hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    <PresentationIcon className="w-5 h-5" />
                    继续播放
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="sm:col-span-5">
            <div className="rounded-[28px] border border-white/12 bg-white/5 p-6">
              <div className="text-[14px] font-black tracking-tight mb-4">页面列表</div>
              {book.pages?.length ? (
                <div className="space-y-3 max-h-[520px] overflow-y-auto thin-scroll pr-1">
                  {book.pages.map((p) => (
                    <div key={p.page_number} className="flex items-center gap-3 rounded-[18px] bg-black/40 border border-white/10 p-3">
                      <div className="w-14 h-10 rounded-[12px] bg-black/60 overflow-hidden flex items-center justify-center border border-white/10 flex-shrink-0">
                        {p.image_url ? (
                          <ResolvedImg src={p.image_url} alt="" className="w-full h-full object-cover" draggable="false" />
                        ) : (
                          <div className="text-[11px] font-black text-white/40">P{p.page_number}</div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-black tracking-tight">第 {p.page_number} 页</div>
                        <div className="text-[12px] font-semibold text-white/55 mt-0.5 truncate">
                          {p.page_type === 'interactive' ? (p.step_title || 'AI 互动网页') : (p.page_type === 'video' ? '视频页' : '课程页')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[13px] font-semibold text-white/55">这门课程还没有任何页面内容。</div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-10 text-center text-[12px] font-semibold text-white/45">
          提示：这是公开分享页面，无需登录即可访问。
        </div>
      </div>
    </div>
  );
}

