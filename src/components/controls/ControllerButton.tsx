interface ControllerButtonProps {
  label: string;
  x?: number;
  y?: number;
  active?: boolean;
  listening?: boolean;
  className?: string;
  onClick?: () => void;
}

export function ControllerButton({ label, x, y, active, listening, className = "", onClick }: ControllerButtonProps) {
  const style = x === undefined || y === undefined ? undefined : { left: `${x}%`, top: `${y}%` };
  return (
    <button
      type="button"
      className={`controller-button ${className}${active ? " is-active" : ""}${listening ? " is-listening" : ""}`}
      style={style}
      onClick={onClick}
      tabIndex={onClick ? 0 : -1}
      aria-label={label}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}
