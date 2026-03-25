import { capitalizeFirstLetter } from "./capitalizeFirstLetter";

// Convert complex objects to simple string representation
const stringifyComplexValue = (value: JsonValue | undefined): string => {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    // Convert object to a simplified string representation
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    // For arrays, join elements with semicolons to avoid CSV column issues
    return value
      .map((item) => (typeof item === "object" ? JSON.stringify(item) : item))
      .join(";");
  }

  return String(value);
};

// Convert a single data group to CSV format
const convertSingleGroupToCSV = <T extends object>(
  arr: T[],
  groupName?: string
): string => {
  if (!arr.length) return "";

  const headers = Object.keys(arr[0]).map(capitalizeFirstLetter);

  const data = arr.map((row) => {
    return Object.values(row).map((value) => {
      const stringValue = stringifyComplexValue(value);
      return typeof stringValue === "string" && stringValue.includes(",")
        ? `"${stringValue}"`
        : stringValue;
    });
  });

  const rows = [headers].concat(data);
  return rows.map((row) => row.join(",")).join("\n");
};

// Group data by dataType
const groupDataByType = <T extends { dataType?: string }>(
  data: T[]
): Record<string, T[]> => {
  const groups: Record<string, T[]> = {};

  data.forEach((item) => {
    const type = item.dataType || "unspecified";
    if (!groups[type]) {
      groups[type] = [];
    }
    // Create a copy without the dataType field for export
    const { dataType, ...rest } = item as T & { dataType?: string };
    groups[type].push(rest as T);
  });

  return groups;
};

// Convert multiple data groups to CSV with separators
const convertMultiGroupToCSV = <T extends { dataType?: string }>(
  data: T[]
): string => {
  const groups = groupDataByType(data);

  const csvParts: string[] = [];

  Object.entries(groups).forEach(([groupName, items]) => {
    // Add group name as a header
    csvParts.push(`# ${groupName}`);

    // Add CSV for this group
    csvParts.push(convertSingleGroupToCSV(items, groupName));

    // Add blank line after each group
    csvParts.push("");
  });

  return csvParts.join("\n");
};

// Add this function to prepare data for the CSV export
export const prepareDataForExport = <T extends object>(
  data: T | T[],
  pageName?: string
): JsonObject[] => {
  if (!data) return [];

  // If data is already an array, use it directly
  if (Array.isArray(data)) {
    return data.length > 0 ? (data as JsonObject[]) : [];
  }

  // Otherwise, extract the appropriate data based on the page name
  switch (pageName?.toLowerCase()) {
    case "dashboard": {
      // Cast to expected structure to access properties
      const homepageData = data as JsonObject;

      // Combine relevant arrays from homepage data into a flattened structure
      return [
        ...mapWithDataType(
          homepageData.bestSellingProducts as object[],
          "bestSellingProducts"
        ),
        ...mapWithDataType(
          homepageData.customerSatisfaction as object[],
          "customerSatisfaction"
        ),
        ...mapWithDataType(homepageData.homeSmallCards as object[], "homeSmallCards"),
        ...mapWithDataType(homepageData.regions as object[], "regions"),
        ...mapWithDataType(homepageData.revenueOverTime as object[], "revenueOverTime"),
        ...mapWithDataType(homepageData.revenuePerCountry as object[], "revenuePerCountry"),
      ];
    }

    case "analytics": {
      // Cast to expected structure to access properties
      const analyticsData = data as JsonObject;

      // Combine relevant arrays from analytics data
      return [
        ...mapWithDataType(analyticsData.assets as object[], "assets"),
        ...mapWithDataType(analyticsData.monthPerformance as object[], "monthPerformance"),
        ...mapWithDataType(analyticsData.todaySales as object[], "todaySales"),
        ...mapWithDataType(
          analyticsData.totalProfitProducts as object[],
          "totalProfitProducts"
        ),
        ...mapWithDataType(
          analyticsData.totalProfitMonths as object[],
          "totalProfitMonths"
        ),
        ...mapWithDataType(analyticsData.yearOverview as object[], "yearOverview"),
        ...mapWithDataType(analyticsData.marketMetrics as object[], "marketMetrics"),
        ...mapWithDataType(
          analyticsData.revenueDistribution as object[],
          "revenueDistribution"
        ),
      ];
    }

    case "orders":
    case "products":
    case "customers":
    case "calendar":
      // These are already arrays of objects
      return data as JsonObject[];

    default: {
      // For unrecognized page names, try to determine if some arrays are in the data
      const record = data as Record<string, JsonValue>;
      const possibleArrays = Object.keys(record).filter(
        (key) => Array.isArray(record[key]) && (record[key] as JsonValue[]).length > 0
      );

      if (possibleArrays.length === 1) {
        // If there's only one array, use that
        return record[possibleArrays[0]] as JsonObject[];
      } else if (possibleArrays.length > 1) {
        // If there are multiple arrays, combine them with type indicators
        return possibleArrays.flatMap((key) =>
          (record[key] as JsonValue[]).map((item) => {
            if (item !== null && typeof item === "object" && !Array.isArray(item)) {
              return { ...(item as JsonObject), dataType: key, value: null };
            }
            return { value: String(item), dataType: key };
          })
        );
      }

      // If no arrays found, return empty array
      return [];
    }
  }

  // This default return is needed to satisfy TypeScript
  return [];
};

// Update the exportToCSV function to use group-based export for complex data
export const exportToCSV = <T extends object>(
  data: T | T[],
  filename: string,
  pageName?: string
): void => {
  // Prepare the data for export
  const preparedData = prepareDataForExport(data, pageName);

  // Check if there's data to export
  if (preparedData.length === 0) {
    console.warn("No data to export");
    return;
  }

  let csvData: string;

  // Use the appropriate conversion method based on the page
  if (["dashboard", "analytics"].includes(pageName?.toLowerCase() || "")) {
    // For complex pages with multiple data types, use the group-based conversion
    csvData = convertMultiGroupToCSV(preparedData as Array<{ dataType?: string }>);
  } else {
    // For simple pages with a single data type, use the standard conversion
    csvData = convertSingleGroupToCSV(preparedData);
  }

  const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Generic function to map items and add dataType
function mapWithDataType<T extends object>(
  items: T[] | undefined,
  dataType: string
): (T & { dataType: string })[] {
  return (items || []).map((item) => ({ ...item, dataType }));
}
