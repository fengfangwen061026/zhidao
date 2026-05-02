import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getApiErrorMessage,
  mediaMaterialsApi,
  voiceApi,
} from '../api/client';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Coins,
  ImageIcon,
  Loader2,
  Mic,
  Paperclip,
  PlayIcon,
  Sparkles,
  Trash2,
  Wand,
  XIcon,
} from './Icons';

/**
 * AI 素材生成器（首页入口 / 个人素材库入口共用）
 *
 * 封装两个面板：
 *  - ImageGeneratorPanel：AI 文生图 / 图生图。
 *  - AudioGeneratorPanel：AI 语音合成（选音色 + 文字）。
 *
 * 两个面板都支持「一键保存到个人素材库」；图片面板额外支持
 * 在保存前挑一条已生成/已有的 AI 语音素材作为配音（linked_audio_url）。
 *
 * 同时都挂了一个「历史记录」按钮，打开可以回看以前生成过的所有内容
 * （即使没有保存到素材库也在），可以重新试听 / 一键保存回素材库。
 */

const IMAGE_ASPECT_RATIOS = [
  { id: '1:1', label: '方图', hint: '1:1' },
  { id: '4:3', label: '横图', hint: '4:3' },
  { id: '3:4', label: '竖图', hint: '3:4' },
  { id: '16:9', label: '宽屏', hint: '16:9' },
  { id: '9:16', label: '手机竖屏', hint: '9:16' },
];

const IMAGE_PROMPT_SUGGESTIONS = [
  '一只戴围裙的小熊厨师在做蛋糕，卡通插画风，暖色调',
  '春天的幼儿园小操场，绿草、气球、小朋友在玩耍，儿童绘本风',
  '橘色背景上漂浮着字母 A B C，简洁扁平插画',
  '一颗卡通磁铁在吸住彩色铁屑，科普风插画，白底',
];

const AUDIO_TEXT_SUGGESTIONS = [
  '小朋友们，我们今天一起来认识神奇的磁铁吧！',
  '请用手指指向图片中最大的苹果。',
  '大家准备好了吗？让我们开始新的冒险吧！',
];

/** 简单的错误条，和其它模块保持一致风格 */
function ErrorBanner({ text }) {
  if (!text) return null;
  return (
    <div className="bg-[#FF3B30]/5 border border-[#FF3B30]/10 text-[#FF3B30] text-[13px] font-medium tracking-tight rounded-[12px] p-3 flex items-start gap-2">
      <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="leading-relaxed">{text}</div>
    </div>
  );
}

