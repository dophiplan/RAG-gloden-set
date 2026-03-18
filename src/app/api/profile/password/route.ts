import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest) {
  try {
    // Get current user
    const supabase = await createClient();
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        { error: "인증되지 않은 사용자입니다." },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "현재 비밀번호와 새 비밀번호를 모두 입력해주세요." },
        { status: 400 },
      );
    }

    // Validate new password complexity (Standard: 8+ chars, upper, lower, number, special)
    const passwordErrors: string[] = [];

    if (newPassword.length < 8) {
      passwordErrors.push("8자 이상");
    }
    if (!/[A-Z]/.test(newPassword)) {
      passwordErrors.push("영문 대문자 1개 이상");
    }
    if (!/[a-z]/.test(newPassword)) {
      passwordErrors.push("영문 소문자 1개 이상");
    }
    if (!/[0-9]/.test(newPassword)) {
      passwordErrors.push("숫자 1개 이상");
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword)) {
      passwordErrors.push("특수문자 1개 이상");
    }

    if (passwordErrors.length > 0) {
      return NextResponse.json(
        { error: `비밀번호는 ${passwordErrors.join(", ")}을 포함해야 합니다.` },
        { status: 400 },
      );
    }

    // Verify current password by attempting to sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: authUser.email!,
      password: currentPassword,
    });

    if (signInError) {
      return NextResponse.json(
        { error: "현재 비밀번호가 일치하지 않습니다." },
        { status: 400 },
      );
    }

    // Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      console.error("Error updating password:", updateError);
      return NextResponse.json(
        { error: "비밀번호 변경 중 오류가 발생했습니다." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "비밀번호가 성공적으로 변경되었습니다.",
    });
  } catch (error) {
    console.error("Error in password update:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "알 수 없는 오류" },
      { status: 500 },
    );
  }
}
