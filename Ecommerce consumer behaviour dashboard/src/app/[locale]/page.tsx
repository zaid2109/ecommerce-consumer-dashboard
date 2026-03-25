import { PageWrapper } from "../../components/common/PageWrapper";
import { HomepageView } from "../../components/views/homepage/HomepageView";
import { getData } from "../../services/getData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const Home = async () => {
  const homepageData = await getData("homepage");
  return (
    <PageWrapper
      hidePaper
      className="pt-32"
      pageName="Dashboard"
      dataForExport={{
        bestSellingProducts: homepageData.bestSellingProducts.map((item) => ({
          name: String(item.name ?? ""),
          profit: Number(item.profit ?? 0),
          revenue: Number(item.revenue ?? 0),
        })),
        customerSatisfaction: homepageData.customerSatisfaction.map((item) => ({
          brandName: String(item.brandName ?? ""),
          customerSatisfaction: Number(item.customerSatisfaction ?? 0),
          totalSales: Number(item.totalSales ?? 0),
          numberOfOrders: Number(item.numberOfOrders ?? 0),
        })),
        homeSmallCards: homepageData.homeSmallCards.map((card) => ({
          title: String(card.title ?? ""),
          metric: String(card.metric ?? ""),
          metricPrev: String(card.metricPrev ?? ""),
          delta: String(card.delta ?? ""),
          deltaType: String(card.deltaType ?? ""),
          color: String(card.color ?? ""),
          increased: Boolean(card.increased),
          changeValue: Number(card.changeValue ?? 0),
          changeText: String(card.changeText ?? ""),
          chartData: card.chartData.map((point) => ({
            date: String(point.date ?? ""),
            metric: Number(point.metric ?? 0),
          })),
        })),
        regions: homepageData.regions.map((region) => ({
          name: String(region.name ?? ""),
          region: String(region.region ?? ""),
          sales: Number(region.sales ?? 0),
          delta: String(region.delta ?? ""),
          deltaType: String(region.deltaType ?? ""),
        })),
        revenueOverTime: homepageData.revenueOverTime.map((item) => ({
          date: String(item.date ?? ""),
          websiteSales: Number(item.websiteSales ?? 0),
          inStoreSales: Number(item.inStoreSales ?? 0),
        })),
        revenuePerCountry: homepageData.revenuePerCountry.map((item) => ({
          name: String(item.name ?? ""),
          price: Number(item.price ?? 0),
        })),
      }}
    >
      <HomepageView homepageData={homepageData} />
    </PageWrapper>
  );
};

export default Home;
