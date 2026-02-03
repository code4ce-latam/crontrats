"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function PasswordChangeRequiredCheck() {
  const router = useRouter();

  useEffect(() => {
    const checkPasswordChange = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user?.user_metadata?.requires_password_change) {
        router.push("/auth/change-password-required");
      }
    };

    checkPasswordChange();
  }, [router]);

  return null;
}

