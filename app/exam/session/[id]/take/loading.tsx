export default function TakeLoading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 bg-[#FAFAF5]">
      <div
        aria-hidden
        className="w-10 h-10 rounded-full border-4 border-[#0B1F3A]/15 border-t-[#0B1F3A] animate-spin"
      />
      <div className="text-center space-y-1">
        <p className="font-bold text-[#0B1F3A]">시험장에 입장하는 중입니다</p>
        <p className="text-sm text-[#0A0A0A]/60">
          저장된 답안을 불러오고 있습니다. 잠시만 기다려주세요.
        </p>
      </div>
    </div>
  );
}
