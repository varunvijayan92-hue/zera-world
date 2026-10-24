export type ProfitInput = {
  sellingPrice: number;
  supplierCost: number;
  shippingCost?: number;
  marketplaceFeeRate?: number;
  marketplaceFeeFixed?: number;
  packagingCost?: number;
  taxRate?: number;
  adSpend?: number;
  returnLoss?: number;
  otherExpenses?: number;
};

export function calculateEstimatedProfit(input: ProfitInput) {
  const sellingPrice = Number(input.sellingPrice) || 0;
  const supplierCost = Number(input.supplierCost) || 0;
  const shippingCost = Number(input.shippingCost || 0);
  const marketplaceFeeRate = Number(input.marketplaceFeeRate || 0);
  const marketplaceFeeFixed = Number(input.marketplaceFeeFixed || 0);
  const packagingCost = Number(input.packagingCost || 0);
  const taxRate = Number(input.taxRate || 0);
  const adSpend = Number(input.adSpend || 0);
  const returnLoss = Number(input.returnLoss || 0);
  const otherExpenses = Number(input.otherExpenses || 0);

  const marketplaceFee = sellingPrice * (marketplaceFeeRate / 100) + marketplaceFeeFixed;
  const taxAmount = sellingPrice * (taxRate / 100);

  const totalCosts =
    supplierCost +
    shippingCost +
    marketplaceFee +
    packagingCost +
    taxAmount +
    adSpend +
    returnLoss +
    otherExpenses;

  const netProfit = sellingPrice - totalCosts;
  const profitMargin = sellingPrice > 0 ? (netProfit / sellingPrice) * 100 : 0;

  return {
    revenue: sellingPrice,
    totalCosts,
    netProfit,
    profitMargin,
    marketplaceFee,
    taxAmount,
  };
}

export function getMarginState(margin: number) {
  if (margin < 0) {
    return {
      warning: true,
      label: "Negative margin",
      description: "This product is currently below the break-even point.",
    };
  }

  if (margin < 10) {
    return {
      warning: true,
      label: "Low margin",
      description: "Margin is thin; review cost assumptions before launch.",
    };
  }

  return {
    warning: false,
    label: "Healthy margin",
    description: "Estimated margin looks viable for a dropshipping channel.",
  };
}
