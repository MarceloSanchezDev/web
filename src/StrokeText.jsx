import { useId } from 'react';

const easeMap = {
  'power2.out': 'cubic-bezier(.22,1,.36,1)',
  'power2.in': 'cubic-bezier(.64,0,.78,0)',
  'power2.inOut': 'cubic-bezier(.65,0,.35,1)',
  linear: 'linear'
};

export default function StrokeText({
  text,
  strokeColor = '#A78BFA',
  fillColor = '#F8FAFC',
  strokeWidth = 1,
  drawDuration = 1,
  fillDelay = 0.1,
  stagger = 0.05,
  ease = 'power2.out',
  trigger = 'mount',
  fillMode = 'wipe',
  fontSize = 'inherit',
  fontWeight = 800,
  letterSpacing = 'inherit',
  reverse = false,
  className = ''
}) {
  const id = useId();
  const characters = Array.from(String(text ?? ''));
  const order = reverse ? [...characters.keys()].reverse() : [...characters.keys()];
  const delays = new Map(order.map((characterIndex, animationIndex) => [characterIndex, animationIndex * stagger]));
  const style = {
    '--stroke-color': strokeColor,
    '--stroke-fill': fillColor,
    '--stroke-width': `${strokeWidth}px`,
    '--stroke-duration': `${drawDuration}s`,
    '--stroke-fill-duration': `${drawDuration * 0.62}s`,
    '--stroke-fill-delay': `${fillDelay}s`,
    '--stroke-ease': easeMap[ease] || ease,
    fontSize,
    fontWeight,
    letterSpacing
  };

  return <span
    className={`stroke-text stroke-text-${fillMode}${trigger === 'mount' ? ' is-animated' : ''} ${className}`.trim()}
    style={style}
    aria-label={String(text ?? '')}
  >{characters.map((character, index) => character === ' '
    ? <span className="stroke-text-space" aria-hidden="true" key={`${id}-${index}`}> </span>
    : <span
      className="stroke-text-character"
      data-character={character}
      aria-hidden="true"
      key={`${id}-${index}`}
      style={{ '--stroke-delay': `${delays.get(index)}s` }}
    >{character}</span>)}</span>;
}
