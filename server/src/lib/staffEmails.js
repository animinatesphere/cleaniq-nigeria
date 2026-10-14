// Welcome / password emails for cleaners and admin staff.
const { layout, detailsTable } = require("./email");
const { escapeHtml } = require("./text");

function staffEmails(config) {
  const appLinks = `<p style="font-size:14px;color:#334155;line-height:1.6">Get the Cleaniq Worker app: <a href="${config.frontendUrl}/app/worker" style="color:#036847;font-weight:700">download links</a>. Log in with the details above, then choose your own password.</p>`;
  return {
    workerWelcome: (w, password) => ({
      subject: "Welcome to the Cleaniq team",
      type: "worker-welcome",
      html: layout(config, {
        title: `Welcome to Cleaniq, ${escapeHtml(w.firstName)}!`,
        intro: "Your cleaner account is ready. Here are your login details for the Cleaniq Worker app:",
        bodyHtml: detailsTable([["Login", w.email], ["Temporary password", password]]) + appLinks,
      }),
    }),
    workerPasswordReset: (w, password) => ({
      subject: "Your new Cleaniq password",
      type: "worker-password-reset",
      html: layout(config, {
        title: "Your password has been reset",
        intro: `Hi ${escapeHtml(w.firstName)}, here's a new temporary password for the Cleaniq Worker app. Please change it after you log in.`,
        bodyHtml: detailsTable([["Login", w.email], ["Temporary password", password]]),
      }),
    }),
    adminInvite: (a, password) => ({
      subject: "Your Cleaniq admin account",
      type: "admin-invite",
      html: layout(config, {
        title: `Hi ${escapeHtml(a.name)}, your admin account is ready`,
        intro: `You've been added to the Cleaniq Nigeria admin as <strong>${escapeHtml(a.role)}</strong>. You'll be asked to choose a new password when you first log in.`,
        bodyHtml: detailsTable([["Login", a.email], ["Temporary password", password]]),
        button: { label: "Open the admin", url: `${config.frontendUrl}/admin` },
      }),
    }),
    adminPasswordReset: (a, password) => ({
      subject: "Your new Cleaniq admin password",
      type: "admin-password-reset",
      html: layout(config, {
        title: "Your admin password has been reset",
        intro: "Use this temporary password to log in; you'll be asked to choose a new one.",
        bodyHtml: detailsTable([["Login", a.email], ["Temporary password", password]]),
        button: { label: "Open the admin", url: `${config.frontendUrl}/admin` },
      }),
    }),
    applicationReceived: (a) => ({
      subject: "We've received your application — Cleaniq",
      type: "applicant-received",
      html: layout(config, {
        title: `Thanks for applying, ${escapeHtml(a.firstName)}!`,
        intro: "We've received your application to join the Cleaniq team in Lagos. We'll be in touch soon.",
      }),
    }),
  };
}

module.exports = { staffEmails };
