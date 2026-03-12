// Amortization calculation utilities

export interface AmortizationRow {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
}

export function calculateReducingBalance(
  principal: number,
  ratePercent: number,
  termMonths: number
): AmortizationRow[] {
  const monthlyRate = ratePercent / 100;
  const payment =
    monthlyRate === 0
      ? principal / termMonths
      : (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
        (Math.pow(1 + monthlyRate, termMonths) - 1);

  const schedule: AmortizationRow[] = [];
  let balance = principal;

  for (let i = 1; i <= termMonths; i++) {
    const interest = balance * monthlyRate;
    const principalPart = payment - interest;
    balance = Math.max(0, balance - principalPart);

    schedule.push({
      month: i,
      payment: Math.round(payment),
      principal: Math.round(principalPart),
      interest: Math.round(interest),
      balance: Math.round(balance),
    });
  }

  return schedule;
}

export function calculateFlatRate(
  principal: number,
  ratePercent: number,
  termMonths: number
): AmortizationRow[] {
  const totalInterest = (principal * ratePercent * termMonths) / 100;
  const totalPayable = principal + totalInterest;
  const payment = totalPayable / termMonths;
  const monthlyInterest = totalInterest / termMonths;
  const monthlyPrincipal = principal / termMonths;

  const schedule: AmortizationRow[] = [];
  let balance = principal;

  for (let i = 1; i <= termMonths; i++) {
    balance = Math.max(0, balance - monthlyPrincipal);
    schedule.push({
      month: i,
      payment: Math.round(payment),
      principal: Math.round(monthlyPrincipal),
      interest: Math.round(monthlyInterest),
      balance: Math.round(balance),
    });
  }

  return schedule;
}

export function generateAmortization(
  principal: number,
  monthlyRate: number,
  termMonths: number,
  model: "reducing" | "flat"
): AmortizationRow[] {
  if (principal <= 0 || monthlyRate < 0 || termMonths <= 0) return [];
  return model === "reducing"
    ? calculateReducingBalance(principal, monthlyRate, termMonths)
    : calculateFlatRate(principal, monthlyRate, termMonths);
}
