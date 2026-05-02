import { useState, useEffect, useRef, useCallback } from 'react';
import { charactersApi } from '../api/client';
import { Loader2 } from './Icons';
import CharacterChat from './CharacterChat';
import { ResolvedImg } from './Resolved';

const ROLE_COLORS = [
  { bg: 'bg-rose-50', border: 'border-rose-200', badge: 'bg-rose-100 text-rose-700', accent: 'text-rose-600', gradient: 'from-rose-500 to-pink-500' },
  { bg: 'bg-sky-50', border: 'border-sky-200', badge: 'bg-sky-100 text-sky-700', accent: 'text-sky-600', gradient: 'from-sky-500 to-cyan-500' },
  { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700', accent: 'text-amber-600', gradient: 'from-amber-500 to-orange-500' },
  { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', accent: 'text-emerald-600', gradient: 'from-emerald-500 to-teal-500' },
  { bg: 'bg-violet-50', border: 'border-violet-200', badge: 'bg-violet-100 text-violet-700', accent: 'text-violet-600', gradient: 'from-violet-500 to-purple-500' },
  { bg: 'bg-cyan-50', border: 'border-cyan-200', badge: 'bg-cyan-100 text-cyan-700', accent: 'text-cyan-600', gradient: 'from-cyan-500 to-blue-500' },
];

function ChatBubbleIcon({ className }) {
  return (
    <svg className={className || 'w-5 h-5'} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function MicIcon({ className }) {
  return (
    <svg className={className || 'w-4 h-4'} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function CropIcon({ className }) {
  return (
    <svg className={className || 'w-4 h-4'} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.13 1L6 16a2 2 0 0 0 2 2h15" />
      <path d="M1 6.13L16 6a2 2 0 0 1 2 2v15" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Avatar Cropper Modal
// ---------------------------------------------------------------------------

function AvatarCropper({ imageUrl, onConfirm, onCancel }) {
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [start, setStart] = useState(null);
  const [rect, setRect] = useState(null);
  const [preview, setPreview] = useState(null);

  const getPos = useCallback((e) => {
    const el = containerRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: Math.max(0, Math.min(clientX - r.left, r.width)),
      y: Math.max(0, Math.min(clientY - r.top, r.height)),
    };
  }, []);

  const handleDown = useCallback((e) => {
    e.preventDefault();
    const pos = getPos(e);
    setStart(pos);
    setRect(null);
    setPreview(null);
    setDragging(true);
  }, [getPos]);

  const handleMove = useCallback((e) => {
    if (!dragging || !start) return;
    e.preventDefault();
    const pos = getPos(e);
    const x = Math.min(start.x, pos.x);
    const y = Math.min(start.y, pos.y);
    const w = Math.abs(pos.x - start.x);
    const h = Math.abs(pos.y - start.y);
    const side = Math.max(w, h);
    setRect({ x, y, w: side, h: side });
  }, [dragging, start, getPos]);

  const handleUp = useCallback(() => {
    setDragging(false);
    if (!rect || rect.w < 20) {
      setRect(null);
      return;
    }
    const img = imgRef.current;
    const container = containerRef.current;
    if (!img || !container) return;

    const scaleX = img.naturalWidth / container.clientWidth;
    const scaleY = img.naturalHeight / container.clientHeight;

    const canvas = document.createElement('canvas');
    const size = 200;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(
      img,
      rect.x * scaleX, rect.y * scaleY, rect.w * scaleX, rect.h * scaleY,
      0, 0, size, size,
    );
    setPreview(canvas.toDataURL('image/png'));
  }, [rect]);

  useEffect(() => {
    const onMouseUp = () => { if (dragging) handleUp(); };
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchend', onMouseUp);
    return () => {
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchend', onMouseUp);
    };
  }, [dragging, handleUp]);

  return (
    <div className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800">框选角色头像</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">在图片上拖拽选取角色区域</p>
        </div>

        <div className="p-4">
          <div
            ref={containerRef}
            className="relative select-none rounded-lg overflow-hidden border border-slate-200 cursor-crosshair"
            onMouseDown={handleDown}
            onMouseMove={handleMove}
            onTouchStart={handleDown}
            onTouchMove={handleMove}
          >
            <img
              ref={imgRef}
              src={imageUrl}
              alt="原图"
              className="w-full block"
              crossOrigin="anonymous"
              onLoad={() => setImgLoaded(true)}
              draggable={false}
            />
            {!imgLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
                <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
              </div>
            )}
            {rect && (
              <>
                <div className="absolute inset-0 bg-black/40 pointer-events-none" />
                <div
                  className="absolute border-2 border-white rounded-full shadow-lg pointer-events-none"
                  style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
                >
                  <div className="absolute inset-0 rounded-full overflow-hidden">
                    <img
                      src={imageUrl}
                      alt=""
                      className="absolute"
                      draggable={false}
                      style={{
                        width: containerRef.current?.clientWidth,
                        height: containerRef.current?.clientHeight,
                        left: -rect.x,
                        top: -rect.y,
                      }}
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {preview && (
            <div className="mt-4 flex items-center gap-4">
              <div className="flex-shrink-0">
                <p className="text-[11px] text-slate-400 mb-1.5 text-center">预览</p>
                <img src={preview} alt="预览" className="w-16 h-16 rounded-full border-2 border-slate-200 object-cover" />
              </div>
              <div className="flex-1 flex gap-2">
                <button
                  onClick={() => { setRect(null); setPreview(null); }}
                  className="flex-1 text-xs text-slate-500 border border-slate-200 rounded-lg py-2 hover:bg-slate-50 transition-colors"
                >
                  重新选
                </button>
                <button
                  onClick={() => onConfirm(preview)}
                  className="flex-1 text-xs text-white bg-rose-500 hover:bg-rose-600 rounded-lg py-2 font-medium transition-colors"
                >
                  使用此头像
                </button>
              </div>
            </div>
          )}

          {!preview && (
            <div className="mt-3 flex justify-end">
              <button onClick={onCancel} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
                取消
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Tab
// ---------------------------------------------------------------------------

export default function CharacterChatTab({ bookId, pages }) {
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chattingCharacter, setChattingCharacter] = useState(null);
  const [avatars, setAvatars] = useState({});
  const [croppingChar, setCroppingChar] = useState(null);

  const pageMap = {};
  for (const p of pages || []) {
    pageMap[p.page_number] = p;
  }

  useEffect(() => {
    if (!bookId) return;
    setLoading(true);
    charactersApi.get(bookId).then((r) => {
      const chars = r.data?.characters || [];
      setCharacters(chars);
      const saved = {};
      for (const c of chars) {
        if (c.avatar_url) saved[c.name] = c.avatar_url;
      }
      if (Object.keys(saved).length) setAvatars((prev) => ({ ...prev, ...saved }));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [bookId]);

  const handleAvatarConfirm = async (charName, dataUrl) => {
    setAvatars((prev) => ({ ...prev, [charName]: dataUrl }));
    setCroppingChar(null);
    try {
      const r = await charactersApi.saveAvatar(bookId, charName, dataUrl);
      if (r.data?.avatar_url) {
        setAvatars((prev) => ({ ...prev, [charName]: r.data.avatar_url }));
      }
    } catch (e) {
      console.error('头像保存失败', e);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-violet-500 animate-spin mb-3" />
        <p className="text-slate-400 text-sm">加载角色中...</p>
      </div>
    );
  }

  if (characters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="bg-[#AF52DE]/10 p-6 rounded-[24px] mb-6 shadow-inner">
          <ChatBubbleIcon className="w-12 h-12 text-[#AF52DE]" />
        </div>
        <h3 className="text-[20px] font-bold tracking-tight text-[#1D1D1F] mb-3">还没有可对话的角色</h3>
        <p className="text-[#86868B] text-center max-w-sm text-[14px] font-medium leading-relaxed">
          请先在「主要角色」标签页中进行 AI 分析，识别出课程中的主要角色后，就可以和他们对话啦
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-[20px] font-black tracking-tight text-[#1D1D1F] flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-[16px] bg-gradient-to-br from-[#AF52DE] to-[#FF2D55] text-white flex items-center justify-center shadow-sm">
            <ChatBubbleIcon className="w-6 h-6" />
          </div>
          选择一个角色开始对话
        </h3>
        <p className="text-[14px] font-medium text-[#86868B] ml-[60px] leading-relaxed">
          可以先框选头像，再点击开始对话
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {characters.map((char, idx) => {
          const color = ROLE_COLORS[idx % ROLE_COLORS.length];
          const pageData = pageMap[char.best_page];
          const customAvatar = avatars[char.name];

          return (
            <div key={char.name} className={`rounded-[32px] border border-black/[0.04] bg-white/80 backdrop-blur-2xl shadow-sm hover:shadow-[0_12px_32px_rgba(0,0,0,0.06)] transition-all duration-300 overflow-hidden`}>
              <div className="flex flex-col sm:flex-row h-full">
                {/* Avatar area */}
                <div className="sm:w-36 flex-shrink-0 flex flex-col items-center justify-center gap-3 p-6 border-b sm:border-b-0 sm:border-r border-black/[0.04] bg-black/[0.02]">
                  {customAvatar ? (
                    <img src={customAvatar} alt={char.name} className="w-20 h-20 rounded-full object-cover border-[3px] border-white shadow-[0_4px_16px_rgba(0,0,0,0.1)] transition-transform duration-300 hover:scale-105" />
                  ) : pageData ? (
                    <div className="w-20 h-20 rounded-full overflow-hidden border-[3px] border-white shadow-[0_4px_16px_rgba(0,0,0,0.1)] transition-transform duration-300 hover:scale-105">
                      <ResolvedImg src={pageData.image_url} alt={char.name} className="w-full h-full object-cover mix-blend-multiply" />
                    </div>
                  ) : (
                    <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${color.gradient} flex items-center justify-center text-white font-black text-[28px] shadow-[0_4px_16px_rgba(0,0,0,0.1)] transition-transform duration-300 hover:scale-105`}>
                      {char.name[0]}
                    </div>
                  )}
                  {pageData && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setCroppingChar(char); }}
                      className="flex items-center gap-1.5 text-[12px] font-bold tracking-tight text-[#86868B] hover:text-[#0071E3] transition-colors bg-white px-3 py-1.5 rounded-full shadow-sm border border-black/[0.04] active:scale-[0.95]"
                    >
                      <CropIcon className="w-3.5 h-3.5" />
                      {customAvatar ? '重选头像' : '框选头像'}
                    </button>
                  )}
                </div>

                {/* Info + chat button */}
                <div className="flex-1 p-6 flex flex-col min-w-0">
                  <div className="flex items-center gap-2.5 mb-2">
                    <h4 className={`text-[20px] font-black tracking-tight ${color.accent} truncate`}>{char.name}</h4>
                    {char.gender === 'female' && (
                      <span className={`text-[12px] px-2 py-0.5 rounded-full font-bold shadow-inner ${color.badge}`}>♀</span>
                    )}
                    {char.gender === 'male' && (
                      <span className={`text-[12px] px-2 py-0.5 rounded-full font-bold shadow-inner ${color.badge}`}>♂</span>
                    )}
                  </div>
                  {char.description && (
                    <p className="text-[14px] font-medium text-[#86868B] leading-relaxed line-clamp-2 mb-3 bg-black/[0.02] p-3 rounded-[16px]">{char.description}</p>
                  )}
                  {char.personality && (
                    <p className="text-[12px] font-bold tracking-tight text-[#86868B]/80 line-clamp-1 mb-4 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-current opacity-50" />
                      {char.personality}
                    </p>
                  )}
                  <div className="mt-auto pt-2">
                    <button
                      onClick={() => setChattingCharacter(char)}
                      className={`inline-flex items-center justify-center gap-2 w-full text-[15px] font-bold tracking-tight px-6 py-3.5 rounded-full bg-gradient-to-r ${color.gradient} text-white shadow-[0_8px_24px_rgba(0,0,0,0.12)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.2)] hover:scale-[1.02] transition-all active:scale-[0.98]`}
                    >
                      <MicIcon className="w-4 h-4" />
                      开始对话
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Avatar cropper modal */}
      {croppingChar && pageMap[croppingChar.best_page] && (
        <AvatarCropper
          imageUrl={pageMap[croppingChar.best_page].image_url}
          onConfirm={(dataUrl) => handleAvatarConfirm(croppingChar.name, dataUrl)}
          onCancel={() => setCroppingChar(null)}
        />
      )}

      {/* Chat dialog */}
      {chattingCharacter && (
        <CharacterChat
          bookId={bookId}
          character={chattingCharacter}
          avatarUrl={avatars[chattingCharacter.name] || pageMap[chattingCharacter.best_page]?.image_url}
          onClose={() => setChattingCharacter(null)}
          onAvatarClick={() => {
            if (pageMap[chattingCharacter.best_page]) {
              setCroppingChar(chattingCharacter);
            }
          }}
        />
      )}
    </div>
  );
}
