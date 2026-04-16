"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { postJson } from "@utils";

export function LogoutButton() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogout() {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      await postJson("/api/auth/logout", {});
    } finally {
      startTransition(() => {
        router.push("/app/login");
        router.refresh();
      });
      setIsSubmitting(false);
    }
  }

  return (
    <Button
      color="inherit"
      disabled={isSubmitting}
      onClick={handleLogout}
      size="small"
      variant="outlined"
    >
      {isSubmitting ? "로그아웃 중..." : "로그아웃"}
    </Button>
  );
}
