export type CreditBucket = "CURRENT" | "NEXT";

export type CreditSummary = {
  bucket: CreditBucket;
  creditType: "PT_55" | "PT_25" | "COUNSELING" | "TRIAL";
  remaining: number;
  consumedThisMonth: number;
  rolloverEligible: boolean;
};

export async function getCustomerCreditSummary(userId: string): Promise<CreditSummary[]> {
  return [
    {
      bucket: "CURRENT",
      creditType: "PT_55",
      remaining: 2,
      consumedThisMonth: 2,
      rolloverEligible: false,
    },
    {
      bucket: "NEXT",
      creditType: "PT_55",
      remaining: 4,
      consumedThisMonth: 0,
      rolloverEligible: false,
    },
    {
      bucket: "CURRENT",
      creditType: "PT_25",
      remaining: 1,
      consumedThisMonth: 3,
      rolloverEligible: false,
    },
  ];
}
