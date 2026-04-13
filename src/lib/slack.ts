import { IncomingWebhook } from "@slack/webhook";

const webhook = new IncomingWebhook(process.env.SLACK_WEBHOOK_URL!);

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
  fileName?: string;
}

export async function sendSlackNotification(data: LeafletRequest) {
  await webhook.send({
    text: `:memo: *새로운 리플렛 제작 신청*`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "새로운 리플렛 제작 신청", emoji: true },
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
        ],
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
