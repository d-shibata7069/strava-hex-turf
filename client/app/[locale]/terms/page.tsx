import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";

/**
 * 利用規約ページ。Strava API 公開審査およびユーザー向けの法務情報。
 */
export default async function TermsPage({
  searchParams,
}: {
  searchParams: { from?: string };
}) {
  const fromSettings = searchParams.from === "settings";
  const t = await getTranslations("terms");
  const tCommon = await getTranslations("common");

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-zinc-50 px-4 py-10">
      <article className="mx-auto max-w-3xl">
        <div className="mb-8">
          <Link
            href={fromSettings ? "/settings" : "/"}
            className="text-sm text-zinc-500 hover:text-zinc-700"
          >
            {fromSettings ? tCommon("backToSettings") : tCommon("backToTop")}
          </Link>
        </div>

        <h1 className="mb-8 text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
          {t("title")}
        </h1>

        <div className="space-y-8 text-base leading-relaxed text-zinc-700">
          <section>
            <h2 className="mb-3 text-lg font-semibold text-zinc-900">
              {t("section1Title")}
            </h2>
            <p className="mb-2">{t("section1Intro")}</p>
            <p className="mb-2">
              <strong>{t("section1DisclaimerTitle")}</strong>
              ：{t("section1DisclaimerIntro")}
            </p>
            <ul className="list-inside list-disc space-y-1 pl-2">
              <li>
                <strong>{t("section1Rule1")}</strong>
                ：{t("section1Rule1Desc")}
              </li>
              <li>
                <strong>{t("section1Rule2")}</strong>
                ：{t("section1Rule2Desc")}
              </li>
              <li>
                <strong>{t("section1Rule3")}</strong>
                ：{t("section1Rule3Desc")}
              </li>
            </ul>
            <p className="mt-3">{t("section1Violation")}</p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-zinc-900">
              {t("section2Title")}
            </h2>
            <p>{t("section2Body")}</p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-zinc-900">
              {t("section3Title")}
            </h2>
            <p className="mb-2">{t("section3Intro")}</p>
            <ul className="list-inside list-disc space-y-1 pl-2">
              <li>
                <strong>{t("section3Cheat")}</strong>
                ：{t("section3CheatDesc")}
              </li>
              <li>
                <strong>{t("section3Api")}</strong>
                ：{t("section3ApiDesc")}
              </li>
              <li>{t("section3Other")}</li>
            </ul>
            <p className="mt-3">{t("section3Enforce")}</p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-zinc-900">
              {t("section4Title")}
            </h2>
            <p className="mb-2">
              <strong>{t("section4Disclaimer")}</strong>
              ：{t("section4DisclaimerBody")}
            </p>
            <p>
              <strong>{t("section4Changes")}</strong>
              ：{t("section4ChangesBody")}
            </p>
          </section>

          <section>
            <p className="text-sm text-zinc-500">{t("footerNote")}</p>
          </section>
        </div>
      </article>
    </main>
  );
}
