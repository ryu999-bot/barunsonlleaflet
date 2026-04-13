import { NextResponse } from "next/server";
import { sendSlackNotification } from "@/lib/slack";
import { appendToSheet } from "@/lib/sheets";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const data = {
      companyName: formData.get("companyName") as string,
      contactName: formData.get("contactName") as string,
      phone: formData.get("phone") as string,
      email: formData.get("email") as string,
      address: formData.get("address") as string,
      partnerCode: formData.get("partnerCode") as string,
      purpose: formData.get("purpose") as string,
      quantity: formData.get("quantity") as string,
      deadline: formData.get("deadline") as string,
    };

    // 필수 필드 검증
    const required = ["companyName", "contactName", "phone", "email", "address", "purpose"] as const;
    for (const field of required) {
      if (!data[field]?.trim()) {
        return NextResponse.json(
          { error: `${field} 항목은 필수입니다.` },
          { status: 400 }
        );
      }
    }

    const file = formData.get("file") as File | null;
    const fileName = file?.name || undefined;

    // Google Sheets 저장
    await appendToSheet({ ...data, fileName });

    // Slack 알림 (웹훅 URL이 설정된 경우에만)
    if (process.env.SLACK_WEBHOOK_URL && !process.env.SLACK_WEBHOOK_URL.includes("YOUR")) {
      await sendSlackNotification({ ...data, fileName });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Submit error:", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: "신청 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
