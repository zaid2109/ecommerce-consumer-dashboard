"use client";

import { PageWrapper } from "../../../components/common/PageWrapper";
import { Card } from "../../../components/common/Card";

const PaymentAnalysisPage = () => {
  return (
    <PageWrapper className="px-4 pt-28 pb-4 xl:p-0" hidePaper pageName="Payment Analysis">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h1 className="text-2xl font-bold text-gray-900">Payment Analysis</h1>
          <p className="text-gray-600 mt-1">Payment methods and revenue insights</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card title="Online Payments">
            <div className="pt-4">
              <div className="text-3xl font-bold text-blue-600">68%</div>
              <p className="text-sm text-gray-500 mt-2">of total transactions</p>
            </div>
          </Card>

          <Card title="COD Payments">
            <div className="pt-4">
              <div className="text-3xl font-bold text-green-600">32%</div>
              <p className="text-sm text-gray-500 mt-2">of total transactions</p>
            </div>
          </Card>

          <Card title="Total Revenue">
            <div className="pt-4">
              <div className="text-3xl font-bold text-purple-600">$2.4M</div>
              <p className="text-sm text-gray-500 mt-2">from all payment methods</p>
            </div>
          </Card>
        </div>

        <Card title="Payment Method Performance">
          <div className="pt-4">
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <span className="font-medium">Credit Card</span>
                <span className="text-sm text-gray-600">45% • $1.1M</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <span className="font-medium">Debit Card</span>
                <span className="text-sm text-gray-600">23% • $550K</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <span className="font-medium">Cash on Delivery</span>
                <span className="text-sm text-gray-600">32% • $768K</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </PageWrapper>
  );
};

export default PaymentAnalysisPage;
