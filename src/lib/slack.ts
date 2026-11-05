import { IncomingWebhook, type IncomingWebhookSendArguments } from "@slack/webhook";

interface LeafletRequest {
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

// 신청 알림 시 태깅할 담당자 (전우람, @팀-편집-멤버 그룹[권다연·전예빈·장영주], 석광호, 강구완)
const MENTIONS = ["<@U08RH9W9S79>", "<!subteam^S08TX7T8XSA>", "<@U08SED8U8JV>", "<@U08RVS9VD19>"].join(" ");

// Slack mrkdwn 제어문자 이스케이프 (입력값으로 <!channel> 멘션·링크가 만들어지는 것 방지)
function esc(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export interface SlackThread {
  channel: string;
  ts: string;
}

// 봇 토큰이 있으면 chat.postMessage로 보내고 스레드 ts를 반환 (지연 리마인드를 스레드 댓글로 달기 위함)
// 없으면 기존 웹훅으로 전송 (ts 없음 → Apps Script가 채널 기록에서 원본 메시지를 찾음)
export async function sendSlackNotification(raw: LeafletRequest): Promise<SlackThread | null> {
  const botToken = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_CHANNEL_ID;
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  const useBot = !!botToken && !!channel;
  if (!useBot && (!webhookUrl || webhookUrl.includes("YOUR"))) return null;

  const data = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, typeof v === "string" ? esc(v) : v])
  ) as LeafletRequest;

  const message: IncomingWebhookSendArguments = {
    text: `:memo: *새로운 리플렛 제작 신청* ${MENTIONS}`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "새로운 리플렛 제작 신청", emoji: true },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: MENTIONS },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*회사명:*\n${data.companyName}` },
          { type: "mrkdwn", text: `*담당자:*\n${data.contactName}` },
          { type: "mrkdwn", text: `*연락처:*\n${data.phone}` },
          { type: "mrkdwn", text: `*이메일:*\n${data.email}` },
          { type: "mrkdwn", text: `*주소:*\n${data.address}` },
          { type: "mrkdwn", text: `*제휴사 코드:*\n${data.partnerCode || "-"}` },
          { type: "mrkdwn", text: `*용도:*\n${data.purpose}` },
          { type: "mrkdwn", text: `*수량:*\n${data.quantity}` },
          { type: "mrkdwn", text: `*납기 희망일:*\n${data.deadline}` },
          { type: "mrkdwn", text: `*유선 연락 요청:*\n${data.phoneCallRequest}` },
        ],
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*특이사항:*\n${data.notes || "-"}` },
      },
      ...(data.fileName
        ? [
            {
              type: "context" as const,
              elements: [
                {
                  type: "mrkdwn" as const,
                  text: `:paperclip: 첨부파일: ${data.fileName}`,
                },
              ],
            },
          ]
        : []),
      { type: "divider" },
    ],
  };

  if (useBot) {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${botToken}`,
      },
      body: JSON.stringify({ channel, ...message }),
    });
    const out = (await res.json()) as { ok: boolean; error?: string; channel?: string; ts?: string };
    if (!out.ok || !out.ts) throw new Error(`Slack chat.postMessage 실패: ${out.error}`);
    return { channel: out.channel ?? channel, ts: out.ts };
  }

  await new IncomingWebhook(webhookUrl!).send(message);
  return null;
}
