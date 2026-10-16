import Link from "next/link";

export default function BackLink({ href = "/", children = "Volver" }: { href?: string; children?: React.ReactNode }) {
  return (
    <Link href={href} className="back">
      <span aria-hidden="true">←</span> {children}
    </Link>
  );
}
