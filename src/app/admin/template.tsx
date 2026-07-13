export default function AdminTemplate({ children }: { children: React.ReactNode }) {
  return <div className="fade-in-section" style={{ height: '100%' }}>{children}</div>;
}
