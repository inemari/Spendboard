// Column names vary enough between bank/card exports that guessing the right
// one from header text alone risks silently mismapping a field (e.g. which
// column is the transaction name vs. its payment-type subtitle). The user
// picks the format explicitly instead, and each format carries its own fixed
// set of header aliases.
export type StatementFormatId = "sas-eurobonus" | "nordea-debit";

export type HeaderAliases = {
  date: string[];
  description: string[];
  location: string[];
  amount: string[];
};

export type StatementFormat = {
  id: StatementFormatId;
  label: string;
  accept: string;
  aliases: HeaderAliases;
};

export const STATEMENT_FORMATS: StatementFormat[] = [
  {
    id: "sas-eurobonus",
    label: "SAS Eurobonus Kredittkort (Excel)",
    accept: ".csv,.xlsx,.xls",
    aliases: {
      date: ["date", "dato", "transaction date", "bokføringsdato", "bokført"],
      description: [
        "description",
        "beskrivelse",
        "tekst",
        "forklaring",
        "spesifikasjon",
        "text",
        "melding",
      ],
      location: ["sted", "location", "place", "merchant"],
      amount: ["amount", "beløp", "belop", "sum", "value"],
    },
  },
  {
    id: "nordea-debit",
    label: "Nordea Debit (PDF)",
    accept: ".pdf",
    aliases: {
      // Betalingstype (e.g. "Visa varekjøp/uttak", "Straksutbetaling") becomes
      // the card's subtitle, same slot "Sted" fills for the Excel format —
      // Navn is the transaction's counterpart name, not its payment method.
      date: ["dato"],
      description: ["navn"],
      location: ["betalingstype"],
      amount: ["beløp", "belop"],
    },
  },
];

export function getStatementFormat(id: string): StatementFormat {
  const format = STATEMENT_FORMATS.find((f) => f.id === id);
  if (!format) {
    throw new Error(`Unknown statement format: ${id}`);
  }
  return format;
}
