import { PageWrapper } from "../../../components/common/PageWrapper";
import { OrdersView } from "../../../components/views/orders/OrdersView";
import { getData } from "../../../services/getData";

const Orders = async () => {
  const ordersData = await getData("orders");

  return (
    <PageWrapper
      pageName="Orders"
      dataForExport={ordersData.map((order) => ({
        orderId: String(order.orderId ?? ""),
        productName: String(order.productName ?? ""),
        user: String(order.user ?? ""),
        price: Number(order.price ?? 0),
        deliveryType: String(order.deliveryType ?? ""),
        date: String(order.date ?? ""),
        status: String(order.status ?? ""),
      }))}
    >
      <OrdersView ordersData={ordersData} />
    </PageWrapper>
  );
};

export default Orders;
