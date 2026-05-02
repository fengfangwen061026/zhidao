import { UploadCloud } from './Icons';

export default function FileUpload({ onUpload, disabled }) {
  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
    e.target.value = '';
  };

  return (
    <label className="relative block group cursor-pointer">
      <div className="relative border-[2px] border-dashed border-[#0071E3]/20 rounded-[24px] bg-[#0071E3]/[0.02] hover:bg-[#0071E3]/[0.04] hover:border-[#0071E3]/40 transition-all duration-300 px-8 py-10 flex flex-col items-center text-center">
        <input
          type="file"
          accept=".pdf,.pptx,.ppt"
          onChange={handleChange}
          disabled={disabled}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div className="bg-white shadow-[0_8px_24px_rgba(0,113,227,0.12)] p-4 rounded-[16px] mb-4 border border-[#0071E3]/10 transform group-hover:scale-110 group-hover:-translate-y-1 transition-all duration-300">
          <UploadCloud className="w-8 h-8 text-[#0071E3]" />
        </div>
        <h3 className="text-[16px] font-bold tracking-tight text-[#1D1D1F] mb-1.5">点击或拖拽上传课程</h3>
        <p className="text-[13px] font-medium text-[#86868B]">支持 PDF / PPTX 格式，上传后自动解析</p>
      </div>
    </label>
  );
}
