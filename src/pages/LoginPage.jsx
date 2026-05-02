import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getApiErrorMessage } from '../api/client';
import { BookOpen, Loader2, Sparkles, CheckCircle2 } from '../components/Icons';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [approvedHint, setApprovedHint] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // 审核通过后会被 PendingReviewPage 自动踢到这里，此时 sessionStorage 里有注册时
  // 临时存下的账号密码，自动回填给老师，点击登录即可进入。
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('pendingLoginCreds');
      if (!raw) return;
      const creds = JSON.parse(raw);
      if (creds?.email) setEmail(creds.email);
      if (creds?.password) setPassword(creds.password);
      setApprovedHint(true);
    } catch { /* 解析失败时忽略 */ }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      try { sessionStorage.removeItem('pendingLoginCreds'); } catch { /* ignore */ }
      navigate('/');
    } catch (err) {
      setError(getApiErrorMessage(err, '登录失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-stretch bg-[#F5F5F7]">
      {/* Left promo panel */}
      <aside className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-[#1D1D1F] via-[#333336] to-black text-white p-16 flex-col justify-between">
        <div className="absolute top-0 right-0 -mr-24 -mt-24 w-96 h-96 bg-gradient-to-br from-[#0071E3]/20 to-[#AF52DE]/20 rounded-full blur-3xl opacity-50" />
        
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-14 h-14 rounded-[20px] bg-white/10 backdrop-blur-md flex items-center justify-center shadow-sm border border-white/10">
            <BookOpen className="w-7 h-7 text-white" />
          </div>
          <div>
            <p className="text-[20px] font-black tracking-tight leading-tight">知岛幼师</p>
            <p className="text-[13px] font-bold tracking-tight text-white/70 mt-0.5">AI 课程教案助手</p>
          </div>
        </div>

        <div className="relative z-10 my-auto">
          <h2 className="text-[42px] font-black tracking-tight leading-tight mb-6">一句话生成<br />专业级课程教案</h2>
          <p className="text-white/80 leading-relaxed max-w-md text-[16px] font-medium tracking-tight">
            上传课程或输入主题，AI 帮你完成公开课教案、配音、互动，像在身边多了一位备课搭档。
          </p>
          <ul className="mt-8 space-y-4 text-[15px] font-bold tracking-tight text-white/90">
            <li className="flex items-center gap-3"><Sparkles className="w-5 h-5 text-[#0071E3]" /> 上传 PDF / PPTX，一键成页</li>
            <li className="flex items-center gap-3"><Sparkles className="w-5 h-5 text-[#FF9F0A]" /> 基于全本智能生成活动教案</li>
            <li className="flex items-center gap-3"><Sparkles className="w-5 h-5 text-[#AF52DE]" /> 角色对话 / 续写 / 投屏播放</li>
          </ul>
        </div>

        <div className="relative z-10 text-[12px] font-bold tracking-tight text-white/50">
          © 知岛幼师 · 让备课像写一句话一样简单
        </div>
      </aside>

      {/* Form */}
      <main className="flex-1 flex items-center justify-center p-6 sm:p-10 relative">
        <div className="w-full max-w-md relative z-10">
          <div className="lg:hidden text-center mb-10">
            <div className="inline-flex items-center justify-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-[20px] bg-[#1D1D1F] text-white flex items-center justify-center shadow-md">
                <BookOpen className="w-7 h-7" />
              </div>
              <div className="text-left">
                <p className="text-[22px] font-black tracking-tight text-[#1D1D1F] leading-tight">知岛幼师</p>
                <p className="text-[13px] font-bold tracking-tight text-[#86868B] mt-0.5">AI 课程教案助手</p>
              </div>
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-3xl rounded-[40px] shadow-[0_24px_64px_rgba(0,0,0,0.08)] border-[3px] border-black/[0.04] p-10 sm:p-12 hover:shadow-[0_32px_80px_rgba(0,0,0,0.12)] transition-shadow duration-500">
            <h2 className="text-[32px] font-black tracking-tight text-[#1D1D1F] mb-3">
              {approvedHint ? '审核已通过' : '欢迎回来'}
            </h2>
            <p className="text-[16px] font-bold tracking-tight text-[#86868B] mb-10">
              {approvedHint ? '已为您填好账号和密码，点击下方“登录”即可进入。' : '使用邮箱和密码继续。'}
            </p>

            {approvedHint && (
              <div className="mb-6 flex items-start gap-3 bg-[#34C759]/10 border border-[#34C759]/20 rounded-[20px] px-5 py-4">
                <CheckCircle2 className="w-5 h-5 text-[#34C759] mt-0.5 flex-shrink-0" />
                <div className="text-[13px] font-bold tracking-tight text-[#1D1D1F] leading-relaxed">
                  恭喜！您的资料已通过审核，<span className="text-[#34C759] font-black">试用点数已到账</span>。
                  下面的账号密码是您注册时设置的，直接点击登录即可开始使用。
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {error && <div className="bg-[#FF3B30]/10 text-[#FF3B30] text-[14px] font-black tracking-tight px-5 py-4 rounded-[20px] border border-[#FF3B30]/20">{error}</div>}

              <div>
                <label className="block text-[14px] font-black tracking-tight text-[#1D1D1F] mb-3 px-2">邮箱</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                  className="w-full px-6 py-5 rounded-[24px] border border-black/[0.04] bg-black/[0.02] focus:bg-white focus:border-[#0071E3]/30 focus:ring-[4px] focus:ring-[#0071E3]/10 outline-none text-[16px] font-black tracking-tight text-[#1D1D1F] transition-all shadow-sm"
                  placeholder="your@email.com" />
              </div>

              <div>
                <label className="block text-[14px] font-black tracking-tight text-[#1D1D1F] mb-3 px-2">密码</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                  className="w-full px-6 py-5 rounded-[24px] border border-black/[0.04] bg-black/[0.02] focus:bg-white focus:border-[#0071E3]/30 focus:ring-[4px] focus:ring-[#0071E3]/10 outline-none text-[16px] font-black tracking-tight text-[#1D1D1F] transition-all shadow-sm"
                  placeholder="••••••••" />
              </div>

              <button type="submit" disabled={loading}
                className="w-full bg-[#1D1D1F] hover:bg-[#333336] disabled:bg-black/[0.04] disabled:text-[#86868B] text-white py-5 mt-4 rounded-full font-black tracking-tight text-[18px] transition-all flex items-center justify-center gap-3 shadow-[0_12px_32px_rgba(0,0,0,0.15)] active:scale-[0.98]">
                {loading && <Loader2 className="w-6 h-6 animate-spin" />}
                {loading ? '登录中...' : '登录'}
              </button>

              <p className="text-center text-[15px] font-bold tracking-tight text-[#86868B] pt-6">
                还没有账号？ <Link to="/register" className="text-[#0071E3] font-black hover:underline underline-offset-4">立即注册</Link>
              </p>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
