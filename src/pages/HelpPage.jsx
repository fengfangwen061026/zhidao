import { useEffect, useState } from 'react';
import { HelpCircle, Loader2, FileText } from '../components/Icons';
import { helpApi, getApiErrorMessage } from '../api/client';

export default function HelpPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [doc, setDoc] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    helpApi
      .getDocument()
      .then((res) => {
        if (cancelled) return;
        setDoc(res.data || null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(getApiErrorMessage(err, '加载使用说明失败'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pdfUrl = doc?.url || '';

  return (
    <div className="w-full">
      <div className="flex items-start gap-3 mb-6">
        <div className="w-11 h-11 rounded-[14px] bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center flex-shrink-0">
          <HelpCircle className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-[#1D1D1F] leading-tight">使用说明</h1>
          <p className="text-[13px] text-[#86868B] mt-1">
            下方直接展示最新的使用说明文档，由运营团队统一维护更新。
          </p>
        </div>
      </div>

      <div className="relative rounded-[20px] overflow-hidden border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_32px_rgba(0,0,0,0.04)]">
        <div className="relative w-full" style={{ height: 'calc(100vh - 220px)', minHeight: 560 }}>
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white z-10">
              <Loader2 className="w-7 h-7 text-[#0071E3] animate-spin" />
              <p className="text-[13px] text-[#86868B]">正在加载使用说明…</p>
            </div>
          )}

          {!loading && error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white z-10 px-6 text-center">
              <div className="w-14 h-14 rounded-[18px] bg-[#FF3B30]/10 text-[#FF3B30] flex items-center justify-center">
                <HelpCircle className="w-7 h-7" />
              </div>
              <div className="max-w-md">
                <h3 className="text-[16px] font-semibold text-[#1D1D1F]">加载使用说明失败</h3>
                <p className="text-[13px] text-[#86868B] mt-1 leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && !pdfUrl && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white z-10 px-6 text-center">
              <div className="w-14 h-14 rounded-[18px] bg-[#8E8E93]/10 text-[#8E8E93] flex items-center justify-center">
                <FileText className="w-7 h-7" />
              </div>
              <div className="max-w-md">
                <h3 className="text-[16px] font-semibold text-[#1D1D1F]">暂未上传使用说明</h3>
                <p className="text-[13px] text-[#86868B] mt-1 leading-relaxed">
                  运营同学上传 PDF 之后，这里会自动显示最新版本的使用说明。
                </p>
              </div>
            </div>
          )}

          {!loading && !error && pdfUrl && (
            <iframe
              key={pdfUrl}
              src={`${pdfUrl}#toolbar=1&navpanes=0`}
              title="使用说明"
              className="w-full h-full block"
            />
          )}
        </div>
      </div>
    </div>
  );
}
