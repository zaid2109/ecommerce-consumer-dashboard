import { PageWrapper } from "../../../components/common/PageWrapper";
import { CustomersView } from "../../../components/views/customers/CustomersView";
import { getData } from "../../../services/getData";

const Customers = async () => {
  const customersData = await getData("customers");

  return (
    <PageWrapper
      className="flex-col"
      pageName="Customers"
      dataForExport={customersData.map((customer) => ({
        photo: String(customer.photo ?? ""),
        firstName: String(customer.firstName ?? ""),
        lastName: String(customer.lastName ?? ""),
        city: String(customer.city ?? ""),
        country: String(customer.country ?? ""),
        phone: String(customer.phone ?? ""),
        totalBuys: Number(customer.totalBuys ?? 0),
      }))}
    >
      <CustomersView customers={customersData} />
    </PageWrapper>
  );
};

export default Customers;
