import { Trash2 } from './Icons';

function SegmentedTabs({ value, options, onChange }) {
  return (
    <div className="inline-flex bg-black/[0.04] rounded-[16px] p-1.5 w-fit">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-4 py-2.5 rounded-[12px] text-[13px] font-bold tracking-tight transition-all duration-300 ${
            value === opt.value
              ? 'bg-white text-[#1D1D1F] shadow-[0_2px_8px_rgba(0,0,0,0.06)]'
              : 'text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/[0.02]'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function TipBox() {
  return (
    <div className="space-y-3 text-[13px] font-medium leading-relaxed tracking-tight">
      <div className="bg-[#FF9F0A]/10 border border-[#FF9F0A]/20 text-[#FF9F0A] rounded-[16px] p-4 shadow-sm">
        <strong className="font-bold">支持的格式</strong>：内联 HTML（含 JS/CSS）；
        也可填 HTTPS 外链（如 GeoGebra、H5 游戏）。如想让 AI 帮着改，切到
        "AI 对话" Tab 即可。
      </div>
      <div className="bg-[#0071E3]/10 border border-[#0071E3]/20 text-[#0071E3] rounded-[16px] p-4 shadow-sm">
        <strong className="font-bold">提示</strong>：学生端以 iframe 嵌入展示，
        外链链接模式下，部分网站（设置了 X-Frame-Options）可能拒绝被嵌入。
        先在本机确认链接可访问后使用，或把互动网页以内联 HTML 保存到素材库，方便在其他课堂中复用。
      </div>
    </div>
  );
}

/**
 * 基本信息 Tab：步骤标题 / 描述 / 内联 HTML / 外链 URL / 素材库导入。
 *
 * 手动编辑 HTML 通过 ``onHtmlChange`` 回传；父组件负责 debounce 后登记
 * 成 manual 版本。
 */
export default function InteractiveBasicInfoPanel({
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  sourceMode,
  onSourceModeChange,
  html,
  onHtmlChange,
  url,
  onUrlChange,
  onFormatHtml,
}) {
  return (
    <div className="px-8 py-6 space-y-6">
      <div>
        <label className="text-[13px] font-black text-[#86868B] uppercase tracking-wider mb-3 block px-2">
          步骤标题
        </label>
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="输入步骤标题"
          className="w-full border border-black/[0.04] bg-white hover:bg-white/90 rounded-[20px] px-6 py-4 text-[16px] font-black text-[#1D1D1F] focus:outline-none focus:ring-[4px] focus:ring-[#0071E3]/10 focus:border-[#0071E3]/30 shadow-sm transition-all placeholder:text-[#86868B]/80"
        />
      </div>

      <div>
        <label className="text-[13px] font-black text-[#86868B] uppercase tracking-wider mb-3 block px-2">
          步骤描述
        </label>
        <textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="输入步骤描述"
          rows={2}
          className="w-full border border-black/[0.04] bg-white hover:bg-white/90 rounded-[24px] px-6 py-5 text-[15px] font-medium leading-relaxed text-[#1D1D1F] focus:outline-none focus:ring-[4px] focus:ring-[#0071E3]/10 focus:border-[#0071E3]/30 resize-none shadow-sm transition-all placeholder:text-[#86868B]/80"
        />
      </div>

      <div>
        <label className="text-[13px] font-black text-[#86868B] uppercase tracking-wider mb-4 block px-2">
          互动网页内容
        </label>
        <div className="flex items-center gap-4 mb-5">
          <SegmentedTabs
            value={sourceMode}
            options={[
              { value: 'html', label: '内联 HTML' },
              { value: 'url', label: '外链 URL' },
            ]}
            onChange={onSourceModeChange}
          />
          {sourceMode === 'html' && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onFormatHtml}
                className="text-[14px] font-bold tracking-tight text-[#AF52DE] bg-[#AF52DE]/10 hover:bg-[#AF52DE]/20 px-5 py-3 rounded-[16px] transition-all active:scale-[0.98]"
              >
                格式化 HTML
              </button>
              <button
                type="button"
                onClick={() => onHtmlChange('')}
                className="inline-flex items-center gap-2 text-[14px] font-bold tracking-tight text-[#FF3B30] bg-[#FF3B30]/10 hover:bg-[#FF3B30]/20 px-5 py-3 rounded-[16px] transition-all active:scale-[0.98]"
                title="一键清空下方 HTML 文本"
              >
                <Trash2 className="w-4 h-4" />
                清空
              </button>
            </div>
          )}
        </div>

        {sourceMode === 'html' ? (
          <textarea
            value={html}
            onChange={(e) => onHtmlChange(e.target.value)}
            rows={18}
            spellCheck={false}
            className="w-full border border-black/[0.04] bg-white hover:bg-white/90 rounded-[28px] px-6 py-5 text-[14px] font-mono text-[#1D1D1F] focus:outline-none focus:ring-[4px] focus:ring-[#0071E3]/10 focus:border-[#0071E3]/30 resize-y leading-relaxed shadow-sm transition-all"
            placeholder="<!DOCTYPE html> ..."
          />
        ) : (
          <input
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="https://www.geogebra.org/classic 或任意支持 iframe 嵌入的 H5 链接"
            className="w-full border border-black/[0.04] bg-white hover:bg-white/90 rounded-[24px] px-6 py-5 text-[16px] font-medium text-[#1D1D1F] focus:outline-none focus:ring-[4px] focus:ring-[#0071E3]/10 focus:border-[#0071E3]/30 shadow-sm transition-all placeholder:text-[#86868B]/80"
          />
        )}
      </div>

      <TipBox />
    </div>
  );
}
