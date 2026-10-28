import { PaperHead } from "./survey/_components/papers";

// portal 호스트의 루트(=/portal). 진행 중인 설문·안내 목록을 여기에 손으로 두지 않는다(목록 관리가 곧 어긋난다) —
// 받은 링크로 들어오라는 안내만. 새 종류의 화면이 생기면 /portal/<종류>/… 로 늘린다(기능별 서브도메인을 만들지 않는다).
export default function PortalIndexPage() {
  return (
    <main className="svy-frame">
      <div className="svy-paper">
        <PaperHead title="푸른숲발도르프학교 포털" subtitle="설문·안내" />
        <div className="svy-notice">
          <b>안내받은 링크로 접속해 주세요.</b>
          이 주소에는 따로 보여 드릴 내용이 없습니다. 설문은 안내 문자·메일에 적힌 주소로 들어가시면 바로 작성할 수 있어요.
        </div>
      </div>
    </main>
  );
}
