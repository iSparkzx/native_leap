// Placeholder content for the Industries section. Times are illustrative, not measured.

export interface WorkflowStep {
  text: string;
  /** Minutes of a person's time. `null` means the step runs without anyone touching it. */
  minutes: number | null;
}

export interface Industry {
  id: string;
  name: string;
  workflow: string;
  unit: string;
  today: WorkflowStep[];
  after: WorkflowStep[];
}

export const industries: Industry[] = [
  {
    id: "distribution",
    name: "Distribution",
    workflow: "Order entry from emailed purchase orders",
    unit: "Time per order",
    today: [
      { text: "Open the PO attachment from the shared inbox", minutes: 1 },
      { text: "Look up the customer and ship-to address", minutes: 2 },
      { text: "Retype each line into the ERP", minutes: 9 },
      { text: "Check prices against the customer contract", minutes: 4 },
      { text: "Email the order confirmation", minutes: 2 },
    ],
    after: [
      { text: "Agent reads the PO and drafts the sales order", minutes: null },
      { text: "Price mismatches flagged with the contract line", minutes: null },
      { text: "Rep reviews and approves the order", minutes: 2 },
    ],
  },
  {
    id: "manufacturing",
    name: "Manufacturing",
    workflow: "Quotes from RFQ drawings",
    unit: "Time per quote",
    today: [
      { text: "Read the RFQ and the attached drawings", minutes: 15 },
      { text: "Search old jobs for something similar", minutes: 20 },
      { text: "Estimate material, routing and machine time", minutes: 30 },
      { text: "Build the quote in the ERP", minutes: 15 },
    ],
    after: [
      { text: "Agent finds similar past jobs and drafts the routing", minutes: null },
      { text: "Estimator reviews and adjusts the draft", minutes: 12 },
      { text: "Quote generated in the ERP", minutes: 1 },
    ],
  },
  {
    id: "trades",
    name: "Trade contractors",
    workflow: "Subcontractor invoices to job cost",
    unit: "Time per invoice",
    today: [
      { text: "Download the invoice from email", minutes: 1 },
      { text: "Match it to the PO and the job", minutes: 6 },
      { text: "Check the lien waiver is on file", minutes: 4 },
      { text: "Code it to cost codes in the accounting system", minutes: 5 },
      { text: "Route it to the project manager for approval", minutes: 3 },
    ],
    after: [
      { text: "Agent matches invoice, PO and waiver", minutes: null },
      { text: "Missing waivers requested automatically", minutes: null },
      { text: "Project manager approves the coded entry", minutes: 1 },
    ],
  },
  {
    id: "insurance",
    name: "Insurance agencies",
    workflow: "Commercial renewal preparation",
    unit: "Time per renewal",
    today: [
      { text: "Pull the policy from the agency management system", minutes: 3 },
      { text: "Request and collect loss runs", minutes: 10 },
      { text: "Re-key the submission into each carrier portal", minutes: 25 },
      { text: "Compare quotes in a spreadsheet", minutes: 15 },
    ],
    after: [
      { text: "Agent assembles the renewal file", minutes: null },
      { text: "Carrier submissions pre-filled for review", minutes: 3 },
      { text: "Quote comparison drafted for the producer", minutes: 5 },
    ],
  },
];
