const { buildPurchaseQuery } = require('../queries/purchaseQuery');
const { buildCategoryQuery } = require('../queries/categoryQuery');
const { buildRFMQuery } = require('../queries/rfmQuery');
const { buildPaymentQuery } = require('../queries/paymentQuery');
const { buildReturnsQuery } = require('../queries/returnsQuery');

function safeExecute(conn, query) {
  return new Promise((resolve) => {
    conn.all(query, (err, result) => {
      if (err) {
        resolve({
          status: "error",
          errorId: "QUERY_FAIL"
        });
      } else if (!result || result.length === 0) {
        resolve({
          status: "unavailable",
          reason: "No data"
        });
      } else {
        resolve({
          status: "ok",
          data: result
        });
      }
    });
  });
}

async function getDashboard(req, res) {
  const { datasetId } = req.params;
  const filters = req.query;
  const roles = req.roles;

  const db = require('duckdb').Database(':memory:');
  const conn = db.connect();

  const response = {};

  // Purchase Frequency
  if (roles.customer_id && roles.timestamp) {
    const query = buildPurchaseQuery(datasetId, roles, filters);
    response.purchase_frequency = await safeExecute(conn, query);
  } else {
    response.purchase_frequency = {
      status: "unavailable",
      reason: "Missing required columns"
    };
  }

  // Category Revenue
  if (roles.revenue && roles.category) {
    const query = buildCategoryQuery(datasetId, roles, filters);
    response.category_revenue = await safeExecute(conn, query);
  } else {
    response.category_revenue = {
      status: "unavailable",
      reason: "Missing required columns"
    };
  }

  // Customer Segmentation
  if (roles.customer_id && roles.revenue && roles.timestamp) {
    const query = buildRFMQuery(datasetId, roles, filters);
    response.customer_segmentation = await safeExecute(conn, query);
  } else {
    response.customer_segmentation = {
      status: "unavailable",
      reason: "Missing required columns"
    };
  }

  // Payment Analysis
  if (roles.payment && roles.revenue) {
    const query = buildPaymentQuery(datasetId, roles, filters);
    response.payment_analysis = await safeExecute(conn, query);
  } else {
    response.payment_analysis = {
      status: "unavailable",
      reason: "Missing required columns"
    };
  }

  // Returns
  if (roles.return_flag || roles.status) {
    const query = buildReturnsQuery(datasetId, roles, filters);
    response.returns = await safeExecute(conn, query);
  } else {
    response.returns = {
      status: "unavailable",
      reason: "Missing return indicator"
    };
  }

  return res.json(response);
}

module.exports = { getDashboard };
