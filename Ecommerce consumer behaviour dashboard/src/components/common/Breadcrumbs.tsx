import { useTranslations } from "next-intl";

interface BreadcrumbsProps {
  pageName?: string;
}

export const Breadcrumbs = ({ pageName }: BreadcrumbsProps) => {
  const t = useTranslations("breadcrumbs");

  // Only translate known static keys; fall back to raw pageName for dynamic tabs
  const firstPart = (() => {
    try {
      return t("firstPart");
    } catch {
      return "Home";
    }
  })();

  return (
    <div className="text-secondaryText text-sm 1xl:text-base font-semibold">
      {firstPart} &gt; {pageName || ""}
    </div>
  );
};
