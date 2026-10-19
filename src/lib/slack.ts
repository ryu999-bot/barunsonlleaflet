import { IncomingWebhook } from "@slack/webhook";

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

export async function sendSlackNotification(raw: LeafletRequest) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl || webhookUrl.includes("YOUR")) return;

  const data = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, typeof v === "string" ? esc(v) : v])
  ) as LeafletRequest;

  const webhook = new IncomingWebhook(webhookUrl);

  await webhook.send({
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
          { type: "mrkdwn", text: `*납기일:*\n${data.deadline}` },
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
  });
}
