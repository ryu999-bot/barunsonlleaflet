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
  fileName?: string;
}

export async function appendToSheet(data: LeafletRow) {
  const payload = JSON.stringify(data);

  // Apps Script는 POST → 302 리다이렉트 → GET 으로 동작함
  // redirect: "follow"로 자동 처리
  const res = await fetch(process.env.GOOGLE_APPS_SCRIPT_URL!, {
    method: "POST",
    body: payload,
    redirect: "follow",
  });

  // Apps Script는 리다이렉트 후 HTML 또는 JSON을 반환
  // 성공 시 response body에 {"success":true} 포함
  const text = await res.text().catch(() => "");

  // 에러 페이지가 반환된 경우 체크
  if (text.includes("TypeError") || text.includes("Error")) {
    throw new Error(`Google Sheets 저장 실패: ${text.substring(0, 200)}`);
  }
}
