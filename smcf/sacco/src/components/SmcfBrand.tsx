/**
 * Renders "SMCF" with brand colours:
 *  SMC → gold  (#C9A227)
 *    F → green (#2D7A36)
 * Accepts an optional suffix (e.g. " SACCO") rendered in the inherited colour.
 */
interface Props {
  suffix?: string;
  className?: string;
}

export function SmcfBrand({ suffix, className }: Props) {
  return (
    <span className={className}>
      <span className="text-[#C9A227]">SMC</span>
      <span className="text-[#2D7A36]">F</span>
      {suffix && <span>{suffix}</span>}
    </span>
  );
}
