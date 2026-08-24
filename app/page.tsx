import ScenovaStudio from "@/components/scenova-studio";

const quickLinkStyle = {
  position: "fixed" as const,
  right: 18,
  zIndex: 50,
  padding: "10px 14px",
  borderRadius: 12,
  color: "white",
  textDecoration: "none",
  fontWeight: 800,
  fontSize: 12,
  border: "1px solid rgba(190,135,255,.4)",
  background: "linear-gradient(135deg,#7135f2,#a94bff)",
  boxShadow: "0 12px 34px rgba(103,49,205,.34)",
};

export default function HomePage() {
  return (
    <>
      <ScenovaStudio />
      <a href="/director" title="Director Console — กำกับตามช่วงเวลาและใช้ Action/Sci-Fi Camera Presets" style={{ ...quickLinkStyle, bottom: 106, background: "linear-gradient(135deg,#352060,#6f3ec8)" }}>
        Director Console →
      </a>
      <a href="/dialogue" title="Dialogue Director — สร้าง Timeline จากบทพูด" style={{ ...quickLinkStyle, bottom: 62, background: "linear-gradient(135deg,#4e2a8f,#8042c8)" }}>
        Dialogue Director →
      </a>
      <a href="/series" title="Series & Episode Manager — จัดการหลาย EP และความยาวสูงสุด 3 นาทีต่อตอน" style={{ ...quickLinkStyle, bottom: 18 }}>
        EP Manager →
      </a>
    </>
  );
}
