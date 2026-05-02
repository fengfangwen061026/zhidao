import { useEffect, useMemo, useState } from 'react';
import { materialsApi, mediaMaterialsApi } from '../api/client';
import { AlertCircle, FolderOpen, Loader2, Search, Sparkles, XIcon } from './Icons';

function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function ModalShell({ title, subtitle, onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-[170] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[82vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-100 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-bold text-slate-800">{title}</h3>
            {subtitle && (
              <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100 flex-shrink-0"
            title="关闭"
            aria-label="关闭"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="text-center text-[#86868B] text-[13px] font-medium py-14">
      <div className="w-12 h-12 rounded-2xl bg-black/[0.04] mx-auto flex items-center justify-center mb-3">
        <FolderOpen className="w-6 h-6" />
      </div>
      {text}
    </div>
  );
}

function ErrorBanner({ text }) {
  if (!text) return null;
  return (
    <div className="bg-[#FF3B30]/5 border border-[#FF3B30]/10 text-[#FF3B30] text-[13px] font-medium tracking-tight rounded-[12px] p-4 flex items-start gap-3">
      <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="leading-relaxed">{text}</div>
    </div>
  );
}

function SearchBox({ value, onChange, placeholder }) {
  return (
    <div className="relative">
      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-[#0071E3]/40 focus:ring-[3px] focus:ring-[#0071E3]/10 outline-none text-[13px] font-medium text-slate-800 placeholder:text-slate-400 transition-all"
      />
    </div>
  );
}

function MediaTabs({ kind, onChange }) {
  const tabs = [
    { id: 'image', label: '图片' },
    { id: 'video', label: '视频' },
  ];
  return (
    <div className="inline-flex bg-black/[0.05] rounded-full p-1 shadow-inner">
      {tabs.map((t) => {
        const active = kind === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`px-4 py-2 rounded-full text-[12.5px] font-black tracking-tight transition-all ${
              active
                ? 'bg-white text-[#1D1D1F] shadow-[0_2px_10px_rgba(0,0,0,0.08)]'
                : 'text-[#86868B] hover:text-[#1D1D1F]'
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function MediaGrid({ items, onPick }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map((m) => {
        const isVideo = m.kind === 'video';
        return (
          <button
            key={m.id}
            onClick={() => onPick(m)}
            className="text-left border border-black/[0.04] bg-white hover:bg-black/[0.02] hover:border-black/[0.08] rounded-[16px] overflow-hidden transition-all shadow-sm active:scale-[0.99]"
            title="选择并插入"
          >
            <div className="aspect-[16/10] bg-[#F5F5F7]">
              {isVideo ? (
                <video
                  src={m.url}
                  className="w-full h-full object-cover bg-black"
                  muted
                  playsInline
                  preload="metadata"
                />
              ) : (
                <img
                  src={m.thumbnail_url || m.url}
                  alt={m.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              )}
            </div>
            <div className="p-3.5">
              <p className="text-[13.5px] font-black tracking-tight text-[#1D1D1F] line-clamp-2 leading-snug">
                {m.title || '未命名素材'}
              </p>
              {m.description && (
                <p className="text-[12px] font-medium text-[#86868B] line-clamp-2 mt-1 leading-relaxed">
                  {m.description}
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function InteractiveGrid({ items, onPick }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {items.map((mat) => (
        <button
          key={mat.id}
          onClick={() => onPick(mat)}
          className="text-left border border-black/[0.04] bg-white hover:bg-black/[0.02] hover:border-black/[0.08] rounded-[16px] p-4 transition-all shadow-sm active:scale-[0.98]"
          title="选择并插入"
        >
          <div className="flex items-start gap-3 mb-2">
            <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-[#AF52DE] to-[#FF2D55] text-white flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
              <Sparkles className="w-4 h-4" />
            </div>
            <p className="text-[15px] font-bold tracking-tight text-[#1D1D1F] flex-1 line-clamp-2 leading-snug pt-1">
              {mat.title || '未命名素材'}
            </p>
          </div>
          {mat.description && (
            <p className="text-[13px] font-medium text-[#86868B] line-clamp-2 mb-2 leading-relaxed">
              {mat.description}
            </p>
          )}
          <p className="text-[11px] font-bold tracking-tight text-[#86868B]/80 truncate">
            {mat.html_url ? `外链 · ${mat.html_url}` : '内联 HTML'}
          </p>
        </button>
      ))}
    </div>
  );
}

/**
 * PersonalMaterialPicker
 *
 * mode:
 * - "media": 图片/视频素材库
 * - "interactive": 互动网页素材库
 */
export default function PersonalMaterialPicker({
  open,
  mode,
  initialMediaKind = 'image',
  onClose,
  onPick,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const qDebounced = useDebouncedValue(q, 250);

  const [mediaKind, setMediaKind] = useState(initialMediaKind);
  const [mediaItems, setMediaItems] = useState([]);
  const [interactiveItems, setInteractiveItems] = useState([]);

  useEffect(() => {
    if (!open) return;
    setQ('');
    setError('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError('');

    const run = async () => {
      try {
        if (mode === 'media') {
          const r = await mediaMaterialsApi.list(mediaKind);
          if (cancelled) return;
          setMediaItems(r.data || []);
        } else {
          const r = await materialsApi.list();
          if (cancelled) return;
          setInteractiveItems(r.data || []);
        }
      } catch (e) {
        if (cancelled) return;
        setError(e.response?.data?.detail || e.message || '加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [open, mode, mediaKind]);

  const filtered = useMemo(() => {
    const qq = (qDebounced || '').trim().toLowerCase();
    if (!qq) return mode === 'media' ? mediaItems : interactiveItems;
    const list = mode === 'media' ? mediaItems : interactiveItems;
    return (list || []).filter((x) => {
      const text = `${x.title || ''} ${x.description || ''} ${x.original_filename || ''}`.toLowerCase();
      return text.includes(qq);
    });
  }, [qDebounced, mode, mediaItems, interactiveItems]);

  if (!open) return null;

  const title = mode === 'media' ? '从个人素材库选择图片/视频' : '从互动网页素材库选择';
  const subtitle = mode === 'media'
    ? '点击一个素材即可插入到课程页中'
    : '点击一个素材即可插入一页互动网页';

  return (
    <ModalShell title={title} subtitle={subtitle} onClose={onClose}>
      <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <SearchBox value={q} onChange={setQ} placeholder="搜索标题/描述..." />
        </div>
        {mode === 'media' && (
          <div className="flex items-center justify-between gap-3">
            <MediaTabs kind={mediaKind} onChange={setMediaKind} />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 text-[#0071E3] animate-spin" />
          </div>
        )}

        {!loading && <ErrorBanner text={error} />}

        {!loading && !error && filtered.length === 0 && (
          <EmptyState text={qDebounced ? '没有匹配的素材' : '素材库为空'} />
        )}

        {!loading && !error && filtered.length > 0 && (
          mode === 'media'
            ? <MediaGrid items={filtered} onPick={onPick} />
            : <InteractiveGrid items={filtered} onPick={onPick} />
        )}
      </div>
    </ModalShell>
  );
}

