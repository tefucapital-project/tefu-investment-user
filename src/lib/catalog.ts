import type { IjarahOpp, MudarabahOpp, Opportunity } from "./types";

export const ONBOARDING_FEE_AMOUNT = 5000;
export const ONBOARDING_FEE_NAME = "Client Onboarding Fee";
export const ONBOARDING_FEE_PURPOSE =
  "Covers identity verification, NIN and BVN checks, and opening your investment account. It is charged once, before KYC can begin.";
export const WITHDRAWAL_FEE = 100;
export const WITHDRAWAL_FEE_PURPOSE = "Processing fee for sending funds to your verified bank account.";
export const MUDARABAH_FEE_RATE = 0.005;
export const ARRANGEMENT_FEE_PURPOSE =
  "Administration of the mudarabah contract. This is not interest and it is not a share of profit.";
export const MIN_DEPOSIT = 1000;
export const MAX_DEPOSIT = 5_000_000;
export const MIN_WITHDRAWAL = 500;

export const NIGERIA_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River",
  "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano",
  "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo",
  "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
];

export const BANKS = [
  "Access Bank", "Citibank Nigeria", "Ecobank", "Fidelity Bank", "First Bank of Nigeria",
  "First City Monument Bank", "Globus Bank", "Guaranty Trust Bank", "Heritage Bank", "Keystone Bank",
  "Kuda Bank", "Opay", "PalmPay", "Polaris Bank", "Providus Bank", "Stanbic IBTC Bank",
  "Standard Chartered", "Sterling Bank", "Union Bank", "United Bank for Africa", "Unity Bank",
  "Wema Bank", "Zenith Bank",
];

export const ID_TYPES = [
  "Government-issued ID",
  "National ID",
  "Passport",
  "Driver's licence",
  "Other approved identification",
];

export const GENDERS = ["Female", "Male"];

export interface AgreementDoc {
  id: string;
  type: string;
  version: string;
  title: string;
  body: string;
}

export const AGREEMENTS: Record<"terms" | "privacy" | "mudarabah" | "ijarah", AgreementDoc> = {
  terms: {
    id: "terms",
    type: "Terms & Conditions",
    version: "1.0",
    title: "Tefu Investment client terms",
    body: `These terms govern your use of the Tefu Investment client application.

Tefu provides access to Mudarabah and Ijarah opportunities. Profit and rental follow the relevant contract and the actual result of the venture or lease. Tefu does not pay interest and does not guarantee a profit, a rental amount, or the return of capital.

The Client Onboarding Fee is a one-time fee required before KYC. Other fees, including any arrangement fee or withdrawal fee, are shown before you confirm the transaction.

You must pay the Client Onboarding Fee and receive KYC approval before your account can invest. Investments are funded only from available wallet balance.

You are responsible for the accuracy of the information you submit, including NIN, BVN, and bank details. Verified identity details may be locked against later edits.

This version stores your records in this browser. It does not include staff, compliance, or back-office tools.`,
  },
  privacy: {
    id: "privacy",
    type: "Privacy Policy",
    version: "1.0",
    title: "Privacy policy",
    body: `Tefu Investment collects the information you enter so it can open your account, take the Client Onboarding Fee, complete KYC, operate your wallet, and record investments.

Identity numbers are masked after submission. Passwords and your transaction PIN are stored as hashes, not as plain text.

In this user-only MVP, records stay in your browser on this device. They are not sent to a Tefu server. Do not enter real identity numbers on a shared computer. Clearing the site data on this device removes the account stored here.

Tefu does not sell client information. Notification preferences can be changed from your profile.`,
  },
  mudarabah: {
    id: "mudarabah",
    type: "Mudarabah agreement",
    version: "1.2",
    title: "Mudarabah participation agreement",
    body: `You participate as rabbul-mal, the provider of capital. The manager acts as mudarib and deploys the pool only for the venture described in the opportunity.

Profit, if the venture earns any, is shared in the published ratio. The ratio is not a rate of interest and it is not a promise that a profit will exist. A loss of capital is borne by the capital providers unless it results from the manager's negligence, misconduct, or breach of the mandate.

The amount you confirm, together with any disclosed arrangement fee, is deducted from your available wallet balance when this agreement is accepted. Your acceptance is recorded with the agreement version, the date and time, and the investment reference.

You should read the risk note on the opportunity before accepting.`,
  },
  ijarah: {
    id: "ijarah",
    type: "Ijarah agreement",
    version: "1.1",
    title: "Ijarah participation agreement",
    body: `You participate in the funding of the asset described in the opportunity. The asset is leased to the named lessee under an ijarah. Rental is distributed from rent actually collected, on the published schedule. Rental is not interest and it is not owed if it is not collected.

The investment amount is deducted from your available wallet balance when you accept this agreement. Any fee shown on the confirmation screen is part of that deduction and will be named before you confirm.

Your acceptance is recorded with the agreement version, the date and time, and the investment reference. Takaful, where it is noted on the opportunity, is a protection arrangement and not a guarantee of profit.`,
  },
};

