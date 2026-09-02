const DISCLAIMER =
  "statvista provides research tools, projections, and statistics for informational and entertainment purposes only. Nothing on this site is gambling, financial, or legal advice. Sports betting involves risk of loss. You are solely responsible for your decisions and for complying with applicable laws in your jurisdiction. Past results do not guarantee future outcomes.";

const COPYRIGHT = "© Copyright 2026 statvista. All Rights Reserved.";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <p>{DISCLAIMER}</p>
        <p>{COPYRIGHT}</p>
      </div>
    </footer>
  );
}
