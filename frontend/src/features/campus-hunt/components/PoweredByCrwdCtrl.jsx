/** Shared "Powered by CrwdCtrl" footer with logo. Works online + offline (public asset). */
export default function PoweredByCrwdCtrl({ dark = false }) {
  return (
    <p
      className={`flex items-center justify-center gap-2 pt-2 text-center text-[11px] ${
        dark ? 'text-black/50' : 'text-white/40'
      }`}
    >
      <img
        src="/logo-crwdctrl.png"
        alt="CrwdCtrl"
        width={18}
        height={18}
        loading="lazy"
        className="h-[18px] w-[18px] rounded-full object-cover"
      />
      <span>Powered by CrwdCtrl</span>
    </p>
  );
}