const grainDocs = [
  {
    title: "Information memorandum",
    body: "The pool buys and sells locally sourced grains through approved wholesalers in Kano and Lagos. Capital is drawn only up to the target. Trading stock is the asset of the venture. This note describes the activity. It is not a forecast of profit.",
  },
  {
    title: "Risk disclosure",
    body: "Grain prices move. Stock can spoil or remain unsold. A loss of capital is possible. Past trade cycles, if mentioned by the manager, are not a promise of the next cycle.",
  },
];

const poultryDocs = [
  {
    title: "Information memorandum",
    body: "The venture raises and sells halal poultry in Kaduna under a written management mandate. Feed, birds, and sales proceeds belong to the mudarabah. Distributions happen only if the cycle records a profit at maturity.",
  },
  {
    title: "Risk disclosure",
    body: "Livestock ventures carry mortality, feed-cost, and sales risk. Capital is not protected by a fixed return.",
  },
];

const datesDocs = [
  {
    title: "Information memorandum",
    body: "A seasonal pool for the purchase and sale of dates into Nigerian wholesale markets. The tenor is short. Profit is assessed at maturity.",
  },
  {
    title: "Risk disclosure",
    body: "Import timing, foreign-currency cost of goods, and festival demand can all reduce or eliminate profit. Currency movement is a commercial risk of the venture, not an interest charge.",
  },
];

const logisticsDocs = [
  {
    title: "Information memorandum",
    body: "The pool funded working capital for an ethical last-mile operator. The target has been reached, so this opportunity is closed to new capital.",
  },
  {
    title: "Risk disclosure",
    body: "Fully funded opportunities cannot accept new investments.",
  },
];

