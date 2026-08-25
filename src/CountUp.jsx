import { useEffect, useRef, useState } from 'react';

function formatValue(value, decimals, separator) {
  const [integer, fraction] = Number(value).toFixed(decimals).split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}

export default function CountUp({
  from = 0,
  to = 100,
  separator = ',',
  direction = 'up',
  duration = 1,
  className = 'count-up-text',
  delay = 0,
  decimals = 0,
  suffix = ''
}) {
  const startValue = direction === 'down' ? Number(to) : Number(from);
  const endValue = direction === 'down' ? Number(from) : Number(to);
  const [current, setCurrent] = useState(startValue);
  const frame = useRef();

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || duration <= 0) { setCurrent(endValue); return undefined; }
    setCurrent(startValue);
    let startedAt;
    const timeout = window.setTimeout(() => {
      const tick = now => {
        if (startedAt === undefined) startedAt = now;
        const progress = Math.min((now - startedAt) / (duration * 1000), 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setCurrent(startValue + (endValue - startValue) * eased);
        if (progress < 1) frame.current = requestAnimationFrame(tick);
      };
      frame.current = requestAnimationFrame(tick);
    }, Math.max(0, delay * 1000));
    return () => { window.clearTimeout(timeout); if (frame.current) cancelAnimationFrame(frame.current); };
  }, [startValue, endValue, duration, delay]);

  return <span className={className} aria-label={`${formatValue(endValue, decimals, separator)}${suffix}`}>
    {formatValue(current, decimals, separator)}{suffix}
  </span>;
}
