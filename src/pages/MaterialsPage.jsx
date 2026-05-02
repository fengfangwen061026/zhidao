import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import Toast from '../components/Toast';
import { getApiErrorMessage, materialsApi, mediaMaterialsApi } from '../api/client';
import { Edit3, FileText, FolderOpen, Loader2, Plus, Search, Sparkles, Trash2, Wand } from '../components/Icons';
import {
  AiAudioMaterialModal,
  AiImageMaterialModal,
} from '../components/AiMaterialGenerator';
import { usePricing } from '../hooks/usePricing';

function useDebouncedValue(value, delay = 500) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

class ModalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch() {
    // ignore: fallback UI only
  }
  render() {
    if (this.state.error) {
      return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-black/50 backdrop-blur-2xl">
          <div className="w-full max-w-lg bg-white rounded-[28px] p-6 shadow-[0_32px_96px_rgba(0,0,0,0.24)]">
            <h3 className="text-[18px] font-black tracking-tight text-[#1D1D1F]">编辑窗口渲染失败</h3>
            <p className="text-[13px] font-medium text-[#86868B] mt-2 leading-relaxed">
              {String(this.state.error?.message || this.state.error || '未知错误')}
            </p>
            <div className="flex justify-end mt-6">
              <button
                onClick={this.props.onClose}
                className="px-5 py-2.5 rounded-full text-[14px] bg-[#1D1D1F] hover:bg-[#333336] text-white font-black tracking-tight shadow-sm transition-all active:scale-[0.95]"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const TABS = [
  { id: 'interactive', label: '互动网页素材库', enabled: true },
  { id: 'images', label: '图片素材库', enabled: true },
  { id: 'videos', label: '视频素材库', enabled: true },
  { id: 'audios', label: '语音素材库', enabled: true },
  { id: 'props', label: '角色与道具素材库', enabled: false },
];

function EmptyState({ query, onCreate }) {
  return (
    <div className="rounded-[40px] border-[3px] border-black/[0.04] bg-white/80 backdrop-blur-3xl p-16 text-center shadow-[0_12px_40px_rgba(0,0,0,0.06)]">
      <div className="w-20 h-20 rounded-[24px] bg-[#1D1D1F] text-white mx-auto flex items-center justify-center mb-6 shadow-md">
        <FolderOpen className="w-10 h-10" />
      </div>
      <h3 className="text-[20px] font-bold tracking-tight text-[#1D1D1F] mb-2">
        {query ? `没有匹配 “${query}” 的素材` : '还没有互动网页素材'}
      </h3>
      <p className="text-[14px] font-medium text-[#86868B] mb-8 leading-relaxed">
        把你常用的互动网页模板保存到这里，之后在任意课程里都能复用。
      </p>
      {!query && (
        <button
          onClick={onCreate}
          className="inline-flex items-center gap-2 bg-[#0071E3] hover:bg-[#0077ED] text-white px-6 py-3.5 rounded-full text-[15px] font-bold tracking-tight transition-all shadow-sm active:scale-[0.98]"
        >
          <Plus className="w-5 h-5" /> 新建互动网页素材
        </button>
      )}
    </div>
  );
}

function MaterialCard({ item, onEdit, onDelete }) {
  const previewKey = item.html_url ? item.html_url : `doc-${item.id}-${(item.html_content || '').length}`;
  return (
    <div className="group rounded-[28px] border border-black/[0.06] bg-white/80 backdrop-blur-2xl shadow-[0_10px_32px_rgba(0,0,0,0.05)] overflow-hidden hover:shadow-[0_18px_48px_rgba(0,0,0,0.08)] transition-all">
      <div className="relative">
        <div className="aspect-[16/10] bg-[#F5F5F7]">
          {item.html_url ? (
            <iframe
              key={previewKey}
              title={item.title}
              src={item.html_url}
              sandbox="allow-scripts allow-pointer-lock allow-popups allow-forms allow-modals allow-presentation allow-same-origin"
              className="w-full h-full border-0 bg-white"
            />
          ) : (
            <iframe
              key={previewKey}
              title={item.title}
              srcDoc={item.html_content || ''}
              sandbox="allow-scripts allow-pointer-lock allow-popups allow-forms allow-modals allow-presentation"
              className="w-full h-full border-0 bg-white"
            />
          )}
        </div>
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-black/60 text-white backdrop-blur">
            互动网页
          </span>
          {item.html_url ? (
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#34C759]/90 text-white backdrop-blur">
              URL
            </span>
          ) : (
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#AF52DE]/90 text-white backdrop-blur">
              HTML
            </span>
          )}
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h4 className="text-[16px] font-black tracking-tight text-[#1D1D1F] truncate">
              {item.title}
            </h4>
            {item.description ? (
              <p className="text-[13px] font-bold tracking-tight text-[#86868B] mt-1 line-clamp-2">
                {item.description}
              </p>
            ) : (
              <p className="text-[13px] font-bold tracking-tight text-[#86868B] mt-1">
                未填写描述
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onEdit}
              className="p-2 rounded-full bg-black/[0.04] hover:bg-black/[0.08] text-[#1D1D1F] transition-all active:scale-[0.95]"
              title="编辑"
              aria-label="编辑"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-2 rounded-full bg-[#FF3B30]/10 hover:bg-[#FF3B30]/20 text-[#FF3B30] transition-all active:scale-[0.95]"
              title="删除"
              aria-label="删除"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * AiModeToggle —— 新建互动网页素材里用的模式切换。
 * 普通模式：DeepSeek flash，响应快、成本低，适合小改。
 * 思考模式：DeepSeek pro，质量高、耗时更长，适合从零规划 / 复杂逻辑。
 */
function AiModeToggle({ value, onChange, disabled }) {
  const options = [
    { id: false, label: '普通模式', hint: '快', color: 'text-[#0071E3]' },
    { id: true, label: '思考模式', hint: '深', color: 'text-[#AF52DE]' },
  ];
  return (
    <div
      className={`inline-flex items-center bg-black/[0.05] rounded-full p-0.5 shadow-inner ${
        disabled ? 'opacity-60' : ''
      }`}
      title="普通=flash（快）；思考=pro（质量高，但更慢）"
    >
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={String(opt.id)}
            type="button"
            disabled={disabled}
            onClick={() => !disabled && onChange(opt.id)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-black tracking-tight transition-all disabled:cursor-not-allowed ${
              active
                ? `bg-white ${opt.color} shadow-[0_2px_8px_rgba(0,0,0,0.06)]`
                : 'text-[#86868B] hover:text-[#1D1D1F]'
            }`}
          >
            <Sparkles className={`w-3.5 h-3.5 ${active ? opt.color : ''}`} />
            {opt.label}
            {active && (
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-black/[0.04] ${opt.color}`}
              >
                {opt.hint}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function MaterialModal({ open, mode, initial, saving, onClose, onSave }) {
  const titleRef = useRef(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sourceType, setSourceType] = useState('html'); // html | url
  const [htmlContent, setHtmlContent] = useState('');
  const [htmlUrl, setHtmlUrl] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [previewKey, setPreviewKey] = useState(0);
  const [rightTab, setRightTab] = useState('ai'); // ai | manual
  const [aiMessages, setAiMessages] = useState([]); // { role: 'user'|'assistant', text, html? }
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiLastHtml, setAiLastHtml] = useState('');
  // 普通模式 = DeepSeek flash（响应快），思考模式 = DeepSeek pro（质量高但慢）。
  // 跨 session 持久化，避免每次新建素材都回到普通模式。
  const [aiThinking, setAiThinking] = useState(() => {
    try {
      return localStorage.getItem('beike:materials-ai:thinking') === '1';
    } catch {
      return false;
    }
  });
  const aiEndRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(
        'beike:materials-ai:thinking',
        aiThinking ? '1' : '0'
      );
    } catch {
      // ignore
    }
  }, [aiThinking]);

  // 锁定背景滚动，避免出现页面侧边滚动条
  useEffect(() => {
    if (!open) return;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyPaddingRight = document.body.style.paddingRight;
    const prevHtmlPaddingRight = document.documentElement.style.paddingRight;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    // 尽量避免隐藏滚动条造成布局抖动
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      const pad = `${scrollbarWidth}px`;
      document.body.style.paddingRight = pad;
      document.documentElement.style.paddingRight = pad;
    }
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.paddingRight = prevBodyPaddingRight;
      document.documentElement.style.paddingRight = prevHtmlPaddingRight;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title || '');
    setDescription(initial?.description || '');
    if (initial?.html_url) setSourceType('url');
    else setSourceType('html');
    setHtmlContent(initial?.html_content || '');
    setHtmlUrl(initial?.html_url || '');
    setAutoRefresh(true);
    setPreviewKey((k) => k + 1);
    setRightTab('ai');
    setAiMessages([]);
    setAiInput('');
    setAiLoading(false);
    setAiLastHtml('');
    setTimeout(() => titleRef.current?.select(), 0);
  }, [open, initial]);

  const canPreview = sourceType === 'url' ? !!htmlUrl.trim() : !!htmlContent.trim();
  const debouncedHtml = useDebouncedValue(htmlContent, 650);
  const debouncedUrl = useDebouncedValue(htmlUrl.trim(), 450);
  const effectiveHtml = autoRefresh ? debouncedHtml : htmlContent;
  const effectiveUrl = autoRefresh ? debouncedUrl : htmlUrl.trim();

  useEffect(() => {
    if (!open) return;
    aiEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [open, aiMessages, aiLoading]);

  if (!open) return null;

  const submit = () => {
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      html_content: sourceType === 'html' ? htmlContent : null,
      html_url: sourceType === 'url' ? htmlUrl : null,
    };
    onSave(payload);
  };

  const sendAi = async () => {
    const text = aiInput.trim();
    if (!text || aiLoading) return;
    setAiInput('');
    setAiMessages((prev) => [...prev, { role: 'user', text }]);
    setAiLoading(true);
    try {
      const currentHtml = sourceType === 'html' ? (htmlContent || '') : '';
      const r = await materialsApi.aiEdit({
        instruction: text,
        current_html: currentHtml || null,
        thinking: aiThinking,
      });
      const nextHtml = r.data?.html_content || '';
      setAiLastHtml(nextHtml);
      const st = (r.data?.suggested_title || '').trim();
      const sd = (r.data?.suggested_description || '').trim();
      if (st) setTitle((prev) => (prev.trim() ? prev : st));
      if (sd) setDescription((prev) => (prev.trim() ? prev : sd));
      setAiMessages((prev) => [...prev, { role: 'assistant', text: '已生成一个可直接预览的版本。你可以选择“应用到编辑器”继续微调。', html: nextHtml }]);
    } catch (e) {
      setAiMessages((prev) => [...prev, { role: 'assistant', text: getApiErrorMessage(e, 'AI 生成失败，请稍后重试。') }]);
    } finally {
      setAiLoading(false);
    }
  };

  const applyAiHtml = (html) => {
    if (!html) return;
    setSourceType('html');
    setHtmlUrl('');
    setHtmlContent(html);
    setRightTab('manual');
    setPreviewKey((k) => k + 1);
  };

  const refreshPreview = () => setPreviewKey((k) => k + 1);

  return (
    <div className="fixed inset-0 z-[120] flex" onClick={onClose}>
      <div className="absolute inset-0 bg-black/55 backdrop-blur-2xl" />
      <div
        className="relative w-[calc(100vw-12px)] sm:w-[calc(100vw-20px)] lg:w-[calc(100vw-24px)] max-w-none h-[calc(100vh-12px)] sm:h-[calc(100vh-20px)] lg:h-[calc(100vh-24px)] max-h-none m-auto bg-[#F5F5F7]/95 backdrop-blur-3xl shadow-[0_32px_96px_rgba(0,0,0,0.28)] rounded-[32px] overflow-hidden border border-white/20 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-2 bg-gradient-to-r from-[#0071E3] via-[#5AC8FA] to-[#AF52DE]" />

        <div className="px-7 sm:px-9 py-6 border-b border-black/[0.04] bg-white/70 backdrop-blur-2xl flex items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <h3 className="text-[22px] sm:text-[24px] font-black tracking-tight text-[#1D1D1F]">
              {mode === 'edit' ? '编辑互动网页素材' : '新建互动网页素材'}
            </h3>
            <p className="text-[13px] font-bold tracking-tight text-[#86868B] mt-1.5">
              左侧预览，右侧可与 AI 对话式修改，或手动编辑 HTML/URL。
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center transition-colors active:scale-[0.95] flex-shrink-0"
            aria-label="关闭"
            title="关闭"
          >
            <span className="text-[#86868B] font-black text-[18px] leading-none">×</span>
          </button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1.65fr_1fr]">
          {/* 左：预览 */}
          <div className="min-h-0 border-b lg:border-b-0 lg:border-r border-black/[0.04] bg-black/[0.02] flex flex-col">
            <div className="px-6 sm:px-8 py-4 border-b border-black/[0.04] bg-white/50 backdrop-blur-md flex items-center justify-between">
              <div>
                <h4 className="text-[14px] font-black tracking-tight text-[#1D1D1F]">预览</h4>
                <p className="text-[12px] font-medium text-[#86868B] mt-0.5">
                  {canPreview ? '确认能正常运行再保存' : '右侧填写内容后自动预览'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-[13px] font-black tracking-tight text-[#1D1D1F] cursor-pointer">
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      checked={autoRefresh}
                      onChange={(e) => setAutoRefresh(e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="w-10 h-6 bg-black/[0.08] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#34C759] shadow-inner transition-colors"></div>
                  </div>
                  自动刷新
                </label>
                <button
                  type="button"
                  onClick={refreshPreview}
                  className="inline-flex items-center gap-2 bg-white hover:bg-black/[0.04] text-[#1D1D1F] px-4 py-2 rounded-full text-[13px] font-black tracking-tight border border-black/[0.06] shadow-sm transition-all active:scale-[0.98]"
                  title="刷新预览"
                >
                  刷新
                </button>
                {aiLastHtml && (
                  <button
                    onClick={() => applyAiHtml(aiLastHtml)}
                    className="inline-flex items-center gap-2 bg-[#AF52DE] hover:bg-[#AF52DE]/90 text-white px-4 py-2 rounded-full text-[13px] font-black tracking-tight shadow-sm transition-all active:scale-[0.98]"
                    title="把 AI 结果应用到编辑器"
                  >
                    <Plus className="w-4 h-4" /> 应用 AI 结果
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 min-h-0 p-4 sm:p-6">
              <div className="w-full h-full rounded-[28px] overflow-hidden border-[3px] border-black/[0.04] bg-white shadow-[0_18px_60px_rgba(0,0,0,0.12)]">
                {canPreview ? (
                  sourceType === 'url' ? (
                    <iframe
                      key={`url-${previewKey}-${effectiveUrl}`}
                      title="预览"
                      src={effectiveUrl}
                      sandbox="allow-scripts allow-pointer-lock allow-popups allow-forms allow-modals allow-presentation allow-same-origin"
                      className="w-full h-full border-0 bg-white"
                    />
                  ) : (
                    <iframe
                      key={`doc-${previewKey}-${effectiveHtml.length}`}
                      title="预览"
                      srcDoc={effectiveHtml}
                      sandbox="allow-scripts allow-pointer-lock allow-popups allow-forms allow-modals allow-presentation"
                      className="w-full h-full border-0 bg-white"
                    />
                  )
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-center px-10 bg-[#F5F5F7]">
                    <div>
                      <div className="w-16 h-16 rounded-[20px] bg-black/[0.04] text-[#86868B] mx-auto flex items-center justify-center mb-4">
                        <FileText className="w-8 h-8" />
                      </div>
                      <p className="text-[14px] font-bold tracking-tight text-[#86868B] leading-relaxed">
                        这里会显示互动网页预览
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 右：编辑 */}
          <div className="min-h-0 flex flex-col bg-white/40">
            <div className="px-6 sm:px-7 py-4 border-b border-black/[0.04] bg-white/60 backdrop-blur-md flex items-center justify-between gap-3">
              <div className="inline-flex gap-1 bg-black/[0.05] rounded-full p-1 shadow-inner">
                <button
                  type="button"
                  onClick={() => setRightTab('ai')}
                  className={`px-5 py-2.5 rounded-full text-[13.5px] font-black tracking-tight transition-all ${
                    rightTab === 'ai' ? 'bg-white text-[#1D1D1F] shadow-[0_2px_10px_rgba(0,0,0,0.08)]' : 'text-[#86868B] hover:text-[#1D1D1F]'
                  }`}
                >
                  AI 交互编辑
                </button>
                <button
                  type="button"
                  onClick={() => setRightTab('manual')}
                  className={`px-5 py-2.5 rounded-full text-[13.5px] font-black tracking-tight transition-all ${
                    rightTab === 'manual' ? 'bg-white text-[#1D1D1F] shadow-[0_2px_10px_rgba(0,0,0,0.08)]' : 'text-[#86868B] hover:text-[#1D1D1F]'
                  }`}
                >
                  手动编辑
                </button>
              </div>

              <div className="text-[11px] font-bold tracking-tight text-[#86868B]">
                {rightTab === 'ai' ? 'AI 生成后“应用”再保存' : '修改后直接保存'}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto thin-scroll p-6 sm:p-7">
              {rightTab === 'ai' ? (
                <div className="flex flex-col min-h-0 h-full">
                  <div className="bg-white/80 rounded-[24px] border border-black/[0.04] shadow-sm p-5">
                    <p className="text-[13px] font-bold tracking-tight text-[#1D1D1F]">
                      你可以这样说：
                    </p>
                    <ul className="mt-3 space-y-2 text-[13px] font-medium text-[#86868B]">
                      <li>把背景改成渐变，并加一个“开始游戏”按钮</li>
                      <li>做一个 4 选 1 的找一找小游戏，答对提示“真棒”</li>
                      <li>按钮、字体更大一点，适合幼儿园小朋友点按</li>
                    </ul>
                  </div>

                  <div className="mt-4 flex-1 min-h-0 bg-white/80 rounded-[24px] border border-black/[0.04] shadow-sm overflow-hidden flex flex-col">
                    <div className="px-5 py-4 border-b border-black/[0.04]">
                      <p className="text-[14px] font-black tracking-tight text-[#1D1D1F]">对话</p>
                      <p className="text-[12px] font-medium text-[#86868B] mt-0.5">AI 不会自动保存，生成后可应用到编辑器再保存</p>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto thin-scroll px-5 py-4 space-y-3">
                      {aiMessages.length === 0 && (
                        <div className="text-center text-[13px] font-medium text-[#86868B] py-8">
                          先发一句指令，AI 会基于当前 HTML 草稿帮你改。
                        </div>
                      )}
                      {aiMessages.map((m, idx) => (
                        <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[92%] rounded-[18px] px-4 py-3 text-[13.5px] leading-relaxed font-medium ${
                            m.role === 'user'
                              ? 'bg-[#0071E3] text-white shadow-sm'
                              : 'bg-black/[0.04] text-[#1D1D1F]'
                          }`}>
                            <div className="whitespace-pre-wrap">{m.text}</div>
                            {m.html && (
                              <button
                                type="button"
                                onClick={() => applyAiHtml(m.html)}
                                className="mt-3 inline-flex items-center gap-2 bg-white/90 hover:bg-white text-[#1D1D1F] px-3 py-2 rounded-full text-[12px] font-black tracking-tight transition-all active:scale-[0.98]"
                              >
                                <Plus className="w-4 h-4" /> 应用到编辑器
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      {aiLoading && (
                        <div className="flex justify-start">
                          <div className="rounded-[18px] px-4 py-3 text-[13.5px] font-medium bg-black/[0.04] text-[#1D1D1F] inline-flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-[#AF52DE]" /> AI 正在生成…
                          </div>
                        </div>
                      )}
                      <div ref={aiEndRef} />
                    </div>
                    <div className="p-5 border-t border-black/[0.04] bg-white/60">
                      {/* 模式切换 */}
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <AiModeToggle
                          value={aiThinking}
                          onChange={setAiThinking}
                          disabled={aiLoading}
                        />
                        <span className="text-[11px] font-medium text-[#86868B] truncate">
                          {aiThinking
                            ? '思考模式：慢一点，但更会想'
                            : '普通模式：响应快，适合小改'}
                        </span>
                      </div>
                      <div className="flex items-end gap-3">
                        <textarea
                          value={aiInput}
                          onChange={(e) => setAiInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              sendAi();
                            }
                          }}
                          placeholder={
                            aiThinking
                              ? '思考模式已开启：AI 会用更深入的推理，适合复杂交互（回车发送）'
                              : '输入指令，回车发送（Shift+Enter 换行）'
                          }
                          rows={2}
                          className="flex-1 px-4 py-3 rounded-[18px] border border-black/[0.04] bg-white focus:bg-white focus:border-[#AF52DE]/30 focus:ring-[4px] focus:ring-[#AF52DE]/10 outline-none text-[13.5px] font-medium text-[#1D1D1F] transition-all shadow-sm resize-none"
                        />
                        <button
                          type="button"
                          onClick={sendAi}
                          disabled={aiLoading || !aiInput.trim()}
                          className="inline-flex items-center justify-center gap-2 bg-[#AF52DE] hover:bg-[#AF52DE]/90 disabled:bg-black/[0.04] disabled:text-[#86868B] text-white px-5 py-3 rounded-full text-[13px] font-black tracking-tight shadow-sm transition-all active:scale-[0.98] disabled:cursor-not-allowed"
                        >
                          {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                          发送
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-[#F5F5F7] rounded-[24px] border border-black/[0.04] p-5">
                    <p className="text-[11px] font-bold text-[#86868B] uppercase tracking-wider mb-2">标题</p>
                    <input
                      ref={titleRef}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="例如：配对小游戏 / 拖拽排序 / 点击找一找…"
                      className="w-full px-4 py-3 rounded-[16px] border border-black/[0.04] bg-white focus:bg-white focus:border-[#0071E3]/30 focus:ring-[4px] focus:ring-[#0071E3]/10 outline-none text-[15px] font-bold tracking-tight text-[#1D1D1F] transition-all shadow-sm"
                    />

                    <p className="text-[11px] font-bold text-[#86868B] uppercase tracking-wider mb-2 mt-4">描述（可选）</p>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="写一句你自己能看懂的备注，比如适用年龄/玩法/注意事项。"
                      rows={3}
                      className="w-full px-4 py-3 rounded-[16px] border border-black/[0.04] bg-white focus:bg-white focus:border-[#0071E3]/30 focus:ring-[4px] focus:ring-[#0071E3]/10 outline-none text-[14px] font-medium text-[#1D1D1F] transition-all shadow-sm resize-none"
                    />
                  </div>

                  <div className="bg-white/80 rounded-[24px] border border-black/[0.04] p-5 shadow-sm">
                    <p className="text-[11px] font-bold text-[#86868B] uppercase tracking-wider mb-3">素材来源</p>
                    <div className="inline-flex gap-1 bg-black/[0.03] p-1.5 rounded-[20px]">
                      <button
                        onClick={() => setSourceType('html')}
                        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-[16px] text-[13px] font-semibold transition-all ${
                          sourceType === 'html' ? 'bg-white text-[#1D1D1F] shadow-sm' : 'text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/[0.02]'
                        }`}
                      >
                        <FileText className="w-4 h-4" /> HTML
                      </button>
                      <button
                        onClick={() => setSourceType('url')}
                        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-[16px] text-[13px] font-semibold transition-all ${
                          sourceType === 'url' ? 'bg-white text-[#1D1D1F] shadow-sm' : 'text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/[0.02]'
                        }`}
                      >
                        <Search className="w-4 h-4" /> URL
                      </button>
                    </div>

                    {sourceType === 'url' ? (
                      <div className="mt-4">
                        <p className="text-[11px] font-bold text-[#86868B] uppercase tracking-wider mb-2">URL</p>
                        <input
                          value={htmlUrl}
                          onChange={(e) => setHtmlUrl(e.target.value)}
                          placeholder="例如：https://example.com/interactive.html"
                          className="w-full px-4 py-3 rounded-[16px] border border-black/[0.04] bg-white focus:bg-white focus:border-[#0071E3]/30 focus:ring-[4px] focus:ring-[#0071E3]/10 outline-none text-[14px] font-medium text-[#1D1D1F] transition-all shadow-sm"
                        />
                        <p className="text-[12px] font-medium text-[#86868B] mt-2 leading-relaxed">
                          建议使用可直接在 iframe 中打开的网页（需支持跨域嵌入）。
                        </p>
                      </div>
                    ) : (
                      <div className="mt-4">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <p className="text-[11px] font-bold text-[#86868B] uppercase tracking-wider">HTML 内容</p>
                          <button
                            type="button"
                            onClick={() => setHtmlContent('')}
                            className="inline-flex items-center gap-1.5 text-[12px] font-black tracking-tight text-[#FF3B30] bg-[#FF3B30]/10 hover:bg-[#FF3B30]/20 px-3 py-1.5 rounded-full transition-all active:scale-[0.98]"
                            title="一键清空下方 HTML 文本"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            清空
                          </button>
                        </div>
                        <textarea
                          value={htmlContent}
                          onChange={(e) => setHtmlContent(e.target.value)}
                          placeholder="粘贴完整 HTML（建议包含 <html>、<head>、<body>，以及必要的 JS/CSS）。"
                          rows={14}
                          className="w-full px-4 py-3 rounded-[16px] border border-black/[0.04] bg-white focus:bg-white focus:border-[#0071E3]/30 focus:ring-[4px] focus:ring-[#0071E3]/10 outline-none text-[13px] font-medium text-[#1D1D1F] transition-all shadow-sm resize-none font-mono"
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-[20px] border border-[#FF9F0A]/20 bg-[#FF9F0A]/12 px-5 py-4 text-[12.5px] font-medium text-[#7A4B00] leading-relaxed">
                      <p className="font-black tracking-tight text-[12px] mb-1.5">支持的格式</p>
                      <p>
                        你可以选择 <b>内联 HTML</b>（包含 JS/CSS），或填写 <b>HTTPS 外链</b>（如 GitHub Pages / 自建站点）。
                        推荐优先使用内联 HTML，稳定且可离线复用。
                      </p>
                    </div>

                    <div className="rounded-[20px] border border-[#0071E3]/20 bg-[#0071E3]/10 px-5 py-4 text-[12.5px] font-medium text-[#0A3D6B] leading-relaxed">
                      <p className="font-black tracking-tight text-[12px] mb-1.5">提示</p>
                      <p>
                        外链 URL 若无法预览，通常是站点设置了 <b>X-Frame-Options</b> 或 <b>CSP</b> 禁止被 iframe 嵌入。
                        可改用内联 HTML，或换一个支持嵌入的站点。
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer 操作区（占位不遮挡内容） */}
        <div className="px-6 sm:px-9 py-5 bg-white/80 backdrop-blur-2xl border-t border-black/[0.04] flex items-center justify-end gap-4">
          <button
            onClick={onClose}
            className="px-8 py-3.5 rounded-full text-[14px] text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/[0.04] font-black tracking-tight transition-all active:scale-[0.98]"
          >
            取消
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="inline-flex items-center gap-2 px-10 py-3.5 rounded-full text-[14px] bg-[#1D1D1F] hover:bg-[#333336] text-white font-black tracking-tight shadow-[0_10px_30px_rgba(0,0,0,0.18)] transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

function MediaCard({ item, onEdit, onDelete }) {
  const kind = item.kind;
  const isVideo = kind === 'video';
  const isAudio = kind === 'audio';
  const badgeLabel = isAudio ? '语音' : isVideo ? '视频' : '图片';
  return (
    <div className="group rounded-[28px] border border-black/[0.06] bg-white/80 backdrop-blur-2xl shadow-[0_10px_32px_rgba(0,0,0,0.05)] overflow-hidden hover:shadow-[0_18px_48px_rgba(0,0,0,0.08)] transition-all">
      <div className="relative">
        <div className={`${isAudio ? 'aspect-[16/7]' : 'aspect-[16/10]'} bg-[#F5F5F7]`}>
          {isVideo ? (
            <video
              src={item.url}
              className="w-full h-full object-cover bg-black"
              controls
              preload="metadata"
            />
          ) : isAudio ? (
            <div className="w-full h-full bg-gradient-to-br from-[#AF52DE]/10 via-white to-[#0071E3]/10 flex items-center justify-center p-4">
              <audio src={item.url} controls className="w-full" />
            </div>
          ) : (
            <img
              src={item.thumbnail_url || item.url}
              alt={item.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          )}
        </div>
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full text-white backdrop-blur ${
            isAudio ? 'bg-[#AF52DE]/90' : 'bg-black/60'
          }`}>
            {badgeLabel}
          </span>
          {item.linked_audio_url && !isAudio && (
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#AF52DE]/90 text-white backdrop-blur inline-flex items-center gap-1">
              已挂配音
            </span>
          )}
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h4 className="text-[16px] font-black tracking-tight text-[#1D1D1F] truncate">
              {item.title}
            </h4>
            {item.description ? (
              <p className="text-[13px] font-bold tracking-tight text-[#86868B] mt-1 line-clamp-2">
                {item.description}
              </p>
            ) : (
              <p className="text-[13px] font-bold tracking-tight text-[#86868B] mt-1">
                未填写描述
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onEdit}
              className="p-2 rounded-full bg-black/[0.04] hover:bg-black/[0.08] text-[#1D1D1F] transition-all active:scale-[0.95]"
              title="编辑"
              aria-label="编辑"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-2 rounded-full bg-[#FF3B30]/10 hover:bg-[#FF3B30]/20 text-[#FF3B30] transition-all active:scale-[0.95]"
              title="删除"
              aria-label="删除"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MediaModal({ open, mode, initial, kind, saving, onClose, onUpload, onUpdate }) {
  const titleRef = useRef(null);
  const fileRef = useRef(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title || '');
    setDescription(initial?.description || '');
    setFile(null);
    setTimeout(() => titleRef.current?.select(), 0);
  }, [open, initial]);

  if (!open) return null;

  const submit = async () => {
    const payload = { title: title.trim(), description: description.trim() || null };
    if (mode === 'create') {
      if (!file) return;
      await onUpload({ ...payload, file });
    } else {
      await onUpdate(payload);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex" onClick={onClose}>
      <div className="absolute inset-0 bg-black/55 backdrop-blur-2xl" />
      <div
        className="relative w-[calc(100vw-12px)] sm:w-[calc(100vw-20px)] max-w-2xl h-auto m-auto bg-[#F5F5F7]/95 backdrop-blur-3xl shadow-[0_32px_96px_rgba(0,0,0,0.28)] rounded-[32px] overflow-hidden border border-white/20 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-2 bg-gradient-to-r from-[#34C759] via-[#5AC8FA] to-[#0071E3]" />

        <div className="px-7 sm:px-9 py-6 border-b border-black/[0.04] bg-white/70 backdrop-blur-2xl flex items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <h3 className="text-[22px] sm:text-[24px] font-black tracking-tight text-[#1D1D1F]">
              {(() => {
                const kindLabel = kind === 'video' ? '视频' : kind === 'audio' ? '语音' : '图片';
                return mode === 'edit' ? `编辑${kindLabel}素材` : `上传${kindLabel}素材`;
              })()}
            </h3>
            <p className="text-[13px] font-bold tracking-tight text-[#86868B] mt-1.5">
              {mode === 'create' ? '选择文件并填写标题/描述。' : '修改标题/描述后保存。'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center transition-colors active:scale-[0.95] flex-shrink-0"
            aria-label="关闭"
            title="关闭"
          >
            <span className="text-[#86868B] font-black text-[18px] leading-none">×</span>
          </button>
        </div>

        <div className="p-6 sm:p-7 space-y-4">
          {mode === 'create' && (
            <div className="bg-white/80 rounded-[24px] border border-black/[0.04] p-5 shadow-sm">
              <p className="text-[11px] font-bold text-[#86868B] uppercase tracking-wider mb-2">文件</p>
              <input
                ref={fileRef}
                type="file"
                accept={kind === 'video' ? 'video/*' : kind === 'audio' ? 'audio/*' : 'image/*'}
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block w-full text-[13px] font-medium text-[#1D1D1F]"
              />
              {file && (
                <p className="text-[12px] font-medium text-[#86868B] mt-2">
                  已选择：{file.name}
                </p>
              )}
            </div>
          )}

          <div className="bg-[#F5F5F7] rounded-[24px] border border-black/[0.04] p-5">
            <p className="text-[11px] font-bold text-[#86868B] uppercase tracking-wider mb-2">标题</p>
            <input
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：表情卡 / 背景图 / 手势示范视频…"
              className="w-full px-4 py-3 rounded-[16px] border border-black/[0.04] bg-white focus:bg-white focus:border-[#0071E3]/30 focus:ring-[4px] focus:ring-[#0071E3]/10 outline-none text-[15px] font-bold tracking-tight text-[#1D1D1F] transition-all shadow-sm"
            />

            <p className="text-[11px] font-bold text-[#86868B] uppercase tracking-wider mb-2 mt-4">描述（可选）</p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="写一句你自己能看懂的备注，比如适用场景/年龄/使用方式。"
              rows={3}
              className="w-full px-4 py-3 rounded-[16px] border border-black/[0.04] bg-white focus:bg-white focus:border-[#0071E3]/30 focus:ring-[4px] focus:ring-[#0071E3]/10 outline-none text-[14px] font-medium text-[#1D1D1F] transition-all shadow-sm resize-none"
            />
          </div>
        </div>

        <div className="px-6 sm:px-9 py-5 bg-white/80 backdrop-blur-2xl border-t border-black/[0.04] flex items-center justify-end gap-4">
          <button
            onClick={onClose}
            className="px-8 py-3.5 rounded-full text-[14px] text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/[0.04] font-black tracking-tight transition-all active:scale-[0.98]"
          >
            取消
          </button>
          <button
            onClick={submit}
            disabled={saving || (mode === 'create' && !file) || !title.trim()}
            className="inline-flex items-center gap-2 px-10 py-3.5 rounded-full text-[14px] bg-[#1D1D1F] hover:bg-[#333336] text-white font-black tracking-tight shadow-[0_10px_30px_rgba(0,0,0,0.18)] transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {mode === 'create' ? '上传' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MaterialsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const allowedTabs = useMemo(() => TABS.filter((t) => t.enabled).map((t) => t.id), []);
  const [activeTab, setActiveTab] = useState(() => {
    const raw = searchParams.get('tab');
    return raw && allowedTabs.includes(raw) ? raw : 'interactive';
  });

  useEffect(() => {
    const raw = searchParams.get('tab');
    if (raw && allowedTabs.includes(raw) && raw !== activeTab) {
      setActiveTab(raw);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const current = searchParams.get('tab');
    if (current !== activeTab) {
      const next = new URLSearchParams(searchParams);
      next.set('tab', activeTab);
      setSearchParams(next, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [items, setItems] = useState([]);
  const [mediaItems, setMediaItems] = useState([]);
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState({ open: false, mode: 'create', item: null });
  const [mediaModal, setMediaModal] = useState({ open: false, mode: 'create', item: null, kind: 'image' });
  const [saving, setSaving] = useState(false);
  const [aiImageOpen, setAiImageOpen] = useState(false);
  const [aiAudioOpen, setAiAudioOpen] = useState(false);
  const { cost } = usePricing();
  const aiImageCost = cost('media.ai_image');
  const aiAudioCost = cost('media.ai_audio');

  const loadInteractive = async () => {
    setLoading(true);
    try {
      const r = await materialsApi.list();
      setItems(r.data || []);
    } catch (e) {
      setToast(getApiErrorMessage(e, '素材加载失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInteractive();
  }, []);

  const loadMedia = async (kind) => {
    setLoading(true);
    try {
      const r = await mediaMaterialsApi.list(kind);
      setMediaItems(r.data || []);
    } catch (e) {
      setToast(getApiErrorMessage(e, '素材加载失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'images') loadMedia('image');
    if (activeTab === 'videos') loadMedia('video');
    if (activeTab === 'audios') loadMedia('audio');
  }, [activeTab]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((m) => {
      const text = `${m.title || ''} ${m.description || ''}`.toLowerCase();
      return text.includes(q);
    });
  }, [items, query]);

  const filteredMedia = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return mediaItems;
    return mediaItems.filter((m) => {
      const text = `${m.title || ''} ${m.description || ''} ${m.original_filename || ''}`.toLowerCase();
      return text.includes(q);
    });
  }, [mediaItems, query]);

  const openCreate = () => setModal({ open: true, mode: 'create', item: null });
  const openEdit = (item) => setModal({ open: true, mode: 'edit', item });

  const openMediaCreate = (kind) => setMediaModal({ open: true, mode: 'create', item: null, kind });
  const openMediaEdit = (kind, item) => setMediaModal({ open: true, mode: 'edit', item, kind });

  const handleDelete = async (item) => {
    if (!confirm(`确定删除素材「${item.title}」？此操作不可撤销。`)) return;
    try {
      await materialsApi.delete(item.id);
      setItems((prev) => prev.filter((x) => String(x.id) !== String(item.id)));
      setToast('已删除');
    } catch (e) {
      setToast(getApiErrorMessage(e, '删除失败'));
    }
  };

  const handleMediaDelete = async (item) => {
    if (!confirm(`确定删除素材「${item.title}」？此操作不可撤销。`)) return;
    try {
      await mediaMaterialsApi.delete(item.id);
      setMediaItems((prev) => prev.filter((x) => String(x.id) !== String(item.id)));
      setToast('已删除');
    } catch (e) {
      setToast(getApiErrorMessage(e, '删除失败'));
    }
  };

  const handleSave = async (payload) => {
    if (saving) return;
    if (!payload.title || !payload.title.trim()) {
      setToast('请填写标题');
      return;
    }
    const hasHtml = !!(payload.html_content && payload.html_content.trim());
    const hasUrl = !!(payload.html_url && payload.html_url.trim());
    if (!hasHtml && !hasUrl) {
      setToast('请提供 HTML 内容或 URL 至少其一');
      return;
    }

    setSaving(true);
    try {
      if (modal.mode === 'edit' && modal.item?.id) {
        const r = await materialsApi.update(modal.item.id, payload);
        const updated = r.data;
        setItems((prev) => prev.map((x) => (String(x.id) === String(updated.id) ? updated : x)));
        setToast('已保存');
      } else {
        const r = await materialsApi.create(payload);
        setItems((prev) => [r.data, ...prev]);
        setToast('已创建');
      }
      setModal({ open: false, mode: 'create', item: null });
    } catch (e) {
      setToast(getApiErrorMessage(e, '保存失败'));
    } finally {
      setSaving(false);
    }
  };

  const handleMediaUpload = async ({ file, title, description } = {}) => {
    if (saving) return;
    if (!file) {
      setToast('请选择文件');
      return;
    }
    if (!title || !title.trim()) {
      setToast('请填写标题');
      return;
    }
    setSaving(true);
    try {
      const r = await mediaMaterialsApi.upload({ file, title, description });
      setMediaItems((prev) => [r.data, ...prev]);
      setToast('已上传');
      setMediaModal({ open: false, mode: 'create', item: null, kind: mediaModal.kind });
    } catch (e) {
      setToast(getApiErrorMessage(e, '上传失败'));
    } finally {
      setSaving(false);
    }
  };

  const handleMediaUpdate = async (payload) => {
    if (saving) return;
    if (!payload.title || !payload.title.trim()) {
      setToast('请填写标题');
      return;
    }
    setSaving(true);
    try {
      const r = await mediaMaterialsApi.update(mediaModal.item.id, payload);
      const updated = r.data;
      setMediaItems((prev) => prev.map((x) => (String(x.id) === String(updated.id) ? updated : x)));
      setToast('已保存');
      setMediaModal({ open: false, mode: 'create', item: null, kind: mediaModal.kind });
    } catch (e) {
      setToast(getApiErrorMessage(e, '保存失败'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="slide-fade">
      <Toast message={toast} onClose={() => setToast('')} />

      <section className="mb-8 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
        <div>
          <h1 className="text-[32px] sm:text-[38px] font-bold tracking-tight text-[#1D1D1F]">个人素材库</h1>
          <p className="text-[#86868B] mt-2 text-[15px] font-medium">
            管理你自己的可复用素材：图片、视频、角色道具、互动网页。
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-5 h-5 text-[#86868B] absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索素材标题或描述..."
              className="w-full pl-12 pr-5 py-3.5 rounded-full bg-white/80 backdrop-blur-2xl border border-black/[0.04] focus:border-[#0071E3]/30 focus:bg-white focus:ring-[4px] focus:ring-[#0071E3]/10 outline-none text-[15px] font-medium text-[#1D1D1F] placeholder:text-[#86868B]/80 transition-all shadow-sm"
            />
          </div>
          {activeTab === 'images' && (
            <button
              onClick={() => setAiImageOpen(true)}
              className="inline-flex items-center justify-center gap-2 bg-[#0071E3] hover:bg-[#0077ED] text-white px-5 py-3.5 rounded-full text-[14px] font-bold tracking-tight transition-all shadow-sm active:scale-[0.98]"
              title={`AI 生成图片素材（约 ${aiImageCost} 点）`}
            >
              <Wand className="w-4 h-4" /> AI 生成
            </button>
          )}
          {activeTab === 'audios' && (
            <button
              onClick={() => setAiAudioOpen(true)}
              className="inline-flex items-center justify-center gap-2 bg-[#AF52DE] hover:bg-[#AF52DE]/90 text-white px-5 py-3.5 rounded-full text-[14px] font-bold tracking-tight transition-all shadow-sm active:scale-[0.98]"
              title={`AI 生成语音素材（约 ${aiAudioCost} 点）`}
            >
              <Wand className="w-4 h-4" /> AI 生成
            </button>
          )}
          <button
            onClick={() => {
              if (activeTab === 'interactive') openCreate();
              else if (activeTab === 'images') openMediaCreate('image');
              else if (activeTab === 'videos') openMediaCreate('video');
              else if (activeTab === 'audios') openMediaCreate('audio');
              else setToast('该素材库功能即将上线。');
            }}
            className="inline-flex items-center justify-center gap-2 bg-[#1D1D1F] hover:bg-[#333336] text-white px-6 py-3.5 rounded-full text-[15px] font-bold tracking-tight transition-all shadow-sm active:scale-[0.98]"
          >
            <Plus className="w-5 h-5" /> 新建
          </button>
        </div>
      </section>

      <section className="mb-8 overflow-x-auto hide-scroll -mx-2 px-2">
        <div className="inline-flex gap-1 bg-black/[0.03] p-1.5 rounded-[20px] relative">
          {TABS.map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => t.enabled && setActiveTab(t.id)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-[16px] text-[14px] font-semibold whitespace-nowrap transition-all duration-300 ${
                  active ? 'bg-white text-[#1D1D1F] shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : 'text-[#515154] hover:bg-black/[0.02]'
                } ${t.enabled ? '' : 'opacity-50 cursor-not-allowed'}`}
                title={t.enabled ? t.label : '敬请期待'}
              >
                {t.label}
                {!t.enabled && <span className="text-[12px] font-bold text-[#86868B]">敬请期待</span>}
              </button>
            );
          })}
        </div>
      </section>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-10 h-10 text-[#0071E3] animate-spin" />
        </div>
      ) : activeTab === 'interactive' ? (
        filtered.length === 0 ? (
          <EmptyState query={query} onCreate={openCreate} />
        ) : (
          <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(320px,1fr))]">
            {filtered.map((m) => (
              <MaterialCard
                key={m.id}
                item={m}
                onEdit={() => openEdit(m)}
                onDelete={() => handleDelete(m)}
              />
            ))}
          </div>
        )
      ) : activeTab === 'images' || activeTab === 'videos' || activeTab === 'audios' ? (
        (() => {
          const currentKind =
            activeTab === 'videos' ? 'video' : activeTab === 'audios' ? 'audio' : 'image';
          const kindLabel =
            activeTab === 'videos' ? '视频' : activeTab === 'audios' ? '语音' : '图片';
          if (filteredMedia.length === 0) {
            return (
              <div className="rounded-[40px] border-[3px] border-black/[0.04] bg-white/80 backdrop-blur-3xl p-16 text-center shadow-[0_12px_40px_rgba(0,0,0,0.06)]">
                <div className="w-20 h-20 rounded-[24px] bg-[#1D1D1F] text-white mx-auto flex items-center justify-center mb-6 shadow-md">
                  <FolderOpen className="w-10 h-10" />
                </div>
                <h3 className="text-[20px] font-bold tracking-tight text-[#1D1D1F] mb-2">
                  {query ? `没有匹配 “${query}” 的素材` : `还没有${kindLabel}素材`}
                </h3>
                <p className="text-[14px] font-medium text-[#86868B] mb-8 leading-relaxed">
                  上传后可在课程制作中快速复用。
                </p>
                {!query && (
                  <button
                    onClick={() => openMediaCreate(currentKind)}
                    className="inline-flex items-center gap-2 bg-[#0071E3] hover:bg-[#0077ED] text-white px-6 py-3.5 rounded-full text-[15px] font-bold tracking-tight transition-all shadow-sm active:scale-[0.98]"
                  >
                    <Plus className="w-5 h-5" /> 上传{kindLabel}素材
                  </button>
                )}
              </div>
            );
          }
          return (
            <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(320px,1fr))]">
              {filteredMedia.map((m) => (
                <MediaCard
                  key={m.id}
                  item={m}
                  onEdit={() => openMediaEdit(currentKind, m)}
                  onDelete={() => handleMediaDelete(m)}
                />
              ))}
            </div>
          );
        })()
      ) : (
        <div className="rounded-[40px] border-[3px] border-black/[0.04] bg-white/80 backdrop-blur-3xl p-16 text-center text-[16px] font-bold tracking-tight text-[#86868B] shadow-[0_12px_40px_rgba(0,0,0,0.06)]">
          该素材库功能即将上线。
        </div>
      )}

      {modal.open && typeof document !== 'undefined' && createPortal(
        <ModalErrorBoundary onClose={() => setModal({ open: false, mode: 'create', item: null })}>
          <MaterialModal
            open={modal.open}
            mode={modal.mode}
            initial={modal.item}
            saving={saving}
            onClose={() => setModal({ open: false, mode: 'create', item: null })}
            onSave={handleSave}
          />
        </ModalErrorBoundary>,
        document.body
      )}

      {mediaModal.open && typeof document !== 'undefined' && createPortal(
        <ModalErrorBoundary onClose={() => setMediaModal({ open: false, mode: 'create', item: null, kind: mediaModal.kind })}>
          <MediaModal
            open={mediaModal.open}
            mode={mediaModal.mode}
            initial={mediaModal.item}
            kind={mediaModal.kind}
            saving={saving}
            onClose={() => setMediaModal({ open: false, mode: 'create', item: null, kind: mediaModal.kind })}
            onUpload={handleMediaUpload}
            onUpdate={handleMediaUpdate}
          />
        </ModalErrorBoundary>,
        document.body
      )}

      <AiImageMaterialModal
        open={aiImageOpen}
        onClose={() => setAiImageOpen(false)}
        onSaved={(saved) => {
          setToast('已存到个人素材库');
          if (activeTab === 'images' && saved) {
            setMediaItems((prev) => [saved, ...prev]);
          }
        }}
        imageCost={aiImageCost}
        audioCost={aiAudioCost}
      />
      <AiAudioMaterialModal
        open={aiAudioOpen}
        onClose={() => setAiAudioOpen(false)}
        onSaved={(saved) => {
          setToast('已存到个人素材库');
          if (activeTab === 'audios' && saved) {
            setMediaItems((prev) => [saved, ...prev]);
          }
        }}
        audioCost={aiAudioCost}
      />
    </div>
  );
}

