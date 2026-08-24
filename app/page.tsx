import ScenovaStudio from "@/components/scenova-studio";

export default function HomePage() {
  return (
    <>
      <ScenovaStudio />
      <a
        href="/series"
        title="Series & Episode Manager — จัดการหลาย EP และความยาวสูงสุด 3 นาทีต่อตอน"
        style={{
          position: "fixed",
          right: 18,
          bottom: 18,
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
        }}
      >
        EP Manager →
      </a>
    </>
  );
}
