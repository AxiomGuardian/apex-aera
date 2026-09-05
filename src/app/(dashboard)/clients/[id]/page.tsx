"use client";

import { useParams } from "next/navigation";
import { useSession } from "@/components/layout/SessionProvider";
import { BrandWorkspace } from "@/components/brand/BrandWorkspace";

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data } = useSession();
  const role = data?.user?.role;
  const mode = role === "agency_admin" ? "agency" : role === "enterprise_admin" ? "enterprise" : "client";
  return <BrandWorkspace brandId={id} mode={mode} />;
}
