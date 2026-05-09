export type LowLeaveTemplateInput = {
  employeeName: string;
  leaveTypeLabel: string;
  remainingDays: number;
  thresholdDays: number;
};

export function buildSimpleHrTemplate(input: {
  greetingName?: string;
  intro?: string;
  lines: string[];
  closing?: string;
}) {
  const greeting = input.greetingName ? `Good day ${input.greetingName},` : "Good day,";
  const intro = input.intro ?? "This is an automated notification from Local DB HR.";
  const closing = input.closing ?? "Please contact HR for clarification.";
  const text = [greeting, "", intro, "", ...input.lines, "", closing, "", "Regards,", "HR Administration"].join(
    "\n",
  );
  return text;
}

export type ContractExpiryTemplateInput = {
  employeeName: string;
  contractEndDateLabel: string;
  daysRemaining: number;
};

export type ContractExpiredTemplateInput = {
  employeeName: string;
  contractEndDateLabel: string;
};

export function buildLowLeaveTemplate(input: LowLeaveTemplateInput) {
  const subject = `Low ${input.leaveTypeLabel} Balance Alert`;
  const text = [
    `Good day ${input.employeeName},`,
    "",
    "This is an automated notification from Local DB HR.",
    "",
    `Your ${input.leaveTypeLabel.toLowerCase()} leave balance is currently ${input.remainingDays} day(s), which is at or below the configured warning threshold of ${input.thresholdDays} day(s).`,
    "",
    "Please contact HR if you require clarification.",
    "",
    "Regards,",
    "HR Administration",
  ].join("\n");
  return { subject, text };
}

export function buildContractExpiryTemplate(input: ContractExpiryTemplateInput) {
  const subject = "Contract Expiry Notice";
  const text = [
    `Good day ${input.employeeName},`,
    "",
    "This is an automated notification from Local DB HR.",
    "",
    `Your current contract is scheduled to end on ${input.contractEndDateLabel}, which is ${input.daysRemaining} day(s) from today.`,
    "",
    "Please contact HR for further guidance.",
    "",
    "Regards,",
    "HR Administration",
  ].join("\n");
  return { subject, text };
}

export function buildContractExpiredTemplate(input: ContractExpiredTemplateInput) {
  const subject = "Contract Expired - No Current Contract";
  const text = [
    `Good day ${input.employeeName},`,
    "",
    "This is an automated notification from Local DB HR.",
    "",
    `Our records indicate that your contract ended on ${input.contractEndDateLabel} and there is no current active contract on file.`,
    "",
    "Please contact HR for further guidance.",
    "",
    "Regards,",
    "HR Administration",
  ].join("\n");
  return { subject, text };
}

export function buildEmployeeProfileUpdatedTemplate(input: {
  employeeName: string;
  changedFields?: string[];
}) {
  const fieldLine =
    input.changedFields && input.changedFields.length > 0
      ? `Updated fields: ${input.changedFields.slice(0, 6).join(", ")}.`
      : null;
  return {
    subject: "Employee Profile Updated",
    text: buildSimpleHrTemplate({
      greetingName: input.employeeName,
      lines: [
        "Your employee profile was updated.",
        ...(fieldLine ? [fieldLine] : []),
      ],
      closing: "Please contact HR if you require clarification or if this update was not expected.",
    }),
  };
}

export function buildNewContractRecordedTemplate(input: {
  employeeName: string;
  contractNumber: string;
  position: string;
  startDate: string;
  endDate: string;
}) {
  return {
    subject: "New Contract Recorded",
    text: buildSimpleHrTemplate({
      greetingName: input.employeeName,
      lines: [
        "A new contract has been recorded for you.",
        `Contract No.: ${input.contractNumber}`,
        `Position: ${input.position}`,
        `Start Date: ${input.startDate}`,
        `End Date: ${input.endDate}`,
      ],
      closing: "Please contact HR if you require clarification.",
    }),
  };
}
