import { useState } from "react";

type TeamAbbrevAvatarProps = {
  abbrev: string;
  logoUrl: string | null;
  sizeClassName?: string;
};

export function TeamAbbrevAvatar({
  abbrev,
  logoUrl,
  sizeClassName = "size-7",
}: TeamAbbrevAvatarProps) {
  const [failed, setFailed] = useState(false);
  const letter = abbrev.slice(0, 1);
  const showLogo = Boolean(logoUrl) && !failed;

  if (showLogo && logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        role="presentation"
        className={`${sizeClassName} shrink-0 object-contain`}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      className={`flex ${sizeClassName} shrink-0 items-center justify-center rounded-full bg-c2 text-[12px] font-bold text-c3`}
    >
      {letter}
    </span>
  );
}
