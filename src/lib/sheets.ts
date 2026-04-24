interface LeafletRow {
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  partnerCode: string;
  purpose: string;
  quantity: string;
  deadline: string;
  notes: string;
  phoneCallRequest: string;
  fileName?: string;
}

export async function appendToSheet(data: LeafletRow) {
  const payload = JSON.stringify(data);
  const headers = {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload).toString(),
  };

  // 1단계: Apps Script로 POST → 302 리다이렉트 받기
  const res = await fetch(process.env.GOOGLE_APPS_SCRIPT_URL!, {
    method: "POST",
    headers,
    body: payload,
    redirect: "manual",
  });

  if (res.status !== 302) {
    throw new Error(`Google Sheets 1단계 실패: ${res.status}`);
  }

  const redirectUrl = res.headers.get("location");
  if (!redirectUrl) {
    throw new Error("Google Sheets 리다이렉트 URL 없음");
  }

  // 2단계: 리다이렉트 URL로 GET 요청 (body 없이)
  const res2 = await fetch(redirectUrl, {
    method: "GET",
  });

  const text = await res2.text().catch(() => "");

  if (text.includes("TypeError") || text.includes("Error")) {
    throw new Error(`Google Sheets 저장 실패: ${text.substring(0, 200)}`);
  }
}
