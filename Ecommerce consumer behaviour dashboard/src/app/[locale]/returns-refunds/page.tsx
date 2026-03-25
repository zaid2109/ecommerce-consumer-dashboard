"use client";

import { PageWrapper } from "../../../components/common/PageWrapper";
import { Card } from "../../../components/common/Card";

const ReturnsRefundsPage = () => {
  return (
    <PageWrapper className="px-4 pt-28 pb-4 xl:p-0" hidePaper pageName="Returns & Refunds">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h1 className="text-2xl font-bold text-gray-900">Returns & Refunds</h1>
          <p className="text-gray-600 mt-1">Return analysis and loss tracking</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card title="Return Rate">
            <div className="pt-4">
              <div className="text-2xl font-bold text-orange-600">3.2%</div>
              <p className="text-sm text-gray-500 mt-1">of total orders</p>
            </div>
          </Card>
          
          <Card title="Total Returns">
            <div className="pt-4">
              <div className="text-2xl font-bold text-red-600">1,847</div>
              <p className="text-sm text-gray-500 mt-1">returns processed</p>
            </div>
          </Card>
          
          <Card title="Refund Amount">
            <div className="pt-4">
              <div className="text-2xl font-bold text-purple-600">$47,250</div>
              <p className="text-sm text-gray-500 mt-1">total refunded</p>
            </div>
          </Card>
          
          <Card title="Avg Refund">
            <div className="pt-4">
              <div className="text-2xl font-bold text-blue-600">$25.60</div>
              <p className="text-sm text-gray-500 mt-1">per return</p>
            </div>
          </Card>
        </div>

        <Card title="Returns by Category">
          <div className="pt-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-red-50 rounded">
                <span className="font-medium">Electronics</span>
                <span className="text-sm text-red-600">5.8% • $18,420</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-orange-50 rounded">
                <span className="font-medium">Clothing</span>
                <span className="text-sm text-orange-600">4.2% • $12,150</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-yellow-50 rounded">
                <span className="font-medium">Home & Garden</span>
                <span className="text-sm text-yellow-600">2.9% • $8,680</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-green-50 rounded">
                <span className="font-medium">Books</span>
                <span className="text-sm text-green-600">1.1% • $2,340</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </PageWrapper>
  );
};

export default ReturnsRefundsPage;
