import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { plansApi } from '../api/client';
import { ArrowLeft, Clock, Heart, BookOpen, Sparkles } from '../components/Icons';

export default function HistoryPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('plans');
  const [plans, setPlans] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    plansApi.list().then((r) => setPlans(r.data)).catch(() => {});
    plansApi.favorites().then((r) => setFavorites(r.data)).catch(() => {});
    plansApi.history().then((r) => setHistory(r.data)).catch(() => {});
  }, []);

  const actionLabel = {
    upload: '上传课程',
    generate: '生成教案',
    view: '查看',
    favorite: '收藏',
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <header className="bg-white/80 backdrop-blur-2xl border-b border-black/[0.04] sticky top-0 z-30">
        <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-4 flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/[0.04] p-2.5 -ml-2.5 rounded-full transition-all active:scale-[0.95]">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[12px] bg-black/[0.04] flex items-center justify-center text-[#1D1D1F]">
              <Clock className="w-5 h-5" />
            </div>
            <h1 className="text-[20px] font-black tracking-tight text-[#1D1D1F]">历史记录</h1>
          </div>
        </div>
      </header>

      <main className="max-w-[1280px] mx-auto px-4 lg:px-8 py-8">
        <div className="flex gap-2 mb-8 bg-black/[0.03] p-1.5 rounded-[24px] shadow-inner max-w-2xl mx-auto">
          {[
            { key: 'plans', label: '我的教案', icon: <Sparkles className="w-4 h-4" /> },
            { key: 'favorites', label: '收藏', icon: <Heart className="w-4 h-4" /> },
            { key: 'history', label: '操作记录', icon: <Clock className="w-4 h-4" /> },
          ].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-[18px] font-bold tracking-tight text-[15px] transition-all duration-300 ${tab === t.key ? 'bg-white text-[#1D1D1F] shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : 'text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/[0.02]'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {tab === 'plans' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {plans.length === 0 ? (
              <p className="col-span-full text-center text-[#86868B] py-20 font-bold tracking-tight">暂无教案</p>
            ) : plans.map((p) => (
              <div key={p.id} onClick={() => navigate(`/workspace/${p.book_id}`)}
                className="bg-white/80 backdrop-blur-2xl p-6 rounded-[24px] border border-black/[0.04] shadow-sm hover:shadow-md hover:border-[#0071E3]/30 cursor-pointer transition-all duration-300">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold tracking-tight text-[16px] text-[#1D1D1F] truncate">{p.content?.plan?.title || p.content?.title || '未命名教案'}</h3>
                    <p className="text-[13px] font-medium text-[#86868B] mt-1.5 truncate">{p.book_filename}</p>
                  </div>
                  <span className="text-[12px] font-bold tracking-tight text-[#86868B] bg-black/[0.04] px-2.5 py-1 rounded-full flex-shrink-0">{new Date(p.created_at).toLocaleString('zh-CN')}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'favorites' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {favorites.length === 0 ? (
              <p className="col-span-full text-center text-[#86868B] py-20 font-bold tracking-tight">暂无收藏</p>
            ) : favorites.map((p) => (
              <div key={p.id} onClick={() => navigate(`/workspace/${p.book_id}`)}
                className="bg-white/80 backdrop-blur-2xl p-6 rounded-[24px] border border-black/[0.04] shadow-sm hover:shadow-md hover:border-[#FF2D55]/30 cursor-pointer transition-all duration-300 flex items-start gap-4">
                <div className="w-10 h-10 rounded-[12px] bg-[#FF2D55]/10 text-[#FF2D55] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Heart className="w-5 h-5" fill="currentColor" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <h3 className="font-bold tracking-tight text-[16px] text-[#1D1D1F] truncate">{p.content?.plan?.title || p.content?.title || '未命名教案'}</h3>
                  </div>
                  <p className="text-[13px] font-medium text-[#86868B] truncate mb-3">{p.book_filename}</p>
                  <span className="text-[12px] font-bold tracking-tight text-[#86868B] bg-black/[0.04] px-2.5 py-1 rounded-full">{new Date(p.created_at).toLocaleString('zh-CN')}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'history' && (
          <div className="space-y-4 max-w-3xl mx-auto relative before:absolute before:inset-0 before:ml-[31px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-black/[0.08] before:to-transparent">
            {history.length === 0 ? (
              <p className="text-center text-[#86868B] py-20 font-bold tracking-tight">暂无记录</p>
            ) : history.map((h) => (
              <div key={h.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                <div className="flex items-center justify-center w-16 h-16 rounded-full border-4 border-[#F5F5F7] bg-white text-[#86868B] group-hover:text-[#0071E3] shadow-sm flex-shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 transition-colors">
                  <Clock className="w-6 h-6" />
                </div>
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-5 rounded-[24px] bg-white border border-black/[0.04] shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[15px] font-bold tracking-tight text-[#1D1D1F]">{actionLabel[h.action] || h.action}</p>
                    <span className="text-[12px] font-bold tracking-tight text-[#86868B] bg-black/[0.04] px-2.5 py-1 rounded-full">{new Date(h.created_at).toLocaleString('zh-CN')}</span>
                  </div>
                  {/* 可选：展示更多历史详情信息，根据需要添加 */}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
