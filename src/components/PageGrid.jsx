import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Cover from './Cover';
import { FolderOpen, Maximize, PlayIcon, Plus, Sparkles, Trash2 } from './Icons';
import { useResolvedFileUrl } from '../hooks/useResolvedFileUrl';
import { ResolvedVideo } from './Resolved';

const BLACK_THUMB =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="100%" height="100%" fill="black"/></svg>');

function VideoThumb({ src, alt }) {
  const videoRef = useRef(null);
  const initSeekKeyRef = useRef('');

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !src) return;
    const key = String(src);
    if (initSeekKeyRef.current === key) return;
    initSeekKeyRef.current = key;

    const desiredTime = 0.12; // 第 3 帧附近
    const safeSeek = () => {
      const dur = Number.isFinite(v.duration) ? v.duration : null;
      const t = dur ? Math.min(desiredTime, Math.max(0, dur - 0.001)) : desiredTime;
      try { v.pause(); } catch { /* noop */ }
      try { v.currentTime = t; } catch { /* noop */ }
    };

    const onLoadedMeta = () => safeSeek();
    const onSeeked = () => { try { v.pause(); } catch { /* noop */ } };
    v.addEventListener('loadedmetadata', onLoadedMeta);
    v.addEventListener('seeked', onSeeked);

    // 触发加载；如果 metadata 已经就绪则立即 seek
    try { v.load?.(); } catch { /* noop */ }
    if (v.readyState >= 1) safeSeek();

    return () => {
      v.removeEventListener('loadedmetadata', onLoadedMeta);
      v.removeEventListener('seeked', onSeeked);
    };
  }, [src]);

  return (
    <ResolvedVideo
      ref={videoRef}
      src={src}
      poster={BLACK_THUMB}
      className="w-full h-full object-cover"
      muted
      playsInline
      preload="metadata"
      controls={false}
      disablePictureInPicture
      controlsList="nodownload noplaybackrate noremoteplayback"
      draggable={false}
      tabIndex={-1}
      style={{ pointerEvents: 'none' }}
      aria-label={alt}
    />
  );
}

function PageAudioButton({ audioUrl }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const resolvedAudioUrl = useResolvedFileUrl(audioUrl);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => setPlaying(false);
    audio.addEventListener('ended', onEnded);
    return () => audio.removeEventListener('ended', onEnded);
  }, [resolvedAudioUrl]);

  const toggle = (e) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  if (!audioUrl) return null;

  return (
    <>
      <button
        onClick={toggle}
        className={`absolute bottom-3 left-3 z-10 p-2.5 rounded-full backdrop-blur-md transition-all shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-white active:scale-[0.95] ${
          playing
            ? 'bg-[#5856D6] text-white'
            : 'bg-white/90 text-[#86868B] hover:bg-[#5856D6] hover:text-white'
        }`}
        title={playing ? '暂停' : '试听'}
      >
        {playing ? (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <PlayIcon className="w-4 h-4" />
        )}
      </button>
      <audio ref={audioRef} src={resolvedAudioUrl} preload="none" />
    </>
  );
}

function DeleteButton({ onDelete }) {
  const [confirming, setConfirming] = useState(false);

  const handleClick = (e) => {
    e.stopPropagation();
    if (confirming) {
      onDelete();
      setConfirming(false);
    } else {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`absolute top-3 right-3 z-10 rounded-full backdrop-blur-md transition-all shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-white ${
        confirming
          ? 'bg-[#FF3B30] text-white px-3 py-1.5 text-[12px] font-bold tracking-tight'
          : 'bg-white/90 text-[#86868B] hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 p-2 active:scale-[0.95]'
      }`}
      title={confirming ? '再点一次确认删除' : '删除'}
    >
      {confirming ? '确认删除' : <Trash2 className="w-4 h-4" />}
    </button>
  );
}

/**
 * 两页之间的"+"插入入口。始终在列表里渲染一条占位条，hover 时展开菜单。
 * `insertAfter=0` 代表插到最前，`=N` 代表插到第 N 页之后。
 *
 * 视觉策略：
 * - 默认就给一条浅色的细线 + 半透明的小胶囊，胶囊里写"+ 在这里插入一页"，
 *   而不是空空一条只在 hover 时才出现的 `+`。这样老师扫视页面列表的时候
 *   能直接看到插入入口，不需要靠"猜哪里能点"。
 * - hover/focus 或菜单展开时把胶囊"变实"：高亮蓝色 + 阴影。
 * - 菜单顶部加一条文案明确落点（"插入到第 N 页之后"），互动页选项改成
 *   更老师友好的表达 + 一句"会先创建一张空白互动页"的预期管理。
 */
