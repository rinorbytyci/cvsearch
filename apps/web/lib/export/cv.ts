import { findCvs, type CvListItem, type CvSearchFilters } from "@/lib/cv/search";

function formatSkillList(skills: CvListItem["skills"]) {
  return skills
    .map((skill) => {
      const parts = [skill.name];
      if (skill.level) {
        parts.push(`(${skill.level})`);
      }
      if (typeof skill.years === "number") {
        parts.push(`${skill.years} yrs`);
      }
      return parts.join(" ");
    })
    .join("; ");
}

function formatLanguages(languages: string[] | undefined) {
  return (languages ?? []).join(", ");
}

function formatDate(value: Date) {
  return value.toISOString();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function createCsv(rows: CvListItem[]): string {
  const header = [
    "Consultant",
    "Title",
    "Seniority",
    "Location",
    "Languages",
    "Availability",
    "Available From",
    "Availability Notes",
    "Skills",
    "Tags",
    "Updated At"
  ];

  const lines = [header.join(",")];

  for (const row of rows) {
    const availability = row.availability.status;
    const availableFrom = row.availability.availableFrom
      ? row.availability.availableFrom.toISOString()
      : "";
    const availabilityNotes = row.availability.notes ?? "";

    const line = [
      JSON.stringify(row.consultant.name),
      JSON.stringify(row.consultant.title ?? ""),
      JSON.stringify(row.consultant.seniority ?? ""),
      JSON.stringify(row.consultant.location ?? ""),
      JSON.stringify(formatLanguages(row.consultant.languages)),
      JSON.stringify(availability),
      JSON.stringify(availableFrom),
      JSON.stringify(availabilityNotes),
      JSON.stringify(formatSkillList(row.skills)),
      JSON.stringify((row.tags ?? []).join(",")),
      JSON.stringify(formatDate(row.updatedAt))
    ];

    lines.push(line.join(","));
  }

  return lines.join("\n");
}

export function createExcelBuffer(rows: CvListItem[]): Buffer {
  const headers = [
    "Consultant",
    "Title",
    "Seniority",
    "Location",
    "Languages",
    "Availability",
    "Available From",
    "Availability Notes",
    "Skills",
    "Tags",
    "Updated At"
  ];

  const headerRow = `<tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>`;

  const bodyRows = rows
    .map((row) => {
      const cells = [
        escapeHtml(row.consultant.name),
        escapeHtml(row.consultant.title ?? ""),
        escapeHtml(row.consultant.seniority ?? ""),
        escapeHtml(row.consultant.location ?? ""),
        escapeHtml(formatLanguages(row.consultant.languages)),
        escapeHtml(row.availability.status),
        escapeHtml(
          row.availability.availableFrom ? row.availability.availableFrom.toISOString() : ""
        ),
        escapeHtml(row.availability.notes ?? ""),
        escapeHtml(formatSkillList(row.skills)),
        escapeHtml((row.tags ?? []).join(", ")),
        escapeHtml(formatDate(row.updatedAt))
      ];

      return `<tr>${cells.map((cell) => `<td>${cell}</td>`).join("")}</tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body><table>${headerRow}${bodyRows}</table></body></html>`;

  return Buffer.from(html, "utf-8");
}

export async function collectCvRows(filters: CvSearchFilters, maxRows = 500) {
  const { results, total } = await findCvs(filters, { page: 1, pageSize: maxRows });
  return { rows: results, total };
}

