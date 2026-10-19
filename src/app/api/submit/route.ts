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
      address: [formData.get("address"), formData.get("addressDetail")].filter(Boolean).join(" "),
      partnerCode: formData.get("partnerCode") as string,
      purpose: formData.get("purpose") as string,
      quantity: formData.get("quantity") as string,
      deadline: formData.get("deadline") as string,
      notes: (formData.get("notes") as string) || "",
      phoneCallRequest: formData.get("phoneCallRequest") as string,
    };

    // 필수 필드 검증
    const required = ["companyName", "contactName", "phone", "email", "address", "partnerCode", "purpose", "phoneCallRequest"] as const;
    for (const field of required) {
      if (!data[field]?.trim()) {
        return NextResponse.json(
          { error: `${field} 항목은 필수입니다.` },
          { status: 400 }
        );
      }
    }

    const file = formData.get("file") as File | null;
    let fileName: string | undefined;
    let fileData: string | undefined;
    let fileMimeType: string | undefined;
    if (file && file.size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer());
      fileName = file.name;
      fileMimeType = file.type || "application/octet-stream";
      fileData = buffer.toString("base64");
    }

    // Google Sheets 저장
    await appendToSheet({ ...data, fileName, fileData, fileMimeType });

    // Slack 알림 (웹훅 URL이 설정된 경우에만)
    // 시트 저장은 이미 끝났으므로 알림 실패로 신청 자체를 실패 처리하지 않음 (중복 재신청 방지)
    try {
      await sendSlackNotification({ ...data, fileName });
    } catch (error) {
      console.error("Slack notification error:", error instanceof Error ? error.message : error);
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
