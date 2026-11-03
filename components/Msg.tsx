export default function Msg({ error, good }: { error?: string; good?: string }) {
  if (error) return <div className="msg err">{error}</div>;
  if (good) return <div className="msg good">{good}</div>;
  return null;
}
