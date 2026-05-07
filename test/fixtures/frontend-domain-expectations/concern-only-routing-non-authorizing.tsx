import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

export function ConcernOnlyRoutingNote() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  return {
    slug: params.slug,
    tab: searchParams.get("tab"),
    href: `/users/${params.slug}`,
    Link,
  };
}