export const OPPORTUNITIES: Opportunity[] = [
  {
    kind: "mudarabah",
    id: "mud-grains",
    name: "Kano Grains Trading Pool",
    sector: "Agricultural trade",
    summary: "A mudarabah that buys and sells millet, maize, and rice through wholesalers.",
    description:
      "Capital is pooled and used to purchase grains for resale. You are the capital provider. The manager buys, stores, and sells within the mandate. At maturity the books are drawn up. Profit is shared. If there is a loss of capital, it falls on the investors unless the manager is at fault.",
    min: 50_000,
    max: 2_000_000,
    target: 25_000_000,
    fundedBase: 14_800_000,
    durationDays: 180,
    investorShare: 70,
    managerShare: 30,
    schedule: "Any profit is distributed once, at maturity. No interim rate is declared.",
    risk: [
      "Commodity prices can fall before stock is sold.",
      "Capital can be lost. It is not a guaranteed deposit.",
      "The profit-sharing ratio applies only when a profit exists.",
    ],
    shariah:
      "Mudarabah. You participate as rabbul-mal. The manager is the mudarib. The published split applies to profit only. This is not an interest-bearing placement.",
    documents: grainDocs,
    status: "open",
  } satisfies MudarabahOpp,
  {
    kind: "mudarabah",
    id: "mud-poultry",
    name: "Kaduna Halal Poultry Venture",
    sector: "Livestock",
    summary: "A one-year halal poultry cycle with profit shared at maturity.",
    description:
      "The venture funds a single poultry cycle: housing, feed, and birds that are raised and sold as halal stock. The manager reports at maturity. Investors receive their share of any profit. There is no coupon and no promised rate.",
    min: 100_000,
    max: 5_000_000,
    target: 40_000_000,
    fundedBase: 9_600_000,
    durationDays: 365,
    investorShare: 65,
    managerShare: 35,
    schedule: "Profit, if earned, is distributed at the end of the cycle.",
    risk: [
      "Mortality and feed prices can consume capital.",
      "A cycle can end without profit.",
      "Funds stay invested until maturity unless the venture rules say otherwise.",
    ],
    shariah:
      "Mudarabah limited to a halal poultry mandate. The manager may not place the capital in interest-bearing instruments.",
    documents: poultryDocs,
    status: "open",
  } satisfies MudarabahOpp,
  {
    kind: "mudarabah",
    id: "mud-dates",
    name: "Seasonal Dates Import Pool",
    sector: "Trade",
    summary: "A 120-day pool for wholesale dates.",
    description:
      "The pool purchases dates for resale into Nigerian markets around the seasonal demand window. The tenor is 120 days. The investor share of any profit is 75 percent. The manager's share is 25 percent of profit, not a fee taken from capital.",
    min: 75_000,
    max: 3_000_000,
    target: 18_000_000,
    fundedBase: 4_200_000,
    durationDays: 120,
    investorShare: 75,
    managerShare: 25,
    schedule: "A single distribution at maturity, and only if the pool records a profit.",
    risk: [
      "Demand can be weaker than the buying plan.",
      "The cost of stock can rise after the pool has committed.",
      "You may receive no profit, and capital may be reduced.",
    ],
    shariah: "Mudarabah for a defined trading mandate. Profit is shared. Loss of capital follows mudarabah rules.",
    documents: datesDocs,
    status: "open",
  } satisfies MudarabahOpp,
  {
    kind: "mudarabah",
    id: "mud-logistics",
    name: "Ethical Last-Mile Logistics",
    sector: "Logistics",
    summary: "Working capital for a halal logistics operator. The target is fully funded.",
    description:
      "This pool financed operating capital for deliveries that do not carry prohibited goods. The target amount has been reached, so new investments are closed. It remains visible so you can read the structure.",
    min: 25_000,
    max: 1_000_000,
    target: 15_000_000,
    fundedBase: 15_000_000,
    durationDays: 270,
    investorShare: 60,
    managerShare: 40,
    schedule: "No new capital is accepted. Existing investors are outside this screen.",
    risk: ["This opportunity cannot take further investments."],
    shariah: "Mudarabah. Shown as fully funded. The structure does not become interest-bearing when it is closed.",
    documents: logisticsDocs,
    status: "fully_funded",
  } satisfies MudarabahOpp,
  {
    kind: "ijarah",
    id: "ij-clinic",
    name: "Diagnostic Clinic Equipment",
    assetType: "Medical equipment",
    summary: "Participation in equipment leased to a diagnostic clinic in Kano.",
    description:
      "Client funds are used, with other participants, to acquire diagnostic equipment. The equipment is leased to the clinic. You do not lend money to the clinic. You participate in the asset. Rent is passed on only when the lessee pays it.",
    min: 100_000,
    max: 5_000_000,
    target: 45_000_000,
    fundedBase: 18_000_000,
    assetValue: 45_000_000,
    leaseMonths: 36,
    takaful: "The equipment is covered by takaful against specified physical loss. Takaful does not guarantee rental or the return of capital.",
    schedule: "Monthly, from rent actually collected. Missed rent is not capitalised as interest.",
    risk: [
      "The lessee may pay late or fail to pay.",
      "The asset can lose value.",
      "Rental amounts are not guaranteed.",
    ],
    shariah:
      "Ijarah. The contract is a lease of an identified asset. Payments are rental, not interest on a loan.",
    documents: [
      {
        title: "Asset note",
        body: "Diagnostic equipment identified for a Kano clinic. The asset is specified before the lease begins. Ownership stays with the leasing arrangement, not with the clinic, until the contract ends.",
      },
      {
        title: "Risk disclosure",
        body: "If rent is not collected, there is nothing to distribute for that period. A lessee default is a credit risk of the lease, not an interest event.",
      },
    ],
    status: "open",
  } satisfies IjarahOpp,
  {
    kind: "ijarah",
    id: "ij-cold",
    name: "Abuja Cold-Chain Warehouse",
    assetType: "Warehouse",
    summary: "A leased cold-storage warehouse with quarterly rental distributions.",
    description:
      "The asset is a cold-chain warehouse leased to a food distributor in Abuja. Participants fund the asset. Rental is reviewed on the lease calendar and distributed quarterly when it is collected.",
    min: 250_000,
    max: 10_000_000,
    target: 80_000_000,
    fundedBase: 22_000_000,
    assetValue: 80_000_000,
    leaseMonths: 48,
    takaful: "Building takaful is in place for fire and defined structural risks. It is not income protection.",
    schedule: "Quarterly, from rent actually collected under the lease.",
    risk: [
      "Occupancy and lessee performance can interrupt rent.",
      "Maintenance can reduce what is available to distribute.",
      "The lease is not a fixed-income security.",
    ],
    shariah: "Ijarah of a specified property. Rental follows the lease. It is not a coupon.",
    documents: [
      {
        title: "Asset note",
        body: "Cold-chain warehouse in Abuja, leased to a single food distributor. The lease term matches the tenor shown on this opportunity.",
      },
      {
        title: "Risk disclosure",
        body: "Property and tenant risk sit with the participants in the asset. Read the lease schedule before you invest.",
      },
    ],
    status: "open",
  } satisfies IjarahOpp,
  {
    kind: "ijarah",
    id: "ij-solar",
    name: "School Solar Installation",
    assetType: "Solar equipment",
    summary: "Solar equipment leased to an educational trust in Ibadan.",
    description:
      "The asset is a solar installation leased to a school trust. Participants fund the equipment. The trust pays rent for the use of the installation. Distributions follow rent that is actually received.",
    min: 50_000,
    max: 2_000_000,
    target: 12_000_000,
    fundedBase: 3_400_000,
    assetValue: 12_000_000,
    leaseMonths: 60,
    takaful: "Equipment takaful applies to defined physical damage. It does not insure the rental stream.",
    schedule: "Monthly, when the lessee's rent is collected.",
    risk: [
      "Equipment can underperform or need replacement.",
      "The trust may delay rent.",
      "Nothing on this page is a promised yield.",
    ],
    shariah: "Ijarah of identified solar equipment. The school pays rent for use. Participants are not lenders.",
    documents: [
      {
        title: "Asset note",
        body: "Rooftop solar equipment specified for a school site in Ibadan. The lessee is an educational trust.",
      },
      {
        title: "Risk disclosure",
        body: "Performance of the equipment and payment by the lessee determine what can be distributed. There is no fixed profit rate.",
      },
    ],
    status: "open",
  } satisfies IjarahOpp,
];

export const FAQS = [
  {
    q: "What is the Client Onboarding Fee?",
    a: "It is a one-time fee of ₦5,000 required before KYC can begin. It pays for identity checks and opening the investment account. A failed or pending payment does not unlock KYC.",
  },
  {
    q: "When can I start KYC?",
    a: "Only after the Client Onboarding Fee is successful. NIN and BVN sit inside KYC. They are not separate stages before it.",
  },
  {
    q: "When can I invest?",
    a: "After KYC is approved, the account is active, and your available wallet balance covers the investment and any fee shown on the confirmation screen.",
  },
  {
    q: "Are profits guaranteed?",
    a: "No. Mudarabah profit depends on the venture. Ijarah rental depends on rent actually collected. Tefu does not pay or promise interest.",
  },
  {
    q: "Where do withdrawals go?",
    a: "To a bank account that has been verified in your name. You cannot withdraw invested funds, and you cannot withdraw more than your available balance.",
  },
  {
    q: "Where are my records kept in this version?",
    a: "On this device, in the browser. Staff, compliance review, and live payment switches are outside this user MVP.",
  },
];

export function findOpportunity(id: string) {
  return OPPORTUNITIES.find((item) => item.id === id);
}
