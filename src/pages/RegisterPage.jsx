import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getApiErrorMessage } from '../api/client';
import { BookOpen, Loader2, Sparkles, Gift } from '../components/Icons';

const ROLE_OPTIONS = ['园长', '主班老师', '配班老师', '保育老师', '教研员', '其他'];

export default function RegisterPage() {
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    wechat_id: '',
    real_name: '',
    phone: '',
    school_name_input: '',
    city: '',
    role_desc: ROLE_OPTIONS[1],
    note: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const required = ['username', 'email', 'password', 'real_name', 'phone', 'school_name_input', 'city', 'role_desc'];
    for (const k of required) {
      if (!String(form[k] || '').trim()) { setError('请完整填写带 * 的必填项'); return; }
    }
    if (form.password.length < 6) { setError('密码至少 6 位'); return; }

    setLoading(true);
    try {
      const payload = {
        email: form.email.trim(),
        username: form.username.trim(),
        password: form.password,
        real_name: form.real_name.trim(),
        phone: form.phone.trim(),
        school_name_input: form.school_name_input.trim(),
        city: form.city.trim(),
        role_desc: form.role_desc.trim(),
      };
      if (form.wechat_id.trim()) payload.wechat_id = form.wechat_id.trim();
      if (form.note.trim()) payload.note = form.note.trim();

      await register(payload);
      try {
        sessionStorage.setItem(
          'pendingLoginCreds',
          JSON.stringify({ email: payload.email, password: form.password, ts: Date.now() })
        );
      } catch { /* sessionStorage 不可用时静默降级 */ }
      navigate('/pending-review', { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, '注册失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-stretch bg-[#F5F5F7]">
      <aside className="hidden lg:flex lg:w-5/12 relative overflow-hidden bg-gradient-to-br from-[#1D1D1F] via-[#333336] to-black text-white p-16 flex-col justify-between">
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
          <h2 className="text-[42px] font-black tracking-tight leading-tight mb-6">加入 30,000+<br />正在用 AI 备课的老师</h2>
          <p className="text-white/80 leading-relaxed max-w-md text-[16px] font-medium tracking-tight">
            3 分钟生成教案、1 分钟完成配音、一键进入投屏。注册即开始使用，免费额度随时续。
          </p>
          <ul className="mt-8 space-y-4 text-[15px] font-bold tracking-tight text-white/90">
            <li className="flex items-center gap-3"><Sparkles className="w-5 h-5 text-[#34C759]" /> 一张表填完，运营审核通过赠送试用点数</li>
            <li className="flex items-center gap-3"><Sparkles className="w-5 h-5 text-[#0071E3]" /> 数据安全加密，仅对你自己可见</li>
            <li className="flex items-center gap-3"><Sparkles className="w-5 h-5 text-[#AF52DE]" /> 小助手全程微信答疑，使用零门槛</li>
          </ul>
        </div>

        <div className="relative z-10 text-[12px] font-bold tracking-tight text-white/50">
          © 知岛幼师 · 让备课像写一句话一样简单
        </div>
      </aside>

      <main className="flex-1 flex items-center justify-center p-6 sm:p-10 relative">
        <div className="w-full max-w-xl relative z-10">
          <div className="lg:hidden text-center mb-8">
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

          <div className="bg-white/90 backdrop-blur-3xl rounded-[32px] shadow-[0_24px_64px_rgba(0,0,0,0.08)] border-[3px] border-black/[0.04] p-8 sm:p-10">
            <h2 className="text-[28px] font-black tracking-tight text-[#1D1D1F] mb-2">创建账号并完善资料</h2>
            <p className="text-[14px] font-semibold tracking-tight text-[#86868B]">一次填完即可提交，无需再分两步。</p>

            <div className="mt-5 flex items-start gap-3 bg-[#34C759]/10 border border-[#34C759]/20 rounded-2xl px-4 py-3">
              <Gift className="w-5 h-5 text-[#34C759] mt-0.5 flex-shrink-0" />
              <div className="text-[13px] font-bold tracking-tight text-[#1D1D1F] leading-relaxed">
                提交后由运营审核（一般工作日内完成），审核通过即 <span className="text-[#34C759] font-black">立刻赠送试用点数</span>，用于免费体验完整产品。
              </div>
            </div>

            {error && (
              <div className="mt-5 bg-[#FF3B30]/10 text-[#FF3B30] text-[13px] font-black tracking-tight px-4 py-3 rounded-2xl border border-[#FF3B30]/20">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <Section title="账号信息">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="昵称 *">
                    <input className="input-pill" value={form.username} onChange={set('username')} placeholder="你的昵称" autoComplete="nickname" />
                  </Field>
                  <Field label="邮箱 *">
                    <input className="input-pill" type="email" value={form.email} onChange={set('email')} placeholder="your@email.com" autoComplete="email" />
                  </Field>
                </div>
                <Field label="密码 *">
                  <input className="input-pill" type="password" value={form.password} onChange={set('password')} placeholder="至少 6 位" autoComplete="new-password" minLength={6} />
                </Field>
                <Field label={<span>微信号 <span className="text-[#86868B] font-bold">（选填）</span></span>}>
                  <input className="input-pill" value={form.wechat_id} onChange={set('wechat_id')} placeholder="方便小助手主动加您答疑" maxLength={80} autoComplete="off" />
                  <p className="mt-2 px-1 text-[12px] font-bold tracking-tight text-[#86868B] leading-relaxed">
                    留下微信号后，<span className="text-[#0071E3] font-black">小助手</span> 会协助您解决使用产品过程中遇到的任何问题。
                  </p>
                </Field>
              </Section>

              <div className="border-t border-black/[0.06]" />

              <Section title="老师资料（用于审核）">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="真实姓名 *">
                    <input className="input-pill" value={form.real_name} onChange={set('real_name')} placeholder="如：张老师" />
                  </Field>
                  <Field label="手机号 *">
                    <input className="input-pill" value={form.phone} onChange={set('phone')} placeholder="联系电话" autoComplete="tel" />
                  </Field>
                </div>
                <Field label="幼儿园名称 *">
                  <input className="input-pill" value={form.school_name_input} onChange={set('school_name_input')} placeholder="所在园所全称" />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="所在城市 *">
                    <input className="input-pill" value={form.city} onChange={set('city')} placeholder="如：上海" />
                  </Field>
                  <Field label="职务 *">
                    <select className="input-pill" value={form.role_desc} onChange={set('role_desc')}>
                      {ROLE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label={<span>备注 <span className="text-[#86868B] font-bold">（选填）</span></span>}>
                  <textarea className="input-pill min-h-[72px]" value={form.note} onChange={set('note')} placeholder="有啥要告诉运营的可以写这里" maxLength={500} />
                </Field>
              </Section>

              <button type="submit" disabled={loading}
                className="w-full bg-[#1D1D1F] hover:bg-[#333336] disabled:bg-black/[0.04] disabled:text-[#86868B] text-white py-4 mt-2 rounded-full font-black tracking-tight text-[16px] transition-all flex items-center justify-center gap-3 shadow-[0_12px_32px_rgba(0,0,0,0.15)] active:scale-[0.98]">
                {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                {loading ? '提交中...' : '注册并提交审核'}
              </button>

              <p className="text-center text-[14px] font-bold tracking-tight text-[#86868B]">
                已有账号？ <Link to="/login" className="text-[#0071E3] font-black hover:underline underline-offset-4">直接登录</Link>
              </p>
            </form>
          </div>
        </div>
      </main>

      <style>{`
        .input-pill {
          width: 100%;
          padding: 14px 18px;
          border-radius: 18px;
          border: 1px solid rgba(0,0,0,0.04);
          background: rgba(0,0,0,0.02);
          font-weight: 700;
          font-size: 15px;
          color: #1D1D1F;
          outline: none;
          transition: all .2s;
        }
        .input-pill:focus { background: #fff; border-color: rgba(0,113,227,0.3); box-shadow: 0 0 0 4px rgba(0,113,227,0.08); }
      `}</style>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="space-y-4">
      <div className="text-[13px] font-black tracking-tight text-[#86868B] uppercase">{title}</div>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-[13px] font-black tracking-tight text-[#1D1D1F] mb-2 px-1">{label}</span>
      {children}
    </label>
  );
}
