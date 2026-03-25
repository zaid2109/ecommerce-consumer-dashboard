import { redirect } from "next/navigation";

type OverviewPageProps = {
  params: {
    locale: string;
  };
};

export default function OverviewPage({ params }: OverviewPageProps) {
  redirect(`/${params.locale}`);
}