function InsertDivider({ insertAfter, onInsertMedia, onInsertInteractive, onOpenLibrary }) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef(null);
  const fileInputRef = useRef(null);
  const [hovered, setHovered] = useState(false);
  const [mediaChoiceOpen, setMediaChoiceOpen] = useState(false);

  const cancelClose = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const close = () => {
    cancelClose();
    timerRef.current = setTimeout(() => setOpen(false), 120);
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (file) onInsertMedia?.(insertAfter, file);
    e.target.value = '';
  };

  const positionLabel = insertAfter === 0
    ? '插入到最前面'
    : `插入到第 ${insertAfter} 页之后`;
  const active = open || hovered;

  return (
    <div
      className="relative group -my-1 flex items-center justify-center py-3"
      onMouseEnter={() => { cancelClose(); setHovered(true); }}
      onMouseLeave={() => { setHovered(false); close(); }}
      onFocus={() => { cancelClose(); setHovered(true); }}
      onBlur={() => { setHovered(false); close(); }}
    >
      <div
        className={`w-full h-px rounded-full transition-colors ${
          active ? 'bg-[#0071E3]/30' : 'bg-black/[0.06]'
        }`}
      />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => {
            const next = !v;
            if (!next) setMediaChoiceOpen(false);
            return next;
          });
        }}
        className={`absolute inline-flex items-center gap-1.5 rounded-full backdrop-blur-md transition-all active:scale-[0.97] border h-7 px-3 ${
          active
            ? 'bg-[#0071E3] text-white border-[#0071E3] shadow-[0_8px_24px_rgba(0,113,227,0.28)]'
            : 'bg-white text-[#86868B] border-black/[0.06] shadow-[0_2px_8px_rgba(0,0,0,0.05)] hover:text-[#0071E3]'
        } ${open ? 'ring-4 ring-[#0071E3]/20' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        title={positionLabel}
      >
        <Plus className="w-3.5 h-3.5" />
        <span className="text-[12px] font-bold tracking-tight">
          在这里插入一页
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-full mt-2 z-20 bg-white/98 backdrop-blur-2xl rounded-[18px] shadow-[0_16px_48px_rgba(0,0,0,0.12)] border border-black/[0.04] p-2 w-[268px] text-left"
          onMouseEnter={() => cancelClose()}
          onMouseLeave={close}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2 pt-1 pb-2 border-b border-black/[0.04] mb-1.5">
            <p className="text-[11px] font-black uppercase tracking-wider text-[#86868B]">
              新增一页
            </p>
            <p className="text-[12.5px] font-bold tracking-tight text-[#1D1D1F] mt-0.5">
              {positionLabel}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setMediaChoiceOpen(true);
            }}
            className="w-full flex items-start gap-2.5 p-2 rounded-[14px] text-left transition-colors hover:bg-black/[0.04]"
          >
            <div className="w-10 h-10 rounded-[12px] bg-[#5AC8FA]/10 text-[#5AC8FA] flex items-center justify-center flex-shrink-0 mt-0.5">
              <Plus className="w-5 h-5" />
            </div>
            <div className="pt-0.5 min-w-0">
              <p className="text-[13.5px] font-bold tracking-tight text-[#1D1D1F] leading-tight">
                图片 / 视频
              </p>
              <p className="text-[11.5px] font-medium text-[#86868B] mt-1 leading-snug">
                上传一张图或一段视频做这页内容
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setMediaChoiceOpen(false);
              onInsertInteractive?.(insertAfter);
            }}
            className="w-full flex items-start gap-2.5 p-2 rounded-[14px] hover:bg-black/[0.04] text-left mt-1 transition-colors"
          >
            <div className="w-10 h-10 rounded-[12px] bg-gradient-to-br from-[#AF52DE] to-[#FF2D55] text-white flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="pt-0.5 min-w-0">
              <p className="text-[13.5px] font-bold tracking-tight text-[#1D1D1F] leading-tight">
                互动页 / 小游戏
              </p>
              <p className="text-[11.5px] font-medium text-[#86868B] mt-1 leading-snug">
                打开编辑器，让 AI 帮你做，或从素材库挑现成的
              </p>
              <p className="text-[10.5px] font-medium text-[#AF52DE]/80 mt-1.5 leading-snug">
                会先生成一张空白互动页占位 · 不要可以删
              </p>
            </div>
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handleFile}
      />

      {mediaChoiceOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[180] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setMediaChoiceOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-[20px] shadow-[0_24px_80px_rgba(0,0,0,0.20)] border border-white/20 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-black/[0.04] bg-white/80 backdrop-blur-xl flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="text-[15px] font-black tracking-tight text-[#1D1D1F]">插入图片/视频</h3>
                <p className="text-[12px] font-medium text-[#86868B] mt-1">请选择素材来源</p>
              </div>
              <button
                onClick={() => setMediaChoiceOpen(false)}
                className="w-9 h-9 rounded-full bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center transition-colors active:scale-[0.95] flex-shrink-0"
                aria-label="关闭"
                title="关闭"
              >
                <span className="text-[#86868B] font-black text-[18px] leading-none">×</span>
              </button>
            </div>

            <div className="p-4 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setMediaChoiceOpen(false);
                  fileInputRef.current?.click();
                }}
                className="w-full flex items-center gap-3 p-3 rounded-[16px] border border-black/[0.06] bg-white hover:bg-black/[0.02] transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-[14px] bg-[#5AC8FA]/12 text-[#5AC8FA] flex items-center justify-center flex-shrink-0">
                  <Plus className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-black tracking-tight text-[#1D1D1F]">本地上传</p>
                  <p className="text-[12px] font-medium text-[#86868B] mt-0.5">从电脑选择图片或视频文件</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMediaChoiceOpen(false);
                  onOpenLibrary?.('media', insertAfter);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-[16px] border border-black/[0.06] bg-white hover:bg-black/[0.02] transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-[14px] bg-[#34C759]/12 text-[#34C759] flex items-center justify-center flex-shrink-0">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-black tracking-tight text-[#1D1D1F]">从素材库选择</p>
                  <p className="text-[12px] font-medium text-[#86868B] mt-0.5">复用你已上传的素材</p>
                </div>
              </button>
            </div>

            <div className="px-4 pb-4">
              <button
                onClick={() => setMediaChoiceOpen(false)}
                className="w-full px-4 py-3 rounded-[16px] bg-black/[0.04] hover:bg-black/[0.07] text-[#1D1D1F] font-black tracking-tight transition-colors active:scale-[0.99]"
              >
                取消
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function PageCard({
  page,
  isSelected,
  onPageClick,
  onDeletePage,
  onEnterPresentation,
  idx,
  canDelete,
}) {
  const pageType = page.page_type || 'image';
  const label = `第 ${page.page_number} 页`;
  const hasVideo = Boolean(page?.video_url);
  const resolvedThumb = useResolvedFileUrl(page.image_url || page.thumbnail_url);
  const showVideoThumbByVideo = (pageType === 'video' || hasVideo) && !resolvedThumb && Boolean(page?.video_url);

  return (
    <div
      className={`group @container relative aspect-[16/10] rounded-[16px] @[280px]:rounded-[20px] @[380px]:rounded-[24px] overflow-hidden cursor-pointer transition-all duration-500 border-2 @[280px]:border-[3px] ${
        isSelected
          ? 'border-[#0071E3] ring-[3px] @[280px]:ring-[4px] @[380px]:ring-[6px] ring-[#0071E3]/20 shadow-[0_12px_32px_rgba(0,113,227,0.2)] scale-[0.98]'
          : 'border-black/[0.04] hover:border-[#0071E3]/50 hover:shadow-[0_16px_40px_rgba(0,0,0,0.1)]'
      }`}
      onClick={() => onPageClick(page.page_number)}
    >
      {pageType === 'interactive' ? (
        <div className="w-full h-full bg-gradient-to-br from-[#AF52DE] via-[#FF2D55] to-[#FF9F0A] text-white flex flex-col items-center justify-center px-3 @[280px]:px-4 @[380px]:px-6 text-center transition-transform duration-500 group-hover:scale-105">
          <Sparkles className="w-6 h-6 @[280px]:w-8 @[280px]:h-8 @[380px]:w-10 @[380px]:h-10 opacity-90 mb-2 @[280px]:mb-3 @[380px]:mb-4" />
          <p className="text-[13px] @[280px]:text-[15px] @[380px]:text-[18px] font-black tracking-tight drop-shadow-sm line-clamp-2 leading-snug">
            {page.step_title || 'AI 互动网页'}
          </p>
          {page.step_description && (
            <p className="text-[11px] @[280px]:text-[12px] @[380px]:text-[14px] font-bold tracking-tight opacity-85 mt-1.5 @[380px]:mt-3 line-clamp-2">
              {page.step_description}
            </p>
          )}
        </div>
      ) : (pageType === 'video' || hasVideo) ? (
        <div className="w-full h-full bg-[#1D1D1F] relative overflow-hidden transition-transform duration-500 group-hover:scale-105">
          {showVideoThumbByVideo ? (
            <VideoThumb src={page.video_url} alt={label} />
          ) : (
            // 有封面/缩略图时仍用图片（最省资源，也避免部分触摸端的系统叠层）
            <img
              src={resolvedThumb || BLACK_THUMB}
              alt={label}
              className="w-full h-full object-cover"
              draggable="false"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 @[280px]:w-12 @[280px]:h-12 @[380px]:w-16 @[380px]:h-16 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-sm transition-transform duration-300 group-hover:scale-110">
              <PlayIcon className="w-4 h-4 @[280px]:w-5 @[280px]:h-5 @[380px]:w-6 @[380px]:h-6 text-white ml-1 @[380px]:ml-1.5" />
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full h-full relative transition-transform duration-500 group-hover:scale-105 bg-black/[0.02]">
          <Cover
            src={page.image_url}
            alt={label}
            label={label}
            variant="image"
            className="w-full h-full mix-blend-multiply"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>
      )}

      <div
        className={`absolute top-2.5 left-2.5 @[280px]:top-3.5 @[280px]:left-3.5 @[380px]:top-5 @[380px]:left-5 text-white text-[11px] @[280px]:text-[12px] @[380px]:text-[15px] px-2.5 py-1 @[280px]:px-3 @[280px]:py-1.5 @[380px]:px-4 @[380px]:py-2 rounded-full font-black tracking-tight backdrop-blur-md shadow-sm border transition-all duration-300 ${
          isSelected ? 'bg-[#0071E3] border-[#0071E3]' : 'bg-black/50 border-white/20'
        }`}
      >
        第 {page.page_number} 页
      </div>

      {onEnterPresentation && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEnterPresentation(idx);
          }}
          className="absolute bottom-2.5 right-2.5 @[280px]:bottom-3.5 @[280px]:right-3.5 @[380px]:bottom-5 @[380px]:right-5 z-10 p-2 @[280px]:p-2.5 @[380px]:p-3.5 rounded-full bg-white/90 text-[#1D1D1F] hover:bg-[#0071E3] hover:text-white backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.15)] transition-all duration-300 active:scale-[0.95]"
          title="从这页开始投屏"
        >
          <Maximize className="w-4 h-4 @[280px]:w-5 @[280px]:h-5 @[380px]:w-6 @[380px]:h-6" />
        </button>
      )}

      {onDeletePage && canDelete && (
        <DeleteButton onDelete={() => onDeletePage(page.page_number)} />
      )}
      <PageAudioButton audioUrl={page.audio_url} />
    </div>
  );
}

export default function PageGrid({
  pages,
  onPageClick,
  onDeletePage,
  selectedPage,
  onEnterPresentation,
  onInsertMedia,
  onInsertInteractive,
  onOpenLibrary,
}) {
  const allowInsert = Boolean(onInsertMedia || onInsertInteractive);
  const canDelete = pages.length > 1;

  return (
    <div className="grid grid-cols-1 gap-3">
      {allowInsert && (
        <InsertDivider
          insertAfter={0}
          onInsertMedia={onInsertMedia}
          onInsertInteractive={onInsertInteractive}
          onOpenLibrary={onOpenLibrary}
        />
      )}
      {pages.map((page, idx) => {
        const isSelected = selectedPage === page.page_number;
        return (
          <div key={page.page_number}>
            <PageCard
              page={page}
              isSelected={isSelected}
              onPageClick={onPageClick}
              onDeletePage={onDeletePage}
              onEnterPresentation={onEnterPresentation}
              idx={idx}
              canDelete={canDelete}
            />
            {allowInsert && (
              <InsertDivider
                insertAfter={page.page_number}
                onInsertMedia={onInsertMedia}
                onInsertInteractive={onInsertInteractive}
                onOpenLibrary={onOpenLibrary}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
