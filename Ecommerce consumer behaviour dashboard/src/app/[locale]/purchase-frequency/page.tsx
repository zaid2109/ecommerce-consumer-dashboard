"use client";

import { PageWrapper } from "../../../components/common/PageWrapper";
import { Card } from "../../../components/common/Card";

const PurchaseFrequencyPage = () => {
  return (
    <PageWrapper className="px-4 pt-28 pb-4 xl:p-0" hidePaper pageName="Purchase Frequency">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h1 className="text-2xl font-bold text-gray-900">Purchase Frequency</h1>
          <p className="text-gray-600 mt-1">Customer buying patterns and frequency analysis</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card title="Avg Orders/Customer">
            <div className="pt-4">
              <div className="text-2xl font-bold text-blue-600">3.4</div>
              <p className="text-sm text-gray-500 mt-1">orders per customer</p>
            </div>
          </Card>
          
          <Card title="Repeat Rate">
            <div className="pt-4">
              <div className="text-2xl font-bold text-green-600">42%</div>
              <p className="text-sm text-gray-500 mt-1">repeat customers</p>
            </div>
          </Card>
          
          <Card title="Active Customers">
            <div className="pt-4">
              <div className="text-2xl font-bold text-purple-600">18,234</div>
              <p className="text-sm text-gray-500 mt-1">last 30 days</p>
            </div>
          </Card>
          
          <Card title="Avg Interval">
            <div className="pt-4">
              <div className="text-2xl font-bold text-orange-600">24 days</div>
              <p className="text-sm text-gray-500 mt-1">between purchases</p>
            </div>
          </Card>
        </div>

        <Card title="Frequency Distribution">
          <div className="pt-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-green-50 rounded">
                <span className="font-medium">1 Purchase</span>
                <span className="text-sm text-green-600">58% • 15,234 customers</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded">
                <span className="font-medium">2-3 Purchases</span>
                <span className="text-sm text-blue-600">28% • 7,361 customers</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-purple-50 rounded">
                <span className="font-medium">4-6 Purchases</span>
                <span className="text-sm text-purple-600">10% • 2,629 customers</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-orange-50 rounded">
                <span className="font-medium">7+ Purchases</span>
                <span className="text-sm text-orange-600">4% • 1,052 customers</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </PageWrapper>
  );
};

export default PurchaseFrequencyPage;
