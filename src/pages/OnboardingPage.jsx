import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { authApi, getApiErrorMessage } from '../api/client';
import { BookOpen, Loader2, Sparkles, LogOut } from '../components/Icons';

const ROLE_OPTIONS = ['园长', '主班老师', '配班老师', '保育老师', '教研员', '其他'];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, logout, applyUser } = useAuth();

  const [form, setForm] = useState({
    real_name: '',
    phone: '',
    school_name_input: '',
    city: '',
    role_desc: ROLE_OPTIONS[1],
    note: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setForm((prev) => ({
      ...prev,
      real_name: user.real_name || prev.real_name,
      phone: user.phone || prev.phone,
      school_name_input: user.school_name_input || prev.school_name_input,
      city: user.city || prev.city,
      role_desc: user.role_desc || prev.role_desc,
    }));
  }, [user]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.real_name.trim() || !form.phone.trim() || !form.school_name_input.trim()
      || !form.city.trim() || !form.role_desc.trim()) {
      setError('请完整填写必填项');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.submitOnboarding(form);
      applyUser(res.data);
      navigate('/pending-review', { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, '提交失败，请稍后再试'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex">
      <aside className="hidden lg:flex lg:w-5/12 relative overflow-hidden bg-gradient-to-br from-[#1D1D1F] via-[#333336] to-black text-white p-16 flex-col justify-between">
        <div className="absolute top-0 right-0 -mr-24 -mt-24 w-96 h-96 bg-gradient-to-br from-[#0071E3]/20 to-[#AF52DE]/20 rounded-full blur-3xl opacity-50" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-14 h-14 rounded-[20px] bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10">
            <BookOpen className="w-7 h-7 text-white" />
          </div>
          <div>
            <p className="text-[20px] font-black tracking-tight leading-tight">知岛幼师</p>
            <p className="text-[13px] font-bold tracking-tight text-white/70 mt-0.5">完善资料 · 等待审核</p>
          </div>
        </div>
        <div className="relative z-10 my-auto">
          <h2 className="text-[36px] font-black tracking-tight leading-tight mb-6">再填一步，帮我们认识你</h2>
          <p className="text-white/80 leading-relaxed max-w-md text-[15px] font-medium tracking-tight">
            为了确认您是真实在园的一线老师，我们需要您补充几项基础信息。提交后由运营审核，一般工作日内完成。
          </p>
          <ul className="mt-8 space-y-4 text-[14px] font-bold tracking-tight text-white/90">
            <li className="flex items-center gap-3"><Sparkles className="w-5 h-5 text-[#34C759]" /> 审核通过即可正常使用 AI 备课</li>
            <li className="flex items-center gap-3"><Sparkles className="w-5 h-5 text-[#0071E3]" /> 通过后会赠送初始点数，随时可用</li>
            <li className="flex items-center gap-3"><Sparkles className="w-5 h-5 text-[#AF52DE]" /> 资料仅用于审核，不会对外公开</li>
          </ul>
        </div>
        <div className="relative z-10 text-[12px] font-bold tracking-tight text-white/50">
          © 知岛幼师 · 让备课像写一句话一样简单
        </div>
      </aside>

      <main className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-xl">
          <div className="flex items-center justify-between mb-6">
            <div className="text-[13px] font-bold text-[#86868B]">当前账号 · <span className="text-[#1D1D1F]">{user?.email}</span></div>
            <button onClick={logout} className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#86868B] hover:text-[#FF3B30]">
              <LogOut className="w-4 h-4" /> 退出
            </button>
          </div>
          <div className="bg-white/90 backdrop-blur-3xl rounded-[32px] shadow-[0_24px_64px_rgba(0,0,0,0.08)] border-[3px] border-black/[0.04] p-8 sm:p-10">
            <h2 className="text-[26px] font-black tracking-tight text-[#1D1D1F] mb-2">完善老师资料</h2>
            <p className="text-[14px] font-semibold tracking-tight text-[#86868B] mb-7">所有字段用于运营审核，审核通过后即可正常使用。</p>

            {error && (
              <div className="bg-[#FF3B30]/10 text-[#FF3B30] text-[13px] font-bold px-4 py-3 rounded-2xl border border-[#FF3B30]/20 mb-5">
                {error}
              </div>
            )}

            <form className="space-y-4" onSubmit={submit}>
              <Field label="真实姓名 *">
                <input className="input-pill" value={form.real_name} onChange={set('real_name')} placeholder="如：张老师" />
              </Field>
              <Field label="手机号 *">
                <input className="input-pill" value={form.phone} onChange={set('phone')} placeholder="联系电话，便于必要时联系" />
              </Field>
              <Field label="幼儿园名称 *">
                <input className="input-pill" value={form.school_name_input} onChange={set('school_name_input')} placeholder="所在园所全称" />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="所在城市 *">
                  <input className="input-pill" value={form.city} onChange={set('city')} placeholder="如：上海" />
                </Field>
                <Field label="职务 *">
                  <select className="input-pill" value={form.role_desc} onChange={set('role_desc')}>
                    {ROLE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="备注（可选）">
                <textarea className="input-pill min-h-[84px]" value={form.note} onChange={set('note')} placeholder="有啥要告诉运营的可以写这里" />
              </Field>

              <button type="submit" disabled={loading}
                className="w-full bg-[#1D1D1F] hover:bg-[#333336] disabled:bg-black/[0.04] disabled:text-[#86868B] text-white py-4 mt-3 rounded-full font-black tracking-tight text-[16px] transition-all flex items-center justify-center gap-3 shadow-[0_12px_32px_rgba(0,0,0,0.15)] active:scale-[0.98]">
                {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                {loading ? '提交中...' : '提交审核'}
              </button>
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

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-[13px] font-black tracking-tight text-[#1D1D1F] mb-2 px-1">{label}</span>
      {children}
    </label>
  );
}
