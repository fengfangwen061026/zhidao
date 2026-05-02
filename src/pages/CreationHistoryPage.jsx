import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { generationApi } from '../api/client';
import Toast from '../components/Toast';
import { ArrowLeft, Sparkles, BookOpen, Loader2, Trash2, Clock } from '../components/Icons';

const STATUS_MAP = {
  draft: { label: '草稿', color: 'bg-black/[0.04] text-[#86868B]' },
  characters_ready: { label: '角色已就绪', color: 'bg-[#0071E3]/10 text-[#0071E3]' },
  story_ready: { label: '待生成课程', color: 'bg-[#AF52DE]/10 text-[#AF52DE]' },
  generating: { label: '正在生成...', color: 'bg-[#FF9F0A]/10 text-[#FF9F0A]' },
  done: { label: '已完成', color: 'bg-[#34C759]/10 text-[#34C759]' },
  error: { label: '生成失败', color: 'bg-[#FF3B30]/10 text-[#FF3B30]' },
};

const STYLE_MAP = {
  watercolor: '水彩', flat: '扁平', '3d': '3D 卡通',
  chinese_ink: '中国风', oil_painting: '油画',
};

export default function CreationHistoryPage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  useEffect(() => {
    generationApi.listTasks()
      .then(r => setTasks(r.data || []))
      .catch(() => setToast('加载失败'))
      .finally(() => setLoading(false));
  }, []);

  const handleClick = (task) => {
    if (task.status === 'done' && task.book_id) {
      navigate(`/workspace/${task.book_id}`);
    } else {
      navigate(`/create?task=${task.id}`);
    }
  };

  const handleDelete = async (e, taskId) => {
    e.stopPropagation();
    if (!confirm('确定删除这个创作记录？')) return;
    try {
      await generationApi.deleteTask(taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch {
      setToast('删除失败');
    }
  };

  const formatTime = (ts) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
    return d.toLocaleDateString('zh-CN');
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <Toast message={toast} onClose={() => setToast('')} />

      <header className="bg-white/80 backdrop-blur-2xl border-b border-black/[0.04] sticky top-0 z-30">
        <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-4 flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/[0.04] p-2.5 -ml-2.5 rounded-full transition-all active:scale-[0.95]">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[12px] bg-black/[0.04] flex items-center justify-center text-[#1D1D1F]">
              <Clock className="w-5 h-5" />
            </div>
            <h1 className="text-[20px] font-black tracking-tight text-[#1D1D1F]">创作历史</h1>
          </div>
          <button onClick={() => navigate('/create')}
            className="ml-auto text-[14px] font-bold tracking-tight bg-[#1D1D1F] text-white px-5 py-2.5 rounded-full hover:bg-[#333336] transition-all shadow-sm active:scale-[0.95] flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" /> 新建创作
          </button>
        </div>
      </header>

      <main className="max-w-[1280px] mx-auto px-4 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-[#0071E3] animate-spin" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-32 rounded-[32px] border border-black/[0.04] bg-white/80 backdrop-blur-2xl shadow-sm">
            <div className="w-20 h-20 rounded-[24px] bg-[#1D1D1F] text-white mx-auto flex items-center justify-center mb-6 shadow-md">
              <Sparkles className="w-10 h-10" />
            </div>
            <h3 className="text-[20px] font-bold tracking-tight text-[#1D1D1F] mb-2">还没有创作记录</h3>
            <p className="text-[14px] font-medium tracking-tight text-[#86868B] mb-8">点击下方按钮开始你的第一次 AI 课程创作</p>
            <button onClick={() => navigate('/create')}
              className="bg-[#0071E3] hover:bg-[#0077ED] text-white px-6 py-3.5 rounded-full font-bold tracking-tight text-[15px] transition-all shadow-sm active:scale-[0.98] inline-flex items-center gap-2">
              <Sparkles className="w-5 h-5" /> 开始创作
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {tasks.map(task => {
              const st = STATUS_MAP[task.status] || STATUS_MAP.draft;
              const isDone = task.status === 'done';
              return (
                <div key={task.id} onClick={() => handleClick(task)}
                  className="group bg-white/80 backdrop-blur-2xl rounded-[24px] p-6 shadow-sm border border-black/[0.04] cursor-pointer hover:shadow-md hover:border-[#0071E3]/30 transition-all duration-300">
                  <div className="flex items-start gap-5">
                    <div className={`w-12 h-12 rounded-[16px] flex items-center justify-center flex-shrink-0 ${isDone ? 'bg-[#34C759]/10 text-[#34C759]' : 'bg-[#0071E3]/10 text-[#0071E3]'}`}>
                      {isDone
                        ? <BookOpen className="w-6 h-6" />
                        : <Sparkles className="w-6 h-6" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h3 className="font-bold tracking-tight text-[16px] text-[#1D1D1F] truncate pt-0.5">{task.theme}</h3>
                        <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold tracking-tight flex-shrink-0 ${st.color}`}>
                          {st.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[13px] font-medium text-[#86868B]">
                        <span>{STYLE_MAP[task.style] || task.style}</span>
                        <span>{task.page_count} 页</span>
                        <span>{formatTime(task.updated_at)}</span>
                      </div>
                      <div className="mt-4 pt-4 border-t border-black/[0.04] flex items-center justify-between">
                        {isDone ? (
                          <span className="text-[13px] font-bold tracking-tight text-[#34C759]">
                            课程已生成 — 点击查看
                          </span>
                        ) : task.status !== 'error' ? (
                          <span className="text-[13px] font-bold tracking-tight text-[#0071E3]">
                            点击继续创作
                          </span>
                        ) : (
                          <span className="text-[13px] font-bold tracking-tight text-[#FF3B30]">
                            点击重试
                          </span>
                        )}
                        <button onClick={(e) => handleDelete(e, task.id)}
                          className="text-[#86868B] hover:text-[#FF3B30] opacity-0 group-hover:opacity-100 transition-all p-1.5 -mr-1.5 rounded-full hover:bg-[#FF3B30]/10">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
