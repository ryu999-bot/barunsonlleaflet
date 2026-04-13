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
  const res = await fetch(process.env.GOOGLE_APPS_SCRIPT_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    redirect: "follow",
  });

  if (!res.ok && res.status !== 0) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google Sheets 저장 실패: ${res.status} ${text}`);
  }
}
