// Thin wrapper around Google Material Symbols (the icon set the Stitch
// export uses via <span class="material-symbols-outlined">name</span>).
export default function Icon({ name, fill = false, className = '', style, size }) {
  return (
    <span
      className={`material-symbols-outlined${fill ? ' fill' : ''} ${className}`}
      style={{ ...(size ? { fontSize: size } : null), ...style }}
    >
      {name}
    </span>
  );
}
