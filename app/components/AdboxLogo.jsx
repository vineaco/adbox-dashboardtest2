'use client';

/**
 * The adbox logo mark: cyan rounded rectangle with the four graded vertical bars,
 * matching the geometry of the official adbox logo in /public/adbox-logo-dark.png.
 */
export function AdboxLogoMark({ size = 32, animated = false, className = '' }) {
  const w = size;
  const h = size;

  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`adbox-mark ${animated ? 'adbox-mark-animated' : ''} ${className}`}
      aria-hidden="true"
    >
      {/* Outer cyan rounded square */}
      <rect
        x="2"
        y="2"
        width="96"
        height="96"
        rx="24"
        fill="#0f171d"
        stroke="#00bdd6"
        strokeWidth="6"
      />

      {/* Four graded vertical bars matching official logo */}
      <rect className="bar bar-1" x="22" y="27" width="10" height="46" rx="5" fill="#106f7b" />
      <rect className="bar bar-2" x="37" y="27" width="10" height="46" rx="5" fill="#008d9f" />
      <rect className="bar bar-3" x="52" y="27" width="10" height="46" rx="5" fill="#00bdd6" />
      <rect className="bar bar-4" x="67" y="27" width="10" height="46" rx="5" fill="#90f2ff" />
    </svg>
  );
}

/** Official wordmark image using the dark or light PNG asset. */
export function AdboxLogo({ variant = 'dark', height = 28, className = '' }) {
  const src = variant === 'dark' ? '/adbox-logo-dark.png' : '/adbox-logo-light.png';
  return (
    <img
      src={src}
      alt="adbox"
      height={height}
      style={{ height, width: 'auto', display: 'block', objectFit: 'contain' }}
      className={`adbox-logo-img ${className}`}
    />
  );
}
