type Props = {
  label: string;
  active: boolean;
  onClick: () => void;
};

export function TabButton({ label, active, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "0.35rem 0.9rem",
        borderRadius: 999,
        background: active ? "var(--white)" : "transparent",
        border: active ? "1px solid var(--shadow)" : "1px solid transparent",
        fontSize: "0.85rem",
        cursor: "pointer",
        color: active ? "var(--hococo_green)" : "#4b5563",
        fontWeight: active ? 600 : 400,
        boxShadow: active ? "0 6px 18px rgba(0,0,0,0.06)" : "none",
        WebkitAppearance: "none",
      }}
    >
      {label}
    </button>
  );
}
