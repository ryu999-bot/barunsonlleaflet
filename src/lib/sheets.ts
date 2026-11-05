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
  fileData?: string;
  fileMimeType?: string;
}

// Apps Script 웹앱 호출 (POST → 302 리다이렉트 → GET으로 결과 수신)
async function callAppsScript(body: unknown): Promise<string> {
  const payload = JSON.stringify(body);
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
  return text;
}

/** 시트에 신청 행을 추가하고, 기록된 행 번호를 반환 (구버전 스크립트면 null) */
export async function appendToSheet(data: LeafletRow): Promise<number | null> {
  const text = await callAppsScript(data);
  try {
    const row = Number((JSON.parse(text) as { row?: number }).row);
    return Number.isInteger(row) && row > 1 ? row : null;
  } catch {
    return null;
  }
}

/** 신청 행에 Slack 알림 메시지 ts 기록 (지연 리마인드를 스레드 댓글로 달기 위함) */
export async function saveSlackThread(row: number, ts: string, companyName: string) {
  const text = await callAppsScript({ action: "setSlackThread", row, ts, companyName });
  const out = JSON.parse(text) as { success?: boolean; error?: string };
  if (!out.success) throw new Error(`Slack 스레드 기록 실패: ${out.error}`);
}