function ModalShell({ open, title, subtitle, onClose, children, widthCls = 'max-w-2xl', headerExtra }) {
  useEffect(() => {
    if (!open) return;
    const prevBody = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevBody; };
  }, [open]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[170] flex items-center justify-center p-4 bg-black/45 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className={`bg-[#F5F5F7]/95 backdrop-blur-3xl rounded-[28px] shadow-[0_32px_96px_rgba(0,0,0,0.28)] w-full ${widthCls} max-h-[92vh] flex flex-col overflow-hidden border border-white/20`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1.5 bg-gradient-to-r from-[#0071E3] via-[#AF52DE] to-[#FF9F0A]" />
        <div className="px-6 sm:px-8 py-5 border-b border-black/[0.04] bg-white/70 backdrop-blur-2xl flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-[18px] sm:text-[20px] font-black tracking-tight text-[#1D1D1F]">{title}</h3>
            {subtitle && <p className="text-[12px] font-semibold tracking-tight text-[#86868B] mt-1 leading-relaxed">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {headerExtra}
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center transition-all active:scale-[0.95]"
              aria-label="关闭"
              title="关闭"
            >
              <XIcon className="w-4 h-4 text-[#86868B]" />
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto thin-scroll p-6 sm:p-7">
          {children}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ 历史记录 ------------------------------ */

function formatHistoryTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    if (sameDay) return `今天 ${hh}:${mm}`;
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return `昨天 ${hh}:${mm}`;
    return `${d.getMonth() + 1}月${d.getDate()}日 ${hh}:${mm}`;
  } catch {
    return '';
  }
}

/**
 * 生成历史面板，kind 决定展示形态（image / audio）。
 * onReuse：把历史记录回填到当前生成面板（从生成阶段跳到预览阶段）。
 */
function HistoryPanel({ kind, onReuse, onRequestRefresh, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const playingRef = useRef(null);
  const [playingId, setPlayingId] = useState('');

  const stopPreview = useCallback(() => {
    if (playingRef.current) {
      try { playingRef.current.pause(); } catch (_err) {}
      playingRef.current = null;
    }
    setPlayingId('');
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await mediaMaterialsApi.listAiHistory(kind);
      setItems(r.data || []);
    } catch (e) {
      setError(getApiErrorMessage(e, '加载历史失败'));
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    load();
    return () => { stopPreview(); };
  }, [load, stopPreview]);

  const togglePlay = (item) => {
    if (playingRef.current && playingId === item.id) {
      stopPreview();
      return;
    }
    stopPreview();
    const audio = new Audio(item.url);
    audio.addEventListener('ended', () => { setPlayingId(''); playingRef.current = null; });
    audio.addEventListener('error', () => { setPlayingId(''); playingRef.current = null; });
    audio.play().then(() => {
      playingRef.current = audio;
      setPlayingId(item.id);
    }).catch(() => {
      playingRef.current = null;
      setPlayingId('');
    });
  };

  const remove = async (item) => {
    if (!window.confirm('确认删除这条历史记录？COS 中的原素材不会被删除。')) return;
    try {
      await mediaMaterialsApi.deleteAiHistory(item.id);
      setItems((prev) => prev.filter((it) => it.id !== item.id));
      onRequestRefresh?.();
    } catch (e) {
      setError(getApiErrorMessage(e, '删除失败'));
    }
  };

  const reuse = (item) => {
    stopPreview();
    onReuse?.(item);
    onClose?.();
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[13px] text-[#86868B] py-10 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> 正在加载历史…
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="text-center py-12 text-[13px] font-semibold text-[#86868B]">
        {error || '还没有生成过任何内容。'}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ErrorBanner text={error} />
      {items.map((it) => (
        <div
          key={it.id}
          className="rounded-[16px] border border-black/[0.06] bg-white p-3 flex items-start gap-3"
        >
          {kind === 'image' ? (
            <div className="w-20 h-20 rounded-[12px] overflow-hidden bg-[#F5F5F7] flex-shrink-0 border border-black/[0.04]">
              <img src={it.thumbnail_url || it.url} alt="" className="w-full h-full object-cover" />
            </div>
          ) : (
            <button
              onClick={() => togglePlay(it)}
              className="w-12 h-12 rounded-full bg-[#AF52DE]/10 hover:bg-[#AF52DE]/20 text-[#AF52DE] flex items-center justify-center flex-shrink-0 transition-all active:scale-[0.95]"
              title={playingId === it.id ? '停止' : '试听'}
              aria-label={playingId === it.id ? '停止' : '试听'}
            >
              {playingId === it.id ? (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              ) : (
                <PlayIcon className="w-4 h-4" />
              )}
            </button>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-[#86868B]">
              <span>{formatHistoryTime(it.created_at)}</span>
              {it.saved_material_id ? (
                <span className="inline-flex items-center gap-1 text-[10.5px] font-black text-[#34C759] bg-[#34C759]/10 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" /> 已入库
                </span>
              ) : null}
              {kind === 'image' && it.params?.mode ? (
                <span className="text-[10.5px] font-black tracking-tight text-[#0071E3] bg-[#0071E3]/10 px-2 py-0.5 rounded-full">
                  {it.params.mode === 'i2i' ? '图生图' : '文生图'}
                </span>
              ) : null}
            </div>
            <div className="mt-1 text-[13px] font-bold tracking-tight text-[#1D1D1F] line-clamp-2 leading-snug">
              {it.prompt || '（无描述）'}
            </div>
            <div className="mt-0.5 text-[11px] font-semibold text-[#86868B] truncate">
              {kind === 'audio' ? (it.voice_type || '-') : `比例 ${it.params?.aspect_ratio || '1:1'}`}
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => reuse(it)}
              className="text-[11.5px] font-black tracking-tight text-[#1D1D1F] bg-black/[0.05] hover:bg-black/[0.1] px-3 py-1.5 rounded-full transition-all active:scale-[0.97]"
              title="把这条结果放回预览区"
            >
              重新使用
            </button>
            <button
              onClick={() => remove(it)}
              className="w-8 h-8 rounded-full bg-[#FF3B30]/10 hover:bg-[#FF3B30]/20 text-[#FF3B30] flex items-center justify-center transition-all active:scale-[0.95]"
              title="删除"
              aria-label="删除"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function HistoryModal({ open, kind, onClose, onReuse }) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      widthCls="max-w-xl"
      title={kind === 'image' ? 'AI 图片历史' : 'AI 语音历史'}
      subtitle="按时间倒序展示最近生成过的内容（含未入库）。"
    >
      {open && (
        <HistoryPanel kind={kind} onReuse={onReuse} onClose={onClose} />
      )}
    </ModalShell>
  );
}

/* ----------------------------- 图片生成面板 ----------------------------- */

export function ImageGeneratorPanel({ onClose, onSaved, imageCost = 15, audioCost = 3 }) {
  const [prompt, setPrompt] = useState('');
  const [aspect, setAspect] = useState('1:1');
  const [referenceFile, setReferenceFile] = useState(null);
  const [referencePreview, setReferencePreview] = useState('');
  const [referenceUrl, setReferenceUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [showAudioPicker, setShowAudioPicker] = useState(false);
  const [audioLibrary, setAudioLibrary] = useState([]);
  const [linkedAudio, setLinkedAudio] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const playingRef = useRef(null);

  const fileRef = useRef(null);

  useEffect(() => {
    return () => {
      if (referencePreview && referencePreview.startsWith('blob:')) {
        URL.revokeObjectURL(referencePreview);
      }
    };
  }, [referencePreview]);

  const loadAudioLibrary = async () => {
    try {
      const r = await mediaMaterialsApi.list('audio');
      setAudioLibrary(r.data || []);
    } catch {
      setAudioLibrary([]);
    }
  };

  const onPickReference = async (file) => {
    if (!file) return;
    if (!file.type?.startsWith('image/')) {
      setError('参考图必须是图片文件');
      return;
    }
    setReferenceFile(file);
    const url = URL.createObjectURL(file);
    setReferencePreview(url);
    setReferenceUrl('');
    setError('');
    try {
      setUploading(true);
      const reader = new FileReader();
      const dataUrl = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      setReferenceUrl(dataUrl);
    } catch (e) {
      setError(getApiErrorMessage(e, '参考图读取失败'));
    } finally {
      setUploading(false);
    }
  };

  const clearReference = () => {
    if (referencePreview && referencePreview.startsWith('blob:')) {
      URL.revokeObjectURL(referencePreview);
    }
    setReferenceFile(null);
    setReferencePreview('');
    setReferenceUrl('');
  };

  const doGenerate = async () => {
    if (!prompt.trim()) {
      setError('请填写图片描述');
      return;
    }
    setError('');
    setGenerating(true);
    try {
      const r = await mediaMaterialsApi.generateImage({
        prompt: prompt.trim(),
        reference_image_url: referenceUrl || undefined,
        aspect_ratio: aspect,
      });
      setGenerated(r.data);
      setTitle(r.data?.suggested_title || '');
    } catch (e) {
      setError(getApiErrorMessage(e, '图片生成失败，请稍后重试'));
    } finally {
      setGenerating(false);
    }
  };

  const doRegenerate = () => {
    setGenerated(null);
    setTitle('');
    setDescription('');
    setLinkedAudio(null);
  };

  const doSave = async () => {
    if (!generated) return;
    if (!title.trim()) {
      setError('请填写素材标题');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const payload = {
        kind: 'image',
        url: generated.url,
        thumbnail_url: generated.thumbnail_url || generated.url,
        content_type: generated.content_type || 'image/jpeg',
        original_filename: generated.original_filename,
        title: title.trim(),
        description: description.trim() || null,
        linked_audio_url: linkedAudio?.url || null,
        generation_id: generated.generation_id || null,
      };
      const r = await mediaMaterialsApi.saveFromUrl(payload);
      onSaved?.(r.data);
      onClose?.();
    } catch (e) {
      setError(getApiErrorMessage(e, '保存失败'));
    } finally {
      setSaving(false);
    }
  };

  const openAudioPicker = async () => {
    setShowAudioPicker(true);
    await loadAudioLibrary();
  };

  const togglePlay = (item) => {
    if (playingRef.current) {
      playingRef.current.pause();
      if (playingRef.current.dataset.id === String(item.id)) {
        playingRef.current = null;
        return;
      }
    }
    const audio = new Audio(item.url);
    audio.dataset.id = String(item.id);
    audio.addEventListener('ended', () => { playingRef.current = null; });
    audio.play().catch(() => { playingRef.current = null; });
    playingRef.current = audio;
  };

  // 从历史记录复用一条生成结果（跳过生成步骤，进入预览/保存阶段）
  const reuseHistory = (item) => {
    setGenerated({
      kind: 'image',
      url: item.url,
      thumbnail_url: item.thumbnail_url || item.url,
      content_type: item.content_type || 'image/jpeg',
      original_filename: item.original_filename,
      suggested_title: item.prompt ? item.prompt.slice(0, 30) : '历史素材',
      prompt: item.prompt,
      voice_type: null,
      generation_id: item.id,
    });
    setTitle(item.prompt ? item.prompt.slice(0, 30) : '历史素材');
    setDescription('');
    setLinkedAudio(null);
    setError('');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end">
        <button
          onClick={() => setHistoryOpen(true)}
          className="inline-flex items-center gap-1.5 text-[12px] font-black tracking-tight text-[#86868B] hover:text-[#1D1D1F] bg-black/[0.04] hover:bg-black/[0.08] px-3 py-1.5 rounded-full transition-all active:scale-[0.98]"
        >
          <Clock className="w-3.5 h-3.5" /> 历史记录
        </button>
      </div>

      <ErrorBanner text={error} />

      {!generated ? (
        <>
          <div className="rounded-[20px] border-2 border-black/[0.06] bg-white p-4 sm:p-5">
            <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-wider">图片描述（Prompt）</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="描述你想要的画面。例如：一只戴围裙的小熊厨师在做蛋糕，卡通插画风，暖色调"
              className="w-full mt-2 px-3 py-3 rounded-[14px] border border-black/[0.04] bg-[#F5F5F7] focus:bg-white focus:border-[#0071E3]/30 focus:ring-[4px] focus:ring-[#0071E3]/10 outline-none text-[14px] font-medium text-[#1D1D1F] leading-relaxed resize-none transition-all"
            />

            <div className="mt-3 flex flex-wrap gap-2">
              {IMAGE_PROMPT_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setPrompt(s)}
                  className="text-[12px] font-semibold tracking-tight text-[#86868B] px-3 py-1.5 rounded-full bg-black/[0.03] hover:bg-[#0071E3]/10 hover:text-[#0071E3] transition-all active:scale-[0.98]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr] gap-4">
            <div className="rounded-[20px] border-2 border-black/[0.06] bg-white p-4 sm:p-5">
              <div className="text-[11px] font-bold text-[#86868B] uppercase tracking-wider mb-2">画面比例</div>
              <div className="grid grid-cols-3 gap-2">
                {IMAGE_ASPECT_RATIOS.map((r) => {
                  const active = aspect === r.id;
                  return (
                    <button
                      key={r.id}
                      onClick={() => setAspect(r.id)}
                      className={`rounded-[12px] py-2 transition-all border-2 ${
                        active
                          ? 'bg-[#0071E3]/5 text-[#0071E3] border-[#0071E3]/30 shadow-inner'
                          : 'bg-white text-[#86868B] border-black/[0.06] hover:border-[#0071E3]/20 hover:text-[#1D1D1F]'
                      }`}
                    >
                      <div className="text-[13px] font-black tracking-tight">{r.label}</div>
                      <div className="text-[10.5px] font-semibold opacity-70">{r.hint}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[20px] border-2 border-black/[0.06] bg-white p-4 sm:p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] font-bold text-[#86868B] uppercase tracking-wider">参考图（可选）</div>
                {referencePreview && (
                  <button
                    onClick={clearReference}
                    className="text-[11px] font-black text-[#FF3B30] bg-[#FF3B30]/10 hover:bg-[#FF3B30]/20 px-2.5 py-1 rounded-full transition-all active:scale-[0.98] inline-flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> 移除
                  </button>
                )}
              </div>

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onPickReference(f);
                  e.target.value = '';
                }}
              />

              {referencePreview ? (
                <div className="rounded-[14px] overflow-hidden border border-black/[0.06] bg-[#F5F5F7]">
                  <img src={referencePreview} alt="参考图" className="w-full h-36 object-cover" />
                  <div className="px-3 py-2 text-[11px] font-semibold text-[#86868B] truncate bg-white">
                    {referenceFile?.name} · {uploading ? '准备中…' : '就绪，会走图生图'}
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full h-36 rounded-[14px] border-2 border-dashed border-black/[0.1] bg-[#F5F5F7] hover:border-[#0071E3]/30 hover:bg-white transition-all flex flex-col items-center justify-center gap-1.5"
                >
                  <Paperclip className="w-5 h-5 text-[#86868B]" />
                  <span className="text-[13px] font-black text-[#1D1D1F]">点击上传参考图</span>
                  <span className="text-[11px] font-semibold text-[#86868B]">会自动走「图生图」</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <span className="inline-flex items-center gap-1 text-[11.5px] font-bold tracking-tight text-[#86868B]">
              <Coins className="w-3.5 h-3.5" /> 本次约 {imageCost} 点
            </span>
            <button
              onClick={doGenerate}
              disabled={generating || !prompt.trim()}
              className="inline-flex items-center gap-2 bg-[#0071E3] hover:bg-[#0077ED] disabled:bg-black/[0.06] disabled:text-[#86868B] text-white px-6 py-3 rounded-full text-[14px] font-black tracking-tight shadow-[0_8px_24px_rgba(0,113,227,0.2)] transition-all active:scale-[0.98] disabled:cursor-not-allowed"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand className="w-4 h-4" />}
              {generating ? '生成中…' : '生成图片'}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="rounded-[20px] border-2 border-black/[0.06] bg-white p-3 sm:p-4">
            <div className="rounded-[14px] overflow-hidden bg-[#F5F5F7]">
              <img src={generated.url} alt={title} className="w-full max-h-[440px] object-contain bg-white" />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div className="inline-flex items-center gap-1.5 text-[11.5px] font-black tracking-tight text-[#34C759] bg-[#34C759]/10 px-3 py-1 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5" /> 已生成
              </div>
              <button
                onClick={doRegenerate}
                className="text-[12px] font-black tracking-tight text-[#86868B] hover:text-[#1D1D1F] bg-black/[0.04] hover:bg-black/[0.08] px-3.5 py-1.5 rounded-full transition-all"
              >
                重新生成
              </button>
            </div>
          </div>

          <div className="rounded-[20px] border-2 border-black/[0.06] bg-white p-4 sm:p-5 space-y-3">
            <div>
              <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-wider">素材标题</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：小熊厨师做蛋糕"
                className="w-full mt-1.5 px-3 py-2.5 rounded-[14px] border border-black/[0.04] bg-[#F5F5F7] focus:bg-white focus:border-[#0071E3]/30 focus:ring-[4px] focus:ring-[#0071E3]/10 outline-none text-[14px] font-bold text-[#1D1D1F] transition-all"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-wider">描述（可选）</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="备注使用场景/年龄段等"
                className="w-full mt-1.5 px-3 py-2.5 rounded-[14px] border border-black/[0.04] bg-[#F5F5F7] focus:bg-white focus:border-[#0071E3]/30 focus:ring-[4px] focus:ring-[#0071E3]/10 outline-none text-[13px] font-medium text-[#1D1D1F] transition-all resize-none"
              />
            </div>

            <div className="rounded-[14px] border border-black/[0.06] bg-[#F5F5F7] p-3 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-black tracking-tight text-[#1D1D1F] flex items-center gap-1.5">
                  <Mic className="w-4 h-4 text-[#AF52DE]" />
                  配一段 AI 语音（可选）
                </div>
                <div className="text-[11px] font-semibold text-[#86868B] mt-0.5 truncate">
                  {linkedAudio
                    ? `已选：${linkedAudio.title || linkedAudio.url}`
                    : '插入到图片页时会自动跟着这段配音一起加进去。'}
                </div>
              </div>
              {linkedAudio ? (
                <button
                  onClick={() => setLinkedAudio(null)}
                  className="text-[11.5px] font-black text-[#FF3B30] bg-[#FF3B30]/10 hover:bg-[#FF3B30]/20 px-3 py-1.5 rounded-full transition-all"
                >
                  移除
                </button>
              ) : (
                <button
                  onClick={openAudioPicker}
                  className="text-[11.5px] font-black text-[#AF52DE] bg-[#AF52DE]/10 hover:bg-[#AF52DE]/20 px-3 py-1.5 rounded-full transition-all"
                >
                  选择配音
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              onClick={onClose}
              className="px-5 py-3 rounded-full text-[14px] font-black tracking-tight text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/[0.04] transition-all"
            >
              取消
            </button>
            <button
              onClick={doSave}
              disabled={saving || !title.trim()}
              className="inline-flex items-center gap-2 bg-[#1D1D1F] hover:bg-[#333336] disabled:bg-black/[0.06] disabled:text-[#86868B] text-white px-6 py-3 rounded-full text-[14px] font-black tracking-tight shadow-[0_10px_30px_rgba(0,0,0,0.18)] transition-all active:scale-[0.98] disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              一键存到个人素材库
            </button>
          </div>
        </>
      )}

      <HistoryModal
        open={historyOpen}
        kind="image"
        onClose={() => setHistoryOpen(false)}
        onReuse={reuseHistory}
      />

      {showAudioPicker && (
        <div
          className="fixed inset-0 z-[180] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setShowAudioPicker(false)}
        >
          <div
            className="bg-white rounded-[24px] shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden border border-black/[0.04]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-black/[0.06] flex items-center justify-between">
              <div>
                <div className="text-[14px] font-black tracking-tight text-[#1D1D1F]">从个人素材库挑一段语音</div>
                <div className="text-[11.5px] font-semibold text-[#86868B] mt-0.5">
                  没有合适的？先用「AI 语音素材」生成一段，再回来挑。
                </div>
              </div>
              <button
                onClick={() => setShowAudioPicker(false)}
                className="p-1.5 rounded-full text-[#86868B] hover:bg-black/[0.04]"
                aria-label="关闭"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {audioLibrary.length === 0 ? (
                <div className="text-center py-10 text-[13px] font-semibold text-[#86868B]">
                  个人素材库里还没有语音素材。
                </div>
              ) : (
                audioLibrary.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 rounded-[14px] border transition-all px-3 py-2.5 ${
                      linkedAudio?.url === item.url
                        ? 'border-[#AF52DE]/40 bg-[#AF52DE]/5'
                        : 'border-black/[0.06] hover:border-[#AF52DE]/30 bg-white'
                    }`}
                  >
                    <button
                      onClick={() => togglePlay(item)}
                      className="w-10 h-10 rounded-full bg-[#AF52DE]/10 hover:bg-[#AF52DE]/20 text-[#AF52DE] flex items-center justify-center flex-shrink-0 transition-all"
                      title="试听"
                      aria-label="试听"
                    >
                      <PlayIcon className="w-4 h-4" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-black tracking-tight text-[#1D1D1F] truncate">
                        {item.title || '未命名语音'}
                      </div>
                      <div className="text-[11px] font-semibold text-[#86868B] truncate">
                        {item.description || item.original_filename || ''}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setLinkedAudio({ url: item.url, title: item.title });
                        setShowAudioPicker(false);
                      }}
                      className="text-[11.5px] font-black tracking-tight text-[#AF52DE] bg-[#AF52DE]/10 hover:bg-[#AF52DE]/20 px-3 py-1.5 rounded-full transition-all active:scale-[0.98] flex-shrink-0"
                    >
                      使用
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------------------------- 语音生成面板 ----------------------------- */

export function AudioGeneratorPanel({ onClose, onSaved, audioCost = 3 }) {
  const [text, setText] = useState('');
  const [voiceType, setVoiceType] = useState('');
  const [speedRatio, setSpeedRatio] = useState(1.0);
  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [historyOpen, setHistoryOpen] = useState(false);
  const [previewingVoiceType, setPreviewingVoiceType] = useState('');
  const previewAudioRef = useRef(null);
  const audioRef = useRef(null);

  const stopPreview = useCallback(() => {
    if (previewAudioRef.current) {
      try { previewAudioRef.current.pause(); } catch (_err) {}
      previewAudioRef.current = null;
    }
    setPreviewingVoiceType('');
  }, []);

  useEffect(() => {
    (async () => {
      setCatalogLoading(true);
      try {
        const r = await voiceApi.getCatalog();
        const list = (r.data || []).filter((v) => v.available !== false);
        setCatalog(list);
        if (list.length) setVoiceType(list[0].voice_type);
      } catch {
        setCatalog([]);
      } finally {
        setCatalogLoading(false);
      }
    })();
    return () => {
      if (audioRef.current) {
        try { audioRef.current.pause(); } catch (_err) {}
        audioRef.current = null;
      }
      stopPreview();
    };
  }, [stopPreview]);

  const grouped = useMemo(() => {
    const groups = { child: [], female: [], male: [], other: [] };
    for (const v of catalog) {
      if (v.age_type === 'child') groups.child.push(v);
      else if (v.gender === 'female') groups.female.push(v);
      else if (v.gender === 'male') groups.male.push(v);
      else groups.other.push(v);
    }
    return groups;
  }, [catalog]);

  const playPreview = (voice) => {
    // 再点一次同一个卡片 = 停止
    if (previewingVoiceType === voice.voice_type) {
      stopPreview();
      return;
    }
    stopPreview();
    if (!voice.sample_url) {
      setError(`「${voice.kid_name || voice.name}」暂时没有试听示例`);
      return;
    }
    setError('');
    const audio = new Audio(voice.sample_url);
    audio.addEventListener('ended', () => {
      previewAudioRef.current = null;
      setPreviewingVoiceType('');
    });
    audio.addEventListener('error', () => {
      previewAudioRef.current = null;
      setPreviewingVoiceType('');
      setError('试听播放失败，稍后再试。');
    });
    audio.play().then(() => {
      previewAudioRef.current = audio;
      setPreviewingVoiceType(voice.voice_type);
    }).catch(() => {
      previewAudioRef.current = null;
      setPreviewingVoiceType('');
    });
  };

  const doGenerate = async () => {
    if (!text.trim()) {
      setError('请填写要合成的文字');
      return;
    }
    if (!voiceType) {
      setError('请选择一个音色');
      return;
    }
    setError('');
    setGenerating(true);
    stopPreview();
    try {
      const r = await mediaMaterialsApi.generateAudio({
        text: text.trim(),
        voice_type: voiceType,
        speed_ratio: speedRatio,
      });
      setGenerated(r.data);
      setTitle(r.data?.suggested_title || '');
    } catch (e) {
      setError(getApiErrorMessage(e, '语音生成失败，请稍后重试'));
    } finally {
      setGenerating(false);
    }
  };

  const doRegenerate = () => {
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch (_err) {}
      audioRef.current = null;
    }
    setGenerated(null);
    setTitle('');
    setDescription('');
  };

  const doSave = async () => {
    if (!generated) return;
    if (!title.trim()) {
      setError('请填写素材标题');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const payload = {
        kind: 'audio',
        url: generated.url,
        content_type: generated.content_type || 'audio/mpeg',
        original_filename: generated.original_filename,
        title: title.trim(),
        description: description.trim() || null,
        generation_id: generated.generation_id || null,
      };
      const r = await mediaMaterialsApi.saveFromUrl(payload);
      onSaved?.(r.data);
      onClose?.();
    } catch (e) {
      setError(getApiErrorMessage(e, '保存失败'));
    } finally {
      setSaving(false);
    }
  };

  // 从历史记录复用
  const reuseHistory = (item) => {
    stopPreview();
    setGenerated({
      kind: 'audio',
      url: item.url,
      thumbnail_url: null,
      content_type: item.content_type || 'audio/mpeg',
      original_filename: item.original_filename,
      suggested_title: item.prompt ? item.prompt.slice(0, 30) : '历史语音',
      prompt: item.prompt,
      voice_type: item.voice_type,
      generation_id: item.id,
    });
    setTitle(item.prompt ? item.prompt.slice(0, 30) : '历史语音');
    setDescription('');
    setError('');
  };

  const voiceBlock = (label, list) => {
    if (!list?.length) return null;
    return (
      <div>
        <div className="text-[11px] font-bold text-[#86868B] uppercase tracking-wider mb-1.5">{label}</div>
        <div className="grid grid-cols-2 gap-2">
          {list.map((v) => {
            const active = voiceType === v.voice_type;
            const playing = previewingVoiceType === v.voice_type;
            const label = v.kid_name || v.name;
            const scene = v.kid_scene || v.description;
            const tags = (v.kid_tags && v.kid_tags.length ? v.kid_tags : v.tags) || [];
            return (
              <div
                key={v.voice_type}
                className={`relative rounded-[12px] border-2 transition-all ${
                  active
                    ? 'bg-[#AF52DE]/5 border-[#AF52DE]/30 shadow-inner'
                    : 'bg-white border-black/[0.06] hover:border-[#AF52DE]/25'
                }`}
              >
                <button
                  onClick={() => setVoiceType(v.voice_type)}
                  className="text-left w-full p-2.5 pr-10"
                >
                  <div className={`text-[13px] font-black tracking-tight leading-tight ${active ? 'text-[#AF52DE]' : 'text-[#1D1D1F]'}`}>
                    {label}
                  </div>
                  <div className="text-[11px] font-semibold text-[#86868B] leading-tight mt-0.5 line-clamp-1">
                    {scene || ''}
                  </div>
                  <div className="text-[10.5px] font-semibold text-[#86868B]/80 leading-tight mt-0.5 truncate">
                    {tags.slice(0, 3).join(' · ')}
                  </div>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); playPreview(v); }}
                  className={`absolute right-1.5 top-1.5 w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-[0.92] ${
                    v.sample_url
                      ? playing
                        ? 'bg-[#AF52DE] text-white'
                        : 'bg-[#AF52DE]/10 text-[#AF52DE] hover:bg-[#AF52DE]/20'
                      : 'bg-black/[0.04] text-[#86868B] cursor-not-allowed'
                  }`}
                  title={v.sample_url ? (playing ? '停止' : '试听') : '暂无试听'}
                  aria-label={v.sample_url ? (playing ? '停止' : '试听') : '暂无试听'}
                  disabled={!v.sample_url}
                >
                  {playing ? (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="5" width="4" height="14" rx="1" />
                      <rect x="14" y="5" width="4" height="14" rx="1" />
                    </svg>
                  ) : (
                    <PlayIcon className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end">
        <button
          onClick={() => setHistoryOpen(true)}
          className="inline-flex items-center gap-1.5 text-[12px] font-black tracking-tight text-[#86868B] hover:text-[#1D1D1F] bg-black/[0.04] hover:bg-black/[0.08] px-3 py-1.5 rounded-full transition-all active:scale-[0.98]"
        >
          <Clock className="w-3.5 h-3.5" /> 历史记录
        </button>
      </div>

      <ErrorBanner text={error} />

      {!generated ? (
        <>
          <div className="rounded-[20px] border-2 border-black/[0.06] bg-white p-4 sm:p-5">
            <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-wider">合成文字</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              placeholder="把要读出来的文字填进来。例如：小朋友们，我们今天一起来认识神奇的磁铁吧！"
              className="w-full mt-2 px-3 py-3 rounded-[14px] border border-black/[0.04] bg-[#F5F5F7] focus:bg-white focus:border-[#AF52DE]/30 focus:ring-[4px] focus:ring-[#AF52DE]/10 outline-none text-[14px] font-medium text-[#1D1D1F] leading-relaxed resize-none transition-all"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {AUDIO_TEXT_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setText(s)}
                  className="text-[12px] font-semibold tracking-tight text-[#86868B] px-3 py-1.5 rounded-full bg-black/[0.03] hover:bg-[#AF52DE]/10 hover:text-[#AF52DE] transition-all active:scale-[0.98]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[20px] border-2 border-black/[0.06] bg-white p-4 sm:p-5 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] font-bold text-[#86868B] uppercase tracking-wider">选择小主播</div>
                <div className="text-[10.5px] font-semibold text-[#86868B] hidden sm:block">点右上角播放键可以先听听看</div>
              </div>
              {catalogLoading ? (
                <div className="flex items-center gap-2 text-[13px] text-[#86868B] py-6">
                  <Loader2 className="w-4 h-4 animate-spin" /> 正在加载音色…
                </div>
              ) : (
                <div className="space-y-3">
                  {voiceBlock('适合小朋友', grouped.child)}
                  {voiceBlock('小姐姐们', grouped.female)}
                  {voiceBlock('小哥哥们', grouped.male)}
                  {voiceBlock('其他', grouped.other)}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[11px] font-bold text-[#86868B] uppercase tracking-wider">说话快慢</div>
                <div className="text-[12px] font-black tracking-tight text-[#1D1D1F]">×{speedRatio.toFixed(1)}</div>
              </div>
              <input
                type="range"
                min="0.7"
                max="1.3"
                step="0.1"
                value={speedRatio}
                onChange={(e) => setSpeedRatio(Number(e.target.value))}
                className="w-full accent-[#AF52DE]"
              />
              <div className="flex justify-between text-[10.5px] font-semibold text-[#86868B] mt-1">
                <span>慢慢说</span>
                <span>正常</span>
                <span>说快点</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <span className="inline-flex items-center gap-1 text-[11.5px] font-bold tracking-tight text-[#86868B]">
              <Coins className="w-3.5 h-3.5" /> 本次约 {audioCost} 点
            </span>
            <button
              onClick={doGenerate}
              disabled={generating || !text.trim() || !voiceType}
              className="inline-flex items-center gap-2 bg-[#AF52DE] hover:bg-[#AF52DE]/90 disabled:bg-black/[0.06] disabled:text-[#86868B] text-white px-6 py-3 rounded-full text-[14px] font-black tracking-tight shadow-[0_8px_24px_rgba(175,82,222,0.22)] transition-all active:scale-[0.98] disabled:cursor-not-allowed"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
              {generating ? '合成中…' : '合成语音'}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="rounded-[20px] border-2 border-black/[0.06] bg-white p-4 sm:p-5 space-y-3">
            <div className="inline-flex items-center gap-1.5 text-[11.5px] font-black tracking-tight text-[#34C759] bg-[#34C759]/10 px-3 py-1 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5" /> 已生成，可试听
            </div>
            <audio controls src={generated.url} className="w-full" />
            <div className="flex items-center justify-end">
              <button
                onClick={doRegenerate}
                className="text-[12px] font-black tracking-tight text-[#86868B] hover:text-[#1D1D1F] bg-black/[0.04] hover:bg-black/[0.08] px-3.5 py-1.5 rounded-full transition-all"
              >
                重新生成
              </button>
            </div>
          </div>

          <div className="rounded-[20px] border-2 border-black/[0.06] bg-white p-4 sm:p-5 space-y-3">
            <div>
              <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-wider">素材标题</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：磁铁活动开场白"
                className="w-full mt-1.5 px-3 py-2.5 rounded-[14px] border border-black/[0.04] bg-[#F5F5F7] focus:bg-white focus:border-[#AF52DE]/30 focus:ring-[4px] focus:ring-[#AF52DE]/10 outline-none text-[14px] font-bold text-[#1D1D1F] transition-all"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-wider">描述（可选）</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="备注使用场景/年龄段等"
                className="w-full mt-1.5 px-3 py-2.5 rounded-[14px] border border-black/[0.04] bg-[#F5F5F7] focus:bg-white focus:border-[#AF52DE]/30 focus:ring-[4px] focus:ring-[#AF52DE]/10 outline-none text-[13px] font-medium text-[#1D1D1F] transition-all resize-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              onClick={onClose}
              className="px-5 py-3 rounded-full text-[14px] font-black tracking-tight text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/[0.04] transition-all"
            >
              取消
            </button>
            <button
              onClick={doSave}
              disabled={saving || !title.trim()}
              className="inline-flex items-center gap-2 bg-[#1D1D1F] hover:bg-[#333336] disabled:bg-black/[0.06] disabled:text-[#86868B] text-white px-6 py-3 rounded-full text-[14px] font-black tracking-tight shadow-[0_10px_30px_rgba(0,0,0,0.18)] transition-all active:scale-[0.98] disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              一键存到个人素材库
            </button>
          </div>
        </>
      )}

      <HistoryModal
        open={historyOpen}
        kind="audio"
        onClose={() => setHistoryOpen(false)}
        onReuse={reuseHistory}
      />
    </div>
  );
}

/* ------------------------------ 两个模态框 ------------------------------ */

export function AiImageMaterialModal({ open, onClose, onSaved, imageCost, audioCost }) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      widthCls="max-w-3xl"
      title="AI 图片素材"
      subtitle="一句话 / 参考图生成一张图片素材，一键存到个人素材库，课程里可直接复用。"
    >
      <ImageGeneratorPanel
        onClose={onClose}
        onSaved={onSaved}
        imageCost={imageCost}
        audioCost={audioCost}
      />
    </ModalShell>
  );
}

export function AiAudioMaterialModal({ open, onClose, onSaved, audioCost }) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      widthCls="max-w-2xl"
      title="AI 语音素材"
      subtitle="挑一个小主播，输入要讲的话，就能得到一段清亮好听的配音。"
    >
      <AudioGeneratorPanel onClose={onClose} onSaved={onSaved} audioCost={audioCost} />
    </ModalShell>
  );
}
