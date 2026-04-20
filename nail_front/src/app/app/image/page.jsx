import { AccessDeniedView } from "@/components/auth/access-denied-view";
import { ImagePageClient } from "@/components/workspace/image-page-client";
import { getSessionOrRedirect } from "@utils/server-session";

export const dynamic = "force-dynamic";

export default async function ImagePage() {
  const member = await getSessionOrRedirect();
  const canViewImage = [1, 2, 3, 4, 5, 6, 9, 10].includes(member?.mr_seq);

  if (!canViewImage) {
    return (
      <AccessDeniedView
        title="이미지 접근 권한 없음"
        description="이 계정은 Nail 이미지 상세를 볼 수 없습니다."
      />
    );
  }

  return <ImagePageClient />;
}
