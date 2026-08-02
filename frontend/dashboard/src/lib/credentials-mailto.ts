/** Build a mailto: link so admin can send credentials from their own mailbox. */
export function credentialsMailto(opts: {
  to: string;
  name?: string;
  role?: string;
  temporaryPassword: string;
  loginUrl?: string;
}): string {
  const login = opts.loginUrl || (typeof window !== "undefined" ? `${window.location.origin}/login` : "https://www.shikshalab.com/login");
  const display = (opts.name || opts.to).trim();
  const role = (opts.role || "STUDENT").toLowerCase();
  const subject = `Your ShikshaLab ${role} account`;
  const body = [
    `Hello ${display},`,
    "",
    `An administrator created a ${role} account for you on ShikshaLab.`,
    "",
    "Login credentials:",
    `Email: ${opts.to}`,
    `Temporary password: ${opts.temporaryPassword}`,
    "",
    `Sign in at: ${login}`,
    "You will be asked to change your password on first login.",
    "",
    "— ShikshaLab",
  ].join("\n");
  return `mailto:${encodeURIComponent(opts.to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
