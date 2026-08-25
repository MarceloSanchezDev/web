import { useRef } from 'react';

export default function BlurText({
  text,
  delay = 200,
  animateBy = 'words',
  direction = 'top',
  onAnimationComplete,
  className = ''
}) {
  const completed = useRef(false);
  const value = String(text ?? '');
  const segments = animateBy === 'letters' ? Array.from(value) : value.split(/(\s+)/);
  const visibleSegments = segments.filter(segment => segment.trim());
  const lastVisibleIndex = segments.findLastIndex(segment => segment.trim());
  let animatedIndex = -1;

  const complete = index => {
    if (index !== lastVisibleIndex || completed.current) return;
    completed.current = true;
    onAnimationComplete?.();
  };

  return <span className={`blur-text ${className}`.trim()} aria-label={value}>
    {segments.map((segment, index) => {
      if (!segment.trim()) return <span className="blur-text-space" aria-hidden="true" key={`space-${index}`}>{segment}</span>;
      animatedIndex += 1;
      return <span
        className="blur-text-segment"
        aria-hidden="true"
        key={`${segment}-${index}`}
        onAnimationEnd={() => complete(index)}
        style={{
          '--blur-delay': `${animatedIndex * delay}ms`,
          '--blur-offset': direction === 'bottom' ? '10px' : '-10px'
        }}
      >{segment}</span>;
    })}
    {!visibleSegments.length && <span aria-hidden="true">{value}</span>}
  </span>;
}
