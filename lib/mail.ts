import "server-only";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

// 트랜잭션 메일(비밀번호 재설정 등). MAIL_FROM 미설정(로컬/SES 미승인)이면 콘솔에 출력만 한다.
export async function sendMail(msg: { to: string; subject: string; text: string }) {
  const from = process.env.MAIL_FROM;
  if (!from) {
    console.log(`[mail:dry-run] to=${msg.to} subject=${msg.subject}\n${msg.text}`);
    return;
  }
  const ses = new SESv2Client({ region: process.env.AWS_REGION ?? "ap-northeast-2" });
  await ses.send(
    new SendEmailCommand({
      FromEmailAddress: from,
      Destination: { ToAddresses: [msg.to] },
      Content: {
        Simple: {
          Subject: { Data: msg.subject, Charset: "UTF-8" },
          Body: { Text: { Data: msg.text, Charset: "UTF-8" } },
        },
      },
    }),
  );
}
