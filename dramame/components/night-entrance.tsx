export function NightEntrance() {
  return (
    <figure className="entrance">
      <div className="ticket" aria-hidden="true">
        <span>Admit one</span>
        <span className="ticket-rule" />
        <span>dramame</span>
      </div>
      <div className="phone-door" aria-hidden="true">
        <div className="phone-screen">
          <span className="door-glow" />
        </div>
        <div className="phone-floor" />
      </div>
      <svg className="bucket" viewBox="0 0 78 86" aria-hidden="true">
        <ellipse cx="28" cy="20" rx="9" ry="8" fill="#FFB84D" />
        <ellipse cx="42" cy="15" rx="10" ry="8" fill="#F7F5FF" />
        <ellipse cx="55" cy="22" rx="8" ry="7" fill="#FFB84D" />
        <ellipse cx="40" cy="26" rx="7" ry="6" fill="#FFB84D" />
        <path d="M18 32h42l-6 46a16 16 0 0 1-30 0L18 32z" fill="#090B18" stroke="#7557FF" strokeWidth="1.4" />
        <path d="M20 44h38" stroke="#FFB84D" strokeWidth="1.6" />
        <path d="M21 52h36" stroke="#4361EE" strokeWidth="1.2" opacity="0.85" />
      </svg>
      <span className="loose-kernel loose-a" aria-hidden="true" />
      <span className="loose-kernel loose-b" aria-hidden="true" />
      <figcaption>The screen is the entrance. This frame is a preview, not a finished series.</figcaption>
    </figure>
  );
}
