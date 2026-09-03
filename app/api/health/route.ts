// ALB·ECS 헬스체크용. DB를 건드리지 않고 프로세스 생존만 응답한다.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true, ts: Date.now() });
}
