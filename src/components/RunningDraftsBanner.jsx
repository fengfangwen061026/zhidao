import { Loader2 } from './Icons';

/**
 * 顶部横幅：后台 running 的互动生成列表。
 *
 * - 非空才渲染；普通流式块（不 sticky），让 header 能 sticky 压在它之上
 * - 正在编辑的那一条不显示（避免"你手上这条还在转还提醒你"）
 * - 点"继续"直接跳回对应抽屉；跨 Tab / 跨刷新都能恢复
 *
 * 注：独立文件是为了让 Vite React Fast Refresh 正确处理 HMR 边界；
 * 之前内联在 WorkspacePage.jsx 里会出现 ReferenceError（热更新漏拾）。
 */
export default function RunningDraftsBanner({ drafts, currentEditing, onResume }) {
  const items = (drafts || []).filter((d) => {
    // 过滤掉当前正在抽屉里看的那条：避免页面上下都提示
    if (!currentEditing) return true;
    if (currentEditing.mode === 'edit' && currentEditing.page) {
      if (d.page_number === currentEditing.page.page_number) return false;
    }
    if (currentEditing.mode === 'insert') {
      // insert 模式下，editing.draftKey 是唯一凭证；没 draftKey 的旧兼容 draft 不去比了
      if (currentEditing.draftKey && d.draft_key === currentEditing.draftKey) return false;
    }
    return true;
  });
  if (items.length === 0) return null;

  return (
    <div>
      <div className="bg-gradient-to-r from-[#AF52DE] via-[#FF2D55] to-[#FF9F0A] text-white shadow-[0_4px_16px_rgba(175,82,222,0.35)]">
        <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-2.5 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 text-[13px] font-black tracking-tight">
            <Loader2 className="w-4 h-4 animate-spin" />
            有 {items.length} 个互动网页正在后台生成
          </span>
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
            {items.map((d) => {
              const entries = Array.isArray(d.progress_log) ? d.progress_log : [];
              const done = entries.filter((e) => e.state === 'done').length;
              const total = entries.length;
              const last = [...entries].reverse().find((e) => e.state === 'running');
              const lastTitle = last?.title || (entries[entries.length - 1]?.title ?? '准备中');
              const loc = d.page_number ? `第 ${d.page_number} 页` : '新插入草稿';
              return (
                <button
                  key={d.message_id}
                  onClick={() => onResume?.(d)}
                  className="inline-flex items-center gap-2 text-[12px] font-bold tracking-tight bg-white/20 hover:bg-white/30 backdrop-blur px-3 py-1 rounded-full transition-all active:scale-[0.96]"
                  title="点击回到对应抽屉查看/停止"
                >
                  <span>{loc}</span>
                  <span className="opacity-80">· {lastTitle}</span>
                  {total > 0 && (
                    <span className="opacity-80">
                      （{done}/{total}）
                    </span>
                  )}
                  <span className="opacity-90 underline underline-offset-2">继续</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
